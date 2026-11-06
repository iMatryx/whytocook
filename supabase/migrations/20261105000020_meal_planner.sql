-- Planner pins survive withdrawal without granting access to obsolete recipe content.
ALTER TABLE app_private.meal_plans ADD COLUMN budget jsonb;
ALTER TABLE app_private.meal_plan_entries
  ADD COLUMN prep_on date,
  ADD COLUMN cost_per_serving jsonb,
  ADD COLUMN recipe_slug text,
  ADD COLUMN recipe_revision integer;
-- Privileged migration only: backfill identities while all historical versions are visible.
UPDATE app_private.meal_plan_entries e SET recipe_slug=r.slug,recipe_revision=v.version_number
  FROM app_private.recipe_versions v JOIN app_private.recipes r ON r.id=v.recipe_id WHERE v.id=e.recipe_version_id;
ALTER TABLE app_private.meal_plan_entries
  ALTER COLUMN recipe_slug SET NOT NULL,
  ALTER COLUMN recipe_revision SET NOT NULL,
  ADD CHECK(recipe_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length(recipe_slug)<=100),
  ADD CHECK(recipe_revision>0),
  ADD CHECK(prep_on IS NULL OR (isfinite(prep_on) AND prep_on<=planned_on));
ALTER TABLE app_private.meal_plans FORCE ROW LEVEL SECURITY;
ALTER TABLE app_private.meal_plan_entries FORCE ROW LEVEL SECURITY;

CREATE TABLE app_private.meal_planner_operations (
  owner_id uuid NOT NULL REFERENCES app_private.profiles(id) ON DELETE CASCADE,
  operation_id uuid NOT NULL,
  payload jsonb NOT NULL,
  result_starts_on date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(owner_id,operation_id)
);
CREATE TABLE app_private.meal_planner_export_state (
  owner_id uuid NOT NULL,
  meal_plan_id uuid NOT NULL,
  exported_revision bigint NOT NULL CHECK(exported_revision>0),
  PRIMARY KEY(owner_id,meal_plan_id),
  FOREIGN KEY(meal_plan_id,owner_id) REFERENCES app_private.meal_plans(id,owner_id) ON DELETE CASCADE
);
CREATE TABLE app_private.meal_planner_export_items (
  owner_id uuid NOT NULL,
  meal_plan_id uuid NOT NULL,
  shopping_item_id uuid NOT NULL,
  saved_revision bigint NOT NULL CHECK(saved_revision>0),
  PRIMARY KEY(owner_id,meal_plan_id,shopping_item_id),
  UNIQUE(shopping_item_id,owner_id),
  FOREIGN KEY(meal_plan_id,owner_id) REFERENCES app_private.meal_plans(id,owner_id) ON DELETE CASCADE,
  FOREIGN KEY(shopping_item_id,owner_id) REFERENCES app_private.shopping_list_items(id,owner_id) ON DELETE CASCADE
);
DO $$ DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['meal_planner_operations','meal_planner_export_state','meal_planner_export_items'] LOOP
    EXECUTE format('ALTER TABLE app_private.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('ALTER TABLE app_private.%I FORCE ROW LEVEL SECURITY',t);
    EXECUTE format('REVOKE ALL ON app_private.%I FROM PUBLIC,anon,authenticated,service_role',t);
    EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON app_private.%I TO cookly_api',t);
    EXECUTE format('CREATE POLICY planner_owner ON app_private.%I TO cookly_api USING(owner_id=(SELECT cookly_security.current_uid())) WITH CHECK(owner_id=(SELECT cookly_security.current_uid()))',t);
  END LOOP;
END;
$$;

CREATE FUNCTION app_private.meal_planner_uuid(p text) RETURNS uuid
LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
BEGIN
  IF p IS NULL OR (p !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' AND lower(p) NOT IN ('00000000-0000-0000-0000-000000000000','ffffffff-ffff-ffff-ffff-ffffffffffff')) THEN RAISE EXCEPTION 'Invalid planner UUID' USING ERRCODE='22023'; END IF;
  RETURN p::uuid;
END;
$$;
CREATE FUNCTION app_private.meal_planner_day(p text) RETURNS date
LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE d date;
BEGIN
  IF p IS NULL OR p !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN RAISE EXCEPTION 'Invalid planner date' USING ERRCODE='22023'; END IF;
  d:=p::date;
  IF d<DATE '0001-01-01' OR d>DATE '9999-12-31' THEN RAISE EXCEPTION 'Invalid planner date' USING ERRCODE='22023'; END IF;
  RETURN d;
END;
$$;
CREATE FUNCTION app_private.meal_planner_week(p date) RETURNS void
LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
BEGIN
  IF p IS NULL OR NOT isfinite(p) OR p<DATE '1900-01-01' OR p>DATE '9999-12-25' THEN RAISE EXCEPTION 'Invalid week date' USING ERRCODE='22023'; END IF;
END;
$$;
CREATE FUNCTION app_private.meal_planner_price(p jsonb,p_observed boolean DEFAULT false) RETURNS void
LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
BEGIN
  IF p='null'::jsonb THEN RETURN; END IF;
  IF NOT app_private.recipe_json_keys(p,CASE WHEN p_observed THEN ARRAY['amount','currency','observedOn'] ELSE ARRAY['amount','currency'] END)
    OR jsonb_typeof(p->'amount') IS DISTINCT FROM 'string' OR coalesce(p->>'amount','') !~ '^(0|[1-9][0-9]{0,5})(\.[0-9]{1,2})?$'
    OR jsonb_typeof(p->'currency') IS DISTINCT FROM 'string' OR coalesce(p->>'currency','') NOT IN ('MDL','RON') THEN RAISE EXCEPTION 'Invalid planner price' USING ERRCODE='22023'; END IF;
  IF p_observed THEN
    IF jsonb_typeof(p->'observedOn') IS DISTINCT FROM 'string' THEN RAISE EXCEPTION 'Invalid price date' USING ERRCODE='22023'; END IF;
    PERFORM app_private.meal_planner_day(p->>'observedOn');
  END IF;
END;
$$;
-- Keep legacy RPC inserts compatible and populate pins at the point of the write.
-- The pre-existing guard_meal_entry still governs publication and parent revisions.
CREATE FUNCTION app_private.meal_planner_pin_entry() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE slug text; rev integer; first_day date;
BEGIN
  IF TG_OP='INSERT' OR NEW.recipe_version_id IS DISTINCT FROM OLD.recipe_version_id THEN
    SELECT r.slug,v.version_number INTO slug,rev FROM app_private.recipe_versions v JOIN app_private.recipes r ON r.id=v.recipe_id WHERE v.id=NEW.recipe_version_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Recipe unavailable' USING ERRCODE='P0002'; END IF;
    NEW.recipe_slug:=slug; NEW.recipe_revision:=rev;
  ELSIF NEW.recipe_slug IS DISTINCT FROM OLD.recipe_slug OR NEW.recipe_revision IS DISTINCT FROM OLD.recipe_revision THEN
    RAISE EXCEPTION 'Recipe pin is immutable without a version change' USING ERRCODE='23514';
  END IF;
  SELECT starts_on INTO first_day FROM app_private.meal_plans WHERE id=NEW.meal_plan_id AND owner_id=NEW.owner_id;
  IF NEW.prep_on IS NOT NULL AND (NOT isfinite(NEW.prep_on) OR NEW.prep_on<first_day OR NEW.prep_on>NEW.planned_on) THEN RAISE EXCEPTION 'Prep date outside plan' USING ERRCODE='22023'; END IF;
  IF TG_OP='INSERT' AND (SELECT count(*) FROM app_private.meal_plan_entries WHERE meal_plan_id=NEW.meal_plan_id AND owner_id=NEW.owner_id)>=56 THEN RAISE EXCEPTION 'Planner capacity exceeded' USING ERRCODE='54000'; END IF;
  PERFORM app_private.meal_planner_price(coalesce(NEW.cost_per_serving,'null'::jsonb),true);
  RETURN NEW;
END;
$$;
CREATE TRIGGER planner_pin_entry BEFORE INSERT OR UPDATE ON app_private.meal_plan_entries FOR EACH ROW EXECUTE FUNCTION app_private.meal_planner_pin_entry();
REVOKE ALL ON FUNCTION app_private.meal_planner_uuid(text),app_private.meal_planner_day(text),app_private.meal_planner_week(date),app_private.meal_planner_price(jsonb,boolean),app_private.meal_planner_pin_entry() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION app_private.meal_planner_uuid(text),app_private.meal_planner_day(text),app_private.meal_planner_week(date),app_private.meal_planner_price(jsonb,boolean),app_private.meal_planner_pin_entry() TO cookly_api;

CREATE FUNCTION api.meal_planner_metadata() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
  IF (SELECT count(*) FROM app_private.recipes r JOIN app_private.recipe_versions v ON v.id=r.current_version_id WHERE r.status='published' AND v.status='published')>1000 THEN RAISE EXCEPTION 'Planner catalog capacity exceeded' USING ERRCODE='54000'; END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('key',r.slug,'revision',v.version_number,'versionId',v.id,
    'nutrition',CASE WHEN s.payload#>>'{nutrition,status}'='verified' THEN jsonb_build_object('status','verified','perServing',s.payload#>'{nutrition,perServing}','source',s.payload#>'{nutrition,source}') ELSE jsonb_build_object('status','unavailable','perServing',NULL,'source',NULL) END,
    'budgetSource',CASE WHEN s.payload#>>'{budget,status}'='verified' THEN s.payload#>'{budget,source}' ELSE 'null'::jsonb END) ORDER BY r.slug),'[]'::jsonb)
    INTO result FROM app_private.recipes r JOIN app_private.recipe_versions v ON v.id=r.current_version_id LEFT JOIN app_private.recipe_seed_records s ON s.recipe_version_id=v.id WHERE r.status='published' AND v.status='published';
  RETURN result;
END;
$$;
CREATE FUNCTION api.meal_planner_snapshot(p_starts_on date) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=cookly_security.current_uid(); plan app_private.meal_plans; entries jsonb; exported text;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
  PERFORM app_private.meal_planner_week(p_starts_on);
  SELECT p.* INTO plan FROM app_private.meal_plans p WHERE p.owner_id=actor AND p.starts_on=p_starts_on;
  IF NOT FOUND THEN RETURN jsonb_build_object('accountId',actor,'week',jsonb_build_object('startsOn',p_starts_on,'revision','0','budget',NULL,'entries','[]'::jsonb,'exportedRevision',NULL)); END IF;
  IF (SELECT count(*) FROM app_private.meal_plan_entries e WHERE e.owner_id=actor AND e.meal_plan_id=plan.id)>56 THEN RAISE EXCEPTION 'Planner capacity exceeded' USING ERRCODE='54000'; END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',e.id,'recipeKey',e.recipe_slug,'recipeRevision',e.recipe_revision,'versionId',e.recipe_version_id,'plannedOn',e.planned_on,'slot',e.meal_slot,'servings',e.servings,'prepOn',e.prep_on,'costPerServing',e.cost_per_serving) ORDER BY e.planned_on,e.meal_slot,e.id),'[]'::jsonb)
    INTO entries FROM app_private.meal_plan_entries e WHERE e.owner_id=actor AND e.meal_plan_id=plan.id;
  SELECT s.exported_revision::text INTO exported FROM app_private.meal_planner_export_state s WHERE s.owner_id=actor AND s.meal_plan_id=plan.id;
  RETURN jsonb_build_object('accountId',actor,'week',jsonb_build_object('startsOn',plan.starts_on,'revision',plan.revision::text,'budget',plan.budget,'entries',entries,'exportedRevision',exported));
END;
$$;

CREATE FUNCTION api.meal_planner_mutate(p_starts_on date,p_expected_revision text,p_operation_id uuid,p_command jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=cookly_security.current_uid(); plan app_private.meal_plans; previous app_private.meal_planner_operations; signature jsonb;
  kind text; entry jsonb; entry_id uuid; version_id uuid; planned date; prep date; old_entry app_private.meal_plan_entries; target date; target_id uuid; delta integer;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
  PERFORM app_private.meal_planner_week(p_starts_on);
  IF p_operation_id IS NULL OR p_expected_revision IS NULL OR p_expected_revision !~ '^(0|[1-9][0-9]{0,18})$' OR jsonb_typeof(p_command) IS DISTINCT FROM 'object' OR octet_length(p_command::text)>65536 THEN RAISE EXCEPTION 'Invalid planner command' USING ERRCODE='22023'; END IF;
  PERFORM 1 FROM app_private.profiles WHERE id=actor FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
  signature:=jsonb_build_object('kind','mutate','startsOn',p_starts_on,'expectedRevision',p_expected_revision,'command',p_command);
  SELECT o.* INTO previous FROM app_private.meal_planner_operations o WHERE o.owner_id=actor AND o.operation_id=p_operation_id;
  IF FOUND THEN
    IF previous.payload IS DISTINCT FROM signature THEN RAISE EXCEPTION 'Operation key reused' USING ERRCODE='22023'; END IF;
    RETURN api.meal_planner_snapshot(previous.result_starts_on);
  END IF;
  SELECT p.* INTO plan FROM app_private.meal_plans p WHERE p.owner_id=actor AND p.starts_on=p_starts_on FOR UPDATE;
  IF coalesce(plan.revision::text,'0')<>p_expected_revision THEN RAISE EXCEPTION 'Revision conflict' USING ERRCODE='40001'; END IF;
  kind:=p_command->>'kind';
  IF kind='configure' THEN
    IF NOT app_private.recipe_json_keys(p_command,ARRAY['kind','budget']) THEN RAISE EXCEPTION 'Invalid configuration' USING ERRCODE='22023'; END IF;
    PERFORM app_private.meal_planner_price(p_command->'budget');
  ELSIF kind='saveEntry' THEN
    IF NOT app_private.recipe_json_keys(p_command,ARRAY['kind','create','entry']) OR jsonb_typeof(p_command->'create') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'Invalid entry command' USING ERRCODE='22023'; END IF;
    entry:=p_command->'entry';
    IF NOT app_private.recipe_json_keys(entry,ARRAY['id','recipeKey','recipeRevision','versionId','plannedOn','slot','servings','prepOn','costPerServing'])
      OR jsonb_typeof(entry->'id') IS DISTINCT FROM 'string' OR jsonb_typeof(entry->'versionId') IS DISTINCT FROM 'string'
      OR jsonb_typeof(entry->'recipeKey') IS DISTINCT FROM 'string' OR char_length(entry->>'recipeKey')>100 OR entry->>'recipeKey' !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
      OR jsonb_typeof(entry->'recipeRevision') IS DISTINCT FROM 'number' OR (entry->>'recipeRevision')::numeric<>trunc((entry->>'recipeRevision')::numeric) OR (entry->>'recipeRevision')::numeric<1
      OR jsonb_typeof(entry->'servings') IS DISTINCT FROM 'number' OR (entry->>'servings')::numeric<>trunc((entry->>'servings')::numeric) OR (entry->>'servings')::numeric NOT BETWEEN 1 AND 20
      OR jsonb_typeof(entry->'slot') IS DISTINCT FROM 'string' OR coalesce(entry->>'slot','') NOT IN ('breakfast','lunch','dinner','snack')
      OR jsonb_typeof(entry->'plannedOn') IS DISTINCT FROM 'string' OR jsonb_typeof(entry->'prepOn') NOT IN ('null','string') THEN RAISE EXCEPTION 'Invalid planner entry' USING ERRCODE='22023'; END IF;
    entry_id:=app_private.meal_planner_uuid(entry->>'id'); version_id:=app_private.meal_planner_uuid(entry->>'versionId');
    planned:=app_private.meal_planner_day(entry->>'plannedOn');
    IF entry->>'prepOn' IS NOT NULL THEN prep:=app_private.meal_planner_day(entry->>'prepOn'); END IF;
    IF planned<p_starts_on OR planned>p_starts_on+6 OR (prep IS NOT NULL AND (prep<p_starts_on OR prep>planned)) THEN RAISE EXCEPTION 'Entry outside week' USING ERRCODE='22023'; END IF;
    PERFORM app_private.meal_planner_price(entry->'costPerServing',true);
    PERFORM 1 FROM app_private.recipes r JOIN app_private.recipe_versions v ON v.id=r.current_version_id WHERE r.status='published' AND v.status='published' AND r.slug=entry->>'recipeKey' AND v.id=version_id AND v.version_number=(entry->>'recipeRevision')::numeric;
    IF NOT FOUND THEN RAISE EXCEPTION 'Pinned recipe unavailable' USING ERRCODE='P0002'; END IF;
    SELECT e.* INTO old_entry FROM app_private.meal_plan_entries e WHERE e.id=entry_id AND e.owner_id=actor FOR UPDATE;
    IF (p_command->>'create')::boolean THEN
      IF old_entry.id IS NOT NULL THEN RAISE EXCEPTION 'Entry already exists' USING ERRCODE='40001'; END IF;
    ELSE
      IF old_entry.id IS NULL OR old_entry.meal_plan_id IS DISTINCT FROM plan.id THEN RAISE EXCEPTION 'Entry unavailable' USING ERRCODE='P0002'; END IF;
      IF (old_entry.recipe_version_id IS DISTINCT FROM version_id OR old_entry.servings IS DISTINCT FROM (entry->>'servings')::integer)
        AND EXISTS(SELECT 1 FROM app_private.shopping_list_item_sources s WHERE s.meal_plan_entry_id=entry_id AND s.owner_id=actor) THEN RAISE EXCEPTION 'Shopping reconciliation required' USING ERRCODE='23514'; END IF;
    END IF;
  ELSIF kind='removeEntry' THEN
    IF NOT app_private.recipe_json_keys(p_command,ARRAY['kind','id']) OR jsonb_typeof(p_command->'id') IS DISTINCT FROM 'string' THEN RAISE EXCEPTION 'Invalid removal' USING ERRCODE='22023'; END IF;
    entry_id:=app_private.meal_planner_uuid(p_command->>'id');
    SELECT e.* INTO old_entry FROM app_private.meal_plan_entries e WHERE e.id=entry_id AND e.owner_id=actor AND e.meal_plan_id=plan.id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Entry unavailable' USING ERRCODE='P0002'; END IF;
  ELSIF kind='copyWeek' THEN
    IF NOT app_private.recipe_json_keys(p_command,ARRAY['kind','targetStartsOn']) OR jsonb_typeof(p_command->'targetStartsOn') IS DISTINCT FROM 'string' THEN RAISE EXCEPTION 'Invalid copy' USING ERRCODE='22023'; END IF;
    target:=app_private.meal_planner_day(p_command->>'targetStartsOn'); PERFORM app_private.meal_planner_week(target);
    IF plan.id IS NULL THEN RAISE EXCEPTION 'Source week unavailable' USING ERRCODE='P0002'; END IF;
    IF EXISTS(SELECT 1 FROM app_private.meal_plans p WHERE p.owner_id=actor AND p.starts_on=target) THEN RAISE EXCEPTION 'Target week already exists' USING ERRCODE='40001'; END IF;
    IF EXISTS(SELECT 1 FROM app_private.meal_plan_entries e WHERE e.owner_id=actor AND e.meal_plan_id=plan.id AND NOT EXISTS(SELECT 1 FROM app_private.recipes r JOIN app_private.recipe_versions v ON v.id=r.current_version_id WHERE r.status='published' AND v.status='published' AND v.id=e.recipe_version_id AND r.slug=e.recipe_slug AND v.version_number=e.recipe_revision)) THEN RAISE EXCEPTION 'Pinned recipe unavailable' USING ERRCODE='P0002'; END IF;
  ELSE RAISE EXCEPTION 'Invalid planner command kind' USING ERRCODE='22023'; END IF;
  IF plan.id IS NULL THEN
    INSERT INTO app_private.meal_plans(owner_id,starts_on,budget) VALUES(actor,p_starts_on,CASE WHEN kind='configure' THEN nullif(p_command->'budget','null'::jsonb) ELSE NULL END) RETURNING * INTO plan;
  END IF;
  IF kind='configure' THEN
    IF p_expected_revision<>'0' THEN UPDATE app_private.meal_plans SET budget=nullif(p_command->'budget','null'::jsonb) WHERE id=plan.id AND owner_id=actor; END IF;
  ELSIF kind='saveEntry' THEN
    IF (p_command->>'create')::boolean THEN
      INSERT INTO app_private.meal_plan_entries(id,owner_id,meal_plan_id,recipe_version_id,planned_on,meal_slot,servings,prep_on,cost_per_serving)
        VALUES(entry_id,actor,plan.id,version_id,planned,entry->>'slot',(entry->>'servings')::integer,prep,nullif(entry->'costPerServing','null'::jsonb));
    ELSE
      UPDATE app_private.meal_plan_entries SET recipe_version_id=version_id,planned_on=planned,meal_slot=entry->>'slot',servings=(entry->>'servings')::integer,prep_on=prep,cost_per_serving=nullif(entry->'costPerServing','null'::jsonb) WHERE id=entry_id AND owner_id=actor;
    END IF;
  ELSIF kind='removeEntry' THEN
    PERFORM api.delete_meal_entry(entry_id,old_entry.revision);
    UPDATE app_private.meal_plans SET updated_at=updated_at WHERE id=plan.id AND owner_id=actor;
  ELSIF kind='copyWeek' THEN
    delta:=target-p_starts_on;
    INSERT INTO app_private.meal_plans(owner_id,starts_on,budget) VALUES(actor,target,plan.budget) RETURNING id INTO target_id;
    INSERT INTO app_private.meal_plan_entries(owner_id,meal_plan_id,recipe_version_id,planned_on,meal_slot,servings,prep_on,cost_per_serving)
      SELECT actor,target_id,e.recipe_version_id,e.planned_on+delta,e.meal_slot,e.servings,e.prep_on+delta,e.cost_per_serving FROM app_private.meal_plan_entries e WHERE e.owner_id=actor AND e.meal_plan_id=plan.id;
  END IF;
  INSERT INTO app_private.meal_planner_operations(owner_id,operation_id,payload,result_starts_on) VALUES(actor,p_operation_id,signature,coalesce(target,p_starts_on));
  RETURN api.meal_planner_snapshot(coalesce(target,p_starts_on));
END;
$$;

CREATE FUNCTION api.meal_planner_export(p_starts_on date,p_expected_revision text,p_operation_id uuid,p_items jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
<<planner_export>>
DECLARE actor uuid:=cookly_security.current_uid(); plan app_private.meal_plans; previous app_private.meal_planner_operations; signature jsonb;
  list_id uuid; line jsonb; ingredient_id uuid; unit_id uuid; new_id uuid; old_row record; shopping jsonb; input_id uuid;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
  PERFORM app_private.meal_planner_week(p_starts_on);
  IF p_operation_id IS NULL OR p_expected_revision IS NULL OR p_expected_revision !~ '^(0|[1-9][0-9]{0,18})$' OR jsonb_typeof(p_items) IS DISTINCT FROM 'array' OR jsonb_array_length(p_items)>100 OR octet_length(p_items::text)>131072 THEN RAISE EXCEPTION 'Invalid planner export' USING ERRCODE='22023'; END IF;
  PERFORM 1 FROM app_private.profiles WHERE id=actor FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
  signature:=jsonb_build_object('kind','export','startsOn',p_starts_on,'expectedRevision',p_expected_revision,'items',p_items);
  SELECT o.* INTO previous FROM app_private.meal_planner_operations o WHERE o.owner_id=actor AND o.operation_id=p_operation_id;
  IF FOUND THEN
    IF previous.payload IS DISTINCT FROM signature THEN RAISE EXCEPTION 'Operation key reused' USING ERRCODE='22023'; END IF;
    shopping:=api.smart_shopping_snapshot();
    RETURN api.meal_planner_snapshot(p_starts_on)||jsonb_build_object('items',shopping->'items');
  END IF;
  SELECT p.* INTO plan FROM app_private.meal_plans p WHERE p.owner_id=actor AND p.starts_on=p_starts_on FOR UPDATE;
  IF coalesce(plan.revision::text,'0')<>p_expected_revision THEN RAISE EXCEPTION 'Revision conflict' USING ERRCODE='40001'; END IF;
  IF plan.id IS NULL THEN RAISE EXCEPTION 'Plan unavailable' USING ERRCODE='P0002'; END IF;
  IF (SELECT count(DISTINCT v->>'id') FROM jsonb_array_elements(p_items) v)<>jsonb_array_length(p_items) THEN RAISE EXCEPTION 'Duplicate export item' USING ERRCODE='22023'; END IF;
  -- Composition calculates shortages. SQL independently restricts ingredients and units.
  FOR line IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    IF NOT app_private.recipe_json_keys(line,ARRAY['id','ingredientId','label','category','quantity','unitCode','checked','price','uncertain'])
      OR jsonb_typeof(line->'id') IS DISTINCT FROM 'string' OR jsonb_typeof(line->'ingredientId') IS DISTINCT FROM 'string'
      OR line->'checked' IS DISTINCT FROM 'false'::jsonb OR line->'price' IS DISTINCT FROM 'null'::jsonb THEN RAISE EXCEPTION 'Invalid export item' USING ERRCODE='22023'; END IF;
    input_id:=app_private.meal_planner_uuid(line->>'id');
    PERFORM app_private.smart_shopping_fields(line-'id'-'ingredientId');
    ingredient_id:=app_private.meal_planner_uuid(line->>'ingredientId');
    IF NOT EXISTS(SELECT 1 FROM app_private.ingredients i WHERE i.id=planner_export.ingredient_id AND i.is_active)
      OR NOT EXISTS(SELECT 1 FROM app_private.meal_plan_entries e JOIN app_private.recipe_ingredients ri ON ri.recipe_version_id=e.recipe_version_id WHERE e.meal_plan_id=plan.id AND e.owner_id=actor AND ri.ingredient_id=planner_export.ingredient_id) THEN RAISE EXCEPTION 'Ingredient not in current plan' USING ERRCODE='22023'; END IF;
    IF line->>'unitCode' IS NOT NULL AND NOT EXISTS(SELECT 1 FROM app_private.ingredient_units iu JOIN app_private.units u ON u.id=iu.unit_id WHERE iu.ingredient_id=planner_export.ingredient_id AND u.code=line->>'unitCode') THEN RAISE EXCEPTION 'Unit not allowed' USING ERRCODE='22023'; END IF;
  END LOOP;
  SELECT l.id INTO list_id FROM app_private.shopping_lists l WHERE l.owner_id=actor AND l.status='active' FOR UPDATE;
  -- Lock every row before checking any deletion. Changed/checked active rows block all replacement.
  FOR old_row IN SELECT s.*,l.status,x.saved_revision FROM app_private.meal_planner_export_items x JOIN app_private.shopping_list_items s ON s.id=x.shopping_item_id AND s.owner_id=x.owner_id JOIN app_private.shopping_lists l ON l.id=s.shopping_list_id AND l.owner_id=s.owner_id WHERE x.owner_id=actor AND x.meal_plan_id=plan.id ORDER BY s.id FOR UPDATE OF s LOOP
    IF old_row.status='active' AND NOT old_row.transferred AND (old_row.revision<>old_row.saved_revision OR old_row.checked_at IS NOT NULL OR old_row.purchased_quantity<>0) THEN RAISE EXCEPTION 'Shopping reconciliation required' USING ERRCODE='40001'; END IF;
  END LOOP;
  DELETE FROM app_private.shopping_list_items s USING app_private.meal_planner_export_items x,app_private.shopping_lists l
    WHERE x.owner_id=actor AND x.meal_plan_id=plan.id AND s.id=x.shopping_item_id AND s.owner_id=x.owner_id AND l.id=s.shopping_list_id AND l.owner_id=actor AND l.status='active' AND NOT s.transferred;
  DELETE FROM app_private.meal_planner_export_items WHERE owner_id=actor AND meal_plan_id=plan.id;
  IF list_id IS NULL AND jsonb_array_length(p_items)>0 THEN list_id:=api.save_shopping_list(NULL,NULL,'Cumpărături din plan','active'); END IF;
  FOR line IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    ingredient_id:=app_private.meal_planner_uuid(line->>'ingredientId'); unit_id:=NULL;
    SELECT u.id INTO unit_id FROM app_private.units u WHERE u.code=line->>'unitCode';
    new_id:=api.save_shopping_item(NULL,NULL,list_id,btrim(line->>'label'),ingredient_id,line->>'quantity',unit_id);
    UPDATE app_private.shopping_list_items SET category=btrim(line->>'category'),uncertain=(line->>'uncertain')::boolean WHERE id=new_id AND owner_id=actor;
    INSERT INTO app_private.meal_planner_export_items(owner_id,meal_plan_id,shopping_item_id,saved_revision) SELECT actor,plan.id,s.id,s.revision FROM app_private.shopping_list_items s WHERE s.id=new_id AND s.owner_id=actor;
  END LOOP;
  INSERT INTO app_private.meal_planner_export_state(owner_id,meal_plan_id,exported_revision) VALUES(actor,plan.id,plan.revision)
    ON CONFLICT(owner_id,meal_plan_id) DO UPDATE SET exported_revision=EXCLUDED.exported_revision;
  INSERT INTO app_private.meal_planner_operations(owner_id,operation_id,payload,result_starts_on) VALUES(actor,p_operation_id,signature,p_starts_on);
  shopping:=api.smart_shopping_snapshot(); -- Capacity failures roll back deletes, inserts, ledger and marker.
  RETURN api.meal_planner_snapshot(p_starts_on)||jsonb_build_object('items',shopping->'items');
END;
$$;
GRANT CREATE ON SCHEMA api TO cookly_api;
ALTER FUNCTION api.meal_planner_metadata() OWNER TO cookly_api;
ALTER FUNCTION api.meal_planner_snapshot(date) OWNER TO cookly_api;
ALTER FUNCTION api.meal_planner_mutate(date,text,uuid,jsonb) OWNER TO cookly_api;
ALTER FUNCTION api.meal_planner_export(date,text,uuid,jsonb) OWNER TO cookly_api;
REVOKE CREATE ON SCHEMA api FROM cookly_api;
REVOKE ALL ON FUNCTION api.meal_planner_metadata(),api.meal_planner_snapshot(date),api.meal_planner_mutate(date,text,uuid,jsonb),api.meal_planner_export(date,text,uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION api.meal_planner_metadata() TO anon,authenticated;
GRANT EXECUTE ON FUNCTION api.meal_planner_snapshot(date),api.meal_planner_mutate(date,text,uuid,jsonb),api.meal_planner_export(date,text,uuid,jsonb) TO authenticated;
NOTIFY pgrst,'reload schema';
