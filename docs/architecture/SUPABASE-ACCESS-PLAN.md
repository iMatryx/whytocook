# Supabase access implementation plan

> For agentic workers: use superpowers:executing-plans; implement in this workspace,
> preserving all existing uncommitted work. No automatic commits or remote setup.

**Goal:** configure Supabase Auth/Storage/PostgreSQL and enforce isolated ownership,
public published recipes and authorized editorial access.

**Architecture:** preserve `app_private` tables, expose `api` security-invoker read
views and narrow security-definer write RPCs. A NOLOGIN/NOBYPASSRLS executor is not
the table owner. A separate metadata reader evaluates the current JWT subject;
signup provisioning has a third minimal role. Server adapters validate Auth with
the provider and then fetch live roles, using only a publishable key and user JWT.

**Stack:** existing Next/TypeScript strict/Zod/PostgreSQL; native fetch for the
small REST adapter. PGlite is requested only for disposable PostgreSQL tests;
install remains subject to the environment's network approval.

**Spec:** user's Etapa 3 Supabase/access request, ARCHITECTURE-Cookly.md §9,
PROJECT-STRUCTURE.md and docs/database/SCHEMA.md.

## Constraints and review focus

- Do not expose app_private, service/secret keys, auth metadata or raw DB errors.
- Do not implement business workflows, login screens, matching, consumption or AI.
- Test anon/A/B/editor/admin/disabled, spoofed roles, missing JWT and stale revisions.
- MFA AAL2 is required for editorial writes; admin has no override on personal rows.
- RLS applies to every underlying table; new tables stay denied until explicit grants.
- Keep existing published-version triggers; migration corrections are versioned.
- Storage is private: editor-owned image uploads and owner-only exports download;
  unverified image publication and export generation are not enabled.

## Task 1 — SQL authorization and isolation

- [x] Add SQL isolation scenarios (auth.uid/JWT fixture, roles and Storage).
- [ ] Run against pre-access schema to observe denial of intended own-user access.
- [x] Add migrations 05 (roles/helpers/policies/views/provisioning), 06 (RPCs),
      07 (Storage). REVOKE EXECUTE in each migration; no dynamic SQL from user input.
- [ ] Test public/draft visibility, cross-owner reads/writes, self-promotion,
      suspended accounts, direct writes, optimistic revisions and editorial MFA.

Files: supabase/migrations/2026110200000{5,6,7}_*.sql;
tests/database/access-bootstrap.sql, access.test.mjs and existing schema runner.

## Task 2 — Server access boundary

- [x] Add tests for verified actor, mismatched subject, provider errors,
      live role changes, malicious metadata, storage paths and safe error mapping.
- [x] Implement server-only per-request REST transport, Zod actor contract,
      requireRole and own-resource checks; expose a no-store auth-context GET endpoint.
- [x] Run Node server tests, project tests, lint and strict typecheck.

Files: src/shared/contracts/actor.schema.ts; src/server/supabase/_.server.ts;
src/server/auth/_.server.ts; src/server/http/access-response.server.ts;
src/app/api/v1/auth/context/route.ts; tests/security/*.test.ts.

## Task 3 — Local configuration, documentation and verification

- [x] Add supabase/config.toml (only api exposed, Auth redirects/email/MFA,
      private bucket limits) and document migration/reset commands for disposable local DB.
- [x] Update .env.example, README and access security/verification docs; distinguish
      SQL execution from HTTP/Auth/Storage integration and multi-session tests.
- [x] Request independent security review, fix findings, rerun affected checks.
- [x] Report actual commands, limitations and manual verification; stop at this stage.

No production changes or secrets are needed. Configuring a hosted project and
end-to-end signup/session refresh need an authorized project and running services.

SQL test execution remains blocked by unavailable PGlite/network approval; no SQL pass is claimed. Auth/profile is the subsequent explicit user request, documented in AUTH-PROFILE-PLAN.md.
