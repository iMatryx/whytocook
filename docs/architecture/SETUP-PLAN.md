# Cookly foundation — implementation plan

> Execution: inline, for the initialization explicitly requested in Stage 2. No business features, remote deployment, database schema or Git initialization.

**Goal:** Runnable Next.js App Router foundation with pnpm, strict TypeScript, Tailwind/shadcn, themes, validated configuration and reproducible checks.

**Architecture:** `src/app` contains routing only; reusable UI in `src/components`, safe helpers in `src/shared/presentation`, configuration in `src/config/env`. Future features retain their boundaries from PROJECT-STRUCTURE.md and are not scaffolded early.

**Spec:** [Project structure](PROJECT-STRUCTURE.md), [architecture](ARCHITECTURE-Cookly.md), and the Stage 2 initialization request.

## Constraints and review focus

- Keep existing product documents; update current-state statements in entry READMEs.
- No business features or dependency on a configured external account for the shell.
- pnpm only, exact resolved versions and one lockfile; no global installation required.
- Environment errors report variable names without secret values; private keys never enter browser exports.
- Theme persistence, system preference, hydration and keyboard access must work.
- Lint must reject unsafe imports through both aliases and relative paths.
- The production build must succeed without downloading remote fonts or accessing Supabase.
- No existing Git repository; work in the authorized project directory without creating a worktree or commits.

## Task 1 — Toolchain and configuration

- [ ] Add package.json, pnpm lockfile, tsconfig, Next/PostCSS, flat ESLint, Prettier, shadcn components.json, test runner configuration.
- [ ] Use strict flags and `@/*` alias; configure import boundaries and environment access restrictions.
- [ ] Verify dependency installation, package manager pin, lint/typecheck scripts.

## Task 2 — Environment boundaries (test first)

- [ ] Write failing tests for shell defaults, invalid origin/enum, URL protocol restrictions and blank Supabase values.
- [ ] Write failing tests for separate integration and maintenance validation, including secret-redacted errors and 32-byte secrets.
- [ ] Implement pure Zod schemas with client/server/maintenance adapters; require integration secrets only when those capabilities initialize.
- [ ] Verify tests and preserve .env.example without credentials.

## Task 3 — Application shell and themes

- [ ] Add layout, theme provider/control, global CSS tokens and one shadcn Button primitive; use local/system fonts.
- [ ] Add an honest foundation homepage, loading, not-found, error and global-error boundaries without business routes.
- [ ] Verify light/dark/system behavior, persistence, no hydration errors and keyboard access in a real browser if available.

## Task 4 — Delivery and verification

- [ ] Run format, lint, typecheck, unit tests and production build; fix actual failures.
- [ ] Start dev server, perform HTTP/browser smoke checks; also smoke production startup.
- [ ] Fresh-context code review, resolve important findings and rerun affected checks.
- [ ] Update README and architecture entrypoint, document versions, dependencies, commands, files, actual results and limitations in SETUP-VERIFICATION.md.

## Progress

- Baseline: seven documentation/configuration files, no package.json/src/.git; no baseline application tests exist.
- Package registry access failed inside sandbox (ENOTFOUND); network escalation requested for pnpm bootstrap.
- Ruling: use the native Node 24 test runner for this foundation instead of the previously proposed Vitest; no DOM/unit framework is needed for pure environment parsing and the lint rule. Browser behavior remains Playwright. This removes a dependency and requires Node >=24.14.0.
- Architecture checks: observed 5/5 failures against a stub, then 5/5 passing; alias traversal regression observed failing and corrected, now 6/6 passing.
- Environment checks: observed 7 failures/1 pass against stubs before Zod implementation. Final execution awaits dependency installation.
