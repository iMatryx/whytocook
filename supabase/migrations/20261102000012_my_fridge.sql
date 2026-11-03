-- My Fridge: additive commands, existing migrations and legacy RPCs preserved.
CREATE TABLE app_private.pantry_operations (
  owner_id uuid NOT NULL REFERENCES app_private.profiles(id) ON DELETE CASCADE,
  operation_id uuid NOT NULL,
  command jsonb NOT NULL CHECK(jsonb_typeof(command)='object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(owner_id,operation_id)
);
ALTER TABLE app_private.pantry_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_private.pantry_operations FORCE ROW LEVEL SECURITY;
REVOKE ALL ON app_private.pantry_operations FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT ON app_private.pantry_operations TO cookly_api;
CREATE POLICY pantry_operations_read ON app_private.pantry_operations FOR SELECT TO cookly_api
  USING(owner_id=(SELECT cookly_security.current_uid()));
CREATE POLICY pantry_operations_insert ON app_private.pantry_operations FOR INSERT TO cookly_api
  WITH CHECK(owner_id=(SELECT cookly_security.current_uid()));
CREATE INDEX pantry_items_owner_location_idx ON app_private.pantry_items(owner_id,location,id) WHERE archived_at IS NULL;

-- Exact conversion only; no mass/volume/count equivalences or rounding.
CREATE FUNCTION app_private.pantry_quantity(p_quantity text,p_from text,p_to text) RETURNS numeric
LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE amount numeric; result numeric; from_dimension text; to_dimension text;
BEGIN
  IF p_quantity IS NULL OR p_quantity !~ '^(0|[1-9][0-9]{0,11})(\.[0-9]{1,6})?$'
    OR p_from IS NULL OR p_to IS NULL OR p_from NOT IN ('g','kg','ml','l','piece') OR p_to NOT IN ('g','kg','ml','l','piece')
    THEN RAISE EXCEPTION 'Invalid quantity or unit' USING ERRCODE='22023'; END IF;
  amount:=p_quantity::numeric;
  from_dimension:=CASE WHEN p_from IN ('g','kg') THEN 'mass' WHEN p_from IN ('ml','l') THEN 'volume' ELSE 'count' END;
  to_dimension:=CASE WHEN p_to IN ('g','kg') THEN 'mass' WHEN p_to IN ('ml','l') THEN 'volume' ELSE 'count' END;
  IF from_dimension<>to_dimension OR (from_dimension='count' AND amount<>trunc(amount)) THEN
    RAISE EXCEPTION 'Incompatible units' USING ERRCODE='22023'; END IF;
  result:=amount*(CASE WHEN p_from IN ('kg','l') THEN 1000 ELSE 1 END)/(CASE WHEN p_to IN ('kg','l') THEN 1000 ELSE 1 END);
  IF result<>trunc(result,6) OR result>=1000000000000 THEN RAISE EXCEPTION 'Conversion requires rounding or exceeds capacity' USING ERRCODE='22023'; END IF;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION app_private.pantry_quantity(text,text,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION app_private.pantry_quantity(text,text,text) TO cookly_api;

CREATE FUNCTION api.get_my_pantry() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=cookly_security.current_uid(); result jsonb;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
  IF (SELECT count(*) FROM app_private.pantry_items WHERE owner_id=actor AND archived_at IS NULL)>500 THEN
    RAISE EXCEPTION 'Pantry capacity exceeded' USING ERRCODE='54000'; END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',p.id,'quantity',p.quantity::text,'unitCode',u.code,
    'location',p.location,'expiresOn',p.expires_on,'revision',p.revision::text,'createdAt',p.created_at,'updatedAt',p.updated_at,
    'ingredient',jsonb_build_object('id',i.id,'name',i.name,'slug',i.slug,'categoryId',c.id,'categoryName',c.name,'active',i.is_active,
      'allowedUnits',coalesce((SELECT jsonb_agg(au.code ORDER BY au.code) FROM app_private.ingredient_units iu JOIN app_private.units au ON au.id=iu.unit_id
        WHERE iu.ingredient_id=i.id AND au.code IN ('g','kg','ml','l','piece')),'[]'::jsonb))) ORDER BY p.created_at,p.id),'[]'::jsonb)
    INTO result FROM app_private.pantry_items p JOIN app_private.ingredients i ON i.id=p.ingredient_id
      LEFT JOIN app_private.units u ON u.id=p.unit_id LEFT JOIN app_private.ingredient_categories c ON c.id=i.category_id
    WHERE p.owner_id=actor AND p.archived_at IS NULL;
  RETURN jsonb_build_object('ownerId',actor,'items',result);
END;
$$;

CREATE FUNCTION api.mutate_my_pantry(p_operation_id uuid,p_command jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
<<pantry_command>>
DECLARE actor uuid:=cookly_security.current_uid(); kind text; previous jsonb; required text[]; allowed text[];
  item_id uuid; ingredient_id uuid; unit_id uuid; code text; q text; amount numeric; expiry date; current_row app_private.pantry_items;
  expected bigint; line jsonb; used numeric; target_code text;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
  IF p_operation_id IS NULL OR p_command IS NULL OR jsonb_typeof(p_command)<>'object' OR octet_length(p_command::text)>32768 THEN
    RAISE EXCEPTION 'Invalid command' USING ERRCODE='22023'; END IF;
  kind:=p_command->>'kind';
  IF kind='create' THEN required:=ARRAY['kind','id','ingredientId','quantity','unitCode','location','expiresOn'];
  ELSIF kind='update' THEN required:=ARRAY['kind','id','expectedRevision','ingredientId','quantity','unitCode','location','expiresOn'];
  ELSIF kind='delete' THEN required:=ARRAY['kind','id','expectedRevision'];
  ELSIF kind='consume' THEN required:=ARRAY['kind','confirmed','lines'];
  ELSE RAISE EXCEPTION 'Invalid command kind' USING ERRCODE='22023'; END IF;
  IF NOT p_command ?& required OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_command) field WHERE field<>ALL(required)) THEN
    RAISE EXCEPTION 'Invalid command fields' USING ERRCODE='22023'; END IF;
  -- Serializes new commands per actor. Row locks/revisions also guard legacy writes.
  PERFORM 1 FROM app_private.profiles WHERE id=actor FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
  SELECT command INTO previous FROM app_private.pantry_operations WHERE owner_id=actor AND operation_id=p_operation_id;
  IF FOUND THEN
    IF previous<>p_command THEN RAISE EXCEPTION 'Operation key reused' USING ERRCODE='22023'; END IF;
    RETURN api.get_my_pantry();
  END IF;
  IF kind='consume' THEN
    IF p_command->'confirmed' IS DISTINCT FROM 'true'::jsonb OR jsonb_typeof(p_command->'lines')<>'array' THEN
      RAISE EXCEPTION 'Confirmation required' USING ERRCODE='22023'; END IF;
    IF jsonb_array_length(p_command->'lines') NOT BETWEEN 1 AND 50 THEN RAISE EXCEPTION 'Invalid consumption size' USING ERRCODE='22023'; END IF;
    IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_command->'lines') v WHERE jsonb_typeof(v)<>'object') THEN RAISE EXCEPTION 'Invalid consumption line' USING ERRCODE='22023'; END IF;
    IF (SELECT count(DISTINCT (v->>'itemId')::uuid) FROM jsonb_array_elements(p_command->'lines') v)<>jsonb_array_length(p_command->'lines') THEN
      RAISE EXCEPTION 'Duplicate lot' USING ERRCODE='22023'; END IF;
    FOR line IN SELECT value FROM jsonb_array_elements(p_command->'lines') ORDER BY (value->>'itemId')::uuid LOOP
      allowed:=ARRAY['itemId','expectedRevision','quantity','unitCode'];
      IF NOT line ?& allowed OR EXISTS(SELECT 1 FROM jsonb_object_keys(line) field WHERE field<>ALL(allowed))
        OR jsonb_typeof(line->'quantity')<>'string' OR (line->>'expectedRevision') !~ '^[1-9][0-9]{0,18}$' THEN
        RAISE EXCEPTION 'Invalid consumption fields' USING ERRCODE='22023'; END IF;
      item_id:=(line->>'itemId')::uuid; expected:=(line->>'expectedRevision')::bigint;
      SELECT * INTO current_row FROM app_private.pantry_items WHERE id=item_id AND owner_id=actor AND archived_at IS NULL FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Lot unavailable' USING ERRCODE='P0002'; END IF;
      IF expected IS DISTINCT FROM current_row.revision THEN RAISE EXCEPTION 'Revision conflict' USING ERRCODE='40001'; END IF;
      IF current_row.quantity IS NULL OR current_row.unit_id IS NULL THEN RAISE EXCEPTION 'Unknown stock quantity' USING ERRCODE='22023'; END IF;
      SELECT u.code INTO target_code FROM app_private.units u WHERE u.id=current_row.unit_id;
      used:=app_private.pantry_quantity(line->>'quantity',line->>'unitCode',target_code);
      IF used<=0 THEN RAISE EXCEPTION 'Consumption must be positive' USING ERRCODE='22023'; END IF;
      IF used>current_row.quantity THEN RAISE EXCEPTION 'Insufficient stock' USING ERRCODE='P0001'; END IF;
      UPDATE app_private.pantry_items SET quantity=quantity-used WHERE id=item_id AND owner_id=actor;
    END LOOP;
  ELSE
    item_id:=(p_command->>'id')::uuid;
    IF item_id IS NULL THEN RAISE EXCEPTION 'Invalid lot' USING ERRCODE='22023'; END IF;
    IF kind<>'create' THEN
      IF (p_command->>'expectedRevision') IS NULL OR (p_command->>'expectedRevision') !~ '^[1-9][0-9]{0,18}$' THEN RAISE EXCEPTION 'Invalid revision' USING ERRCODE='22023'; END IF;
      expected:=(p_command->>'expectedRevision')::bigint;
      SELECT * INTO current_row FROM app_private.pantry_items WHERE id=item_id AND owner_id=actor AND archived_at IS NULL FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Lot unavailable' USING ERRCODE='P0002'; END IF;
      IF expected IS DISTINCT FROM current_row.revision THEN RAISE EXCEPTION 'Revision conflict' USING ERRCODE='40001'; END IF;
    END IF;
    IF kind='delete' THEN DELETE FROM app_private.pantry_items WHERE id=item_id AND owner_id=actor;
    ELSE
      ingredient_id:=(p_command->>'ingredientId')::uuid; q:=p_command->>'quantity'; code:=p_command->>'unitCode';
      IF ingredient_id IS NULL OR NOT EXISTS(SELECT 1 FROM app_private.ingredients i WHERE i.id=ingredient_id AND (i.is_active OR (kind='update' AND current_row.ingredient_id=i.id))) THEN
        RAISE EXCEPTION 'Ingredient unavailable' USING ERRCODE='22023'; END IF;
      IF (q IS NULL)<>(code IS NULL) OR jsonb_typeof(p_command->'quantity') NOT IN ('string','null') OR jsonb_typeof(p_command->'unitCode') NOT IN ('string','null') THEN
        RAISE EXCEPTION 'Invalid quantity pair' USING ERRCODE='22023'; END IF;
      unit_id:=NULL; amount:=NULL;
      IF q IS NOT NULL THEN
        amount:=app_private.pantry_quantity(q,code,code);
        SELECT u.id INTO unit_id FROM app_private.units u JOIN app_private.ingredient_units iu ON iu.unit_id=u.id
          WHERE iu.ingredient_id=pantry_command.ingredient_id AND u.code=pantry_command.code;
        -- Preserve the explicitly measured unit of an existing lot even when
        -- its ingredient is withdrawn; do not infer any new unit equivalence.
        IF unit_id IS NULL AND kind='update' AND current_row.ingredient_id=ingredient_id THEN
          SELECT u.id INTO unit_id FROM app_private.units u WHERE u.id=current_row.unit_id AND u.code=pantry_command.code;
        END IF;
        IF unit_id IS NULL THEN RAISE EXCEPTION 'Unit not allowed for ingredient' USING ERRCODE='22023'; END IF;
      END IF;
      IF (p_command->>'location') IS NULL OR (p_command->>'location') NOT IN ('pantry','fridge','freezer') THEN RAISE EXCEPTION 'Invalid location' USING ERRCODE='22023'; END IF;
      IF jsonb_typeof(p_command->'expiresOn') NOT IN ('string','null') OR ((p_command->>'expiresOn') IS NOT NULL AND (p_command->>'expiresOn') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$') THEN RAISE EXCEPTION 'Invalid date' USING ERRCODE='22023'; END IF;
      expiry:=(p_command->>'expiresOn')::date;
      IF expiry<DATE '1900-01-01' OR expiry>DATE '9999-12-31' THEN RAISE EXCEPTION 'Invalid date range' USING ERRCODE='22023'; END IF;
      IF kind='create' THEN
        IF EXISTS(SELECT 1 FROM app_private.pantry_items WHERE id=item_id) THEN RAISE EXCEPTION 'Lot already exists' USING ERRCODE='40001'; END IF;
        IF (SELECT count(*) FROM app_private.pantry_items WHERE owner_id=actor AND archived_at IS NULL)>=500 THEN RAISE EXCEPTION 'Pantry capacity exceeded' USING ERRCODE='54000'; END IF;
        INSERT INTO app_private.pantry_items(id,owner_id,ingredient_id,quantity,unit_id,location,expires_on)
          VALUES(item_id,actor,ingredient_id,amount,unit_id,p_command->>'location',expiry);
      ELSE
        UPDATE app_private.pantry_items SET ingredient_id=pantry_command.ingredient_id,quantity=amount,unit_id=pantry_command.unit_id,location=p_command->>'location',expires_on=expiry WHERE id=item_id AND owner_id=actor;
      END IF;
    END IF;
  END IF;
  INSERT INTO app_private.pantry_operations(owner_id,operation_id,command) VALUES(actor,p_operation_id,p_command);
  RETURN api.get_my_pantry();
END;
$$;

GRANT CREATE ON SCHEMA api TO cookly_api;
ALTER FUNCTION api.get_my_pantry() OWNER TO cookly_api;
ALTER FUNCTION api.mutate_my_pantry(uuid,jsonb) OWNER TO cookly_api;
REVOKE CREATE ON SCHEMA api FROM cookly_api;
REVOKE ALL ON FUNCTION api.get_my_pantry(),api.mutate_my_pantry(uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION api.get_my_pantry(),api.mutate_my_pantry(uuid,jsonb) TO authenticated;
NOTIFY pgrst,'reload schema';
