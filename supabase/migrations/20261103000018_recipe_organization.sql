CREATE FUNCTION app_private.recipe_collection_name(p_name text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT SET search_path='' AS $$
 SELECT pg_catalog.normalize(pg_catalog.btrim(pg_catalog.regexp_replace(
  p_name,U&'[\0009-\000D\0020\00A0\1680\2000-\200A\2028\2029\202F\205F\3000\FEFF]+',' ','g')),'NFC');
$$;
REVOKE ALL ON FUNCTION app_private.recipe_collection_name(text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION app_private.recipe_collection_name(text) TO cookly_api;
CREATE TABLE app_private.recipe_collections (
 id uuid PRIMARY KEY,
 owner_id uuid NOT NULL REFERENCES app_private.profiles(id) ON DELETE CASCADE,
 name text NOT NULL CHECK (name=app_private.recipe_collection_name(name) AND char_length(name) BETWEEN 1 AND 80),
 UNIQUE(id,owner_id)
);
CREATE UNIQUE INDEX recipe_collection_names ON app_private.recipe_collections(owner_id,lower(name));
CREATE TABLE app_private.recipe_collection_members (
 owner_id uuid NOT NULL,
 collection_id uuid NOT NULL,
 recipe_id uuid NOT NULL REFERENCES app_private.recipes(id) ON DELETE CASCADE,
 PRIMARY KEY(owner_id,collection_id,recipe_id),
 FOREIGN KEY(collection_id,owner_id) REFERENCES app_private.recipe_collections(id,owner_id) ON DELETE CASCADE
);
CREATE TABLE app_private.recipe_history (
 owner_id uuid NOT NULL REFERENCES app_private.profiles(id) ON DELETE CASCADE,
 operation_id uuid NOT NULL,
 recipe_id uuid NOT NULL REFERENCES app_private.recipes(id) ON DELETE CASCADE,
 cooked_at timestamptz NOT NULL,
 servings integer NOT NULL CHECK(servings BETWEEN 1 AND 20),
 PRIMARY KEY(owner_id,operation_id)
);
CREATE INDEX recipe_history_owner_date ON app_private.recipe_history(owner_id,cooked_at DESC);
INSERT INTO app_private.recipe_history SELECT owner_id,operation_id,recipe_id,created_at,(payload#>>'{command,servings}')::integer FROM app_private.recipe_action_operations WHERE kind='cooked';
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['recipe_collections','recipe_collection_members','recipe_history'] LOOP
  EXECUTE format('ALTER TABLE app_private.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE app_private.%I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON app_private.%I FROM PUBLIC,anon,authenticated,service_role',t);
  EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON app_private.%I TO cookly_api',t);
  EXECUTE format('CREATE POLICY owner_access ON app_private.%I TO cookly_api USING(owner_id=(SELECT cookly_security.current_uid())) WITH CHECK(owner_id=(SELECT cookly_security.current_uid()))',t);
 END LOOP;
END $$;
-- Only the API executor can resolve saved identifiers after withdrawal. Version
-- content remains protected by the existing publication policies.
CREATE POLICY organized_recipe_identifiers ON app_private.recipes FOR SELECT TO cookly_api USING (
 EXISTS(SELECT 1 FROM app_private.favorites f WHERE f.recipe_id=recipes.id AND f.owner_id=(SELECT cookly_security.current_uid()))
 OR EXISTS(SELECT 1 FROM app_private.recipe_collection_members m WHERE m.recipe_id=recipes.id AND m.owner_id=(SELECT cookly_security.current_uid()))
 OR EXISTS(SELECT 1 FROM app_private.recipe_history h WHERE h.recipe_id=recipes.id AND h.owner_id=(SELECT cookly_security.current_uid()))
);
CREATE FUNCTION app_private.record_cooked_history() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF NEW.kind='cooked' THEN
 INSERT INTO app_private.recipe_history VALUES(NEW.owner_id,NEW.operation_id,NEW.recipe_id,NEW.created_at,(NEW.payload#>>'{command,servings}')::integer) ON CONFLICT DO NOTHING;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER record_cooked_history AFTER INSERT ON app_private.recipe_action_operations FOR EACH ROW EXECUTE FUNCTION app_private.record_cooked_history();
CREATE OR REPLACE FUNCTION api.get_recipe_actions(p_slug text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=cookly_security.current_uid(); rid uuid;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
 SELECT r.id INTO rid FROM app_private.recipes r JOIN app_private.recipe_versions v ON v.id=r.current_version_id WHERE r.slug=p_slug AND r.status='published' AND v.status='published';
 IF NOT FOUND THEN RAISE EXCEPTION 'Recipe unavailable' USING ERRCODE='P0002'; END IF;
 RETURN jsonb_build_object('favorite',EXISTS(SELECT 1 FROM app_private.favorites f WHERE f.owner_id=actor AND f.recipe_id=rid),'lastCookedAt',(SELECT max(h.cooked_at) FROM app_private.recipe_history h WHERE h.owner_id=actor AND h.recipe_id=rid),'addedCount',0);
END $$;
CREATE FUNCTION api.get_recipe_organization() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=cookly_security.current_uid(); result jsonb;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
 SELECT jsonb_build_object('accountId',actor,
 'favorites',(SELECT coalesce(jsonb_agg('published:'||r.slug ORDER BY f.created_at DESC,r.slug),'[]') FROM app_private.favorites f JOIN app_private.recipes r ON r.id=f.recipe_id WHERE f.owner_id=actor),
 'collections',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'recipeKeys',(SELECT coalesce(jsonb_agg('published:'||r.slug ORDER BY r.slug),'[]') FROM app_private.recipe_collection_members m JOIN app_private.recipes r ON r.id=m.recipe_id WHERE m.owner_id=actor AND m.collection_id=c.id)) ORDER BY c.name,c.id),'[]') FROM app_private.recipe_collections c WHERE c.owner_id=actor),
 'cooked',(SELECT coalesce(jsonb_agg(jsonb_build_object('recipeKey','published:'||r.slug,'at',h.cooked_at,'servings',h.servings) ORDER BY h.cooked_at DESC,h.operation_id),'[]') FROM (SELECT * FROM app_private.recipe_history WHERE owner_id=actor ORDER BY cooked_at DESC,operation_id LIMIT 100) h JOIN app_private.recipes r ON r.id=h.recipe_id),
 'titles',(SELECT coalesce(jsonb_object_agg('published:'||r.slug,CASE WHEN r.status='published' AND v.status='published' THEN v.title ELSE NULL END),'{}') FROM app_private.recipes r LEFT JOIN app_private.recipe_versions v ON v.id=r.current_version_id WHERE r.id IN (SELECT recipe_id FROM app_private.favorites WHERE owner_id=actor UNION SELECT recipe_id FROM app_private.recipe_collection_members WHERE owner_id=actor UNION SELECT recipe_id FROM app_private.recipe_history WHERE owner_id=actor))
 ) INTO result;
 RETURN result;
END $$;
CREATE FUNCTION api.mutate_recipe_organization(p_command jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=cookly_security.current_uid(); kind text:=p_command->>'kind'; cid uuid; rid uuid; normalized text; enabled boolean;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
 IF jsonb_typeof(p_command) IS DISTINCT FROM 'object' OR octet_length(p_command::text)>2048 THEN RAISE EXCEPTION 'Invalid command' USING ERRCODE='22023'; END IF;
 PERFORM 1 FROM app_private.profiles WHERE id=actor FOR UPDATE;
 IF kind IN ('saveCollection','deleteCollection','membership') THEN
  cid:=(p_command->>'id')::uuid;
  IF cid IS NULL THEN RAISE EXCEPTION 'Invalid id' USING ERRCODE='22023'; END IF;
 END IF;
 IF kind='saveCollection' THEN
  IF NOT app_private.recipe_json_keys(p_command,ARRAY['kind','id','name','create']) OR jsonb_typeof(p_command->'create') IS DISTINCT FROM 'boolean' OR jsonb_typeof(p_command->'name') IS DISTINCT FROM 'string' THEN RAISE EXCEPTION 'Invalid name' USING ERRCODE='22023'; END IF;
  normalized:=app_private.recipe_collection_name(p_command->>'name');
  IF char_length(normalized) NOT BETWEEN 1 AND 80 OR EXISTS(SELECT 1 FROM app_private.recipe_collections WHERE owner_id=actor AND lower(name)=lower(normalized) AND id<>cid) THEN RAISE EXCEPTION 'Invalid or duplicate collection name' USING ERRCODE='22023'; END IF;
  IF (p_command->>'create')::boolean THEN
   IF EXISTS(SELECT 1 FROM app_private.recipe_collections WHERE id=cid AND owner_id=actor AND name=normalized) THEN RETURN api.get_recipe_organization(); END IF;
   IF (SELECT count(*) FROM app_private.recipe_collections WHERE owner_id=actor)>=50 THEN RAISE EXCEPTION 'Collection capacity' USING ERRCODE='22023'; END IF;
   INSERT INTO app_private.recipe_collections VALUES(cid,actor,normalized) ON CONFLICT(id) DO NOTHING;
   IF NOT FOUND THEN RAISE EXCEPTION 'Collection unavailable' USING ERRCODE='P0002'; END IF;
  ELSE
   UPDATE app_private.recipe_collections SET name=normalized WHERE id=cid AND owner_id=actor;
   IF NOT FOUND THEN RAISE EXCEPTION 'Collection unavailable' USING ERRCODE='P0002'; END IF;
  END IF;
 ELSIF kind='deleteCollection' THEN
  IF NOT app_private.recipe_json_keys(p_command,ARRAY['kind','id']) THEN RAISE EXCEPTION 'Invalid command' USING ERRCODE='22023'; END IF;
  DELETE FROM app_private.recipe_collections WHERE id=cid AND owner_id=actor;
 ELSIF kind='clearHistory' THEN
  IF NOT app_private.recipe_json_keys(p_command,ARRAY['kind']) THEN RAISE EXCEPTION 'Invalid command' USING ERRCODE='22023'; END IF;
  DELETE FROM app_private.recipe_history WHERE owner_id=actor;
 ELSIF kind IN ('favorite','membership') THEN
  IF NOT app_private.recipe_json_keys(p_command,CASE WHEN kind='favorite' THEN ARRAY['kind','recipeKey','enabled'] ELSE ARRAY['kind','id','recipeKey','enabled'] END) OR jsonb_typeof(p_command->'enabled') IS DISTINCT FROM 'boolean' OR jsonb_typeof(p_command->'recipeKey') IS DISTINCT FROM 'string' OR (p_command->>'recipeKey') !~ '^published:[a-z0-9]+(-[a-z0-9]+)*$' THEN RAISE EXCEPTION 'Invalid membership' USING ERRCODE='22023'; END IF;
  enabled:=(p_command->>'enabled')::boolean;
  SELECT id INTO rid FROM app_private.recipes WHERE slug=substring(p_command->>'recipeKey' FROM 11);
  IF NOT FOUND THEN RAISE EXCEPTION 'Recipe unavailable' USING ERRCODE='P0002'; END IF;
  IF enabled AND NOT EXISTS(SELECT 1 FROM app_private.recipes r JOIN app_private.recipe_versions v ON v.id=r.current_version_id WHERE r.id=rid AND r.status='published' AND v.status='published') THEN RAISE EXCEPTION 'Recipe unavailable' USING ERRCODE='P0002'; END IF;
  IF kind='favorite' THEN
   IF enabled THEN PERFORM api.set_favorite(rid,true); ELSE DELETE FROM app_private.favorites WHERE owner_id=actor AND recipe_id=rid; END IF;
  ELSE
   IF NOT EXISTS(SELECT 1 FROM app_private.recipe_collections WHERE id=cid AND owner_id=actor) THEN RAISE EXCEPTION 'Collection unavailable' USING ERRCODE='P0002'; END IF;
   IF enabled THEN
    IF (SELECT count(*) FROM app_private.recipe_collection_members WHERE owner_id=actor AND collection_id=cid)>=500 AND NOT EXISTS(SELECT 1 FROM app_private.recipe_collection_members WHERE owner_id=actor AND collection_id=cid AND recipe_id=rid) THEN RAISE EXCEPTION 'Membership capacity' USING ERRCODE='22023'; END IF;
    INSERT INTO app_private.recipe_collection_members VALUES(actor,cid,rid) ON CONFLICT DO NOTHING;
   ELSE DELETE FROM app_private.recipe_collection_members WHERE owner_id=actor AND collection_id=cid AND recipe_id=rid;
   END IF;
  END IF;
 ELSE RAISE EXCEPTION 'Invalid command' USING ERRCODE='22023'; END IF;
 RETURN api.get_recipe_organization();
END $$;
GRANT CREATE ON SCHEMA api TO cookly_api;
ALTER FUNCTION api.get_recipe_organization() OWNER TO cookly_api;
ALTER FUNCTION api.mutate_recipe_organization(jsonb) OWNER TO cookly_api;
REVOKE CREATE ON SCHEMA api FROM cookly_api;
REVOKE ALL ON FUNCTION api.get_recipe_organization(),api.mutate_recipe_organization(jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION api.get_recipe_organization(),api.mutate_recipe_organization(jsonb) TO authenticated;
REVOKE ALL ON FUNCTION app_private.record_cooked_history() FROM PUBLIC,anon,authenticated,service_role;
NOTIFY pgrst,'reload schema';
