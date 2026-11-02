-- Read-only RPCs, same public data for anonymous and authenticated callers.
CREATE FUNCTION app_private.ingredient_summary(p_id uuid,p_locale text,p_matched text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
  SELECT jsonb_build_object('id',i.id,'slug',i.slug,'canonicalName',i.name,
    'name',CASE WHEN p_locale='ro-RO' THEN i.name ELSE coalesce((SELECT alias FROM app_private.ingredient_aliases a WHERE a.ingredient_id=i.id AND a.locale=p_locale AND a.is_preferred),i.name) END,
    'matchedTerm',p_matched,'kind',i.identity_kind,
    'category',CASE WHEN c.id IS NULL THEN NULL ELSE jsonb_build_object('id',c.id,'slug',c.slug,'name',c.name) END,
    'broader',CASE WHEN b.id IS NULL THEN NULL ELSE jsonb_build_object('id',b.id,'name',b.name,'relation',i.broader_relation) END)
  FROM app_private.ingredients i LEFT JOIN app_private.ingredient_categories c ON c.id=i.category_id
    LEFT JOIN app_private.ingredients b ON b.id=i.broader_ingredient_id AND b.is_active
  WHERE i.id=p_id AND i.is_active;
$$;
REVOKE ALL ON FUNCTION app_private.ingredient_summary(uuid,text,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION app_private.ingredient_summary(uuid,text,text) TO anon,authenticated;

CREATE FUNCTION api.search_ingredients(p_query text DEFAULT '',p_locale text DEFAULT 'ro-RO',p_category_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 20,p_version text DEFAULT NULL,p_after_rank integer DEFAULT NULL,p_after_name text DEFAULT NULL,p_after_id uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE key text; terms text[]; search tsquery; revision text; result jsonb;
BEGIN
  IF p_query IS NULL OR char_length(p_query)>80 OR p_locale IS NULL OR p_locale NOT IN ('ro-RO','ru-RU','en-GB')
    OR p_limit IS NULL OR p_limit<1 OR p_limit>50 OR num_nonnulls(p_after_rank,p_after_name,p_after_id) NOT IN (0,3)
    OR p_after_rank<0 OR p_after_rank>6 OR char_length(p_after_name)>240 THEN
    RAISE EXCEPTION 'Invalid catalog query' USING ERRCODE='22023';
  END IF;
  key:=app_private.ingredient_search_key(p_query);
  IF btrim(p_query)<>'' AND (char_length(key)<2 OR key='') THEN RAISE EXCEPTION 'Invalid catalog query' USING ERRCODE='22023'; END IF;
  terms:=string_to_array(key,' ');
  IF cardinality(terms)>8 THEN RAISE EXCEPTION 'Too many query terms' USING ERRCODE='22023'; END IF;
  SELECT s.revision::text INTO revision FROM app_private.ingredient_catalog_state s WHERE singleton;
  IF revision IS NULL THEN RAISE EXCEPTION 'Catalog unavailable' USING ERRCODE='55000'; END IF;
  IF p_after_id IS NOT NULL AND p_version IS NULL THEN RAISE EXCEPTION 'Catalog revision required' USING ERRCODE='22023'; END IF;
  IF p_version IS NOT NULL AND p_version<>revision THEN RAISE EXCEPTION 'Catalog changed' USING ERRCODE='40001'; END IF;
  IF key<>'' THEN SELECT to_tsquery('simple'::regconfig,string_agg(quote_literal(term)||':*',' & ')) INTO search FROM unnest(terms) term; END IF;
  WITH hits AS (
    SELECT i.id,CASE WHEN key='' OR i.search_key=key THEN 0 WHEN starts_with(i.search_key,key) THEN 2 ELSE 4 END AS rank,i.name AS matched
      FROM app_private.ingredients i WHERE i.is_active AND (p_category_id IS NULL OR i.category_id=p_category_id) AND (key='' OR i.search_document@@search)
    UNION ALL
    SELECT i.id,CASE WHEN a.search_key=key THEN 1 WHEN starts_with(a.search_key,key) THEN 3 ELSE 5 END,a.alias
      FROM app_private.ingredient_aliases a JOIN app_private.ingredients i ON i.id=a.ingredient_id
      WHERE key<>'' AND i.is_active AND (p_category_id IS NULL OR i.category_id=p_category_id) AND a.search_document@@search
  ), best AS (
    SELECT DISTINCT ON(id) id,rank,matched FROM hits ORDER BY id,rank,matched COLLATE "C"
  ), selected AS (
    SELECT b.*,i.search_key AS sort_name FROM best b JOIN app_private.ingredients i ON i.id=b.id
      WHERE p_after_id IS NULL OR (b.rank,i.search_key COLLATE "C",i.id)>(p_after_rank,p_after_name COLLATE "C",p_after_id)
      ORDER BY b.rank,i.search_key COLLATE "C",i.id LIMIT p_limit+1
  ), visible AS (SELECT * FROM selected ORDER BY rank,sort_name COLLATE "C",id LIMIT p_limit)
  SELECT jsonb_build_object('version',revision,
    'items',coalesce((SELECT jsonb_agg(app_private.ingredient_summary(id,p_locale,CASE WHEN key='' THEN NULL ELSE matched END) ORDER BY rank,sort_name COLLATE "C",id) FROM visible),'[]'::jsonb),
    'next',CASE WHEN (SELECT count(*) FROM selected)>p_limit THEN
      (SELECT jsonb_build_object('rank',rank,'name',sort_name,'id',id) FROM visible ORDER BY rank DESC,sort_name COLLATE "C" DESC,id DESC LIMIT 1) ELSE NULL END)
    INTO result;
  RETURN result;
END;
$$;

CREATE FUNCTION api.get_ingredient(p_id uuid,p_locale text DEFAULT 'ro-RO') RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE summary jsonb; nutrition jsonb;
BEGIN
  IF p_locale IS NULL OR p_locale NOT IN ('ro-RO','ru-RU','en-GB') THEN RAISE EXCEPTION 'Invalid locale' USING ERRCODE='22023'; END IF;
  summary:=app_private.ingredient_summary(p_id,p_locale,NULL);
  IF summary IS NULL THEN RAISE EXCEPTION 'Ingredient unavailable' USING ERRCODE='P0002'; END IF;
  SELECT jsonb_build_object('status',CASE WHEN num_nonnulls(n.energy_kcal,n.protein_g,n.carbohydrate_g,n.fat_g,n.fiber_g,n.salt_g)=6 THEN 'available' ELSE 'partial' END,
    'basis','100g','energyKcal',n.energy_kcal::text,'proteinG',n.protein_g::text,'carbohydrateG',n.carbohydrate_g::text,'fatG',n.fat_g::text,'fiberG',n.fiber_g::text,'saltG',n.salt_g::text,
    'source',jsonb_build_object('name',s.name,'url',s.reference_url,'recordKey',n.source_record_key,'revision',n.source_revision,
      'observedOn',n.observed_on,'verifiedAt',n.verified_at,'foodDescription',n.source_food_description)) INTO nutrition
    FROM app_private.nutrition_data n JOIN app_private.data_sources s ON s.id=n.source_id
      JOIN app_private.ingredients i ON i.id=n.ingredient_id
    WHERE n.ingredient_id=p_id AND i.identity_kind='specific' AND n.verification_status='verified'
      AND s.reference_url ~ '^https?://' AND nullif(btrim(s.license),'') IS NOT NULL
    ORDER BY n.observed_on DESC,n.source_revision DESC,n.id LIMIT 1;
  RETURN summary || jsonb_build_object(
    'aliases',coalesce((SELECT jsonb_agg(jsonb_build_object('locale',locale,'label',alias,'preferred',is_preferred) ORDER BY locale,is_preferred DESC,alias) FROM app_private.ingredient_aliases WHERE ingredient_id=p_id),'[]'::jsonb),
    'units',coalesce((SELECT jsonb_agg(jsonb_build_object('id',u.id,'code',u.code,'name',u.name,'dimension',u.dimension,'isDefault',iu.is_default) ORDER BY iu.is_default DESC,u.code)
      FROM app_private.ingredient_units iu JOIN app_private.units u ON u.id=iu.unit_id WHERE iu.ingredient_id=p_id),'[]'::jsonb),
    'nutrition',coalesce(nutrition,jsonb_build_object('status','unavailable','basis','100g','energyKcal',NULL,'proteinG',NULL,'carbohydrateG',NULL,'fatG',NULL,'fiberG',NULL,'saltG',NULL,'source',NULL)));
END;
$$;
CREATE FUNCTION api.list_ingredient_categories() RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',c.id,'slug',c.slug,'name',c.name) ORDER BY c.name,c.id),'[]'::jsonb)
  FROM app_private.ingredient_categories c WHERE EXISTS(SELECT 1 FROM app_private.ingredients i WHERE i.category_id=c.id AND i.is_active);
$$;
REVOKE ALL ON FUNCTION api.search_ingredients(text,text,uuid,integer,text,integer,text,uuid),api.get_ingredient(uuid,text),api.list_ingredient_categories()
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION api.search_ingredients(text,text,uuid,integer,text,integer,text,uuid),api.get_ingredient(uuid,text),api.list_ingredient_categories() TO anon,authenticated;
NOTIFY pgrst,'reload schema';
