-- Bounded public snapshot: current published content only, no personal data.
CREATE FUNCTION api.recipe_search_snapshot() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
  IF (SELECT count(*) FROM app_private.recipes r JOIN app_private.recipe_versions v ON v.id=r.current_version_id WHERE r.status='published' AND v.status='published')>1000 THEN
    RAISE EXCEPTION 'Search catalog capacity exceeded' USING ERRCODE='54000';
  END IF;
  WITH current_recipes AS (
    SELECT r.slug,v.*,s.base_servings,seed.payload
    FROM app_private.recipes r JOIN app_private.recipe_versions v ON v.id=r.current_version_id
    JOIN app_private.recipe_servings s ON s.recipe_version_id=v.id
    LEFT JOIN app_private.recipe_seed_records seed ON seed.recipe_version_id=v.id
    WHERE r.status='published' AND v.status='published'
  ), content AS (
    SELECT jsonb_build_object(
      'id',c.recipe_id,'key',c.slug,'revision',c.version_number,'dataClass',c.data_class,
      'title',c.title,'summary',coalesce(c.summary,''),'servings',c.base_servings,
      'totalMinutes',c.total_minutes,'difficulty',c.difficulty,
      'mealTypes',coalesce(c.payload->'mealTypes',(SELECT jsonb_agg(t.slug ORDER BY t.slug) FROM app_private.recipe_tags rt JOIN app_private.tags t ON t.id=rt.tag_id WHERE rt.recipe_version_id=c.id AND t.slug IN ('breakfast','lunch','dinner','dessert')),'[]'::jsonb),
      'cuisines',coalesce((SELECT jsonb_agg(t.slug ORDER BY t.slug) FROM app_private.recipe_tags rt JOIN app_private.tags t ON t.id=rt.tag_id WHERE rt.recipe_version_id=c.id AND t.kind='cuisine'),'[]'::jsonb),
      'diets',coalesce((SELECT jsonb_agg(t.slug ORDER BY t.slug) FROM app_private.recipe_tags rt JOIN app_private.tags t ON t.id=rt.tag_id WHERE rt.recipe_version_id=c.id AND t.kind='diet'),'[]'::jsonb),
      'tags',coalesce((SELECT jsonb_agg(t.slug ORDER BY t.slug) FROM app_private.recipe_tags rt JOIN app_private.tags t ON t.id=rt.tag_id WHERE rt.recipe_version_id=c.id),'[]'::jsonb),
      'equipment',coalesce((SELECT jsonb_agg(e.code ORDER BY e.code) FROM app_private.recipe_equipment re JOIN app_private.equipment_types e ON e.id=re.equipment_id WHERE re.recipe_version_id=c.id),'[]'::jsonb),
      'ingredients',(SELECT jsonb_agg(jsonb_build_object('ingredientSlug',i.slug,'name',i.name,'quantity',ri.quantity::text,'unit',u.code,'optional',ri.is_optional,'preparation',coalesce(ri.preparation_note,'')) ORDER BY ri.position) FROM app_private.recipe_ingredients ri JOIN app_private.ingredients i ON i.id=ri.ingredient_id JOIN app_private.units u ON u.id=ri.unit_id WHERE ri.recipe_version_id=c.id),
      'steps',(SELECT jsonb_agg(s.instruction ORDER BY s.step_number) FROM app_private.recipe_steps s WHERE s.recipe_version_id=c.id),
      'allergens',jsonb_build_object('status',CASE WHEN c.payload#>>'{allergens,status}'='verified' THEN 'verified' ELSE 'unverified' END,
        'contains',coalesce((SELECT jsonb_agg(a.code ORDER BY a.code) FROM app_private.recipe_allergens ra JOIN app_private.allergens a ON a.id=ra.allergen_id WHERE ra.recipe_version_id=c.id AND ra.relation='contains'),'[]'::jsonb),
        'mayContain',coalesce((SELECT jsonb_agg(a.code ORDER BY a.code) FROM app_private.recipe_allergens ra JOIN app_private.allergens a ON a.id=ra.allergen_id WHERE ra.recipe_version_id=c.id AND ra.relation='may_contain'),'[]'::jsonb)),
      'nutrition',CASE WHEN c.payload#>>'{nutrition,status}'='verified' THEN jsonb_build_object('calories',c.payload#>>'{nutrition,perServing,energyKcal}','protein',c.payload#>>'{nutrition,perServing,proteinG}') ELSE 'null'::jsonb END,
      'budget',CASE WHEN c.payload#>>'{budget,status}'='verified' THEN jsonb_build_object('amount',c.payload#>>'{budget,perServing}','currency',c.payload#>>'{budget,currency}') ELSE 'null'::jsonb END
    ) AS data,c.slug FROM current_recipes c
  ), used_ingredients AS (
    SELECT DISTINCT i.* FROM app_private.ingredients i JOIN app_private.recipe_ingredients ri ON ri.ingredient_id=i.id JOIN current_recipes c ON c.id=ri.recipe_version_id
  )
  SELECT jsonb_build_object('recipes',coalesce((SELECT jsonb_agg(data ORDER BY slug) FROM content),'[]'::jsonb),
    'catalog',jsonb_build_object('ingredients',coalesce((SELECT jsonb_agg(jsonb_build_object(
      'slug',i.slug,'name',i.name,'active',i.is_active,
      'units',coalesce((SELECT jsonb_agg(u.code ORDER BY u.code) FROM app_private.ingredient_units iu JOIN app_private.units u ON u.id=iu.unit_id WHERE iu.ingredient_id=i.id),'[]'::jsonb),
      'aliases',coalesce((SELECT jsonb_agg(jsonb_build_object('locale',a.locale,'label',a.alias) ORDER BY a.locale,a.alias) FROM app_private.ingredient_aliases a WHERE a.ingredient_id=i.id AND a.locale IN ('ro-RO','ru-RU','en-GB')),'[]'::jsonb),
      'allergenHints',coalesce((SELECT jsonb_agg(a.code ORDER BY a.code) FROM app_private.ingredient_allergens ia JOIN app_private.allergens a ON a.id=ia.allergen_id WHERE ia.ingredient_id=i.id),'[]'::jsonb)
    ) ORDER BY i.slug) FROM used_ingredients i),'[]'::jsonb))) INTO result;
  RETURN result;
END;
$$;

CREATE FUNCTION api.recipe_search_context() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE pantry jsonb; actor uuid;
BEGIN
  pantry:=api.get_my_pantry(); -- Enforces active account and derives identity from verified claims.
  actor:=(pantry->>'ownerId')::uuid;
  RETURN jsonb_build_object('accountId',actor,'items',pantry->'items',
    'allergies',coalesce((SELECT jsonb_agg(a.code ORDER BY a.code) FROM app_private.user_allergen_exclusions ua JOIN app_private.allergens a ON a.id=ua.allergen_id WHERE ua.profile_id=actor),'[]'::jsonb),
    'excludedIngredients',coalesce((SELECT jsonb_agg(i.slug ORDER BY i.slug) FROM app_private.user_ingredient_exclusions ui JOIN app_private.ingredients i ON i.id=ui.ingredient_id WHERE ui.profile_id=actor),'[]'::jsonb));
END;
$$;
GRANT CREATE ON SCHEMA api TO cookly_api;
ALTER FUNCTION api.recipe_search_snapshot() OWNER TO cookly_api;
ALTER FUNCTION api.recipe_search_context() OWNER TO cookly_api;
REVOKE CREATE ON SCHEMA api FROM cookly_api;
REVOKE ALL ON FUNCTION api.recipe_search_snapshot(),api.recipe_search_context() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION api.recipe_search_snapshot() TO anon,authenticated;
GRANT EXECUTE ON FUNCTION api.recipe_search_context() TO authenticated;
NOTIFY pgrst,'reload schema';
