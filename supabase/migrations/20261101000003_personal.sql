CREATE TABLE app_private.user_preferences (
  profile_id uuid PRIMARY KEY REFERENCES app_private.profiles(id) ON DELETE CASCADE,
  default_servings smallint NOT NULL DEFAULT 2 CHECK (default_servings BETWEEN 1 AND 20),
  max_cooking_minutes integer CHECK (max_cooking_minutes BETWEEN 1 AND 10080),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE app_private.user_ingredient_exclusions (
  profile_id uuid NOT NULL REFERENCES app_private.user_preferences(profile_id) ON DELETE CASCADE,
  ingredient_id uuid NOT NULL REFERENCES app_private.ingredients(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id, ingredient_id)
);
CREATE INDEX user_ingredient_exclusions_ingredient_idx ON app_private.user_ingredient_exclusions(ingredient_id);
CREATE TABLE app_private.user_allergen_exclusions (
  profile_id uuid NOT NULL REFERENCES app_private.user_preferences(profile_id) ON DELETE CASCADE,
  allergen_id uuid NOT NULL REFERENCES app_private.allergens(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id, allergen_id)
);
CREATE INDEX user_allergen_exclusions_allergen_idx ON app_private.user_allergen_exclusions(allergen_id);
CREATE TABLE app_private.user_preference_tags (
  profile_id uuid NOT NULL REFERENCES app_private.user_preferences(profile_id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES app_private.tags(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id, tag_id)
);
CREATE INDEX user_preference_tags_tag_idx ON app_private.user_preference_tags(tag_id);

CREATE TABLE app_private.pantry_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES app_private.profiles(id) ON DELETE CASCADE,
  ingredient_id uuid NOT NULL REFERENCES app_private.ingredients(id) ON DELETE RESTRICT,
  quantity app_private.quantity,
  unit_id uuid REFERENCES app_private.units(id) ON DELETE RESTRICT,
  location text NOT NULL DEFAULT 'pantry' CHECK (location IN ('pantry', 'fridge', 'freezer')),
  expires_on date CHECK (isfinite(expires_on)),
  archived_at timestamptz,
  revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((quantity IS NULL) = (unit_id IS NULL)),
  UNIQUE (id, owner_id)
);
CREATE INDEX pantry_items_owner_ingredient_idx ON app_private.pantry_items(owner_id, ingredient_id);
CREATE INDEX pantry_items_expiry_idx ON app_private.pantry_items(owner_id, expires_on, id) WHERE archived_at IS NULL;
CREATE INDEX pantry_items_ingredient_idx ON app_private.pantry_items(ingredient_id);
CREATE INDEX pantry_items_unit_idx ON app_private.pantry_items(unit_id);

CREATE TABLE app_private.favorites (
  owner_id uuid NOT NULL REFERENCES app_private.profiles(id) ON DELETE CASCADE,
  recipe_id uuid NOT NULL REFERENCES app_private.recipes(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, recipe_id)
);
CREATE INDEX favorites_recipe_idx ON app_private.favorites(recipe_id);

CREATE TABLE app_private.meal_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES app_private.profiles(id) ON DELETE CASCADE,
  starts_on date NOT NULL,
  revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, owner_id),
  UNIQUE (owner_id, starts_on),
  CHECK (isfinite(starts_on))
);
CREATE TABLE app_private.meal_plan_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES app_private.profiles(id) ON DELETE CASCADE,
  meal_plan_id uuid NOT NULL,
  recipe_version_id uuid NOT NULL REFERENCES app_private.recipe_versions(id) ON DELETE RESTRICT,
  planned_on date NOT NULL CHECK (isfinite(planned_on)),
  meal_slot text NOT NULL CHECK (meal_slot IN ('breakfast', 'lunch', 'dinner', 'snack')),
  servings smallint NOT NULL CHECK (servings BETWEEN 1 AND 20),
  revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, owner_id),
  FOREIGN KEY (meal_plan_id, owner_id) REFERENCES app_private.meal_plans(id, owner_id) ON DELETE CASCADE
);
CREATE INDEX meal_plan_entries_plan_idx ON app_private.meal_plan_entries(meal_plan_id, owner_id, planned_on);
CREATE INDEX meal_plan_entries_owner_idx ON app_private.meal_plan_entries(owner_id, planned_on);
CREATE INDEX meal_plan_entries_recipe_idx ON app_private.meal_plan_entries(recipe_version_id);

CREATE TABLE app_private.shopping_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES app_private.profiles(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Lista mea' CHECK (char_length(btrim(name)) BETWEEN 1 AND 120),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, owner_id)
);
CREATE UNIQUE INDEX shopping_lists_one_active_owner ON app_private.shopping_lists(owner_id) WHERE status = 'active';
CREATE INDEX shopping_lists_owner_history_idx ON app_private.shopping_lists(owner_id, created_at DESC, id);
CREATE TABLE app_private.shopping_list_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES app_private.profiles(id) ON DELETE CASCADE,
  shopping_list_id uuid NOT NULL,
  ingredient_id uuid REFERENCES app_private.ingredients(id) ON DELETE RESTRICT,
  label text NOT NULL CHECK (char_length(btrim(label)) BETWEEN 1 AND 200),
  origin text NOT NULL CHECK (origin IN ('manual', 'derived')),
  quantity app_private.quantity CHECK (quantity > 0),
  unit_id uuid REFERENCES app_private.units(id) ON DELETE RESTRICT,
  purchased_quantity app_private.quantity NOT NULL DEFAULT 0,
  checked_at timestamptz,
  revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, owner_id),
  FOREIGN KEY (shopping_list_id, owner_id) REFERENCES app_private.shopping_lists(id, owner_id) ON DELETE CASCADE,
  CHECK ((quantity IS NULL) = (unit_id IS NULL)),
  CHECK ((quantity IS NULL AND purchased_quantity = 0) OR (quantity IS NOT NULL AND purchased_quantity <= quantity)),
  CHECK (origin <> 'derived' OR ingredient_id IS NOT NULL)
);
CREATE INDEX shopping_list_items_list_idx ON app_private.shopping_list_items(shopping_list_id, owner_id);
CREATE INDEX shopping_list_items_owner_idx ON app_private.shopping_list_items(owner_id);
CREATE INDEX shopping_list_items_ingredient_idx ON app_private.shopping_list_items(ingredient_id);
CREATE INDEX shopping_list_items_unit_idx ON app_private.shopping_list_items(unit_id);
-- PG >= 15: NULL unit is a single unknown-quantity group, not unlimited duplicates.
CREATE UNIQUE INDEX shopping_list_items_derived_group
  ON app_private.shopping_list_items(shopping_list_id, ingredient_id, unit_id) NULLS NOT DISTINCT
  WHERE origin = 'derived';
CREATE TABLE app_private.shopping_list_item_sources (
  shopping_list_item_id uuid NOT NULL,
  meal_plan_entry_id uuid NOT NULL,
  owner_id uuid NOT NULL REFERENCES app_private.profiles(id) ON DELETE CASCADE,
  contributed_quantity app_private.quantity CHECK (contributed_quantity > 0),
  unit_id uuid REFERENCES app_private.units(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (shopping_list_item_id, meal_plan_entry_id),
  FOREIGN KEY (shopping_list_item_id, owner_id)
    REFERENCES app_private.shopping_list_items(id, owner_id) ON DELETE CASCADE,
  FOREIGN KEY (meal_plan_entry_id, owner_id)
    REFERENCES app_private.meal_plan_entries(id, owner_id) ON DELETE CASCADE,
  CHECK ((contributed_quantity IS NULL) = (unit_id IS NULL))
);
CREATE INDEX shopping_list_item_sources_entry_idx ON app_private.shopping_list_item_sources(meal_plan_entry_id, owner_id);
CREATE INDEX shopping_list_item_sources_owner_idx ON app_private.shopping_list_item_sources(owner_id);
CREATE INDEX shopping_list_item_sources_unit_idx ON app_private.shopping_list_item_sources(unit_id);

CREATE TABLE app_private.ai_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES app_private.profiles(id) ON DELETE CASCADE,
  recipe_version_id uuid REFERENCES app_private.recipe_versions(id) ON DELETE SET NULL,
  idempotency_key uuid NOT NULL,
  input_fingerprint text NOT NULL CHECK (input_fingerprint ~ '^[a-f0-9]{64}$'),
  prompt_version text NOT NULL CHECK (char_length(btrim(prompt_version)) BETWEEN 1 AND 80),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'succeeded', 'failed', 'cancelled')),
  provider text CHECK (char_length(btrim(provider)) BETWEEN 1 AND 80),
  model text CHECK (char_length(btrim(model)) BETWEEN 1 AND 120),
  input_tokens bigint CHECK (input_tokens >= 0),
  output_tokens bigint CHECK (output_tokens >= 0),
  estimated_cost app_private.amount,
  actual_cost app_private.amount,
  cost_currency text CHECK (cost_currency ~ '^[A-Z]{3}$'),
  error_code text CHECK (error_code ~ '^[A-Z][A-Z0-9_]{0,79}$'),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, idempotency_key),
  CHECK ((estimated_cost IS NULL AND actual_cost IS NULL) OR cost_currency IS NOT NULL),
  CHECK (status <> 'pending' OR (started_at IS NULL AND completed_at IS NULL)),
  CHECK (status <> 'running' OR (started_at IS NOT NULL AND completed_at IS NULL)),
  CHECK (status NOT IN ('succeeded', 'failed', 'cancelled') OR completed_at IS NOT NULL),
  CHECK (status <> 'succeeded' OR (started_at IS NOT NULL AND provider IS NOT NULL AND model IS NOT NULL)),
  CHECK (status <> 'failed' OR error_code IS NOT NULL),
  CHECK (completed_at IS NULL OR completed_at >= created_at),
  CHECK (started_at IS NULL OR started_at >= created_at),
  CHECK (completed_at IS NULL OR started_at IS NULL OR completed_at >= started_at)
);
CREATE INDEX ai_requests_recipe_idx ON app_private.ai_requests(recipe_version_id);
CREATE INDEX ai_requests_owner_history_idx ON app_private.ai_requests(owner_id, created_at DESC, id);
CREATE INDEX ai_requests_pending_idx ON app_private.ai_requests(created_at, id) WHERE status IN ('pending', 'running');

-- Append-only to application roles. Controlled maintenance may erase/retain rows.
-- No raw prompts, auth tokens, email addresses or previous field values.
CREATE TABLE app_private.audit_logs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_profile_id uuid REFERENCES app_private.profiles(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action ~ '^[a-z][a-z0-9_.]{0,99}$'),
  resource_type text NOT NULL CHECK (resource_type ~ '^[a-z][a-z0-9_]{0,79}$'),
  resource_id uuid,
  request_id uuid NOT NULL,
  outcome text NOT NULL CHECK (outcome IN ('success', 'denied', 'failure')),
  reason_code text CHECK (reason_code ~ '^[A-Z][A-Z0-9_]{0,79}$'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_logs_actor_idx ON app_private.audit_logs(actor_profile_id, created_at DESC);
CREATE INDEX audit_logs_resource_idx ON app_private.audit_logs(resource_type, resource_id, created_at DESC);
CREATE INDEX audit_logs_request_idx ON app_private.audit_logs(request_id);
CREATE INDEX audit_logs_created_idx ON app_private.audit_logs(created_at);
