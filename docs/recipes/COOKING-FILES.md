# Fișiere — pagina rețetei și Cooking

Fișiere create în această sarcină:

- `src/features/recipes/contracts/detail.schema.ts` — contracte detail/actions/sesiune.
- `src/features/recipes/contracts/detail-query.ts` — validare URL și linkuri cu restricții.
- `src/features/recipes/application/detail-model.ts` — porții exacte și similaritate.
- `src/features/recipes/presentation/use-recipe-detail.ts` — transport și invalidare context.
- `src/features/recipes/presentation/recipe-detail-view.tsx` — pagina detaliată și confirmări.
- `src/features/recipes/presentation/use-recipe-actions.ts` — local/remote/memorie, retry.
- `src/features/recipes/presentation/recipe-actions-storage.ts` — guest validat și replay.
- `src/features/recipes/presentation/cooking-mode.tsx` — pași, progres, timere, ecran aprins.
- `src/components/recipes/recipe-detail.client.tsx` — compune detaliul și consumul pantry.
- `src/shared/domain/cooking-quantity.ts` — primitive exacte mutate din matching.
- `src/shared/presentation/cooking-timer.ts` — deadline/pauză/reset.
- `src/shared/presentation/screen-awake.ts` — lifecycle Wake Lock și concurență.
- `src/server/composition/recipe-context.server.ts` — context auth/inventar comun extras.
- `src/server/composition/recipe-detail.server.ts` — detail, metadate, scor și restricții.
- `src/server/composition/recipe-actions.server.ts` — compune acțiunile autentificate.
- `src/app/api/v1/recipes/detail/route.ts` — adaptor HTTP detail.
- `src/app/api/v1/recipes/actions/route.ts` — adaptor HTTP actions.
- `supabase/migrations/20261103000017_recipe_cooking.sql` — foto și acțiuni atomice/private.
- `public/recipes/oatmeal-apple-demo.png` — fotografie ilustrativă generată cu AI.
- `tests/recipes/cooking.test.ts` — conversii, URL, sesiune, timere, wake lock, guest.
- `tests/recipes/detail-routes.smoke.mjs` — handlere compilate cu provider simulat.
- `tests/database/recipe-cooking.test.mjs` — SQL real în PGlite, izolare și replay.
- `tests/e2e/cooking.spec.ts` — interacțiuni și regresii browser.
- `docs/architecture/RECIPE-COOKING-PLAN.md` — decizii și planul etapei.
- `docs/recipes/COOKING.md`, `COOKING-FILES.md`, `COOKING-VERIFICATION.md` — ghid și verificări.

Fișiere existente modificate în această sarcină (unele erau deja necomise din etapele precedente):

- `src/app/(shell)/recipes/[recipeId]/page.tsx` — înlocuiește placeholderul cu pagina pe slug.
- `src/features/recipes/contracts/index.ts` — exportă noile contracte publice.
- `src/features/recipes/presentation/recipe-results.tsx` — titluri cu link la detaliu.
- `src/features/recipes/presentation/recipe-search-view.tsx` — transmite contextul linkurilor.
- `src/features/recipes/domain/search-error.ts` — NOT_FOUND/CONFLICT.
- `src/features/matching/application/quantity.ts` — reexportă primitivele shared fără schimbarea regulilor.
- `src/server/composition/recipes.server.ts` — reutilizare snapshot/context/scor pentru detail.
- `src/server/supabase/recipe-rpc.server.ts` — căi RPC detail/actions și erori SQL controlate.
- `src/server/http/recipe-response.server.ts` — răspunsuri 404/409.
- `tests/e2e/shell.spec.ts` — navigare și heading actualizate pentru detaliul real.
- `package.json` — script `test:recipe-detail-routes`, fără dependențe noi.
- `README.md`, `src/features/recipes/README.md`, `docs/architecture/SHELL-ROUTING.md` — documentație actualizată.

Modificările altor etape din workspace au fost păstrate. Migrațiile 01–16 și datele
seed nu au fost rescrise pentru această sarcină. Nu s-a creat commit sau deploy.
