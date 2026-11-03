CREATE TABLE app_private.recipe_photos (
  recipe_version_id uuid PRIMARY KEY REFERENCES app_private.recipe_versions(id) ON DELETE CASCADE,
  url text NOT NULL CHECK(char_length(url)<=2048 AND (url ~ '^/recipes/[a-z0-9-]+\.(png|webp|jpg|jpeg)$' OR app_private.recipe_json_url(to_jsonb(url)))),
  alt text NOT NULL CHECK(char_length(btrim(alt)) BETWEEN 1 AND 300),
  credit text NOT NULL CHECK(char_length(btrim(credit)) BETWEEN 1 AND 500),
  generated boolean NOT NULL DEFAULT false
);
ALTER TABLE app_private.recipe_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_private.recipe_photos FORCE ROW LEVEL SECURITY;
REVOKE ALL ON app_private.recipe_photos FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON app_private.recipe_photos TO cookly_api;
CREATE POLICY recipe_photos_executor_read ON app_private.recipe_photos FOR SELECT TO cookly_api USING(true);
CREATE TRIGGER guard_recipe_content BEFORE INSERT OR UPDATE OR DELETE ON app_private.recipe_photos FOR EACH ROW EXECUTE FUNCTION app_private.guard_recipe_content();

CREATE TABLE app_private.recipe_action_operations (
  owner_id uuid NOT NULL REFERENCES app_private.profiles(id) ON DELETE CASCADE,
  operation_id uuid NOT NULL,
  recipe_id uuid NOT NULL REFERENCES app_private.recipes(id) ON DELETE CASCADE,
  payload jsonb NOT NULL,
  kind text NOT NULL CHECK(kind IN ('favorite','shopping','cooked')),
  added_count integer NOT NULL DEFAULT 0 CHECK(added_count BETWEEN 0 AND 50),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(owner_id,operation_id)
);
CREATE INDEX recipe_action_history_idx ON app_private.recipe_action_operations(owner_id,recipe_id,kind,created_at DESC);
ALTER TABLE app_private.recipe_action_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_private.recipe_action_operations FORCE ROW LEVEL SECURITY;
REVOKE ALL ON app_private.recipe_action_operations FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT ON app_private.recipe_action_operations TO cookly_api;
CREATE POLICY recipe_actions_read ON app_private.recipe_action_operations FOR SELECT TO cookly_api USING(owner_id=(SELECT cookly_security.current_uid()));
CREATE POLICY recipe_actions_insert ON app_private.recipe_action_operations FOR INSERT TO cookly_api WITH CHECK(owner_id=(SELECT cookly_security.current_uid()));

CREATE FUNCTION api.recipe_detail_metadata(p_slug text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE recipe_id uuid; version_id uuid; revision integer; payload jsonb; photo jsonb; nutrition jsonb;
BEGIN
  IF p_slug IS NULL OR char_length(p_slug)>100 OR p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' THEN RAISE EXCEPTION 'Invalid slug' USING ERRCODE='22023'; END IF;
  SELECT r.id,v.id,v.version_number,s.payload INTO recipe_id,version_id,revision,payload
    FROM app_private.recipes r JOIN app_private.recipe_versions v ON v.id=r.current_version_id
    LEFT JOIN app_private.recipe_seed_records s ON s.recipe_version_id=v.id
    WHERE r.slug=p_slug AND r.status='published' AND v.status='published';
  IF NOT FOUND THEN RAISE EXCEPTION 'Recipe unavailable' USING ERRCODE='P0002'; END IF;
  SELECT jsonb_build_object('url',p.url,'alt',p.alt,'credit',p.credit,'generated',p.generated) INTO photo FROM app_private.recipe_photos p WHERE p.recipe_version_id=version_id;
  nutrition:=CASE WHEN payload#>>'{nutrition,status}'='verified' THEN jsonb_build_object('status','verified','perServing',payload#>'{nutrition,perServing}','source',payload#>'{nutrition,source}') ELSE jsonb_build_object('status','unavailable','perServing',NULL,'source',NULL) END;
  RETURN jsonb_build_object('recipeId',recipe_id,'revision',revision,'photo',photo,'stepTimers',(SELECT coalesce(jsonb_agg(s.timer_seconds ORDER BY s.step_number),'[]'::jsonb) FROM app_private.recipe_steps s WHERE s.recipe_version_id=version_id),'nutrition',nutrition);
END;
$$;
CREATE FUNCTION api.get_recipe_actions(p_slug text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
<<recipe_state>>
DECLARE actor uuid:=cookly_security.current_uid(); recipe_id uuid;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
  SELECT r.id INTO recipe_id FROM app_private.recipes r JOIN app_private.recipe_versions v ON v.id=r.current_version_id WHERE r.slug=p_slug AND r.status='published' AND v.status='published';
  IF NOT FOUND THEN RAISE EXCEPTION 'Recipe unavailable' USING ERRCODE='P0002'; END IF;
  RETURN jsonb_build_object('favorite',EXISTS(SELECT 1 FROM app_private.favorites f WHERE f.owner_id=actor AND f.recipe_id=recipe_state.recipe_id),
    'lastCookedAt',(SELECT max(o.created_at) FROM app_private.recipe_action_operations o WHERE o.owner_id=actor AND o.recipe_id=recipe_state.recipe_id AND o.kind='cooked'),'addedCount',0);
END;
$$;
CREATE FUNCTION api.apply_recipe_action(p_slug text,p_revision integer,p_operation_id uuid,p_command jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
<<recipe_action>>
DECLARE actor uuid:=cookly_security.current_uid(); recipe_id uuid; version_id uuid; revision integer; signature jsonb; previous jsonb; added integer:=0; list_id uuid; line jsonb; ingredient_id uuid; unit_id uuid; label text; state jsonb;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
  IF p_operation_id IS NULL OR p_revision IS NULL OR p_revision<1 OR jsonb_typeof(p_command) IS DISTINCT FROM 'object' OR octet_length(p_command::text)>65536 THEN RAISE EXCEPTION 'Invalid command' USING ERRCODE='22023'; END IF;
  PERFORM 1 FROM app_private.profiles WHERE id=actor FOR UPDATE;
  SELECT r.id,v.id,v.version_number INTO recipe_id,version_id,revision FROM app_private.recipes r JOIN app_private.recipe_versions v ON v.id=r.current_version_id WHERE r.slug=p_slug AND r.status='published' AND v.status='published';
  IF NOT FOUND THEN RAISE EXCEPTION 'Recipe unavailable' USING ERRCODE='P0002'; END IF;
  signature:=jsonb_build_object('slug',p_slug,'revision',p_revision,'command',p_command);
  SELECT o.payload,o.added_count INTO previous,added FROM app_private.recipe_action_operations o WHERE o.owner_id=actor AND o.operation_id=p_operation_id;
  IF FOUND THEN
    IF previous IS DISTINCT FROM signature THEN RAISE EXCEPTION 'Operation conflict' USING ERRCODE='22023'; END IF;
    RETURN api.get_recipe_actions(p_slug)||jsonb_build_object('addedCount',added);
  END IF;
  added:=0;
  IF p_revision<>revision THEN RAISE EXCEPTION 'Recipe revision changed' USING ERRCODE='40001'; END IF;
  IF p_command->>'kind'='favorite' THEN
    IF NOT app_private.recipe_json_keys(p_command,ARRAY['kind','enabled']) OR jsonb_typeof(p_command->'enabled') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'Invalid favorite' USING ERRCODE='22023'; END IF;
    PERFORM api.set_favorite(recipe_id,(p_command->>'enabled')::boolean);
  ELSIF p_command->>'kind'='cooked' THEN
    IF NOT app_private.recipe_json_keys(p_command,ARRAY['kind','servings']) OR jsonb_typeof(p_command->'servings') IS DISTINCT FROM 'number' OR (p_command->>'servings')::numeric<>trunc((p_command->>'servings')::numeric) OR (p_command->>'servings')::numeric NOT BETWEEN 1 AND 20 THEN RAISE EXCEPTION 'Invalid portions' USING ERRCODE='22023'; END IF;
  ELSIF p_command->>'kind'='shopping' THEN
    IF NOT app_private.recipe_json_keys(p_command,ARRAY['kind','items']) OR jsonb_typeof(p_command->'items') IS DISTINCT FROM 'array' OR jsonb_array_length(p_command->'items') NOT BETWEEN 1 AND 50 THEN RAISE EXCEPTION 'Invalid shopping batch' USING ERRCODE='22023'; END IF;
    IF (SELECT count(DISTINCT (i->>'ingredientSlug',i->>'unitCode')) FROM jsonb_array_elements(p_command->'items') i)<>jsonb_array_length(p_command->'items') THEN RAISE EXCEPTION 'Duplicate shopping line' USING ERRCODE='22023'; END IF;
    SELECT s.id INTO list_id FROM app_private.shopping_lists s WHERE s.owner_id=actor AND s.status='active' FOR UPDATE;
    IF list_id IS NULL THEN list_id:=api.save_shopping_list(NULL,NULL,'Cumpărături din rețete','active'); END IF;
    FOR line IN SELECT value FROM jsonb_array_elements(p_command->'items') LOOP
      IF NOT app_private.recipe_json_keys(line,ARRAY['ingredientSlug','label','quantity','unitCode']) OR jsonb_typeof(line->'ingredientSlug') IS DISTINCT FROM 'string' OR NOT app_private.recipe_json_text(line->'label',120)
        OR jsonb_typeof(line->'quantity') IS DISTINCT FROM 'string' OR coalesce(line->>'quantity','') !~ '^(0|[1-9][0-9]{0,11})(\.[0-9]{1,6})?$' OR (line->>'quantity')::numeric<=0
        OR coalesce(line->>'unitCode','') NOT IN ('g','kg','ml','l','piece') OR (line->>'unitCode'='piece' AND (line->>'quantity')::numeric<>trunc((line->>'quantity')::numeric)) THEN RAISE EXCEPTION 'Invalid shopping quantity' USING ERRCODE='22023'; END IF;
      SELECT i.id,u.id,i.name INTO ingredient_id,unit_id,label FROM app_private.ingredients i JOIN app_private.ingredient_units iu ON iu.ingredient_id=i.id JOIN app_private.units u ON u.id=iu.unit_id
        WHERE i.slug=line->>'ingredientSlug' AND i.is_active AND u.code=line->>'unitCode' AND EXISTS(SELECT 1 FROM app_private.recipe_ingredients ri WHERE ri.recipe_version_id=version_id AND ri.ingredient_id=i.id);
      IF NOT FOUND THEN RAISE EXCEPTION 'Ingredient or unit not permitted' USING ERRCODE='22023'; END IF;
      PERFORM api.save_shopping_item(NULL,NULL,list_id,label,ingredient_id,line->>'quantity',unit_id);
      added:=added+1;
    END LOOP;
  ELSE RAISE EXCEPTION 'Unknown action' USING ERRCODE='22023';
  END IF;
  INSERT INTO app_private.recipe_action_operations(owner_id,operation_id,recipe_id,payload,kind,added_count) VALUES(actor,p_operation_id,recipe_id,signature,p_command->>'kind',added);
  state:=api.get_recipe_actions(p_slug);
  RETURN state||jsonb_build_object('addedCount',added);
END;
$$;
GRANT CREATE ON SCHEMA api TO cookly_api;
ALTER FUNCTION api.recipe_detail_metadata(text) OWNER TO cookly_api;
ALTER FUNCTION api.get_recipe_actions(text) OWNER TO cookly_api;
ALTER FUNCTION api.apply_recipe_action(text,integer,uuid,jsonb) OWNER TO cookly_api;
REVOKE CREATE ON SCHEMA api FROM cookly_api;
REVOKE ALL ON FUNCTION api.recipe_detail_metadata(text),api.get_recipe_actions(text),api.apply_recipe_action(text,integer,uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION api.recipe_detail_metadata(text) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION api.get_recipe_actions(text),api.apply_recipe_action(text,integer,uuid,jsonb) TO authenticated;
NOTIFY pgrst,'reload schema';
