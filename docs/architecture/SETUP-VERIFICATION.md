# Cookly — Stage 2 setup verification

This is an execution record, not a claim that planned checks have passed.

## Scope and files

Foundation only: package/tooling configuration, `src/app` shell and boundaries, `src/components/theme`, shadcn-derived Button, `src/styles/globals.css`, `src/shared/presentation/cn.ts`, `src/config/env`, lint rule under `tooling/eslint`, Node tests and Playwright smoke tests. No Supabase project, business feature, migration, AI provider, billing or deployment is created.

Dependency rationale:

- Next/React/React DOM: requested App Router and rendering runtime.
- Tailwind/PostCSS: requested styling; `class-variance-authority`, `clsx`, `tailwind-merge`, Radix Slot: local shadcn-compatible Button composition.
- `next-themes`: light/dark/system persistence and hydration handling, following the official shadcn guide.
- Zod: environment validation; `server-only`: explicit guard against importing privileged adapters into client code.
- TypeScript/types, ESLint/Next config, Prettier/config: requested type, lint and formatting checks.
- Playwright: real browser checks for theme persistence, hydration, keyboard skip link and 404 recovery. Unit/import tests use Node's built-in runner.
- pnpm: requested package manager, bootstrapped through Corepack; exact resolved version and lockfile remain pending until registry access is approved.

## Actual checks so far

| Command | Actual result |
|---|---|
| `node --version` | `v24.14.0` |
| `git rev-parse --show-toplevel` | Not a Git repository; no Git initialization/worktree/commit attempted |
| `npm view next version --fetch-retries=0 --fetch-timeout=10000` | Failed inside sandbox: ENOTFOUND registry.npmjs.org |
| `COREPACK_HOME=/private/tmp/cookly-corepack corepack pnpm --version` | Failed inside sandbox with the same network restriction; escalated attempt pending approval |
| `node --test tests/architecture/import-boundaries.test.mjs` | 8 passed, 0 failed after the recorded red/green cycles, including review regressions |
| `node --check tooling/eslint/import-boundaries.mjs` | Exit 0 |
| `node --test src/config/env/schema.test.ts` before implementation | 7 failed, 1 passed against stub behavior; expected red phase |
| `node --test src/config/env/schema.test.ts` after implementation | Blocked: ERR_MODULE_NOT_FOUND for `zod`, dependency installation not approved yet; no environment assertions executed in this run |
| `node --check src/config/env/schema.ts` | Exit 0; syntax only, not TypeScript checking |

Additional local validation: four JSON configuration files parse successfully, new README/plan links exist, and all five integration/secret placeholders in the ten-variable environment example remain empty.

## Not yet verified

Dependency installation, final environment tests, formatting, full lint, typecheck, development startup, browser smoke and production build/start cannot be marked successful until installed dependencies are available. No credentials are needed for the foundation shell. Browser engines may require a separate download if the existing local Playwright cache does not match the installed version.

Static review corrected shared/workflow import escapes, made production environment/origin explicit at request time (homepage uses `connection()`), and separated ordinary CSRF validation from privileged maintenance credentials. The added environment regression tests still require Zod installation before execution.

Manual acceptance after executable verification: inspect light/dark on mobile and desktop, use keyboard-only navigation, inspect visible focus, and confirm that the page makes no business capabilities available. Screen reader behavior and a full WCAG audit remain manual work beyond automated smoke checks.

## File inventory for this stage

Created (33):

- `.editorconfig`
- `.npmrc`
- `.nvmrc`
- `.prettierignore`
- `.prettierrc.json`
- `components.json`
- `docs/architecture/SETUP-PLAN.md`
- `docs/architecture/SETUP-VERIFICATION.md`
- `eslint.config.mjs`
- `next.config.ts`
- `package.json`
- `playwright.config.ts`
- `postcss.config.mjs`
- `src/app/error.tsx`
- `src/app/global-error.tsx`
- `src/app/layout.tsx`
- `src/app/loading.tsx`
- `src/app/not-found.tsx`
- `src/app/page.tsx`
- `src/components/theme/theme-control.tsx`
- `src/components/theme/theme-provider.tsx`
- `src/components/ui/button.tsx`
- `src/config/env/client.ts`
- `src/config/env/maintenance.ts`
- `src/config/env/schema.test.ts`
- `src/config/env/schema.ts`
- `src/config/env/server.ts`
- `src/shared/presentation/cn.ts`
- `src/styles/globals.css`
- `tests/architecture/import-boundaries.test.mjs`
- `tests/e2e/foundation.spec.ts`
- `tooling/eslint/import-boundaries.mjs`
- `tsconfig.json`

Modified (4):

- `README.md`
- `.env.example`
- `.gitignore`
- `docs/architecture/README.md`

PRD, initial architecture and PROJECT-STRUCTURE.md remain unchanged. No pnpm lockfile exists yet; installation is still blocked on registry approval.
