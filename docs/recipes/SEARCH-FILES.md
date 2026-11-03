# Căutare rețete — fișiere

## Create

- `src/features/recipes/contracts/search.schema.ts`: DTO-uri și filtre Zod.
- `src/features/recipes/contracts/search-query.ts`: parser/serializer URL.
- `src/features/recipes/application/search-catalog.ts`: index, filtre, scor-port, sortare/paginare.
- `src/features/recipes/domain/search-error.ts`: coduri de eroare.
- `src/features/recipes/presentation/use-recipe-search.ts`: cereri, loading/error, anulare/context.
- `src/features/recipes/presentation/recipe-search-view.tsx`: pagină, reset, empty/error și paginare.
- `src/features/recipes/presentation/recipe-filters.tsx`: formular accesibil, filtre simple/avansate.
- `src/features/recipes/presentation/recipe-results.tsx`: carduri și dialog de detalii/compatibilitate.
- `src/components/recipes/recipe-search.client.tsx`: compunerea UI cu inventarul My Fridge.
- `src/app/api/v1/recipes/search/route.ts`: API POST dinamic.
- `src/server/composition/recipes.server.ts`: sesiune, profil, inventar și matching.
- `src/server/composition/recipe-demo.server.ts`: sursa demo explicită, numai pe server.
- `src/server/supabase/recipe-rpc.server.ts`: transport public/privat cu limite.
- `src/server/http/recipe-response.server.ts`: body limit și erori sigure.
- `supabase/migrations/20261103000016_recipe_search.sql`: snapshot public/context privat.
- `tests/recipes/search.test.ts`: 7 teste query/filtre/sortare/global pagination.
- `tests/recipes/search-routes.smoke.mjs`: handler compilat, identitate, profil, limite și compatibilitate legacy.
- `tests/database/recipe-search.test.mjs`: migrații și izolare în PGlite.
- `tests/e2e/recipes.spec.ts`: 5 scenarii browser, definite/colectate; execuția blocată de port.
- `docs/architecture/RECIPE-SEARCH-PLAN.md`: plan și decizii.
- `docs/recipes/SEARCH.md`: ghidul funcțional și tehnic.
- `docs/recipes/SEARCH-FILES.md`: acest inventar.
- `docs/recipes/SEARCH-VERIFICATION.md`: rezultate reale, limite și verificări manuale.

## Modificate

- `src/app/(shell)/recipes/page.tsx`: înlocuiește placeholderul cu pagina funcțională în Suspense.
- `src/features/recipes/contracts/index.ts`: exporturile publice noi.
- `src/features/recipes/README.md`: documentarea modulului de căutare.
- `package.json`: comanda test:recipe-search-routes; testele native sunt incluse prin globul existent.
- `README.md`: starea curentă a paginii și documentația.
- `docs/architecture/SHELL-ROUTING.md`: starea rutei /recipes actualizată.

Nu s-au adăugat dependențe și nu s-au modificat lockfile-ul, datele seed,
migrațiile 01–15, motorul de matching sau fluxurile My Fridge/Auth. Modificările
preexistente din workspace ale acelor etape nu sunt atribuite acestei sarcini.
