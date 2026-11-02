# Catalog de ingrediente — fișiere

Inventar comparat cu starea workspace-ului de la începutul acestei sarcini.
Cele două documente Auth deja editate de utilizator nu sunt incluse.

## Create

- [docs/architecture/INGREDIENT-CATALOG-PLAN.md](../../docs/architecture/INGREDIENT-CATALOG-PLAN.md)
- [docs/data/ingredients-v1.json](../../docs/data/ingredients-v1.json)
- [docs/ingredients/CATALOG.md](../../docs/ingredients/CATALOG.md)
- [docs/ingredients/FILES.md](../../docs/ingredients/FILES.md)
- [docs/ingredients/VERIFICATION.md](../../docs/ingredients/VERIFICATION.md)
- [src/app/(shell)/ingredients/page.tsx](<../../src/app/(shell)/ingredients/page.tsx>)
- [src/app/api/v1/ingredients/[ingredientId]/route.ts](../../src/app/api/v1/ingredients/[ingredientId]/route.ts)
- [src/app/api/v1/ingredients/categories/route.ts](../../src/app/api/v1/ingredients/categories/route.ts)
- [src/app/api/v1/ingredients/route.ts](../../src/app/api/v1/ingredients/route.ts)
- [src/components/ingredients/ingredient-autocomplete.tsx](../../src/components/ingredients/ingredient-autocomplete.tsx)
- [src/features/ingredients/README.md](../../src/features/ingredients/README.md)
- [src/features/ingredients/application/catalog.port.ts](../../src/features/ingredients/application/catalog.port.ts)
- [src/features/ingredients/application/catalog.service.ts](../../src/features/ingredients/application/catalog.service.ts)
- [src/features/ingredients/contracts/index.ts](../../src/features/ingredients/contracts/index.ts)
- [src/features/ingredients/contracts/ingredient.schema.ts](../../src/features/ingredients/contracts/ingredient.schema.ts)
- [src/features/ingredients/domain/catalog-error.ts](../../src/features/ingredients/domain/catalog-error.ts)
- [src/features/ingredients/domain/search-key.ts](../../src/features/ingredients/domain/search-key.ts)
- [src/features/ingredients/infrastructure/cursor-codec.server.ts](../../src/features/ingredients/infrastructure/cursor-codec.server.ts)
- [src/features/ingredients/infrastructure/supabase-catalog.repository.server.ts](../../src/features/ingredients/infrastructure/supabase-catalog.repository.server.ts)
- [src/features/ingredients/presentation/ingredient-catalog.tsx](../../src/features/ingredients/presentation/ingredient-catalog.tsx)
- [src/features/ingredients/presentation/use-ingredient-catalog.ts](../../src/features/ingredients/presentation/use-ingredient-catalog.ts)
- [src/server/composition/ingredients.server.ts](../../src/server/composition/ingredients.server.ts)
- [src/server/http/catalog-response.server.ts](../../src/server/http/catalog-response.server.ts)
- [src/server/supabase/public-catalog.server.ts](../../src/server/supabase/public-catalog.server.ts)
- [supabase/migrations/20261102000009_ingredient_catalog.sql](../../supabase/migrations/20261102000009_ingredient_catalog.sql)
- [supabase/migrations/20261102000010_ingredient_seed.sql](../../supabase/migrations/20261102000010_ingredient_seed.sql)
- [supabase/migrations/20261102000011_ingredient_search_api.sql](../../supabase/migrations/20261102000011_ingredient_search_api.sql)
- [tests/database/ingredients.test.mjs](../../tests/database/ingredients.test.mjs)
- [tests/e2e/ingredients.spec.ts](../../tests/e2e/ingredients.spec.ts)
- [tests/ingredients/catalog.test.ts](../../tests/ingredients/catalog.test.ts)
- [tests/ingredients/routes.smoke.mjs](../../tests/ingredients/routes.smoke.mjs)
- [tests/ingredients/search.test.ts](../../tests/ingredients/search.test.ts)

## Modificate

- [README.md](../../README.md)
- [package.json](../../package.json)
- [src/app/(shell)/recipes/page.tsx](<../../src/app/(shell)/recipes/page.tsx>)
- [src/components/ui/combobox.tsx](../../src/components/ui/combobox.tsx)
- [src/config/navigation.ts](../../src/config/navigation.ts)
- [tests/e2e/shell.spec.ts](../../tests/e2e/shell.spec.ts)
- [tests/shell/navigation.test.ts](../../tests/shell/navigation.test.ts)

Migrațiile 01–08 și configurarea mediului sunt păstrate. Fișierele complete sunt
în workspace; nu sunt necesare fragmente de cod copiate din conversație.
