-- Cookly / PostgreSQL >= 15 / fresh Supabase project.
-- The migration runner owns the transaction. Never create auth.users here.
CREATE SCHEMA IF NOT EXISTS app_private;
CREATE SCHEMA IF NOT EXISTS api;
REVOKE ALL ON SCHEMA app_private, api FROM PUBLIC, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA app_private
  REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA app_private
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated, service_role;

CREATE DOMAIN app_private.quantity AS numeric(18,6)
  CHECK (VALUE >= 0 AND VALUE < 'Infinity'::numeric AND VALUE <> 'NaN'::numeric);
CREATE DOMAIN app_private.positive_factor AS numeric(24,12)
  CHECK (VALUE > 0 AND VALUE < 'Infinity'::numeric AND VALUE <> 'NaN'::numeric);
CREATE DOMAIN app_private.amount AS numeric(18,8)
  CHECK (VALUE >= 0 AND VALUE < 'Infinity'::numeric AND VALUE <> 'NaN'::numeric);

CREATE FUNCTION app_private.normalize_label(value text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT SET search_path = '' AS $$
  SELECT pg_catalog.lower(pg_catalog.regexp_replace(pg_catalog.btrim(value), '\s+', ' ', 'g'));
$$;

CREATE TABLE app_private.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text CHECK (char_length(btrim(display_name)) BETWEEN 1 AND 80),
  locale text NOT NULL DEFAULT 'ro-RO' CHECK (locale IN ('ro-RO', 'en-GB')),
  time_zone text NOT NULL DEFAULT 'Europe/Chisinau'
    CHECK (char_length(time_zone) BETWEEN 1 AND 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Authorization is not writable profile data. Provisioning is a later use case.
CREATE TABLE app_private.account_states (
  profile_id uuid PRIMARY KEY REFERENCES app_private.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled', 'deleting')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE app_private.user_roles (
  profile_id uuid NOT NULL REFERENCES app_private.profiles(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('editor', 'moderator', 'admin')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id, role)
);

CREATE TABLE app_private.units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE CHECK (code ~ '^[a-z][a-z0-9_-]{0,31}$'),
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
  dimension text NOT NULL CHECK (dimension IN ('mass', 'volume', 'count')),
  to_base_factor app_private.positive_factor NOT NULL,
  is_base boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (NOT is_base OR to_base_factor = 1)
);
CREATE UNIQUE INDEX units_one_base_per_dimension ON app_private.units(dimension) WHERE is_base;
INSERT INTO app_private.units(code, name, dimension, to_base_factor, is_base) VALUES
  ('g', 'gram', 'mass', 1, true), ('kg', 'kilogram', 'mass', 1000, false),
  ('ml', 'mililitru', 'volume', 1, true), ('l', 'litru', 'volume', 1000, false),
  ('piece', 'bucată', 'count', 1, true);

CREATE TABLE app_private.serving_units (
  code text PRIMARY KEY CHECK (code ~ '^[a-z][a-z0-9_-]{0,31}$'),
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
  created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO app_private.serving_units(code, name) VALUES ('portion', 'porție'), ('piece', 'bucată');

CREATE TABLE app_private.ingredient_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE app_private.ingredients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 120),
  normalized_name text GENERATED ALWAYS AS (app_private.normalize_label(name)) STORED UNIQUE,
  category_id uuid REFERENCES app_private.ingredient_categories(id) ON DELETE SET NULL,
  allergen_review_status text NOT NULL DEFAULT 'unknown'
    CHECK (allergen_review_status IN ('unknown', 'reviewed')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ingredients_category_idx ON app_private.ingredients(category_id);
CREATE TABLE app_private.ingredient_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ingredient_id uuid NOT NULL REFERENCES app_private.ingredients(id) ON DELETE CASCADE,
  locale text NOT NULL CHECK (locale IN ('ro-RO', 'en-GB')),
  alias text NOT NULL CHECK (char_length(btrim(alias)) BETWEEN 1 AND 120),
  normalized_alias text GENERATED ALWAYS AS (app_private.normalize_label(alias)) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (locale, normalized_alias)
);
CREATE INDEX ingredient_aliases_ingredient_idx ON app_private.ingredient_aliases(ingredient_id);
CREATE TABLE app_private.allergens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE CHECK (code ~ '^[a-z0-9_]+$'),
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE app_private.ingredient_allergens (
  ingredient_id uuid NOT NULL REFERENCES app_private.ingredients(id) ON DELETE CASCADE,
  allergen_id uuid NOT NULL REFERENCES app_private.allergens(id) ON DELETE RESTRICT,
  relation text NOT NULL CHECK (relation IN ('contains', 'may_contain')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ingredient_id, allergen_id)
);
CREATE INDEX ingredient_allergens_allergen_idx ON app_private.ingredient_allergens(allergen_id);

CREATE TABLE app_private.data_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE CHECK (code ~ '^[a-z0-9_-]+$'),
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 200),
  reference_url text CHECK (char_length(reference_url) <= 2048),
  license text CHECK (char_length(license) <= 500),
  attribution text CHECK (char_length(attribution) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE app_private.tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
  kind text NOT NULL CHECK (kind IN ('diet', 'cuisine', 'general')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
