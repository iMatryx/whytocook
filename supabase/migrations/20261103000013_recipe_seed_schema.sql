-- Seed metadata extend, rather than replace, the existing versioned recipe model.
ALTER TABLE app_private.recipe_versions ADD COLUMN data_class text NOT NULL DEFAULT 'unreviewed'
  CHECK(data_class IN ('unreviewed','demonstration','verified')),
  ADD CONSTRAINT recipe_demo_not_published CHECK(status<>'published' OR data_class<>'demonstration');
CREATE TABLE app_private.recipe_equipment (
  recipe_version_id uuid NOT NULL REFERENCES app_private.recipe_versions(id) ON DELETE CASCADE,
  equipment_id uuid NOT NULL REFERENCES app_private.equipment_types(id) ON DELETE RESTRICT,
  PRIMARY KEY(recipe_version_id,equipment_id)
);
CREATE INDEX recipe_equipment_equipment_idx ON app_private.recipe_equipment(equipment_id,recipe_version_id);
CREATE TABLE app_private.recipe_allergens (
  recipe_version_id uuid NOT NULL REFERENCES app_private.recipe_versions(id) ON DELETE CASCADE,
  allergen_id uuid NOT NULL REFERENCES app_private.allergens(id) ON DELETE RESTRICT,
  relation text NOT NULL CHECK(relation IN ('contains','may_contain')),
  PRIMARY KEY(recipe_version_id,allergen_id)
);
CREATE INDEX recipe_allergens_allergen_idx ON app_private.recipe_allergens(allergen_id,recipe_version_id);

CREATE FUNCTION app_private.recipe_seed_quality_ok(p jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE n jsonb; field text; reviewed boolean; source jsonb;
BEGIN
  IF jsonb_typeof(p)<>'object' OR NOT p ?& ARRAY['dataClass','verification','allergens','nutrition','budget','provenance','proteinClaim','collections'] THEN RETURN false; END IF;
  IF coalesce(p->>'dataClass','') NOT IN ('demonstration','verified') OR coalesce(p#>>'{verification,status}','') NOT IN ('unverified','verified')
    OR coalesce(p#>>'{nutrition,status}','') NOT IN ('unavailable','verified') OR coalesce(p#>>'{allergens,status}','') NOT IN ('unverified','verified')
    OR coalesce(p#>>'{budget,status}','') NOT IN ('unverified','verified') OR coalesce(p->>'proteinClaim','') NOT IN ('none','candidate','verified') THEN RETURN false; END IF;
  reviewed:=(p->>'dataClass'='verified');
  IF reviewed IS DISTINCT FROM (p#>>'{verification,status}'='verified') THEN RETURN false; END IF;
  IF reviewed THEN
    IF coalesce(length(btrim(p#>>'{verification,reviewedBy}')),0)<1 OR p#>>'{verification,reviewedAt}' IS NULL
      OR coalesce(p#>>'{verification,evidenceUrl}','') !~ '^https://'
      OR p#>>'{allergens,status}'<>'verified' OR p#>>'{nutrition,status}'<>'verified' THEN RETURN false; END IF;
    PERFORM (p#>>'{verification,reviewedAt}')::timestamptz;
  ELSIF (p#>>'{verification,reviewedBy}') IS NOT NULL OR (p#>>'{verification,reviewedAt}') IS NOT NULL OR (p#>>'{verification,evidenceUrl}') IS NOT NULL THEN RETURN false;
  END IF;
  IF p#>>'{nutrition,status}'='verified' THEN
    n:=p#>'{nutrition,perServing}';
    IF jsonb_typeof(n)<>'object' OR NOT n ?& ARRAY['energyKcal','proteinG','carbohydrateG','fatG','fiberG','saltG'] THEN RETURN false; END IF;
    FOREACH field IN ARRAY ARRAY['energyKcal','proteinG','carbohydrateG','fatG','fiberG','saltG'] LOOP
      IF jsonb_typeof(n->field)<>'string' OR coalesce(n->>field,'') !~ '^(0|[1-9][0-9]{0,11})(\.[0-9]{1,6})?$' THEN RETURN false; END IF;
    END LOOP;
    IF (n->>'energyKcal')::numeric<=0 OR (n->>'proteinG')::numeric*4>(n->>'energyKcal')::numeric THEN RETURN false; END IF;
  ELSIF (p#>'{nutrition,perServing}') IS DISTINCT FROM 'null'::jsonb OR (p#>'{nutrition,source}') IS DISTINCT FROM 'null'::jsonb THEN RETURN false;
  END IF;
  FOREACH field IN ARRAY ARRAY['nutrition','allergens','budget'] LOOP
    IF p#>>ARRAY[field,'status']='verified' THEN
      source:=p#>ARRAY[field,'source'];
      IF jsonb_typeof(source)<>'object' OR coalesce(source->>'url','') !~ '^https://'
        OR coalesce(length(btrim(source->>'name')),0)<1 OR coalesce(length(btrim(source->>'recordId')),0)<1
        OR coalesce(length(btrim(source->>'license')),0)<1 OR source->>'observedOn' IS NULL THEN RETURN false; END IF;
      PERFORM (source->>'observedOn')::date;
    END IF;
  END LOOP;
  IF p#>>'{budget,status}'='unverified' AND ((p#>'{budget,perServing}') IS DISTINCT FROM 'null'::jsonb OR (p#>'{budget,source}') IS DISTINCT FROM 'null'::jsonb) THEN RETURN false; END IF;
  IF p#>>'{budget,status}'='verified' AND (coalesce(p#>>'{budget,perServing}','') !~ '^(0|[1-9][0-9]{0,11})(\.[0-9]{1,6})?$' OR (p#>>'{budget,perServing}')::numeric<=0) THEN RETURN false; END IF;
  IF (p->>'proteinClaim'<>'none') IS DISTINCT FROM ((p->'collections') ? 'high-protein') THEN RETURN false; END IF;
  IF p->>'proteinClaim'='verified' AND (NOT reviewed OR (n->>'proteinG')::numeric*400<(n->>'energyKcal')::numeric*20) THEN RETURN false; END IF;
  IF p#>>'{provenance,kind}'='external' AND (coalesce(p#>>'{provenance,url}','') !~ '^https://' OR coalesce(length(p#>>'{provenance,license}'),0)<1) THEN RETURN false; END IF;
  RETURN true;
EXCEPTION WHEN data_exception THEN RETURN false;
END;
$$;
REVOKE ALL ON FUNCTION app_private.recipe_seed_quality_ok(jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION app_private.recipe_seed_quality_ok(jsonb) TO cookly_api;

CREATE FUNCTION app_private.recipe_json_keys(p jsonb,keys text[]) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
  SELECT CASE WHEN jsonb_typeof(p)='object' THEN p ?& keys AND NOT EXISTS(SELECT 1 FROM jsonb_object_keys(p) k WHERE k<>ALL(keys)) ELSE false END;
$$;
CREATE FUNCTION app_private.recipe_json_text(p jsonb,max_length integer,nullable boolean DEFAULT false) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
  -- Match ECMAScript trim whitespace without rewriting the stored payload.
  SELECT coalesce((nullable AND p='null'::jsonb) OR (jsonb_typeof(p)='string' AND char_length(p#>>'{}')<=max_length AND char_length(btrim(p#>>'{}',U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF')) BETWEEN 1 AND max_length),false);
$$;
CREATE FUNCTION app_private.recipe_json_url(p jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE value text; port text; host text;
BEGIN
  IF p='null'::jsonb THEN RETURN true; END IF;
  IF jsonb_typeof(p) IS DISTINCT FROM 'string' THEN RETURN false; END IF;
  value:=p#>>'{}';
  IF char_length(value)>2048 OR value !~ '^https://[a-zA-Z0-9.-]+(:[0-9]{1,5})?([/?#][^[:space:][:cntrl:]]*)?$' THEN RETURN false; END IF;
  host:=substring(value FROM '^https://([^/:?#]+)');
  IF host !~ '^([a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.)*[a-zA-Z]([a-zA-Z0-9-]*[a-zA-Z0-9])?$' THEN
    IF host !~ '^(0|[1-9][0-9]{0,2})(\.(0|[1-9][0-9]{0,2})){3}$' THEN RETURN false; END IF;
    PERFORM host::inet;
  END IF;
  port:=substring(value FROM '^https://[^/:?#]+:([0-9]+)');
  RETURN port IS NULL OR port::integer BETWEEN 0 AND 65535;
EXCEPTION WHEN data_exception THEN RETURN false;
END;
$$;
CREATE FUNCTION app_private.recipe_json_source(p jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
BEGIN
  IF p='null'::jsonb THEN RETURN true; END IF;
  IF NOT app_private.recipe_json_keys(p,ARRAY['name','url','recordId','license','observedOn']) OR NOT app_private.recipe_json_text(p->'name',200)
    OR NOT app_private.recipe_json_text(p->'url',2048) OR NOT app_private.recipe_json_url(p->'url')
    OR NOT app_private.recipe_json_text(p->'recordId',200) OR NOT app_private.recipe_json_text(p->'license',500)
    OR jsonb_typeof(p->'observedOn') IS DISTINCT FROM 'string' OR coalesce(p->>'observedOn','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN RETURN false; END IF;
  RETURN isfinite((p->>'observedOn')::date);
EXCEPTION WHEN data_exception THEN RETURN false;
END;
$$;
CREATE FUNCTION app_private.recipe_seed_shape_ok(p jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE field text; a jsonb; item jsonb; part jsonb; n numeric; limit_count integer;
BEGIN
  IF NOT app_private.recipe_json_keys(p,ARRAY['key','revision','title','summary','dataClass','regions','mealTypes','collections','servings','difficulty','activeMinutes','totalMinutes','ingredients','steps','equipment','tags','allergens','nutrition','proteinClaim','budget','verification','provenance'])
    OR NOT app_private.recipe_json_text(p->'key',100) OR p->>'key' !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    OR NOT app_private.recipe_json_text(p->'title',200) OR NOT app_private.recipe_json_text(p->'summary',4000)
    OR jsonb_typeof(p->'dataClass') IS DISTINCT FROM 'string' OR p->>'dataClass' NOT IN ('demonstration','verified')
    OR jsonb_typeof(p->'difficulty') IS DISTINCT FROM 'string' OR p->>'difficulty' NOT IN ('easy','medium','hard')
    OR jsonb_typeof(p->'proteinClaim') IS DISTINCT FROM 'string' OR p->>'proteinClaim' NOT IN ('none','candidate','verified') THEN RETURN false; END IF;
  FOREACH field IN ARRAY ARRAY['revision','servings','activeMinutes','totalMinutes'] LOOP
    IF jsonb_typeof(p->field) IS DISTINCT FROM 'number' THEN RETURN false; END IF;
    n:=(p->>field)::numeric;
    IF n<>trunc(n) OR n>(CASE field WHEN 'revision' THEN 100000 WHEN 'servings' THEN 20 ELSE 10080 END)
      OR n<(CASE field WHEN 'activeMinutes' THEN 0 ELSE 1 END) THEN RETURN false; END IF;
  END LOOP;
  IF (p->>'activeMinutes')::numeric>(p->>'totalMinutes')::numeric THEN RETURN false; END IF;
  FOREACH field IN ARRAY ARRAY['regions','mealTypes','collections','equipment','tags','ingredients','steps'] LOOP
    a:=p->field;
    IF jsonb_typeof(a) IS DISTINCT FROM 'array' THEN RETURN false; END IF;
    limit_count:=CASE field WHEN 'regions' THEN 2 WHEN 'mealTypes' THEN 4 WHEN 'collections' THEN 2 WHEN 'equipment' THEN 20 WHEN 'tags' THEN 30 WHEN 'ingredients' THEN 60 ELSE 30 END;
    IF jsonb_array_length(a)>limit_count OR (field<>'collections' AND jsonb_array_length(a)<1) THEN RETURN false; END IF;
    IF field IN ('ingredients','steps') THEN CONTINUE; END IF;
    IF EXISTS(SELECT 1 FROM jsonb_array_elements(a) v WHERE jsonb_typeof(v)<>'string') OR (SELECT count(DISTINCT v) FROM jsonb_array_elements(a) v)<>jsonb_array_length(a) THEN RETURN false; END IF;
    FOR item IN SELECT value FROM jsonb_array_elements(a) LOOP
      IF (field='regions' AND item#>>'{}' NOT IN ('MD','RO')) OR (field='mealTypes' AND item#>>'{}' NOT IN ('breakfast','lunch','dinner','dessert'))
        OR (field='collections' AND item#>>'{}' NOT IN ('vegetarian','high-protein'))
        OR (field='equipment' AND (char_length(item#>>'{}')>32 OR item#>>'{}' !~ '^[a-z_]+$'))
        OR (field='tags' AND (char_length(item#>>'{}')>100 OR item#>>'{}' !~ '^[a-z0-9]+(-[a-z0-9]+)*$')) THEN RETURN false; END IF;
    END LOOP;
  END LOOP;
  FOR item IN SELECT value FROM jsonb_array_elements(p->'ingredients') LOOP
    IF NOT app_private.recipe_json_keys(item,ARRAY['ingredientSlug','quantity','unit','optional','state','preparation'])
      OR NOT app_private.recipe_json_text(item->'ingredientSlug',100) OR item->>'ingredientSlug' !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
      OR jsonb_typeof(item->'quantity') IS DISTINCT FROM 'string' OR coalesce(item->>'quantity','') !~ '^(0|[1-9][0-9]{0,11})(\.[0-9]{1,6})?$'
      OR jsonb_typeof(item->'unit') IS DISTINCT FROM 'string' OR item->>'unit' NOT IN ('g','kg','ml','l','piece')
      OR jsonb_typeof(item->'optional') IS DISTINCT FROM 'boolean' OR jsonb_typeof(item->'state') IS DISTINCT FROM 'string'
      OR item->>'state' NOT IN ('raw','cooked','ready-to-eat') OR NOT app_private.recipe_json_text(item->'preparation',500) THEN RETURN false; END IF;
    IF (item->>'quantity')::numeric<=0 OR (item->>'unit'='piece' AND (item->>'quantity')::numeric<>trunc((item->>'quantity')::numeric)) THEN RETURN false; END IF;
  END LOOP;
  FOR item IN SELECT value FROM jsonb_array_elements(p->'steps') LOOP
    IF NOT app_private.recipe_json_keys(item,ARRAY['instruction','timerSeconds']) OR NOT app_private.recipe_json_text(item->'instruction',8000) THEN RETURN false; END IF;
    IF item->'timerSeconds'<>'null'::jsonb THEN
      IF jsonb_typeof(item->'timerSeconds') IS DISTINCT FROM 'number' THEN RETURN false; END IF;
      n:=(item->>'timerSeconds')::numeric;IF n<>trunc(n) OR n NOT BETWEEN 1 AND 604800 THEN RETURN false; END IF;
    END IF;
  END LOOP;
  part:=p->'allergens';
  IF NOT app_private.recipe_json_keys(part,ARRAY['status','contains','mayContain','source','notes']) OR NOT app_private.recipe_json_text(part->'notes',1000) OR NOT app_private.recipe_json_source(part->'source') THEN RETURN false; END IF;
  FOREACH field IN ARRAY ARRAY['contains','mayContain'] LOOP
    a:=part->field;IF jsonb_typeof(a) IS DISTINCT FROM 'array' OR jsonb_array_length(a)>30 THEN RETURN false; END IF;
    IF EXISTS(SELECT 1 FROM jsonb_array_elements(a) v WHERE jsonb_typeof(v)<>'string') OR (SELECT count(DISTINCT v) FROM jsonb_array_elements(a) v)<>jsonb_array_length(a) THEN RETURN false; END IF;
  END LOOP;
  part:=p->'nutrition';
  IF NOT app_private.recipe_json_keys(part,ARRAY['status','basis','perServing','source','notes']) OR part->>'basis' IS DISTINCT FROM 'per-serving' OR NOT app_private.recipe_json_text(part->'notes',1000) OR NOT app_private.recipe_json_source(part->'source') THEN RETURN false; END IF;
  IF part->'perServing'<>'null'::jsonb AND NOT app_private.recipe_json_keys(part->'perServing',ARRAY['energyKcal','proteinG','carbohydrateG','fatG','fiberG','saltG']) THEN RETURN false; END IF;
  part:=p->'budget';
  IF NOT app_private.recipe_json_keys(part,ARRAY['status','currency','perServing','source','notes']) OR part->>'currency' IS NULL OR part->>'currency' NOT IN ('MDL','RON') OR NOT app_private.recipe_json_text(part->'notes',1000) OR NOT app_private.recipe_json_source(part->'source') THEN RETURN false; END IF;
  part:=p->'verification';
  IF NOT app_private.recipe_json_keys(part,ARRAY['status','reviewedBy','reviewedAt','evidenceUrl','notes']) OR NOT app_private.recipe_json_text(part->'reviewedBy',100,true) OR NOT app_private.recipe_json_text(part->'notes',1000) OR NOT app_private.recipe_json_text(part->'evidenceUrl',2048,true) THEN RETURN false; END IF;
  IF part->'reviewedAt'<>'null'::jsonb THEN
    IF jsonb_typeof(part->'reviewedAt') IS DISTINCT FROM 'string' OR coalesce(part->>'reviewedAt','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]+)?(Z|[+-][0-9]{2}:[0-9]{2})$' OR NOT isfinite((part->>'reviewedAt')::timestamptz) THEN RETURN false; END IF;
  END IF;
  IF NOT app_private.recipe_json_url(part->'evidenceUrl') THEN RETURN false; END IF;
  part:=p->'provenance';
  IF NOT app_private.recipe_json_keys(part,ARRAY['kind','name','url','license']) OR part->>'kind' IS NULL OR part->>'kind' NOT IN ('original','external') OR NOT app_private.recipe_json_text(part->'name',200) OR NOT app_private.recipe_json_text(part->'license',500,true) OR NOT app_private.recipe_json_text(part->'url',2048,true) THEN RETURN false; END IF;
  IF NOT app_private.recipe_json_url(part->'url') THEN RETURN false; END IF;
  RETURN app_private.recipe_seed_quality_ok(p);
EXCEPTION WHEN data_exception THEN RETURN false;
END;
$$;
REVOKE ALL ON FUNCTION app_private.recipe_json_keys(jsonb,text[]),app_private.recipe_json_text(jsonb,integer,boolean),app_private.recipe_json_url(jsonb),app_private.recipe_json_source(jsonb),app_private.recipe_seed_shape_ok(jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION app_private.recipe_json_keys(jsonb,text[]),app_private.recipe_json_text(jsonb,integer,boolean),app_private.recipe_json_url(jsonb),app_private.recipe_json_source(jsonb),app_private.recipe_seed_shape_ok(jsonb) TO cookly_api;

CREATE TABLE app_private.recipe_seed_records (
  namespace text NOT NULL CHECK(namespace ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  external_key text NOT NULL CHECK(external_key ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  import_revision integer NOT NULL CHECK(import_revision BETWEEN 1 AND 100000),
  recipe_id uuid NOT NULL,
  recipe_version_id uuid NOT NULL UNIQUE,
  content_hash text NOT NULL CHECK(content_hash ~ '^[a-f0-9]{64}$'),
  payload jsonb NOT NULL CHECK(app_private.recipe_seed_shape_ok(payload) IS TRUE),
  data_class text GENERATED ALWAYS AS (payload->>'dataClass') STORED NOT NULL,
  nutrition_status text GENERATED ALWAYS AS (payload#>>'{nutrition,status}') STORED NOT NULL,
  allergen_status text GENERATED ALWAYS AS (payload#>>'{allergens,status}') STORED NOT NULL,
  imported_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(namespace,external_key,import_revision),
  FOREIGN KEY(recipe_id,recipe_version_id) REFERENCES app_private.recipe_versions(recipe_id,id) ON DELETE RESTRICT,
  CHECK(content_hash=encode(sha256(convert_to(payload::text,'UTF8')),'hex'))
);
CREATE INDEX recipe_seed_identity_idx ON app_private.recipe_seed_records(namespace,external_key,recipe_id);
CREATE INDEX recipe_seed_quality_idx ON app_private.recipe_seed_records(data_class,nutrition_status,allergen_status);
DO $$ DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['recipe_equipment','recipe_allergens','recipe_seed_records'] LOOP
    EXECUTE format('ALTER TABLE app_private.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('ALTER TABLE app_private.%I FORCE ROW LEVEL SECURITY',t);
    EXECUTE format('REVOKE ALL ON app_private.%I FROM PUBLIC,anon,authenticated,service_role',t);
    EXECUTE format('GRANT SELECT ON app_private.%I TO cookly_api',t);
    -- Seed metadata contain no personal data. No web read/write endpoint is added.
    EXECUTE format('CREATE POLICY seed_executor_read ON app_private.%I FOR SELECT TO cookly_api USING(true)',t);
  END LOOP;
END;
$$;
CREATE TRIGGER guard_recipe_content BEFORE INSERT OR UPDATE OR DELETE ON app_private.recipe_equipment
  FOR EACH ROW EXECUTE FUNCTION app_private.guard_recipe_content();
CREATE TRIGGER guard_recipe_content BEFORE INSERT OR UPDATE OR DELETE ON app_private.recipe_allergens
  FOR EACH ROW EXECUTE FUNCTION app_private.guard_recipe_content();

-- Imported drafts are reproducible artifacts, corrected by a new import revision.
-- Status/publication may change on verified versions; their content cannot drift.
CREATE FUNCTION app_private.guard_recipe_seed() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE version_id uuid;
BEGIN
  IF TG_TABLE_NAME='recipe_versions' THEN
    IF TG_OP='INSERT' THEN RETURN NEW; END IF;
    version_id:=OLD.id;
  ELSE
    IF TG_OP='DELETE' THEN version_id:=OLD.recipe_version_id; ELSE version_id:=NEW.recipe_version_id; END IF;
  END IF;
  IF EXISTS(SELECT 1 FROM app_private.recipe_seed_records WHERE recipe_version_id=version_id) THEN
    IF TG_TABLE_NAME<>'recipe_versions' OR TG_OP='DELETE' OR
      (to_jsonb(NEW)-ARRAY['status','published_at','updated_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','published_at','updated_at']) THEN
      RAISE EXCEPTION 'Imported content is immutable; import a new revision' USING ERRCODE='23514';
    END IF;
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;
GRANT CREATE ON SCHEMA app_private TO cookly_api;
ALTER FUNCTION app_private.guard_recipe_seed() OWNER TO cookly_api;
REVOKE CREATE ON SCHEMA app_private FROM cookly_api;
REVOKE ALL ON FUNCTION app_private.guard_recipe_seed() FROM PUBLIC,anon,authenticated,service_role;
DO $$ DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['recipe_versions','recipe_servings','recipe_ingredients','recipe_steps','recipe_tags','recipe_equipment','recipe_allergens'] LOOP
    EXECUTE format('CREATE TRIGGER guard_recipe_seed BEFORE INSERT OR UPDATE OR DELETE ON app_private.%I FOR EACH ROW EXECUTE FUNCTION app_private.guard_recipe_seed()',t);
  END LOOP;
END;
$$;

CREATE FUNCTION app_private.import_recipe_bundle(p_bundle jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
<<recipe_import>>
DECLARE ns text; r jsonb; line jsonb; code text; target_recipe uuid; target_version uuid; target_ingredient uuid; target_unit uuid; ref_id uuid;
  old_hash text; fingerprint text; version_number integer; position integer; imported integer:=0; skipped integer:=0; quantity_text text; allergen_hint text;
BEGIN
  IF NOT app_private.recipe_json_keys(p_bundle,ARRAY['schemaVersion','namespace','locale','recipes']) OR octet_length(p_bundle::text)>8388608 OR p_bundle->'schemaVersion' IS DISTINCT FROM '1'::jsonb OR p_bundle->>'locale' IS DISTINCT FROM 'ro-RO'
    OR jsonb_typeof(p_bundle->'recipes') IS DISTINCT FROM 'array' OR jsonb_array_length(p_bundle->'recipes')>1000 THEN RAISE EXCEPTION 'Invalid recipe bundle' USING ERRCODE='22023'; END IF;
  ns:=p_bundle->>'namespace';IF ns IS NULL OR char_length(ns)>100 OR ns !~ '^[a-z0-9]+(-[a-z0-9]+)*$' THEN RAISE EXCEPTION 'Invalid namespace' USING ERRCODE='22023'; END IF;
  PERFORM pg_advisory_xact_lock(1129271115,hashtext(ns));
  IF (SELECT count(DISTINCT value->>'key') FROM jsonb_array_elements(p_bundle->'recipes'))<>jsonb_array_length(p_bundle->'recipes') THEN RAISE EXCEPTION 'Duplicate recipe keys' USING ERRCODE='22023'; END IF;
  FOR r IN SELECT value FROM jsonb_array_elements(p_bundle->'recipes') ORDER BY value->>'key' LOOP
    IF r->>'key' IS NULL OR r->>'key' !~ '^[a-z0-9]+(-[a-z0-9]+)*$' OR coalesce(r->>'revision','') !~ '^[1-9][0-9]{0,5}$'
      OR app_private.recipe_seed_shape_ok(r) IS DISTINCT FROM true OR (r->>'activeMinutes')::integer>(r->>'totalMinutes')::integer THEN RAISE EXCEPTION 'Invalid recipe metadata' USING ERRCODE='22023'; END IF;
    fingerprint:=encode(sha256(convert_to(r::text,'UTF8')),'hex');
    SELECT content_hash INTO old_hash FROM app_private.recipe_seed_records WHERE namespace=ns AND external_key=r->>'key' AND import_revision=(r->>'revision')::integer;
    IF FOUND THEN
      IF old_hash<>fingerprint THEN RAISE EXCEPTION 'Seed revision conflict' USING ERRCODE='23505'; END IF;
      skipped:=skipped+1;CONTINUE;
    END IF;
    SELECT recipe_id INTO target_recipe FROM app_private.recipe_seed_records WHERE namespace=ns AND external_key=r->>'key' ORDER BY import_revision DESC LIMIT 1;
    IF target_recipe IS NULL THEN
      IF EXISTS(SELECT 1 FROM app_private.recipes WHERE slug=r->>'key') THEN RAISE EXCEPTION 'Recipe slug already belongs to another source' USING ERRCODE='23505'; END IF;
      INSERT INTO app_private.recipes(slug) VALUES(r->>'key') RETURNING id INTO target_recipe;
    ELSIF (r->>'revision')::integer<=(SELECT max(import_revision) FROM app_private.recipe_seed_records WHERE namespace=ns AND external_key=r->>'key') THEN
      RAISE EXCEPTION 'Import revision must increase' USING ERRCODE='22023';
    END IF;
    SELECT coalesce(max(v.version_number),0)+1 INTO version_number FROM app_private.recipe_versions v WHERE v.recipe_id=target_recipe;
    INSERT INTO app_private.recipe_versions(recipe_id,version_number,title,summary,difficulty,active_minutes,total_minutes,data_class,attribution)
      VALUES(target_recipe,version_number,r->>'title',r->>'summary',r->>'difficulty',(r->>'activeMinutes')::integer,(r->>'totalMinutes')::integer,r->>'dataClass',r#>>'{provenance,name}') RETURNING id INTO target_version;
    INSERT INTO app_private.recipe_servings(recipe_version_id,base_servings) VALUES(target_version,(r->>'servings')::integer);
    IF jsonb_typeof(r->'ingredients')<>'array' OR jsonb_array_length(r->'ingredients') NOT BETWEEN 1 AND 60
      OR jsonb_typeof(r->'steps')<>'array' OR jsonb_array_length(r->'steps') NOT BETWEEN 1 AND 30
      OR jsonb_typeof(r->'equipment')<>'array' OR jsonb_array_length(r->'equipment') NOT BETWEEN 1 AND 20
      OR jsonb_typeof(r->'tags')<>'array' OR jsonb_array_length(r->'tags') NOT BETWEEN 1 AND 30 THEN RAISE EXCEPTION 'Incomplete recipe content' USING ERRCODE='22023'; END IF;
    IF (SELECT count(DISTINCT value->>'ingredientSlug') FROM jsonb_array_elements(r->'ingredients'))<>jsonb_array_length(r->'ingredients') THEN RAISE EXCEPTION 'Duplicate ingredient' USING ERRCODE='22023'; END IF;
    IF ((r->'collections') ? 'vegetarian' OR (r->'tags') ? 'vegetarian') AND EXISTS(SELECT 1 FROM jsonb_array_elements(r->'ingredients') i WHERE i->>'ingredientSlug' IN ('carne-de-pui','piept-de-pui')) THEN RAISE EXCEPTION 'Vegetarian classification conflicts with chicken' USING ERRCODE='22023'; END IF;
    position:=0;
    FOR line IN SELECT value FROM jsonb_array_elements(r->'ingredients') LOOP
      allergen_hint:=CASE WHEN line->>'ingredientSlug'='ou-de-gaina' THEN 'eggs'
        WHEN line->>'ingredientSlug' IN ('lapte-de-vaca','branza-proaspata-de-vaca','smantana','unt','iaurt-natural') THEN 'milk'
        WHEN line->>'ingredientSlug' IN ('faina-de-grau','fulgi-de-ovaz','gris-de-grau','arpacas-de-orz','paste-din-grau-fara-ou','paine-de-grau') THEN 'gluten'
        WHEN line->>'ingredientSlug'='miez-de-nuca' THEN 'tree_nuts' ELSE NULL END;
      IF r#>>'{allergens,status}'='verified' AND allergen_hint IS NOT NULL AND NOT (r#>'{allergens,contains}') ? allergen_hint THEN RAISE EXCEPTION 'Minimum allergen declaration missing' USING ERRCODE='22023'; END IF;
      SELECT i.id,u.id INTO target_ingredient,target_unit FROM app_private.ingredients i JOIN app_private.ingredient_units iu ON iu.ingredient_id=i.id
        JOIN app_private.units u ON u.id=iu.unit_id WHERE i.slug=line->>'ingredientSlug' AND i.is_active AND u.code=line->>'unit';
      IF NOT FOUND THEN RAISE EXCEPTION 'Unknown canonical ingredient or disallowed unit' USING ERRCODE='22023'; END IF;
      quantity_text:=line->>'quantity';
      IF jsonb_typeof(line->'quantity')<>'string' OR quantity_text IS NULL OR quantity_text !~ '^(0|[1-9][0-9]{0,11})(\.[0-9]{1,6})?$'
        OR quantity_text::numeric<=0 OR (line->>'unit'='piece' AND quantity_text::numeric<>trunc(quantity_text::numeric)) THEN RAISE EXCEPTION 'Invalid ingredient quantity' USING ERRCODE='22023'; END IF;
      position:=position+1;
      INSERT INTO app_private.recipe_ingredients(recipe_version_id,ingredient_id,quantity,unit_id,is_optional,position,preparation_note)
        VALUES(target_version,target_ingredient,quantity_text::numeric,target_unit,(line->>'optional')::boolean,position,line->>'preparation');
    END LOOP;
    IF NOT EXISTS(SELECT 1 FROM app_private.recipe_ingredients WHERE recipe_version_id=target_version AND NOT is_optional) THEN RAISE EXCEPTION 'A required ingredient is needed' USING ERRCODE='22023'; END IF;
    position:=0;
    FOR line IN SELECT value FROM jsonb_array_elements(r->'steps') LOOP
      position:=position+1;INSERT INTO app_private.recipe_steps(recipe_version_id,step_number,instruction,timer_seconds) VALUES(target_version,position,line->>'instruction',(line->>'timerSeconds')::integer);
    END LOOP;
    FOR code IN SELECT value FROM jsonb_array_elements_text(r->'equipment') LOOP
      SELECT id INTO ref_id FROM app_private.equipment_types WHERE equipment_types.code=recipe_import.code;
      IF NOT FOUND THEN RAISE EXCEPTION 'Unknown equipment' USING ERRCODE='22023'; END IF;
      INSERT INTO app_private.recipe_equipment VALUES(target_version,ref_id);
    END LOOP;
    FOR code IN SELECT value FROM jsonb_array_elements_text(r->'tags') LOOP
      IF code='high-protein' AND r->>'proteinClaim'<>'verified' THEN RAISE EXCEPTION 'High protein claim is not verified' USING ERRCODE='22023'; END IF;
      SELECT id INTO ref_id FROM app_private.tags WHERE slug=code;
      IF NOT FOUND THEN RAISE EXCEPTION 'Unknown tag' USING ERRCODE='22023'; END IF;
      INSERT INTO app_private.recipe_tags VALUES(target_version,ref_id,now());
    END LOOP;
    FOR code IN SELECT value FROM jsonb_array_elements_text(r#>'{allergens,contains}') LOOP
      SELECT id INTO ref_id FROM app_private.allergens WHERE allergens.code=recipe_import.code;
      IF NOT FOUND THEN RAISE EXCEPTION 'Unknown allergen' USING ERRCODE='22023'; END IF;
      INSERT INTO app_private.recipe_allergens VALUES(target_version,ref_id,'contains');
    END LOOP;
    FOR code IN SELECT value FROM jsonb_array_elements_text(r#>'{allergens,mayContain}') LOOP
      SELECT id INTO ref_id FROM app_private.allergens WHERE allergens.code=recipe_import.code;
      IF NOT FOUND THEN RAISE EXCEPTION 'Unknown allergen' USING ERRCODE='22023'; END IF;
      INSERT INTO app_private.recipe_allergens VALUES(target_version,ref_id,'may_contain');
    END LOOP;
    INSERT INTO app_private.recipe_seed_records(namespace,external_key,import_revision,recipe_id,recipe_version_id,content_hash,payload)
      VALUES(ns,r->>'key',(r->>'revision')::integer,target_recipe,target_version,fingerprint,r);
    imported:=imported+1;
  END LOOP;
  RETURN jsonb_build_object('imported',imported,'skipped',skipped);
END;
$$;
REVOKE ALL ON FUNCTION app_private.import_recipe_bundle(jsonb) FROM PUBLIC,anon,authenticated,service_role,cookly_api;
CREATE FUNCTION app_private.export_recipe_bundle(p_namespace text,p_data_class text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
  IF p_namespace IS NULL OR char_length(p_namespace)>100 OR p_namespace !~ '^[a-z0-9]+(-[a-z0-9]+)*$' OR (p_data_class IS NOT NULL AND p_data_class NOT IN ('demonstration','verified')) THEN RAISE EXCEPTION 'Invalid export filter' USING ERRCODE='22023'; END IF;
  WITH latest AS (SELECT DISTINCT ON(external_key) external_key,payload,data_class FROM app_private.recipe_seed_records WHERE namespace=p_namespace ORDER BY external_key,import_revision DESC)
    SELECT coalesce(jsonb_agg(payload ORDER BY external_key),'[]'::jsonb) INTO result FROM latest WHERE p_data_class IS NULL OR data_class=p_data_class;
  RETURN jsonb_build_object('schemaVersion',1,'namespace',p_namespace,'locale','ro-RO','recipes',result);
END;
$$;
REVOKE ALL ON FUNCTION app_private.export_recipe_bundle(text,text) FROM PUBLIC,anon,authenticated,service_role,cookly_api;
NOTIFY pgrst,'reload schema';
