# Cookly — App shell și routing

Scope: Stage 2 routing/placeholders only. Reuse the current UI kit; no Auth/RLS, database, recipe data, AI or administration operations.

## Decisions

- Canonical paths: `/`, `/recipes`, `/recipes/[recipeId]`, `/my-fridge`, `/meal-planner`, `/shopping-list`, `/favorites`, `/assistant`, `/profile`, `/login`, `/admin`.
- Shared route group `(shell)` owns server-rendered header, desktop sidebar, content frame and footer. `/ui-kit` retains its standalone reference layout.
- Pages and placeholder content are Server Components. Small client islands own active navigation (`usePathname`), mobile drawer and theme control; children remain server-rendered.
- Central browser-safe route metadata and tested helpers provide exact/segment-aware active matching and breadcrumbs. Detail IDs are validated with Zod; no fake recipe is loaded.
- Login/profile/admin are honest placeholders without credentials/forms or authorization claims. They are accessible for shell review, marked noindex, and expose no protected operations.
- Desktop sidebar shows primary routes; header has profile/login. Mobile drawer includes all routes and restores focus. Route transitions close it and restore focus to content after navigation.
- Preserve homepage heading and UI kit route; move homepage into the shared route group and reuse its copy without duplicate headers/main landmarks.
- No dependencies added. Existing npm installation/package-lock is preserved; checks run through npm because pnpm is not in PATH.

## Work

- [x] Write failing native tests for route coverage, segment matching, breadcrumbs and recipe IDs; implement metadata/helpers.
- [x] Build server shell, client active links/mobile navigation, breadcrumbs, loading and server placeholders.
- [x] Add all route pages, recipe details validation/not-found and scope notices for future Auth/admin.
- [ ] Add route and navigation E2E tests; verify HTTP status, h1, breadcrumbs, navigation state, mobile focus and 404.
- [ ] Run unit/import/contrast tests, lint, typecheck, production build and full browser suite; review and document actual outcomes.

## Baseline

- Commit `b183ed9`, clean worktree, installed Next 16.4.3 / React 19.3.1 / TypeScript 5.9.3.
- `npm test`: 23 passed.
- Existing blockers: PostCSS anonymous default export warning; combobox indexed access TS2532. Minimal fixes included in this stage to unblock verification.

- Actual verification: 28 native tests, lint/typecheck and Webpack production build passed; static HTML smoke passed for9routes+not-found. E2E23tests collected, execution blocked EPERM. Static review focus fix applied and re-reviewed.
