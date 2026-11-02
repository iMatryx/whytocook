-- Existing 01-04 remain immutable. Expose api only, never app_private/security.
CREATE ROLE cookly_api NOLOGIN NOINHERIT NOBYPASSRLS;
CREATE ROLE cookly_authz NOLOGIN NOINHERIT NOBYPASSRLS;
CREATE ROLE cookly_provisioner NOLOGIN NOINHERIT NOBYPASSRLS;
GRANT cookly_api, cookly_authz, cookly_provisioner TO CURRENT_USER;
CREATE SCHEMA cookly_security;
REVOKE ALL ON SCHEMA cookly_security FROM PUBLIC;
GRANT USAGE ON SCHEMA cookly_security TO anon, authenticated, cookly_api, cookly_authz;
GRANT USAGE ON SCHEMA app_private TO anon, authenticated, cookly_api, cookly_authz, cookly_provisioner;
GRANT USAGE ON SCHEMA api TO anon, authenticated, cookly_api;
GRANT USAGE ON SCHEMA auth TO cookly_api, cookly_authz;
GRANT EXECUTE ON FUNCTION auth.uid(), auth.jwt() TO cookly_api, cookly_authz;
-- Temporary DDL privileges needed to transfer function ownership; revoked below/06.
GRANT CREATE ON SCHEMA cookly_security TO cookly_authz;
GRANT CREATE ON SCHEMA app_private TO cookly_provisioner;
GRANT CREATE ON SCHEMA api TO cookly_api;

GRANT SELECT ON app_private.account_states, app_private.user_roles TO cookly_authz;
CREATE POLICY account_states_authz ON app_private.account_states FOR SELECT TO cookly_authz
  USING (profile_id = (SELECT auth.uid()));
CREATE POLICY user_roles_authz ON app_private.user_roles FOR SELECT TO cookly_authz
  USING (profile_id = (SELECT auth.uid()));

CREATE FUNCTION cookly_security.current_uid() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT profile_id FROM app_private.account_states
  WHERE profile_id = auth.uid() AND status = 'active';
$$;
ALTER FUNCTION cookly_security.current_uid() OWNER TO cookly_authz;
CREATE FUNCTION cookly_security.assigned_roles() RETURNS text[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(array_agg(role ORDER BY role), ARRAY[]::text[]) FROM app_private.user_roles
  WHERE profile_id = cookly_security.current_uid();
$$;
ALTER FUNCTION cookly_security.assigned_roles() OWNER TO cookly_authz;
CREATE FUNCTION cookly_security.can_edit_catalog() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(auth.jwt()->>'aal' = 'aal2', false)
    AND cookly_security.assigned_roles() && ARRAY['editor','admin']::text[];
$$;
ALTER FUNCTION cookly_security.can_edit_catalog() OWNER TO cookly_authz;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA cookly_security FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION cookly_security.current_uid(), cookly_security.can_edit_catalog()
  TO anon, authenticated, cookly_api;
GRANT EXECUTE ON FUNCTION cookly_security.assigned_roles() TO cookly_api;
REVOKE CREATE ON SCHEMA cookly_security FROM cookly_authz;

-- Provision defaults without copying raw_user_meta_data or assigning roles.
GRANT INSERT ON app_private.profiles, app_private.account_states, app_private.user_preferences TO cookly_provisioner;
CREATE POLICY profiles_provision ON app_private.profiles FOR INSERT TO cookly_provisioner WITH CHECK (true);
CREATE POLICY account_states_provision ON app_private.account_states FOR INSERT TO cookly_provisioner WITH CHECK (true);
CREATE POLICY preferences_provision ON app_private.user_preferences FOR INSERT TO cookly_provisioner WITH CHECK (true);
CREATE FUNCTION app_private.provision_profile() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO app_private.profiles(id) VALUES (NEW.id);
  INSERT INTO app_private.account_states(profile_id) VALUES (NEW.id);
  INSERT INTO app_private.user_preferences(profile_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$;
ALTER FUNCTION app_private.provision_profile() OWNER TO cookly_provisioner;
REVOKE ALL ON FUNCTION app_private.provision_profile() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER cookly_provision_profile AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION app_private.provision_profile();
REVOKE CREATE ON SCHEMA app_private FROM cookly_provisioner;
-- Backfill already-existing identities; do not activate previously disabled rows.
INSERT INTO app_private.profiles(id) SELECT id FROM auth.users ON CONFLICT (id) DO NOTHING;
INSERT INTO app_private.account_states(profile_id) SELECT id FROM app_private.profiles ON CONFLICT (profile_id) DO NOTHING;
INSERT INTO app_private.user_preferences(profile_id) SELECT id FROM app_private.profiles ON CONFLICT (profile_id) DO NOTHING;

-- Reference data are safe for public reads; only the executor may write with MFA.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['units','serving_units','ingredient_categories','ingredients','ingredient_aliases',
    'allergens','ingredient_allergens','data_sources','tags','ingredient_unit_conversions',
    'ingredient_substitutions','nutrition_data','ingredient_prices'] LOOP
    EXECUTE format('GRANT SELECT ON app_private.%I TO anon, authenticated, cookly_api',t);
    EXECUTE format('CREATE POLICY reference_read ON app_private.%I FOR SELECT TO anon, authenticated, cookly_api USING (true)',t);
    -- There is deliberately no reference-data write RPC in this stage.
  END LOOP;
END;
$$;
GRANT SELECT ON app_private.recipes, app_private.recipe_versions, app_private.recipe_servings,
  app_private.recipe_ingredients, app_private.recipe_steps, app_private.recipe_tags TO cookly_api;
GRANT SELECT (id,slug,status,current_version_id,created_at,updated_at) ON app_private.recipes TO anon, authenticated;
GRANT SELECT ON app_private.recipe_versions, app_private.recipe_servings,
  app_private.recipe_ingredients, app_private.recipe_steps, app_private.recipe_tags TO anon, authenticated;
CREATE POLICY recipes_read ON app_private.recipes FOR SELECT TO anon, authenticated, cookly_api
  USING (status = 'published' OR (SELECT cookly_security.can_edit_catalog()));
CREATE POLICY versions_read ON app_private.recipe_versions FOR SELECT TO anon, authenticated, cookly_api
  USING ((SELECT cookly_security.can_edit_catalog()) OR (status = 'published' AND EXISTS (
    SELECT 1 FROM app_private.recipes r WHERE r.id = recipe_id AND r.status = 'published' AND r.current_version_id = recipe_versions.id
  )));
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['recipe_servings','recipe_ingredients','recipe_steps','recipe_tags'] LOOP
    EXECUTE format('CREATE POLICY content_read ON app_private.%I FOR SELECT TO anon, authenticated, cookly_api USING (EXISTS (SELECT 1 FROM app_private.recipe_versions v WHERE v.id = recipe_version_id))', t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['recipes','recipe_versions','recipe_servings','recipe_ingredients','recipe_steps','recipe_tags'] LOOP
    EXECUTE format('GRANT INSERT, UPDATE, DELETE ON app_private.%I TO cookly_api',t);
    EXECUTE format('CREATE POLICY catalog_insert ON app_private.%I FOR INSERT TO cookly_api WITH CHECK ((SELECT cookly_security.can_edit_catalog()))',t);
    EXECUTE format('CREATE POLICY catalog_update ON app_private.%I FOR UPDATE TO cookly_api USING ((SELECT cookly_security.can_edit_catalog())) WITH CHECK ((SELECT cookly_security.can_edit_catalog()))',t);
    EXECUTE format('CREATE POLICY catalog_delete ON app_private.%I FOR DELETE TO cookly_api USING ((SELECT cookly_security.can_edit_catalog()))',t);
  END LOOP;
END;
$$;

-- Every personal child gets its own RLS. Admin/editor have no ownership override.
DO $$
DECLARE t text; owner_column text;
BEGIN
  FOREACH t IN ARRAY ARRAY['profiles','user_preferences','user_ingredient_exclusions','user_allergen_exclusions',
    'user_preference_tags','pantry_items','favorites','meal_plans','meal_plan_entries','shopping_lists',
    'shopping_list_items','shopping_list_item_sources','ai_requests'] LOOP
    owner_column := CASE WHEN t = 'profiles' THEN 'id' WHEN t LIKE 'user_%' THEN 'profile_id' ELSE 'owner_id' END;
    EXECUTE format('GRANT SELECT ON app_private.%I TO authenticated, cookly_api',t);
    EXECUTE format('CREATE POLICY own_read ON app_private.%I FOR SELECT TO authenticated, cookly_api USING (%I = (SELECT cookly_security.current_uid()))',t,owner_column);
    IF t IN ('profiles','pantry_items','favorites','meal_plans','meal_plan_entries','shopping_lists','shopping_list_items') THEN
      EXECUTE format('GRANT INSERT, UPDATE, DELETE ON app_private.%I TO cookly_api',t);
      EXECUTE format('CREATE POLICY own_insert ON app_private.%I FOR INSERT TO cookly_api WITH CHECK (%I = (SELECT cookly_security.current_uid()))',t,owner_column);
      EXECUTE format('CREATE POLICY own_update ON app_private.%I FOR UPDATE TO cookly_api USING (%I = (SELECT cookly_security.current_uid())) WITH CHECK (%I = (SELECT cookly_security.current_uid()))',t,owner_column,owner_column);
      EXECUTE format('CREATE POLICY own_delete ON app_private.%I FOR DELETE TO cookly_api USING (%I = (SELECT cookly_security.current_uid()))',t,owner_column);
    END IF;
  END LOOP;
END;
$$;
-- Do not grant profile insertion/deletion or editable security metadata to RPCs.
REVOKE INSERT,DELETE ON app_private.profiles FROM cookly_api;
GRANT INSERT ON app_private.audit_logs TO cookly_api;
GRANT USAGE ON SEQUENCE app_private.audit_logs_id_seq TO cookly_api;
CREATE POLICY audit_append ON app_private.audit_logs FOR INSERT TO cookly_api
  WITH CHECK (actor_profile_id = (SELECT cookly_security.current_uid()));
-- Triggers run as executor; they need only these existing invoker functions.
GRANT EXECUTE ON FUNCTION app_private.normalize_label(text),app_private.touch_row(),
  app_private.guard_recipe_version(),app_private.guard_recipe_content(),
  app_private.guard_current_version(),app_private.guard_meal_entry(),app_private.guard_plan_dates() TO cookly_api;
GRANT EXECUTE ON FUNCTION app_private.normalize_label(text) TO anon, authenticated;

CREATE VIEW api.recipes WITH (security_invoker=true, security_barrier=true) AS
  SELECT r.id,r.slug,v.id AS version_id,v.title,v.summary,v.difficulty,v.active_minutes,v.total_minutes
  FROM app_private.recipes r JOIN app_private.recipe_versions v ON v.id=r.current_version_id
  WHERE r.status='published' AND v.status='published';
DO $$
DECLARE projection text[];
BEGIN
  FOREACH projection SLICE 1 IN ARRAY ARRAY[
    ['recipe_servings','c.recipe_version_id,c.base_servings,c.serving_unit_code'],
    ['recipe_ingredients','c.id,c.recipe_version_id,c.ingredient_id,c.quantity::text AS quantity,c.unit_id,c.is_optional,c.position,c.preparation_note'],
    ['recipe_steps','c.id,c.recipe_version_id,c.step_number,c.instruction,c.timer_seconds'],
    ['recipe_tags','c.recipe_version_id,c.tag_id']
  ] LOOP
    EXECUTE format('CREATE VIEW api.%I WITH (security_invoker=true,security_barrier=true) AS SELECT %s FROM app_private.%I c JOIN app_private.recipe_versions v ON v.id=c.recipe_version_id JOIN app_private.recipes r ON r.id=v.recipe_id AND r.current_version_id=v.id WHERE r.status=''published'' AND v.status=''published''',projection[1],projection[2],projection[1]);
    EXECUTE format('CREATE VIEW api.%I WITH (security_invoker=true,security_barrier=true) AS SELECT %s FROM app_private.%I c WHERE cookly_security.can_edit_catalog()', 'editor_'||projection[1],projection[2],projection[1]);
  END LOOP;
  FOREACH projection SLICE 1 IN ARRAY ARRAY[
    ['ingredients','id,slug,name,category_id,allergen_review_status,is_active'],
    ['ingredient_aliases','id,ingredient_id,locale,alias'],['ingredient_categories','id,slug,name'],
    ['units','id,code,name,dimension,to_base_factor::text AS to_base_factor,is_base'],
    ['tags','id,slug,name,kind'],['allergens','id,code,name'],['ingredient_allergens','ingredient_id,allergen_id,relation']
  ] LOOP
    EXECUTE format('CREATE VIEW api.%I WITH (security_invoker=true,security_barrier=true) AS SELECT %s FROM app_private.%I',projection[1],projection[2],projection[1]);
  END LOOP;
END;
$$;
CREATE VIEW api.my_profile WITH (security_invoker=true,security_barrier=true) AS
  SELECT id,display_name,locale,time_zone,created_at,updated_at FROM app_private.profiles;
CREATE VIEW api.my_pantry WITH (security_invoker=true,security_barrier=true) AS
  SELECT id,owner_id,ingredient_id,quantity::text AS quantity,unit_id,location,expires_on,archived_at,
    revision::text AS revision,created_at,updated_at FROM app_private.pantry_items;
CREATE VIEW api.my_meal_plans WITH (security_invoker=true,security_barrier=true) AS
  SELECT id,owner_id,starts_on,revision::text AS revision,created_at,updated_at FROM app_private.meal_plans;
CREATE VIEW api.my_meal_entries WITH (security_invoker=true,security_barrier=true) AS
  SELECT id,owner_id,meal_plan_id,recipe_version_id,planned_on,meal_slot,servings,
    revision::text AS revision,created_at,updated_at FROM app_private.meal_plan_entries;
CREATE VIEW api.my_shopping_lists WITH (security_invoker=true,security_barrier=true) AS
  SELECT id,owner_id,name,status,revision::text AS revision,created_at,updated_at FROM app_private.shopping_lists;
CREATE VIEW api.my_shopping_items WITH (security_invoker=true,security_barrier=true) AS
  SELECT id,owner_id,shopping_list_id,ingredient_id,label,origin,quantity::text AS quantity,unit_id,
    purchased_quantity::text AS purchased_quantity,checked_at,revision::text AS revision,created_at,updated_at
    FROM app_private.shopping_list_items;
CREATE VIEW api.my_favorites WITH (security_invoker=true,security_barrier=true) AS
  SELECT owner_id,recipe_id,created_at FROM app_private.favorites;
-- An editor must be able to read the exact revision needed by update/publication.
CREATE VIEW api.editor_recipe_versions WITH (security_invoker=true,security_barrier=true) AS
  SELECT id,recipe_id,version_number,status,title,summary,difficulty,active_minutes,total_minutes,
    source_id,attribution,published_at,created_at,updated_at
    FROM app_private.recipe_versions WHERE cookly_security.can_edit_catalog();
REVOKE ALL ON ALL TABLES IN SCHEMA api FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON api.recipes,api.recipe_servings,api.recipe_ingredients,api.recipe_steps,api.recipe_tags,
  api.ingredients,api.ingredient_aliases,api.ingredient_categories,api.units,api.tags,api.allergens,api.ingredient_allergens TO anon,authenticated;
GRANT SELECT ON api.my_profile,api.my_pantry,api.my_meal_plans,api.my_meal_entries,
  api.my_shopping_lists,api.my_shopping_items,api.my_favorites TO authenticated;
GRANT SELECT ON api.editor_recipe_versions,api.editor_recipe_servings,api.editor_recipe_ingredients,
  api.editor_recipe_steps,api.editor_recipe_tags TO authenticated;
-- All remaining RLS-protected tables remain inaccessible without an explicit API.
