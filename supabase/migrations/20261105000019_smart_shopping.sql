-- Smart Shopping extends the same active list written by Cooking.
ALTER TABLE app_private.shopping_list_items
  ADD COLUMN category text NOT NULL DEFAULT 'Altele' CHECK(char_length(btrim(category)) BETWEEN 1 AND 80),
  ADD COLUMN price jsonb,
  ADD COLUMN transferred boolean NOT NULL DEFAULT false,
  ADD COLUMN uncertain boolean NOT NULL DEFAULT false;
ALTER TABLE app_private.shopping_lists FORCE ROW LEVEL SECURITY;
ALTER TABLE app_private.shopping_list_items FORCE ROW LEVEL SECURITY;

CREATE TABLE app_private.smart_shopping_operations (
  owner_id uuid NOT NULL REFERENCES app_private.profiles(id) ON DELETE CASCADE,
  operation_id uuid NOT NULL,
  command jsonb NOT NULL CHECK(jsonb_typeof(command)='object'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(owner_id,operation_id)
);
ALTER TABLE app_private.smart_shopping_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_private.smart_shopping_operations FORCE ROW LEVEL SECURITY;
REVOKE ALL ON app_private.smart_shopping_operations FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT ON app_private.smart_shopping_operations TO cookly_api;
CREATE POLICY smart_shopping_operations_read ON app_private.smart_shopping_operations FOR SELECT TO cookly_api USING(owner_id=(SELECT cookly_security.current_uid()));
CREATE POLICY smart_shopping_operations_insert ON app_private.smart_shopping_operations FOR INSERT TO cookly_api WITH CHECK(owner_id=(SELECT cookly_security.current_uid()));

CREATE FUNCTION app_private.smart_shopping_ingredient(p_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SET search_path='' AS $$
  SELECT jsonb_build_object('id',i.id,'name',i.name,'slug',i.slug,'categoryId',c.id,'categoryName',c.name,'active',i.is_active,
    'allowedUnits',coalesce((SELECT jsonb_agg(u.code ORDER BY u.code) FROM app_private.ingredient_units iu JOIN app_private.units u ON u.id=iu.unit_id
      WHERE iu.ingredient_id=i.id AND u.code IN ('g','kg','ml','l','piece')),'[]'::jsonb))
  FROM app_private.ingredients i LEFT JOIN app_private.ingredient_categories c ON c.id=i.category_id WHERE i.id=p_id;
$$;

-- Shared exact validation for both append and complete update fields.
CREATE FUNCTION app_private.smart_shopping_fields(p jsonb) RETURNS void
LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE amount numeric; v jsonb; day date;
BEGIN
  IF NOT app_private.recipe_json_keys(p,ARRAY['label','category','quantity','unitCode','checked','price','uncertain'])
    OR NOT app_private.recipe_json_text(p->'label',120) OR NOT app_private.recipe_json_text(p->'category',80)
    OR jsonb_typeof(p->'checked') IS DISTINCT FROM 'boolean' OR jsonb_typeof(p->'uncertain') IS DISTINCT FROM 'boolean'
    OR jsonb_typeof(p->'quantity') NOT IN ('null','string') OR jsonb_typeof(p->'unitCode') NOT IN ('null','string')
    OR ((p->>'quantity') IS NULL)<>((p->>'unitCode') IS NULL) THEN RAISE EXCEPTION 'Invalid shopping fields' USING ERRCODE='22023'; END IF;
  IF p->>'quantity' IS NOT NULL THEN
    amount:=app_private.pantry_quantity(p->>'quantity',p->>'unitCode',p->>'unitCode');
    IF amount<=0 THEN RAISE EXCEPTION 'Quantity must be positive' USING ERRCODE='22023'; END IF;
  END IF;
  v:=p->'price';
  IF v<>'null'::jsonb THEN
    IF NOT app_private.recipe_json_keys(v,ARRAY['amount','currency','basisQuantity','basisUnit','observedOn'])
      OR jsonb_typeof(v->'amount') IS DISTINCT FROM 'string' OR coalesce(v->>'amount','') !~ '^(0|[1-9][0-9]{0,5})(\.[0-9]{1,2})?$'
      OR coalesce(v->>'currency','') NOT IN ('MDL','RON') OR jsonb_typeof(v->'basisQuantity') IS DISTINCT FROM 'string'
      OR jsonb_typeof(v->'observedOn') IS DISTINCT FROM 'string' OR coalesce(v->>'observedOn','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      THEN RAISE EXCEPTION 'Invalid price' USING ERRCODE='22023'; END IF;
    amount:=app_private.pantry_quantity(v->>'basisQuantity',v->>'basisUnit',v->>'basisUnit');
    IF amount<=0 THEN RAISE EXCEPTION 'Price basis must be positive' USING ERRCODE='22023'; END IF;
    day:=(v->>'observedOn')::date;
    IF day>DATE '9999-12-31' THEN RAISE EXCEPTION 'Invalid price date' USING ERRCODE='22023'; END IF;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION app_private.smart_shopping_ingredient(uuid),app_private.smart_shopping_fields(jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION app_private.smart_shopping_ingredient(uuid),app_private.smart_shopping_fields(jsonb) TO cookly_api;

CREATE FUNCTION api.smart_shopping_catalog() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
  IF (SELECT count(*) FROM app_private.ingredients WHERE is_active)>1000 THEN
    RAISE EXCEPTION 'Shopping catalog capacity exceeded' USING ERRCODE='54000'; END IF;
  SELECT coalesce(jsonb_agg(app_private.smart_shopping_ingredient(i.id) ORDER BY i.name,i.id),'[]'::jsonb)
    INTO result FROM app_private.ingredients i WHERE i.is_active;
  RETURN result;
END;
$$;
CREATE FUNCTION api.smart_shopping_snapshot() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=cookly_security.current_uid(); result jsonb;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
  IF (SELECT count(*) FROM app_private.shopping_list_items s JOIN app_private.shopping_lists l ON l.id=s.shopping_list_id WHERE s.owner_id=actor AND l.status='active')>500 THEN
    RAISE EXCEPTION 'Shopping capacity exceeded' USING ERRCODE='54000'; END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',s.id,'revision',s.revision::text,'ingredient',app_private.smart_shopping_ingredient(s.ingredient_id),
      'label',left(btrim(s.label),120),'category',CASE WHEN s.category='Altele' THEN coalesce(app_private.smart_shopping_ingredient(s.ingredient_id)->>'categoryName',s.category) ELSE s.category END,
      'quantity',CASE WHEN u.code IN ('g','kg','ml','l','piece') AND (u.code<>'piece' OR s.quantity=trunc(s.quantity)) THEN s.quantity::text ELSE NULL END,
      'unitCode',CASE WHEN u.code IN ('g','kg','ml','l','piece') AND (u.code<>'piece' OR s.quantity=trunc(s.quantity)) THEN u.code ELSE NULL END,
      'checked',s.checked_at IS NOT NULL,'price',s.price,'transferred',s.transferred,
      'uncertain',s.uncertain OR s.quantity IS NULL OR u.code IS NULL OR u.code NOT IN ('g','kg','ml','l','piece') OR (u.code='piece' AND s.quantity<>trunc(s.quantity))) ORDER BY s.created_at,s.id),'[]'::jsonb)
    INTO result FROM app_private.shopping_list_items s JOIN app_private.shopping_lists l ON l.id=s.shopping_list_id
    LEFT JOIN app_private.units u ON u.id=s.unit_id WHERE s.owner_id=actor AND l.status='active';
  RETURN jsonb_build_object('accountId',actor,'items',result);
END;
$$;

CREATE FUNCTION api.smart_shopping_mutate(p_operation_id uuid,p_command jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
<<shopping>>
DECLARE actor uuid:=cookly_security.current_uid(); kind text; previous jsonb; list_id uuid; line jsonb; fields jsonb;
  item_id uuid; ingredient_id uuid; unit_id uuid; code text; target_code text; base_code text; amount numeric; merged numeric;
  old_row app_private.shopping_list_items; expected bigint; pantry_id uuid; expiry date;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
  IF p_operation_id IS NULL OR jsonb_typeof(p_command) IS DISTINCT FROM 'object' OR octet_length(p_command::text)>131072 THEN RAISE EXCEPTION 'Invalid command' USING ERRCODE='22023'; END IF;
  PERFORM 1 FROM app_private.profiles WHERE id=actor FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
  SELECT o.command INTO previous FROM app_private.smart_shopping_operations o WHERE o.owner_id=actor AND o.operation_id=p_operation_id;
  IF FOUND THEN
    IF previous IS DISTINCT FROM p_command THEN RAISE EXCEPTION 'Operation key reused' USING ERRCODE='22023'; END IF;
    RETURN api.smart_shopping_snapshot();
  END IF;
  SELECT l.id INTO list_id FROM app_private.shopping_lists l WHERE l.owner_id=actor AND l.status='active' FOR UPDATE;
  kind:=p_command->>'kind';
  IF kind='append' THEN
    IF NOT app_private.recipe_json_keys(p_command,ARRAY['kind','items']) OR jsonb_typeof(p_command->'items') IS DISTINCT FROM 'array' OR jsonb_array_length(p_command->'items') NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Invalid append' USING ERRCODE='22023'; END IF;
    IF (SELECT count(DISTINCT v->>'id') FROM jsonb_array_elements(p_command->'items') v)<>jsonb_array_length(p_command->'items') THEN RAISE EXCEPTION 'Duplicate item' USING ERRCODE='22023'; END IF;
    IF list_id IS NULL THEN list_id:=api.save_shopping_list(NULL,NULL,'Lista mea','active'); END IF;
    FOR line IN SELECT value FROM jsonb_array_elements(p_command->'items') LOOP
      IF NOT app_private.recipe_json_keys(line,ARRAY['id','ingredientId','label','category','quantity','unitCode','checked','price','uncertain'])
        OR jsonb_typeof(line->'id') IS DISTINCT FROM 'string' OR jsonb_typeof(line->'ingredientId') NOT IN ('string','null') THEN RAISE EXCEPTION 'Invalid item' USING ERRCODE='22023'; END IF;
      fields:=line-'id'-'ingredientId'; PERFORM app_private.smart_shopping_fields(fields);
      item_id:=(line->>'id')::uuid; ingredient_id:=(line->>'ingredientId')::uuid; code:=line->>'unitCode'; unit_id:=NULL; amount:=NULL;
      IF EXISTS(SELECT 1 FROM app_private.shopping_list_items s WHERE s.id=item_id) THEN RAISE EXCEPTION 'Item already exists' USING ERRCODE='40001'; END IF;
      IF ingredient_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM app_private.ingredients i WHERE i.id=ingredient_id AND i.is_active) THEN RAISE EXCEPTION 'Ingredient unavailable' USING ERRCODE='22023'; END IF;
      IF code IS NOT NULL THEN
        amount:=(line->>'quantity')::numeric;
        SELECT u.id INTO unit_id FROM app_private.units u WHERE u.code=shopping.code AND (ingredient_id IS NULL OR EXISTS(SELECT 1 FROM app_private.ingredient_units iu WHERE iu.ingredient_id=shopping.ingredient_id AND iu.unit_id=u.id));
        IF unit_id IS NULL THEN RAISE EXCEPTION 'Unit not allowed' USING ERRCODE='22023'; END IF;
      END IF;
      old_row:=NULL;
      IF ingredient_id IS NOT NULL AND code IS NOT NULL AND NOT (line->>'checked')::boolean AND NOT (line->>'uncertain')::boolean THEN
        SELECT s.* INTO old_row FROM app_private.shopping_list_items s JOIN app_private.units u ON u.id=s.unit_id
          WHERE s.owner_id=actor AND s.shopping_list_id=list_id AND s.ingredient_id=shopping.ingredient_id AND s.origin='manual'
            AND s.checked_at IS NULL AND NOT s.transferred AND NOT s.uncertain AND s.quantity IS NOT NULL
            AND ((shopping.code IN ('g','kg') AND u.code IN ('g','kg')) OR (shopping.code IN ('ml','l') AND u.code IN ('ml','l')) OR (shopping.code='piece' AND u.code='piece'))
            AND EXISTS(SELECT 1 FROM app_private.ingredient_units iu WHERE iu.ingredient_id=s.ingredient_id AND iu.unit_id=s.unit_id)
          ORDER BY s.created_at,s.id LIMIT 1 FOR UPDATE OF s;
      END IF;
      IF old_row.id IS NOT NULL THEN
        SELECT u.code INTO target_code FROM app_private.units u WHERE u.id=old_row.unit_id;
        BEGIN
          merged:=old_row.quantity+app_private.pantry_quantity(line->>'quantity',code,target_code);
        EXCEPTION WHEN invalid_parameter_value THEN
          base_code:=CASE WHEN code IN ('g','kg') THEN 'g' WHEN code IN ('ml','l') THEN 'ml' ELSE 'piece' END;
          SELECT u.id INTO unit_id FROM app_private.units u JOIN app_private.ingredient_units iu ON iu.unit_id=u.id WHERE iu.ingredient_id=shopping.ingredient_id AND u.code=base_code;
          IF unit_id IS NULL THEN RAISE EXCEPTION 'Merge requires rounding' USING ERRCODE='22023'; END IF;
          merged:=app_private.pantry_quantity(old_row.quantity::text,target_code,base_code)+app_private.pantry_quantity(line->>'quantity',code,base_code);
          target_code:=base_code;
        END;
        merged:=trim_scale(merged);
        PERFORM app_private.pantry_quantity(merged::text,target_code,target_code);
        UPDATE app_private.shopping_list_items SET quantity=merged,unit_id=(SELECT u.id FROM app_private.units u WHERE u.code=target_code),price=coalesce(nullif(line->'price','null'::jsonb),old_row.price) WHERE id=old_row.id AND owner_id=actor;
      ELSE
        INSERT INTO app_private.shopping_list_items(id,owner_id,shopping_list_id,ingredient_id,label,origin,quantity,unit_id,category,checked_at,price,uncertain)
          VALUES(item_id,actor,list_id,ingredient_id,btrim(line->>'label'),'manual',amount,unit_id,btrim(line->>'category'),CASE WHEN (line->>'checked')::boolean THEN clock_timestamp() ELSE NULL END,nullif(line->'price','null'::jsonb),(line->>'uncertain')::boolean);
      END IF;
    END LOOP;
  ELSIF kind IN ('update','remove') THEN
    IF (kind='update' AND NOT app_private.recipe_json_keys(p_command,ARRAY['kind','id','expectedRevision','fields'])) OR (kind='remove' AND NOT app_private.recipe_json_keys(p_command,ARRAY['kind','id','expectedRevision']))
      OR jsonb_typeof(p_command->'id') IS DISTINCT FROM 'string' OR jsonb_typeof(p_command->'expectedRevision') IS DISTINCT FROM 'string' OR coalesce(p_command->>'expectedRevision','') !~ '^[1-9][0-9]{0,18}$' THEN RAISE EXCEPTION 'Invalid item command' USING ERRCODE='22023'; END IF;
    item_id:=(p_command->>'id')::uuid; expected:=(p_command->>'expectedRevision')::bigint;
    SELECT s.* INTO old_row FROM app_private.shopping_list_items s WHERE s.id=item_id AND s.owner_id=actor AND s.shopping_list_id=list_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Item unavailable' USING ERRCODE='P0002'; END IF;
    IF old_row.revision<>expected THEN RAISE EXCEPTION 'Revision conflict' USING ERRCODE='40001'; END IF;
    IF old_row.origin<>'manual' THEN RAISE EXCEPTION 'Derived item is guarded' USING ERRCODE='42501'; END IF;
    IF kind='remove' THEN DELETE FROM app_private.shopping_list_items WHERE id=item_id AND owner_id=actor;
    ELSE
      IF old_row.transferred THEN RAISE EXCEPTION 'Transferred item is immutable' USING ERRCODE='42501'; END IF;
      fields:=p_command->'fields'; PERFORM app_private.smart_shopping_fields(fields); code:=fields->>'unitCode'; unit_id:=NULL; amount:=(fields->>'quantity')::numeric;
      IF code IS NOT NULL THEN
        SELECT u.id INTO unit_id FROM app_private.units u WHERE u.code=shopping.code AND (old_row.ingredient_id IS NULL OR EXISTS(SELECT 1 FROM app_private.ingredient_units iu WHERE iu.ingredient_id=old_row.ingredient_id AND iu.unit_id=u.id));
        IF unit_id IS NULL THEN RAISE EXCEPTION 'Unit not allowed' USING ERRCODE='22023'; END IF;
      END IF;
      UPDATE app_private.shopping_list_items SET label=btrim(fields->>'label'),category=btrim(fields->>'category'),quantity=amount,unit_id=shopping.unit_id,
        checked_at=CASE WHEN (fields->>'checked')::boolean THEN coalesce(old_row.checked_at,clock_timestamp()) ELSE NULL END,price=nullif(fields->'price','null'::jsonb),uncertain=(fields->>'uncertain')::boolean WHERE id=item_id AND owner_id=actor;
    END IF;
  ELSIF kind='purchase' THEN
    IF NOT app_private.recipe_json_keys(p_command,ARRAY['kind','confirmed','lines','location','expiresOn']) OR p_command->'confirmed' IS DISTINCT FROM 'true'::jsonb
      OR jsonb_typeof(p_command->'lines') IS DISTINCT FROM 'array' OR jsonb_array_length(p_command->'lines') NOT BETWEEN 1 AND 50
      OR coalesce(p_command->>'location','') NOT IN ('pantry','fridge','freezer') OR jsonb_typeof(p_command->'expiresOn') NOT IN ('null','string')
      OR (p_command->>'expiresOn' IS NOT NULL AND p_command->>'expiresOn' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$') THEN RAISE EXCEPTION 'Invalid purchase confirmation' USING ERRCODE='22023'; END IF;
    expiry:=(p_command->>'expiresOn')::date;
    IF expiry<DATE '1900-01-01' OR expiry>DATE '9999-12-31' THEN RAISE EXCEPTION 'Invalid expiry' USING ERRCODE='22023'; END IF;
    IF (SELECT count(DISTINCT v->>'id') FROM jsonb_array_elements(p_command->'lines') v)<>jsonb_array_length(p_command->'lines')
      OR (SELECT count(DISTINCT v->>'pantryItemId') FROM jsonb_array_elements(p_command->'lines') v)<>jsonb_array_length(p_command->'lines') THEN RAISE EXCEPTION 'Duplicate purchase line' USING ERRCODE='22023'; END IF;
    FOR line IN SELECT value FROM jsonb_array_elements(p_command->'lines') LOOP
      IF NOT app_private.recipe_json_keys(line,ARRAY['id','expectedRevision','pantryItemId']) OR jsonb_typeof(line->'id') IS DISTINCT FROM 'string' OR jsonb_typeof(line->'pantryItemId') IS DISTINCT FROM 'string'
        OR jsonb_typeof(line->'expectedRevision') IS DISTINCT FROM 'string' OR coalesce(line->>'expectedRevision','') !~ '^[1-9][0-9]{0,18}$' THEN RAISE EXCEPTION 'Invalid purchase line' USING ERRCODE='22023'; END IF;
      item_id:=(line->>'id')::uuid; pantry_id:=(line->>'pantryItemId')::uuid; expected:=(line->>'expectedRevision')::bigint;
      SELECT s.* INTO old_row FROM app_private.shopping_list_items s WHERE s.id=item_id AND s.owner_id=actor AND s.shopping_list_id=list_id FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Item unavailable' USING ERRCODE='P0002'; END IF;
      IF old_row.revision<>expected THEN RAISE EXCEPTION 'Revision conflict' USING ERRCODE='40001'; END IF;
      IF old_row.transferred OR old_row.checked_at IS NULL OR old_row.ingredient_id IS NULL OR old_row.quantity IS NULL OR old_row.uncertain OR old_row.origin<>'manual' THEN RAISE EXCEPTION 'Item cannot be transferred' USING ERRCODE='22023'; END IF;
      SELECT u.code INTO code FROM app_private.units u JOIN app_private.ingredient_units iu ON iu.unit_id=u.id JOIN app_private.ingredients i ON i.id=iu.ingredient_id WHERE iu.ingredient_id=old_row.ingredient_id AND u.id=old_row.unit_id AND i.is_active;
      IF code IS NULL THEN RAISE EXCEPTION 'Ingredient unit unavailable' USING ERRCODE='22023'; END IF;
      PERFORM app_private.pantry_quantity(old_row.quantity::text,code,code);
      IF EXISTS(SELECT 1 FROM app_private.pantry_items p WHERE p.id=pantry_id) OR EXISTS(SELECT 1 FROM app_private.pantry_operations o WHERE o.owner_id=actor AND o.operation_id=pantry_id) THEN RAISE EXCEPTION 'Pantry lot already used' USING ERRCODE='40001'; END IF;
      PERFORM api.mutate_my_pantry(pantry_id,jsonb_build_object('kind','create','id',pantry_id,'ingredientId',old_row.ingredient_id,'quantity',old_row.quantity::text,'unitCode',code,'location',p_command->>'location','expiresOn',expiry));
      UPDATE app_private.shopping_list_items SET transferred=true,purchased_quantity=quantity WHERE id=item_id AND owner_id=actor;
    END LOOP;
  ELSE RAISE EXCEPTION 'Invalid command kind' USING ERRCODE='22023'; END IF;
  INSERT INTO app_private.smart_shopping_operations(owner_id,operation_id,command) VALUES(actor,p_operation_id,p_command);
  RETURN api.smart_shopping_snapshot();
END;
$$;
GRANT CREATE ON SCHEMA api TO cookly_api;
ALTER FUNCTION api.smart_shopping_catalog() OWNER TO cookly_api;
ALTER FUNCTION api.smart_shopping_snapshot() OWNER TO cookly_api;
ALTER FUNCTION api.smart_shopping_mutate(uuid,jsonb) OWNER TO cookly_api;
REVOKE CREATE ON SCHEMA api FROM cookly_api;
REVOKE ALL ON FUNCTION api.smart_shopping_catalog(),api.smart_shopping_snapshot(),api.smart_shopping_mutate(uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION api.smart_shopping_catalog() TO anon,authenticated;
GRANT EXECUTE ON FUNCTION api.smart_shopping_snapshot(),api.smart_shopping_mutate(uuid,jsonb) TO authenticated;
NOTIFY pgrst,'reload schema';
