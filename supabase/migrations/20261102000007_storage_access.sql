-- Private buckets: no unverified object is publicly addressable.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES
  ('recipe-media','recipe-media',false,5242880,ARRAY['image/jpeg','image/png','image/webp']),
  ('account-exports','account-exports',false,52428800,ARRAY['application/json','application/zip'])
ON CONFLICT (id) DO UPDATE SET public=false,file_size_limit=EXCLUDED.file_size_limit,
  allowed_mime_types=EXCLUDED.allowed_mime_types;

GRANT CREATE ON SCHEMA cookly_security TO cookly_authz;
CREATE FUNCTION cookly_security.owns_storage_path(object_name text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT coalesce(split_part(object_name,'/',1)=cookly_security.current_uid()::text
    AND object_name ~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}\.(jpg|jpeg|png|webp|json|zip)$',false);
$$;
ALTER FUNCTION cookly_security.owns_storage_path(text) OWNER TO cookly_authz;
REVOKE ALL ON FUNCTION cookly_security.owns_storage_path(text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION cookly_security.owns_storage_path(text) TO authenticated;
REVOKE CREATE ON SCHEMA cookly_security FROM cookly_authz;

CREATE POLICY cookly_media_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id='recipe-media' AND owner_id=auth.uid()::text
    AND cookly_security.owns_storage_path(name) AND cookly_security.can_edit_catalog());
CREATE POLICY cookly_media_upload ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id='recipe-media' AND owner_id=auth.uid()::text
    AND cookly_security.owns_storage_path(name) AND cookly_security.can_edit_catalog()
    AND name ~ '\.(jpg|jpeg|png|webp)$');
CREATE POLICY cookly_media_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id='recipe-media' AND owner_id=auth.uid()::text
    AND cookly_security.owns_storage_path(name) AND cookly_security.can_edit_catalog());
CREATE POLICY cookly_exports_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id='account-exports' AND owner_id=auth.uid()::text
    AND cookly_security.owns_storage_path(name) AND name ~ '\.(json|zip)$');
-- No client UPDATE/upsert, no export INSERT/DELETE, no anonymous object policy.
-- Storage service validates MIME/size; bytes still need independent verification
-- before any later publication pipeline enables public media.
CREATE INDEX cookly_storage_owner_bucket_idx ON storage.objects(bucket_id,owner_id)
  WHERE bucket_id IN ('recipe-media','account-exports');
