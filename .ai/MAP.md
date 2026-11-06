# Hartă selectivă

Căi confirmate în N01 prin rg --files; nu reprezintă verificare funcțională.
Reguli import: tooling/eslint/import-boundaries.mjs.
Setup/comenzi: package.json, .nvmrc, .npmrc, .env.example, src/config/env/.
Auth: src/server/auth/, src/server/actions/auth-actions.server.ts;
UI/contracte: src/features/auth/; teste tests/security/, tests/e2e/auth.spec.ts.
Ingrediente: src/features/ingredients/, src/server/composition/ingredients.server.ts;
API src/app/api/v1/ingredients/; teste tests/ingredients/; migrații 09–11.
Pantry: src/features/pantry/, src/server/composition/pantry.server.ts;
API src/app/api/v1/pantry/; teste tests/pantry/; migrația 12.
Matching: src/features/matching/; teste tests/matching/; CLI scripts/matching/.
Rețete/date: src/features/recipes/contracts/recipe-bundle.schema.ts,
scripts/recipes/, data/recipes/; migrații 13–15. Nu încărca toate datele.
Search: src/features/recipes/application/search-catalog.ts,
src/server/composition/recipes.server.ts, src/server/composition/recipe-demo.server.ts;
UI src/features/recipes/presentation/recipe-search-view.tsx; migrația 16.
Cooking: src/features/recipes/presentation/cooking-mode.tsx,
src/features/recipes/presentation/recipe-detail-view.tsx,
src/server/composition/recipe-detail.server.ts;
src/shared/presentation/cooking-timer.ts, src/shared/presentation/screen-awake.ts;
migrația 17.
Organizare: src/features/recipes/presentation/organization-view.tsx,
src/features/recipes/presentation/organization-storage.ts;
src/server/composition/recipe-organization.server.ts; tests/organization/; migrația 18.
Shopping: src/shared/domain/shopping.ts, src/features/shopping/,
src/components/shopping/, src/server/composition/shopping.server.ts;
tests/shopping/; migrația 19.
Planner: src/shared/domain/meal-planner.ts, src/features/meal-planner/,
src/components/planner/, src/server/composition/planner.server.ts;
tests/planner/; migrația 20.
Cantități: src/shared/domain/quantity.ts, src/shared/domain/cooking-quantity.ts.
RPC: src/server/supabase/recipe-rpc.server.ts; nu muta tokenul în browser.
DB: supabase/migrations/; tests/database/ (PGlite).
Browser: tests/e2e/, playwright.config.ts; execuția cere server și Chromium.
Ghiduri la nevoie: docs/; rapoartele sunt istorice, nu PASS curent.
Module viitoare conform auditului: nutrition, ai, community, billing, admin funcțional.
