-- Narrow commands: fixed arguments, no owner supplied, no SQL from JSON.
CREATE FUNCTION api.actor_context() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor uuid := cookly_security.current_uid();
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
  RETURN jsonb_build_object('id',actor,'roles',cookly_security.assigned_roles(),
    'aal',coalesce(auth.jwt()->>'aal','aal1'));
END;
$$;
CREATE FUNCTION api.update_my_profile(p_display_name text,p_locale text,p_time_zone text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF cookly_security.current_uid() IS NULL THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name=p_time_zone) THEN
    RAISE EXCEPTION 'Invalid time zone' USING ERRCODE='22023';
  END IF;
  UPDATE app_private.profiles SET display_name=p_display_name,locale=p_locale,time_zone=p_time_zone
    WHERE id=cookly_security.current_uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Resource unavailable' USING ERRCODE='P0002'; END IF;
END;
$$;

CREATE FUNCTION api.save_pantry_item(p_id uuid,p_expected_revision bigint,p_ingredient_id uuid,
  p_quantity text,p_unit_id uuid,p_location text,p_expires_on date) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor uuid := cookly_security.current_uid(); current_revision bigint; result uuid;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
  IF p_id IS NULL THEN
    IF p_expected_revision IS NOT NULL THEN RAISE EXCEPTION 'Invalid revision' USING ERRCODE='22023'; END IF;
    INSERT INTO app_private.pantry_items(owner_id,ingredient_id,quantity,unit_id,location,expires_on)
      VALUES(actor,p_ingredient_id,p_quantity::app_private.quantity,p_unit_id,p_location,p_expires_on) RETURNING id INTO result;
  ELSE
    SELECT revision INTO current_revision FROM app_private.pantry_items WHERE id=p_id AND owner_id=actor FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Resource unavailable' USING ERRCODE='P0002'; END IF;
    IF p_expected_revision IS DISTINCT FROM current_revision THEN RAISE EXCEPTION 'Revision conflict' USING ERRCODE='40001'; END IF;
    UPDATE app_private.pantry_items SET ingredient_id=p_ingredient_id,quantity=p_quantity::app_private.quantity,
      unit_id=p_unit_id,location=p_location,expires_on=p_expires_on WHERE id=p_id AND owner_id=actor;
    result:=p_id;
  END IF;
  RETURN result;
END;
$$;
CREATE FUNCTION api.save_meal_plan(p_id uuid,p_expected_revision bigint,p_starts_on date) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor uuid := cookly_security.current_uid(); current_revision bigint; result uuid;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
  IF p_id IS NULL THEN
    IF p_expected_revision IS NOT NULL THEN RAISE EXCEPTION 'Invalid revision' USING ERRCODE='22023'; END IF;
    INSERT INTO app_private.meal_plans(owner_id,starts_on) VALUES(actor,p_starts_on) RETURNING id INTO result;
  ELSE
    SELECT revision INTO current_revision FROM app_private.meal_plans WHERE id=p_id AND owner_id=actor FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Resource unavailable' USING ERRCODE='P0002'; END IF;
    IF p_expected_revision IS DISTINCT FROM current_revision THEN RAISE EXCEPTION 'Revision conflict' USING ERRCODE='40001'; END IF;
    UPDATE app_private.meal_plans SET starts_on=p_starts_on WHERE id=p_id AND owner_id=actor;
    result:=p_id;
  END IF;
  RETURN result;
END;
$$;
CREATE FUNCTION api.save_meal_entry(p_id uuid,p_expected_revision bigint,p_plan_id uuid,p_recipe_version_id uuid,
  p_planned_on date,p_meal_slot text,p_servings integer) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor uuid := cookly_security.current_uid(); current_revision bigint; old_plan uuid; old_recipe uuid; old_servings smallint; result uuid;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
  PERFORM 1 FROM app_private.meal_plans WHERE id=p_plan_id AND owner_id=actor FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Resource unavailable' USING ERRCODE='P0002'; END IF;
  IF p_id IS NULL THEN
    IF p_expected_revision IS NOT NULL THEN RAISE EXCEPTION 'Invalid revision' USING ERRCODE='22023'; END IF;
    INSERT INTO app_private.meal_plan_entries(owner_id,meal_plan_id,recipe_version_id,planned_on,meal_slot,servings)
      VALUES(actor,p_plan_id,p_recipe_version_id,p_planned_on,p_meal_slot,p_servings) RETURNING id INTO result;
  ELSE
    SELECT revision,meal_plan_id,recipe_version_id,servings INTO current_revision,old_plan,old_recipe,old_servings
      FROM app_private.meal_plan_entries WHERE id=p_id AND owner_id=actor FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Resource unavailable' USING ERRCODE='P0002'; END IF;
    IF old_plan<>p_plan_id THEN RAISE EXCEPTION 'Cannot move entry between plans' USING ERRCODE='22023'; END IF;
    IF p_expected_revision IS DISTINCT FROM current_revision THEN RAISE EXCEPTION 'Revision conflict' USING ERRCODE='40001'; END IF;
    IF (old_recipe IS DISTINCT FROM p_recipe_version_id OR old_servings IS DISTINCT FROM p_servings)
      AND EXISTS (SELECT 1 FROM app_private.shopping_list_item_sources WHERE meal_plan_entry_id=p_id AND owner_id=actor) THEN
      RAISE EXCEPTION 'Shopping reconciliation required' USING ERRCODE='23514';
    END IF;
    UPDATE app_private.meal_plan_entries SET recipe_version_id=p_recipe_version_id,planned_on=p_planned_on,
      meal_slot=p_meal_slot,servings=p_servings WHERE id=p_id AND owner_id=actor;
    result:=p_id;
  END IF;
  RETURN result;
END;
$$;
CREATE FUNCTION api.save_shopping_list(p_id uuid,p_expected_revision bigint,p_name text,p_status text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor uuid := cookly_security.current_uid(); current_revision bigint; result uuid;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
  IF p_id IS NULL THEN
    IF p_expected_revision IS NOT NULL THEN RAISE EXCEPTION 'Invalid revision' USING ERRCODE='22023'; END IF;
    INSERT INTO app_private.shopping_lists(owner_id,name,status) VALUES(actor,p_name,p_status) RETURNING id INTO result;
  ELSE
    SELECT revision INTO current_revision FROM app_private.shopping_lists WHERE id=p_id AND owner_id=actor FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Resource unavailable' USING ERRCODE='P0002'; END IF;
    IF p_expected_revision IS DISTINCT FROM current_revision THEN RAISE EXCEPTION 'Revision conflict' USING ERRCODE='40001'; END IF;
    UPDATE app_private.shopping_lists SET name=p_name,status=p_status WHERE id=p_id AND owner_id=actor;
    result:=p_id;
  END IF;
  RETURN result;
END;
$$;
CREATE FUNCTION api.save_shopping_item(p_id uuid,p_expected_revision bigint,p_list_id uuid,p_label text,
  p_ingredient_id uuid,p_quantity text,p_unit_id uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor uuid := cookly_security.current_uid(); current_revision bigint; old_list uuid; old_origin text; result uuid;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
  PERFORM 1 FROM app_private.shopping_lists WHERE id=p_list_id AND owner_id=actor FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Resource unavailable' USING ERRCODE='P0002'; END IF;
  IF p_id IS NULL THEN
    IF p_expected_revision IS NOT NULL THEN RAISE EXCEPTION 'Invalid revision' USING ERRCODE='22023'; END IF;
    INSERT INTO app_private.shopping_list_items(owner_id,shopping_list_id,label,origin,ingredient_id,quantity,unit_id)
      VALUES(actor,p_list_id,p_label,'manual',p_ingredient_id,p_quantity::app_private.quantity,p_unit_id) RETURNING id INTO result;
  ELSE
    SELECT revision,shopping_list_id,origin INTO current_revision,old_list,old_origin
      FROM app_private.shopping_list_items WHERE id=p_id AND owner_id=actor FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Resource unavailable' USING ERRCODE='P0002'; END IF;
    IF old_list<>p_list_id OR old_origin<>'manual' THEN RAISE EXCEPTION 'Operation not allowed' USING ERRCODE='42501'; END IF;
    IF p_expected_revision IS DISTINCT FROM current_revision THEN RAISE EXCEPTION 'Revision conflict' USING ERRCODE='40001'; END IF;
    UPDATE app_private.shopping_list_items SET label=p_label,ingredient_id=p_ingredient_id,
      quantity=p_quantity::app_private.quantity,unit_id=p_unit_id WHERE id=p_id AND owner_id=actor;
    result:=p_id;
  END IF;
  RETURN result;
END;
$$;
CREATE FUNCTION api.set_shopping_progress(p_id uuid,p_expected_revision bigint,p_purchased_quantity text,p_checked boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor uuid := cookly_security.current_uid(); current_revision bigint;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
  SELECT revision INTO current_revision FROM app_private.shopping_list_items WHERE id=p_id AND owner_id=actor FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Resource unavailable' USING ERRCODE='P0002'; END IF;
  IF p_expected_revision IS DISTINCT FROM current_revision THEN RAISE EXCEPTION 'Revision conflict' USING ERRCODE='40001'; END IF;
  IF p_checked IS NULL THEN RAISE EXCEPTION 'Checked is required' USING ERRCODE='22023'; END IF;
  UPDATE app_private.shopping_list_items SET purchased_quantity=p_purchased_quantity::app_private.quantity,
    checked_at=CASE WHEN p_checked THEN clock_timestamp() ELSE NULL END WHERE id=p_id AND owner_id=actor;
END;
$$;

-- Generates five fixed delete functions from migration-owned names, never input.
DO $$
DECLARE entry text[]; target_table text; fn text; dependency_guard text;
BEGIN
  FOREACH entry SLICE 1 IN ARRAY ARRAY[
    ['delete_pantry_item','pantry_items'],['delete_meal_plan','meal_plans'],['delete_meal_entry','meal_plan_entries'],
    ['delete_shopping_list','shopping_lists'],['delete_shopping_item','shopping_list_items']
  ] LOOP
    fn:=entry[1]; target_table:=entry[2];
    dependency_guard:=CASE fn
      WHEN 'delete_meal_entry' THEN $guard$
        IF EXISTS (SELECT 1 FROM app_private.shopping_list_item_sources WHERE meal_plan_entry_id=p_id AND owner_id=actor) THEN
          RAISE EXCEPTION 'Shopping reconciliation required' USING ERRCODE='23514';
        END IF;
      $guard$
      WHEN 'delete_meal_plan' THEN $guard$
        PERFORM 1 FROM app_private.meal_plan_entries WHERE meal_plan_id=p_id AND owner_id=actor ORDER BY id FOR UPDATE;
        IF EXISTS (SELECT 1 FROM app_private.shopping_list_item_sources s JOIN app_private.meal_plan_entries e
          ON e.id=s.meal_plan_entry_id AND e.owner_id=s.owner_id WHERE e.meal_plan_id=p_id AND e.owner_id=actor) THEN
          RAISE EXCEPTION 'Shopping reconciliation required' USING ERRCODE='23514';
        END IF;
      $guard$
      ELSE '' END;
    EXECUTE format($body$CREATE FUNCTION api.%I(p_id uuid,p_expected_revision bigint) RETURNS void
      LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
      DECLARE actor uuid:=cookly_security.current_uid(); current_revision bigint;
      BEGIN
        IF actor IS NULL THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
        SELECT revision INTO current_revision FROM app_private.%I WHERE id=p_id AND owner_id=actor FOR UPDATE;
        IF NOT FOUND THEN RAISE EXCEPTION 'Resource unavailable' USING ERRCODE='P0002'; END IF;
        IF p_expected_revision IS DISTINCT FROM current_revision THEN RAISE EXCEPTION 'Revision conflict' USING ERRCODE='40001'; END IF;
        %s
        DELETE FROM app_private.%I WHERE id=p_id AND owner_id=actor;
      END; $fn$ $body$,fn,target_table,dependency_guard,target_table);
  END LOOP;
END;
$$;
CREATE FUNCTION api.set_favorite(p_recipe_id uuid,p_enabled boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=cookly_security.current_uid();
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
  IF p_enabled IS NULL THEN RAISE EXCEPTION 'Enabled is required' USING ERRCODE='22023'; END IF;
  IF p_enabled THEN
    PERFORM 1 FROM app_private.recipes WHERE id=p_recipe_id AND status='published';
    IF NOT FOUND THEN RAISE EXCEPTION 'Resource unavailable' USING ERRCODE='P0002'; END IF;
    INSERT INTO app_private.favorites(owner_id,recipe_id) VALUES(actor,p_recipe_id) ON CONFLICT DO NOTHING;
  ELSE DELETE FROM app_private.favorites WHERE owner_id=actor AND recipe_id=p_recipe_id;
  END IF;
END;
$$;

CREATE FUNCTION api.save_recipe_draft(p_recipe_id uuid,p_slug text,p_version_id uuid,p_expected_updated_at timestamptz,
  p_title text,p_summary text,p_difficulty text,p_active_minutes integer,p_total_minutes integer,
  p_base_servings integer,p_ingredients jsonb,p_steps jsonb,p_tag_ids uuid[]) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_recipe_id uuid; v_version_id uuid; previous_update timestamptz;
BEGIN
  IF NOT cookly_security.can_edit_catalog() THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
  IF jsonb_typeof(p_ingredients) IS DISTINCT FROM 'array' OR jsonb_typeof(p_steps) IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_ingredients)>60 OR jsonb_array_length(p_steps)>30
    OR coalesce(cardinality(p_tag_ids),0)>20 OR octet_length(p_ingredients::text)>65536 OR octet_length(p_steps::text)>65536 THEN
    RAISE EXCEPTION 'Invalid recipe payload' USING ERRCODE='22023';
  END IF;
  IF p_recipe_id IS NULL THEN
    IF p_version_id IS NOT NULL THEN RAISE EXCEPTION 'Invalid recipe version' USING ERRCODE='22023'; END IF;
    INSERT INTO app_private.recipes(slug,author_profile_id) VALUES(p_slug,cookly_security.current_uid()) RETURNING id INTO v_recipe_id;
  ELSE
    SELECT r.id INTO v_recipe_id FROM app_private.recipes r WHERE r.id=p_recipe_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Resource unavailable' USING ERRCODE='P0002'; END IF;
  END IF;
  IF p_version_id IS NULL THEN
    INSERT INTO app_private.recipe_versions(recipe_id,version_number,title,summary,difficulty,active_minutes,total_minutes)
      SELECT v_recipe_id,coalesce(max(v.version_number),0)+1,p_title,p_summary,p_difficulty,p_active_minutes,p_total_minutes
      FROM app_private.recipe_versions v WHERE v.recipe_id=v_recipe_id RETURNING id INTO v_version_id;
  ELSE
    SELECT v.id,v.updated_at INTO v_version_id,previous_update FROM app_private.recipe_versions v
      WHERE v.id=p_version_id AND v.recipe_id=v_recipe_id AND v.status='draft' FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Draft unavailable' USING ERRCODE='P0002'; END IF;
    IF p_expected_updated_at IS DISTINCT FROM previous_update THEN RAISE EXCEPTION 'Revision conflict' USING ERRCODE='40001'; END IF;
    UPDATE app_private.recipe_versions SET title=p_title,summary=p_summary,difficulty=p_difficulty,
      active_minutes=p_active_minutes,total_minutes=p_total_minutes WHERE id=v_version_id;
    DELETE FROM app_private.recipe_servings WHERE recipe_version_id=v_version_id;
    DELETE FROM app_private.recipe_ingredients WHERE recipe_version_id=v_version_id;
    DELETE FROM app_private.recipe_steps WHERE recipe_version_id=v_version_id;
    DELETE FROM app_private.recipe_tags WHERE recipe_version_id=v_version_id;
  END IF;
  INSERT INTO app_private.recipe_servings(recipe_version_id,base_servings) VALUES(v_version_id,p_base_servings);
  INSERT INTO app_private.recipe_ingredients(recipe_version_id,ingredient_id,quantity,unit_id,is_optional,position,preparation_note)
    SELECT v_version_id,(value->>'ingredient_id')::uuid,(value->>'quantity')::app_private.quantity,
      (value->>'unit_id')::uuid,coalesce((value->>'is_optional')::boolean,false),ordinality::integer,value->>'preparation_note'
    FROM jsonb_array_elements(p_ingredients) WITH ORDINALITY;
  INSERT INTO app_private.recipe_steps(recipe_version_id,step_number,instruction)
    SELECT v_version_id,ordinality::integer,value FROM jsonb_array_elements_text(p_steps) WITH ORDINALITY;
  INSERT INTO app_private.recipe_tags(recipe_version_id,tag_id) SELECT v_version_id,unnest(p_tag_ids);
  INSERT INTO app_private.audit_logs(actor_profile_id,action,resource_type,resource_id,request_id,outcome)
    VALUES(cookly_security.current_uid(),'recipe.draft_saved','recipe',v_recipe_id,gen_random_uuid(),'success');
  RETURN v_version_id;
END;
$$;
CREATE FUNCTION api.publish_recipe(p_recipe_id uuid,p_version_id uuid,p_expected_updated_at timestamptz) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE previous_update timestamptz;
BEGIN
  IF NOT cookly_security.can_edit_catalog() THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
  PERFORM 1 FROM app_private.recipes WHERE id=p_recipe_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Resource unavailable' USING ERRCODE='P0002'; END IF;
  SELECT updated_at INTO previous_update FROM app_private.recipe_versions
    WHERE id=p_version_id AND recipe_id=p_recipe_id AND status='draft' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Draft unavailable' USING ERRCODE='P0002'; END IF;
  IF previous_update IS DISTINCT FROM p_expected_updated_at THEN RAISE EXCEPTION 'Revision conflict' USING ERRCODE='40001'; END IF;
  UPDATE app_private.recipe_versions SET status='published' WHERE id=p_version_id;
  UPDATE app_private.recipes SET status='published',current_version_id=p_version_id WHERE id=p_recipe_id;
  INSERT INTO app_private.audit_logs(actor_profile_id,action,resource_type,resource_id,request_id,outcome)
    VALUES(cookly_security.current_uid(),'recipe.published','recipe',p_recipe_id,gen_random_uuid(),'success');
END;
$$;
CREATE FUNCTION api.withdraw_recipe(p_recipe_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF NOT cookly_security.can_edit_catalog() THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
  UPDATE app_private.recipes SET status='withdrawn' WHERE id=p_recipe_id AND status IN ('published','withdrawn');
  IF NOT FOUND THEN RAISE EXCEPTION 'Resource unavailable' USING ERRCODE='P0002'; END IF;
  INSERT INTO app_private.audit_logs(actor_profile_id,action,resource_type,resource_id,request_id,outcome)
    VALUES(cookly_security.current_uid(),'recipe.withdrawn','recipe',p_recipe_id,gen_random_uuid(),'success');
END;
$$;

-- Transfer only this migration's known API functions, then revoke public defaults.
DO $$
DECLARE signature regprocedure;
BEGIN
  FOR signature IN SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='api' LOOP
    EXECUTE format('ALTER FUNCTION %s OWNER TO cookly_api',signature);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated, service_role',signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',signature);
  END LOOP;
END;
$$;
REVOKE CREATE ON SCHEMA api FROM cookly_api;
NOTIFY pgrst, 'reload schema';
