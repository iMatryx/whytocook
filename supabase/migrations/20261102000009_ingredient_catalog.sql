-- Search keys do not replace identity or the existing uniqueness constraints.
CREATE FUNCTION app_private.ingredient_search_key(value text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE SET search_path='' AS $$
  SELECT btrim(regexp_replace(translate(lower(normalize(value,NFC) COLLATE "C"),
    'ĂÂÎȘŞȚŢăâîșşțţЁёАБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ',
    'aaissttaaissttееабвгдежзийклмнопрстуфхцчшщъыьэюя'),
    '[^a-z0-9а-я]+',' ','g'));
$$;
REVOKE ALL ON FUNCTION app_private.ingredient_search_key(text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION app_private.ingredient_search_key(text) TO anon,authenticated,cookly_api;

ALTER TABLE app_private.ingredient_aliases DROP CONSTRAINT ingredient_aliases_locale_check;
ALTER TABLE app_private.ingredient_aliases
  ADD CONSTRAINT ingredient_aliases_locale_check CHECK(locale IN ('ro-RO','ru-RU','en-GB')),
  ADD COLUMN is_preferred boolean NOT NULL DEFAULT false,
  ADD COLUMN search_key text GENERATED ALWAYS AS (app_private.ingredient_search_key(alias)) STORED,
  ADD COLUMN search_document tsvector GENERATED ALWAYS AS (to_tsvector('simple'::regconfig,app_private.ingredient_search_key(alias))) STORED,
  ADD CONSTRAINT ingredient_aliases_searchable CHECK(app_private.ingredient_search_key(alias)<>'');
CREATE UNIQUE INDEX ingredient_aliases_preferred_idx ON app_private.ingredient_aliases(ingredient_id,locale) WHERE is_preferred;
CREATE INDEX ingredient_aliases_search_idx ON app_private.ingredient_aliases USING gin(search_document);
CREATE INDEX ingredient_aliases_key_idx ON app_private.ingredient_aliases(search_key text_pattern_ops,ingredient_id);

ALTER TABLE app_private.ingredients
  ADD COLUMN identity_kind text NOT NULL DEFAULT 'specific' CHECK(identity_kind IN ('generic','specific')),
  ADD COLUMN broader_ingredient_id uuid,
  ADD COLUMN broader_kind text GENERATED ALWAYS AS ('generic'::text) STORED,
  ADD COLUMN broader_relation text CHECK(broader_relation IN ('part_of','variant_of')),
  ADD COLUMN search_key text GENERATED ALWAYS AS (app_private.ingredient_search_key(name)) STORED,
  ADD COLUMN search_document tsvector GENERATED ALWAYS AS (to_tsvector('simple'::regconfig,app_private.ingredient_search_key(name))) STORED,
  ADD CONSTRAINT ingredients_kind_identity UNIQUE(id,identity_kind),
  ADD CONSTRAINT ingredients_broader_fk FOREIGN KEY(broader_ingredient_id,broader_kind)
    REFERENCES app_private.ingredients(id,identity_kind) ON DELETE RESTRICT,
  ADD CONSTRAINT ingredients_broader_pair CHECK((broader_ingredient_id IS NULL)=(broader_relation IS NULL)),
  ADD CONSTRAINT ingredients_broader_kind CHECK(identity_kind='specific' OR broader_ingredient_id IS NULL),
  ADD CONSTRAINT ingredients_no_self_broader CHECK(broader_ingredient_id IS DISTINCT FROM id),
  ADD CONSTRAINT ingredients_searchable CHECK(app_private.ingredient_search_key(name)<>'');
-- A specific child can reference only a generic parent, which cannot have a
-- parent. This prevents cycles without introducing inferred substitutions.
CREATE INDEX ingredients_broader_idx ON app_private.ingredients(broader_ingredient_id);
CREATE INDEX ingredients_search_idx ON app_private.ingredients USING gin(search_document) WHERE is_active;
CREATE INDEX ingredients_search_key_idx ON app_private.ingredients(search_key text_pattern_ops,id) WHERE is_active;
CREATE INDEX ingredients_category_active_idx ON app_private.ingredients(category_id,search_key,id) WHERE is_active;

CREATE TABLE app_private.ingredient_units (
  ingredient_id uuid NOT NULL REFERENCES app_private.ingredients(id) ON DELETE CASCADE,
  unit_id uuid NOT NULL REFERENCES app_private.units(id) ON DELETE RESTRICT,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(ingredient_id,unit_id)
);
CREATE UNIQUE INDEX ingredient_units_default_idx ON app_private.ingredient_units(ingredient_id) WHERE is_default;
CREATE INDEX ingredient_units_unit_idx ON app_private.ingredient_units(unit_id);
ALTER TABLE app_private.ingredient_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_private.ingredient_units FORCE ROW LEVEL SECURITY;
REVOKE ALL ON app_private.ingredient_units FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON app_private.ingredient_units TO anon,authenticated,cookly_api;
CREATE POLICY ingredient_units_read ON app_private.ingredient_units FOR SELECT TO anon,authenticated,cookly_api
  USING(EXISTS(SELECT 1 FROM app_private.ingredients i WHERE i.id=ingredient_id AND i.is_active));

ALTER TABLE app_private.nutrition_data
  ADD COLUMN verification_status text NOT NULL DEFAULT 'unverified' CHECK(verification_status IN ('unverified','verified')),
  ADD COLUMN verified_at timestamptz,
  ADD COLUMN source_food_description text CHECK(char_length(btrim(source_food_description)) BETWEEN 1 AND 500),
  ADD CONSTRAINT nutrition_verified_evidence CHECK(verification_status<>'verified' OR (verified_at IS NOT NULL AND source_food_description IS NOT NULL));
CREATE INDEX nutrition_verified_lookup_idx ON app_private.nutrition_data(ingredient_id,observed_on DESC,id) WHERE verification_status='verified';

CREATE TABLE app_private.ingredient_catalog_state (
  singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
  revision bigint NOT NULL DEFAULT 1 CHECK(revision>0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO app_private.ingredient_catalog_state(singleton) VALUES(true);
ALTER TABLE app_private.ingredient_catalog_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_private.ingredient_catalog_state FORCE ROW LEVEL SECURITY;
REVOKE ALL ON app_private.ingredient_catalog_state FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON app_private.ingredient_catalog_state TO anon,authenticated,cookly_api;
CREATE POLICY catalog_revision_read ON app_private.ingredient_catalog_state FOR SELECT TO anon,authenticated,cookly_api USING(true);

CREATE ROLE cookly_catalog_versioner NOLOGIN NOINHERIT NOBYPASSRLS;
GRANT cookly_catalog_versioner TO CURRENT_USER;
GRANT USAGE,CREATE ON SCHEMA app_private TO cookly_catalog_versioner;
GRANT SELECT,UPDATE ON app_private.ingredient_catalog_state TO cookly_catalog_versioner;
CREATE POLICY catalog_versioner_read ON app_private.ingredient_catalog_state FOR SELECT TO cookly_catalog_versioner USING(true);
CREATE POLICY catalog_versioner_update ON app_private.ingredient_catalog_state FOR UPDATE TO cookly_catalog_versioner USING(true) WITH CHECK(true);
CREATE FUNCTION app_private.bump_ingredient_catalog() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  UPDATE app_private.ingredient_catalog_state SET revision=revision+1,updated_at=clock_timestamp() WHERE singleton;
  RETURN NULL;
END;
$$;
ALTER FUNCTION app_private.bump_ingredient_catalog() OWNER TO cookly_catalog_versioner;
REVOKE ALL ON FUNCTION app_private.bump_ingredient_catalog() FROM PUBLIC,anon,authenticated,service_role,cookly_api;
REVOKE CREATE ON SCHEMA app_private FROM cookly_catalog_versioner;
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['ingredients','ingredient_aliases','ingredient_categories','units','ingredient_units','nutrition_data','data_sources'] LOOP
    EXECUTE format('CREATE TRIGGER bump_ingredient_catalog AFTER INSERT OR UPDATE OR DELETE OR TRUNCATE ON app_private.%I FOR EACH STATEMENT EXECUTE FUNCTION app_private.bump_ingredient_catalog()',t);
  END LOOP;
END;
$$;
