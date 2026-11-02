-- TEST ONLY. Minimal managed objects for an empty, disposable PostgreSQL instance.
-- Never run this fixture against Supabase or a real database with user data.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY);
