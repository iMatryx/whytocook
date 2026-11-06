# Fișiere — planificator alimentar

Inventarul de mai jos privește această sarcină. Workspace-ul conținea deja
modificări pentru Cooking, favorite/colecții și Shopping; acestea sunt păstrate.

## Create

- `src/features/meal-planner/contracts/index.ts` — scheme și tipuri Zod.
- `src/shared/domain/meal-planner.ts` — calendar, alocare, nutriție, buget, prep.
- `src/features/meal-planner/presentation/planner-storage.ts` — model local, revizii, replay/copiere.
- `src/features/meal-planner/presentation/use-planner.ts` — sesiune, încărcare, invalidare și comenzi.
- `src/features/meal-planner/presentation/meal-form.tsx` — editorul mesei.
- `src/features/meal-planner/presentation/planner-view.tsx` — calendar, agregate și confirmări.
- `src/components/planner/local-planner.ts` — export local și recuperare.
- `src/components/planner/planner.client.tsx` — compoziție cu Pantry și locks.
- `src/server/composition/planner.server.ts` — compoziție, profil/stoc autoritativ și RPC.
- `src/app/api/v1/planner/route.ts` — bootstrap și comenzi.
- `src/app/api/v1/planner/analyze/route.ts` — calcule fără scriere.
- `src/app/api/v1/planner/export/route.ts` — export confirmat.
- `src/shared/contracts/food-inventory.ts` — schemele canonice comune extrase din Pantry.
- `src/shared/contracts/shopping-item.ts` — schemele comune extrase din Shopping.
- `supabase/migrations/20261105000020_meal_planner.sql` — extindere plan și RPC/RLS.
- `tests/planner/model.test.ts` — calcule, date, cantități, alergii/versiuni.
- `tests/planner/storage.test.ts` — CRUD/copiere/revizii/validări locale.
- `tests/planner/export.test.ts` — înlocuire, stoc schimbat și recuperare.
- `tests/planner/routes.smoke.mjs` — handleri API compilați și cont autoritativ.
- `tests/database/planner.test.mjs` — migrație, RLS, replay, export și compatibilitate legacy.
- `tests/e2e/planner.spec.ts` — scenarii browser inclusiv navigare în timpul confirmării.
- `docs/superpowers/plans/2026-11-05-meal-planner.md` — decizii și plan.
- `docs/planner/{MEAL-PLANNER,FILES,VERIFICATION}.md` — documentație și rezultate.

## Modificate

- `src/app/(shell)/meal-planner/page.tsx` — pagină funcțională și acces pentru invitați.
- `src/features/pantry/contracts/pantry.schema.ts` — reexportă schemele comune, contract păstrat.
- `src/features/shopping/contracts/index.ts` — reexportă schemele comune, contract păstrat.
- `src/features/recipes/contracts/index.ts` — export public al fullNutritionSchema.
- `src/server/composition/shopping.server.ts` — exportă adaptoarele existente de sesiune/catalog.
- `src/server/supabase/recipe-rpc.server.ts` — allowlist planner, metadate publice fără bearer.
- `src/server/http/recipe-response.server.ts` — erori planner fără detalii interne.
- `tests/e2e/auth.spec.ts` — plannerul nu mai este o pagină exclusiv pentru conturi.
- `package.json` — test:planner și test:planner-routes; suitele unitare în npm test.
- `README.md`, `docs/architecture/SHELL-ROUTING.md` — rută și reproducere.
