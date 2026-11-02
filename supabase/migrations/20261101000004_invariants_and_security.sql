-- All functions are invoker rights, with a fixed empty search_path.
CREATE FUNCTION app_private.touch_row() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF (to_jsonb(NEW)->'id') IS DISTINCT FROM (to_jsonb(OLD)->'id')
     OR (to_jsonb(NEW)->'profile_id') IS DISTINCT FROM (to_jsonb(OLD)->'profile_id')
     OR (to_jsonb(NEW)->'owner_id') IS DISTINCT FROM (to_jsonb(OLD)->'owner_id') THEN
    RAISE EXCEPTION 'Row identity and owner are immutable' USING ERRCODE = '23514';
  END IF;
  NEW.created_at := OLD.created_at;
  NEW.updated_at := clock_timestamp();
  IF to_jsonb(OLD) ? 'revision' THEN
    NEW := jsonb_populate_record(NEW, jsonb_build_object('revision', (to_jsonb(OLD)->>'revision')::bigint + 1));
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION app_private.guard_recipe_version() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'published' THEN
      RAISE EXCEPTION 'Published recipe content cannot be deleted; withdraw its recipe' USING ERRCODE = '23514';
    END IF;
    RETURN OLD;
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'draft' THEN
      RAISE EXCEPTION 'Create a draft before publication' USING ERRCODE = '23514';
    END IF;
  ELSE
    IF OLD.status = 'published' THEN
      RAISE EXCEPTION 'Published recipe content is immutable' USING ERRCODE = '23514';
    END IF;
    IF NEW.recipe_id <> OLD.recipe_id OR NEW.version_number <> OLD.version_number THEN
      RAISE EXCEPTION 'Recipe version identity is immutable' USING ERRCODE = '23514';
    END IF;
    IF NEW.status = 'published' THEN
      IF NOT EXISTS (SELECT 1 FROM app_private.recipe_servings WHERE recipe_version_id = NEW.id)
        OR NOT EXISTS (SELECT 1 FROM app_private.recipe_ingredients WHERE recipe_version_id = NEW.id AND NOT is_optional)
        OR NOT EXISTS (SELECT 1 FROM app_private.recipe_steps WHERE recipe_version_id = NEW.id) THEN
        RAISE EXCEPTION 'Publication requires servings, a required ingredient and a step' USING ERRCODE = '23514';
      END IF;
      NEW.published_at := clock_timestamp();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_recipe_version BEFORE INSERT OR UPDATE OR DELETE ON app_private.recipe_versions
  FOR EACH ROW EXECUTE FUNCTION app_private.guard_recipe_version();

CREATE FUNCTION app_private.guard_recipe_content() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  version_id uuid;
  version_status text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.recipe_version_id <> OLD.recipe_version_id THEN
    RAISE EXCEPTION 'Content cannot move between recipe versions' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'DELETE' THEN version_id := OLD.recipe_version_id;
  ELSE version_id := NEW.recipe_version_id; END IF;
  -- A real parent write also causes a serialization failure for stale snapshots
  -- under REPEATABLE READ; callers must retry the entire transaction on 40001.
  UPDATE app_private.recipe_versions SET updated_at = updated_at WHERE id = version_id
    RETURNING status INTO version_status;
  IF version_status = 'published' THEN
    RAISE EXCEPTION 'Published recipe children are immutable' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
DO $$
DECLARE v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['recipe_servings', 'recipe_ingredients', 'recipe_steps', 'recipe_tags'] LOOP
    EXECUTE format('CREATE TRIGGER guard_recipe_content BEFORE INSERT OR UPDATE OR DELETE ON app_private.%I FOR EACH ROW EXECUTE FUNCTION app_private.guard_recipe_content()', v_table);
  END LOOP;
END;
$$;

CREATE FUNCTION app_private.guard_current_version() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.current_version_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM app_private.recipe_versions
    WHERE id = NEW.current_version_id AND recipe_id = NEW.id AND status = 'published'
  ) THEN
    RAISE EXCEPTION 'Current version must be a published version of this recipe' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_current_version BEFORE INSERT OR UPDATE ON app_private.recipes
  FOR EACH ROW EXECUTE FUNCTION app_private.guard_current_version();

CREATE FUNCTION app_private.guard_meal_entry() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE plan_start date;
BEGIN
  UPDATE app_private.meal_plans SET updated_at = updated_at
    WHERE id = NEW.meal_plan_id AND owner_id = NEW.owner_id RETURNING starts_on INTO plan_start;
  -- A missing/wrong owner is also rejected by the composite FK.
  IF plan_start IS NOT NULL AND (NEW.planned_on < plan_start OR NEW.planned_on > plan_start + 6) THEN
    RAISE EXCEPTION 'Meal date must be inside its seven-day plan' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'INSERT' OR NEW.recipe_version_id IS DISTINCT FROM OLD.recipe_version_id THEN
    IF NOT EXISTS (
      SELECT 1 FROM app_private.recipe_versions v JOIN app_private.recipes r ON r.id = v.recipe_id
      WHERE v.id = NEW.recipe_version_id AND v.status = 'published' AND r.status = 'published'
    ) THEN
      RAISE EXCEPTION 'New meal entries require an available published recipe version' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_meal_entry BEFORE INSERT OR UPDATE ON app_private.meal_plan_entries
  FOR EACH ROW EXECUTE FUNCTION app_private.guard_meal_entry();
CREATE FUNCTION app_private.guard_plan_dates() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.starts_on <> OLD.starts_on AND EXISTS (
    SELECT 1 FROM app_private.meal_plan_entries
    WHERE meal_plan_id = OLD.id AND (planned_on < NEW.starts_on OR planned_on > NEW.starts_on + 6)
  ) THEN
    RAISE EXCEPTION 'Plan change would strand existing meal entries' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_plan_dates BEFORE UPDATE ON app_private.meal_plans
  FOR EACH ROW EXECUTE FUNCTION app_private.guard_plan_dates();

-- Deny by default, including roles that bypass RLS if granted table access.
-- No permissive policies, RPC grants, signup trigger or business writes in this stage.
DO $$
DECLARE v_table text;
BEGIN
  FOR v_table IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'app_private' AND c.relkind = 'r'
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'app_private' AND information_schema.columns.table_name = v_table
      AND column_name = 'updated_at') THEN
      EXECUTE format('CREATE TRIGGER touch_row BEFORE UPDATE ON app_private.%I FOR EACH ROW EXECUTE FUNCTION app_private.touch_row()', v_table);
    END IF;
    EXECUTE format('ALTER TABLE app_private.%I ENABLE ROW LEVEL SECURITY', v_table);
    EXECUTE format('ALTER TABLE app_private.%I FORCE ROW LEVEL SECURITY', v_table);
  END LOOP;
END;
$$;
REVOKE ALL ON ALL TABLES IN SCHEMA app_private FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA app_private FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA app_private FROM PUBLIC, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA app_private
  REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA api
  REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA api
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated, service_role;
-- PostgreSQL's global PUBLIC EXECUTE default cannot be revoked per schema.
-- Above defaults express intent only; every future function migration MUST
-- explicitly REVOKE EXECUTE on its new functions in the same transaction.
