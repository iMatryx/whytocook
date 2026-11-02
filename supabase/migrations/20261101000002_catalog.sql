-- Stable identities; published content lives in immutable version rows.
CREATE TABLE app_private.recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  author_profile_id uuid REFERENCES app_private.profiles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'withdrawn', 'archived')),
  current_version_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status NOT IN ('published', 'withdrawn') OR current_version_id IS NOT NULL),
  CHECK (status <> 'draft' OR current_version_id IS NULL)
);
CREATE INDEX recipes_author_idx ON app_private.recipes(author_profile_id);
CREATE INDEX recipes_published_idx ON app_private.recipes(updated_at DESC, id) WHERE status = 'published';

CREATE TABLE app_private.recipe_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id uuid NOT NULL REFERENCES app_private.recipes(id) ON DELETE CASCADE,
  version_number integer NOT NULL CHECK (version_number > 0),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 200),
  summary text CHECK (char_length(summary) <= 4000),
  difficulty text NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
  active_minutes integer NOT NULL CHECK (active_minutes BETWEEN 0 AND 10080),
  total_minutes integer NOT NULL CHECK (total_minutes BETWEEN 1 AND 10080 AND total_minutes >= active_minutes),
  source_id uuid REFERENCES app_private.data_sources(id) ON DELETE RESTRICT,
  attribution text CHECK (char_length(attribution) <= 2000),
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (recipe_id, version_number),
  UNIQUE (recipe_id, id),
  CHECK ((status = 'published') = (published_at IS NOT NULL))
);
ALTER TABLE app_private.recipes ADD CONSTRAINT recipes_current_version_fk
  FOREIGN KEY (id, current_version_id) REFERENCES app_private.recipe_versions(recipe_id, id)
  ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED;
CREATE INDEX recipes_current_version_idx ON app_private.recipes(id, current_version_id);
CREATE INDEX recipe_versions_source_idx ON app_private.recipe_versions(source_id);

CREATE TABLE app_private.recipe_servings (
  recipe_version_id uuid PRIMARY KEY REFERENCES app_private.recipe_versions(id) ON DELETE CASCADE,
  base_servings smallint NOT NULL CHECK (base_servings BETWEEN 1 AND 20),
  serving_unit_code text NOT NULL DEFAULT 'portion'
    REFERENCES app_private.serving_units(code) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX recipe_servings_unit_idx ON app_private.recipe_servings(serving_unit_code);

CREATE TABLE app_private.recipe_ingredients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_version_id uuid NOT NULL REFERENCES app_private.recipe_versions(id) ON DELETE CASCADE,
  ingredient_id uuid NOT NULL REFERENCES app_private.ingredients(id) ON DELETE RESTRICT,
  quantity app_private.quantity NOT NULL CHECK (quantity > 0),
  unit_id uuid NOT NULL REFERENCES app_private.units(id) ON DELETE RESTRICT,
  is_optional boolean NOT NULL DEFAULT false,
  position integer NOT NULL CHECK (position > 0),
  preparation_note text CHECK (char_length(preparation_note) <= 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (recipe_version_id, position)
);
CREATE INDEX recipe_ingredients_ingredient_idx ON app_private.recipe_ingredients(ingredient_id, recipe_version_id);
CREATE INDEX recipe_ingredients_unit_idx ON app_private.recipe_ingredients(unit_id);
CREATE TABLE app_private.recipe_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_version_id uuid NOT NULL REFERENCES app_private.recipe_versions(id) ON DELETE CASCADE,
  step_number integer NOT NULL CHECK (step_number > 0),
  instruction text NOT NULL CHECK (char_length(btrim(instruction)) BETWEEN 1 AND 8000),
  timer_seconds integer CHECK (timer_seconds BETWEEN 1 AND 604800),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (recipe_version_id, step_number)
);
CREATE TABLE app_private.recipe_tags (
  recipe_version_id uuid NOT NULL REFERENCES app_private.recipe_versions(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES app_private.tags(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (recipe_version_id, tag_id)
);
CREATE INDEX recipe_tags_tag_idx ON app_private.recipe_tags(tag_id, recipe_version_id);

-- Cross-dimension conversion requires an ingredient-specific, sourced measurement.
CREATE TABLE app_private.ingredient_unit_conversions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ingredient_id uuid NOT NULL REFERENCES app_private.ingredients(id) ON DELETE RESTRICT,
  from_unit_id uuid NOT NULL REFERENCES app_private.units(id) ON DELETE RESTRICT,
  to_unit_id uuid NOT NULL REFERENCES app_private.units(id) ON DELETE RESTRICT,
  factor app_private.positive_factor NOT NULL,
  source_id uuid NOT NULL REFERENCES app_private.data_sources(id) ON DELETE RESTRICT,
  measured_on date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (from_unit_id <> to_unit_id),
  UNIQUE (ingredient_id, from_unit_id, to_unit_id)
);
CREATE INDEX ingredient_unit_conversions_from_idx ON app_private.ingredient_unit_conversions(from_unit_id);
CREATE INDEX ingredient_unit_conversions_to_idx ON app_private.ingredient_unit_conversions(to_unit_id);
CREATE INDEX ingredient_unit_conversions_source_idx ON app_private.ingredient_unit_conversions(source_id);

CREATE TABLE app_private.ingredient_substitutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ingredient_id uuid NOT NULL REFERENCES app_private.ingredients(id) ON DELETE RESTRICT,
  substitute_ingredient_id uuid NOT NULL REFERENCES app_private.ingredients(id) ON DELETE RESTRICT,
  from_unit_id uuid NOT NULL REFERENCES app_private.units(id) ON DELETE RESTRICT,
  to_unit_id uuid NOT NULL REFERENCES app_private.units(id) ON DELETE RESTRICT,
  ratio app_private.positive_factor NOT NULL,
  source_id uuid NOT NULL REFERENCES app_private.data_sources(id) ON DELETE RESTRICT,
  notes text CHECK (char_length(notes) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ingredient_id <> substitute_ingredient_id),
  UNIQUE (ingredient_id, substitute_ingredient_id, from_unit_id, to_unit_id)
);
CREATE INDEX ingredient_substitutions_substitute_idx ON app_private.ingredient_substitutions(substitute_ingredient_id);
CREATE INDEX ingredient_substitutions_from_idx ON app_private.ingredient_substitutions(from_unit_id);
CREATE INDEX ingredient_substitutions_to_idx ON app_private.ingredient_substitutions(to_unit_id);
CREATE INDEX ingredient_substitutions_source_idx ON app_private.ingredient_substitutions(source_id);

-- Every row is a sourced revision, on an edible 100 g basis. NULL means unknown.
CREATE TABLE app_private.nutrition_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ingredient_id uuid NOT NULL REFERENCES app_private.ingredients(id) ON DELETE RESTRICT,
  source_id uuid NOT NULL REFERENCES app_private.data_sources(id) ON DELETE RESTRICT,
  source_record_key text NOT NULL CHECK (char_length(btrim(source_record_key)) BETWEEN 1 AND 200),
  source_revision integer NOT NULL CHECK (source_revision > 0),
  observed_on date NOT NULL,
  energy_kcal app_private.quantity CHECK (energy_kcal <= 1000),
  protein_g app_private.quantity CHECK (protein_g <= 100),
  carbohydrate_g app_private.quantity CHECK (carbohydrate_g <= 100),
  fat_g app_private.quantity CHECK (fat_g <= 100),
  fiber_g app_private.quantity CHECK (fiber_g <= 100),
  salt_g app_private.quantity CHECK (salt_g <= 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ingredient_id, source_id, source_record_key, source_revision),
  CHECK (num_nonnulls(energy_kcal, protein_g, carbohydrate_g, fat_g, fiber_g, salt_g) > 0)
);
CREATE INDEX nutrition_data_lookup_idx ON app_private.nutrition_data(ingredient_id, observed_on DESC, id);
CREATE INDEX nutrition_data_source_idx ON app_private.nutrition_data(source_id);

CREATE TABLE app_private.ingredient_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ingredient_id uuid NOT NULL REFERENCES app_private.ingredients(id) ON DELETE RESTRICT,
  source_id uuid NOT NULL REFERENCES app_private.data_sources(id) ON DELETE RESTRICT,
  source_record_key text NOT NULL CHECK (char_length(btrim(source_record_key)) BETWEEN 1 AND 200),
  source_revision integer NOT NULL CHECK (source_revision > 0),
  basis_quantity app_private.quantity NOT NULL CHECK (basis_quantity > 0),
  basis_unit_id uuid NOT NULL REFERENCES app_private.units(id) ON DELETE RESTRICT,
  price app_private.amount NOT NULL,
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  region text NOT NULL CHECK (region ~ '^[A-Z]{2}$'),
  observed_on date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ingredient_id, source_id, source_record_key, source_revision, region, currency)
);
CREATE INDEX ingredient_prices_lookup_idx ON app_private.ingredient_prices(ingredient_id, region, currency, observed_on DESC, id);
CREATE INDEX ingredient_prices_source_idx ON app_private.ingredient_prices(source_id);
CREATE INDEX ingredient_prices_unit_idx ON app_private.ingredient_prices(basis_unit_id);
