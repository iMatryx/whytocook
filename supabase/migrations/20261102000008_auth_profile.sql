-- Profile preferences; identity/roles remain separate and protected.
ALTER TABLE app_private.user_preferences
  ADD COLUMN household_size smallint NOT NULL DEFAULT 2 CHECK (household_size BETWEEN 1 AND 20),
  ADD COLUMN meal_budget app_private.amount CHECK (meal_budget>0 AND meal_budget<=999999.99 AND meal_budget=round(meal_budget,2)),
  ADD COLUMN currency text NOT NULL DEFAULT 'MDL' CHECK (currency IN ('MDL','RON','EUR','USD'));
CREATE TABLE app_private.equipment_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE CHECK (code ~ '^[a-z_]+$'),
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER touch_row BEFORE UPDATE ON app_private.equipment_types
  FOR EACH ROW EXECUTE FUNCTION app_private.touch_row();
CREATE TABLE app_private.user_equipment (
  profile_id uuid NOT NULL REFERENCES app_private.user_preferences(profile_id) ON DELETE CASCADE,
  equipment_id uuid NOT NULL REFERENCES app_private.equipment_types(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(profile_id,equipment_id)
);
CREATE INDEX user_equipment_equipment_idx ON app_private.user_equipment(equipment_id);
ALTER TABLE app_private.equipment_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_private.equipment_types FORCE ROW LEVEL SECURITY;
ALTER TABLE app_private.user_equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_private.user_equipment FORCE ROW LEVEL SECURITY;
REVOKE ALL ON app_private.equipment_types,app_private.user_equipment FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON app_private.equipment_types TO anon,authenticated,cookly_api;
CREATE POLICY equipment_read ON app_private.equipment_types FOR SELECT TO anon,authenticated,cookly_api USING (true);
GRANT SELECT ON app_private.user_equipment TO authenticated,cookly_api;
CREATE POLICY user_equipment_read ON app_private.user_equipment FOR SELECT TO authenticated,cookly_api
  USING (profile_id=(SELECT cookly_security.current_uid()));
GRANT UPDATE ON app_private.user_preferences TO cookly_api;
CREATE POLICY preferences_update ON app_private.user_preferences FOR UPDATE TO cookly_api
  USING (profile_id=(SELECT cookly_security.current_uid())) WITH CHECK (profile_id=(SELECT cookly_security.current_uid()));
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['user_preference_tags','user_allergen_exclusions','user_equipment'] LOOP
    EXECUTE format('GRANT INSERT,DELETE ON app_private.%I TO cookly_api',t);
    EXECUTE format('CREATE POLICY own_insert ON app_private.%I FOR INSERT TO cookly_api WITH CHECK (profile_id=(SELECT cookly_security.current_uid()))',t);
    EXECUTE format('CREATE POLICY own_delete ON app_private.%I FOR DELETE TO cookly_api USING (profile_id=(SELECT cookly_security.current_uid()))',t);
  END LOOP;
END;
$$;

INSERT INTO app_private.equipment_types(code,name) VALUES
  ('hob','Plită'),('oven','Cuptor'),('microwave','Cuptor cu microunde'),('pan','Tigaie'),
  ('pot','Oală'),('blender','Blender'),('mixer','Mixer'),('air_fryer','Friteuză cu aer'),('grill','Grătar')
ON CONFLICT(code) DO NOTHING;
INSERT INTO app_private.tags(slug,name,kind) VALUES
  ('vegetarian','Vegetarian','diet'),('vegan','Vegan','diet'),('pescatarian','Pescetarian','diet'),
  ('gluten-free','Fără gluten','diet'),('lactose-free','Fără lactoză','diet') ON CONFLICT(slug) DO NOTHING;
INSERT INTO app_private.allergens(code,name) VALUES
  ('gluten','Cereale cu gluten'),('crustaceans','Crustacee'),('eggs','Ouă'),('fish','Pește'),
  ('peanuts','Arahide'),('soy','Soia'),('milk','Lapte'),('tree_nuts','Fructe cu coajă lemnoasă'),
  ('celery','Țelină'),('mustard','Muștar'),('sesame','Susan'),('sulphites','Sulfiți'),
  ('lupin','Lupin'),('molluscs','Moluște') ON CONFLICT(code) DO NOTHING;

GRANT CREATE ON SCHEMA api TO cookly_api;
CREATE FUNCTION api.profile_options() RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
  SELECT jsonb_build_object(
    'diets',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'name',name) ORDER BY name) FROM app_private.tags WHERE kind='diet'),'[]'::jsonb),
    'allergens',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'name',name) ORDER BY name) FROM app_private.allergens),'[]'::jsonb),
    'equipment',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'name',name) ORDER BY name) FROM app_private.equipment_types),'[]'::jsonb)
  );
$$;
CREATE FUNCTION api.get_my_profile() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=cookly_security.current_uid(); result jsonb;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
  SELECT jsonb_build_object('id',p.id,'display_name',p.display_name,'locale',p.locale,'time_zone',p.time_zone,
    'household_size',u.household_size,'meal_budget',u.meal_budget::text,'currency',u.currency,
    'diet_ids',coalesce((SELECT jsonb_agg(tag_id) FROM app_private.user_preference_tags WHERE profile_id=actor),'[]'::jsonb),
    'allergen_ids',coalesce((SELECT jsonb_agg(allergen_id) FROM app_private.user_allergen_exclusions WHERE profile_id=actor),'[]'::jsonb),
    'equipment_ids',coalesce((SELECT jsonb_agg(equipment_id) FROM app_private.user_equipment WHERE profile_id=actor),'[]'::jsonb))
    INTO result FROM app_private.profiles p JOIN app_private.user_preferences u ON u.profile_id=p.id WHERE p.id=actor;
  IF result IS NULL THEN RAISE EXCEPTION 'Resource unavailable' USING ERRCODE='P0002'; END IF;
  RETURN result;
END;
$$;
CREATE FUNCTION api.save_my_profile(p_display_name text,p_locale text,p_time_zone text,p_household_size integer,
  p_meal_budget text,p_currency text,p_diet_ids uuid[],p_allergen_ids uuid[],p_equipment_ids uuid[]) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=cookly_security.current_uid();
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
  IF coalesce(cardinality(p_diet_ids),0)>20 OR coalesce(cardinality(p_allergen_ids),0)>30 OR coalesce(cardinality(p_equipment_ids),0)>30
    OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name=p_time_zone) THEN
    RAISE EXCEPTION 'Invalid profile' USING ERRCODE='22023';
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(p_diet_ids) x(id) WHERE NOT EXISTS (SELECT 1 FROM app_private.tags t WHERE t.id=x.id AND t.kind='diet')) THEN
    RAISE EXCEPTION 'Invalid dietary preference' USING ERRCODE='22023';
  END IF;
  -- Parent lock serializes full-profile replacement across sessions.
  PERFORM 1 FROM app_private.profiles WHERE id=actor FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Resource unavailable' USING ERRCODE='P0002'; END IF;
  PERFORM 1 FROM app_private.user_preferences WHERE profile_id=actor FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Resource unavailable' USING ERRCODE='P0002'; END IF;
  UPDATE app_private.profiles SET display_name=p_display_name,locale=p_locale,time_zone=p_time_zone WHERE id=actor;
  UPDATE app_private.user_preferences SET household_size=p_household_size,default_servings=p_household_size,
    meal_budget=nullif(p_meal_budget,'')::app_private.amount,currency=p_currency WHERE profile_id=actor;
  DELETE FROM app_private.user_preference_tags WHERE profile_id=actor;
  INSERT INTO app_private.user_preference_tags(profile_id,tag_id) SELECT actor,unnest(p_diet_ids);
  DELETE FROM app_private.user_allergen_exclusions WHERE profile_id=actor;
  INSERT INTO app_private.user_allergen_exclusions(profile_id,allergen_id) SELECT actor,unnest(p_allergen_ids);
  DELETE FROM app_private.user_equipment WHERE profile_id=actor;
  INSERT INTO app_private.user_equipment(profile_id,equipment_id) SELECT actor,unnest(p_equipment_ids);
END;
$$;
ALTER FUNCTION api.profile_options() OWNER TO cookly_api;
ALTER FUNCTION api.get_my_profile() OWNER TO cookly_api;
ALTER FUNCTION api.save_my_profile(text,text,text,integer,text,text,uuid[],uuid[],uuid[]) OWNER TO cookly_api;
REVOKE ALL ON FUNCTION api.profile_options(),api.get_my_profile(),api.save_my_profile(text,text,text,integer,text,text,uuid[],uuid[],uuid[])
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION api.profile_options() TO anon,authenticated;
GRANT EXECUTE ON FUNCTION api.get_my_profile(),api.save_my_profile(text,text,text,integer,text,text,uuid[],uuid[],uuid[]) TO authenticated;
REVOKE CREATE ON SCHEMA api FROM cookly_api;
NOTIFY pgrst,'reload schema';
