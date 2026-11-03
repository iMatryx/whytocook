# My Fridge — fișiere

Inventar comparat cu workspace-ul de la începutul sarcinii, nu numai cu HEAD.
Instalarea PGlite în package.json/package-lock.json exista deja și este păstrată.

## Create

- [docs/architecture/PANTRY-PLAN.md](../../docs/architecture/PANTRY-PLAN.md)
- [docs/pantry/FILES.md](../../docs/pantry/FILES.md)
- [docs/pantry/MY-FRIDGE.md](../../docs/pantry/MY-FRIDGE.md)
- [docs/pantry/VERIFICATION.md](../../docs/pantry/VERIFICATION.md)
- [src/app/api/v1/pantry/route.ts](../../src/app/api/v1/pantry/route.ts)
- [src/features/pantry/README.md](../../src/features/pantry/README.md)
- [src/features/pantry/application/pantry.port.ts](../../src/features/pantry/application/pantry.port.ts)
- [src/features/pantry/application/pantry.service.ts](../../src/features/pantry/application/pantry.service.ts)
- [src/features/pantry/contracts/index.ts](../../src/features/pantry/contracts/index.ts)
- [src/features/pantry/contracts/pantry.schema.ts](../../src/features/pantry/contracts/pantry.schema.ts)
- [src/features/pantry/domain/pantry-error.ts](../../src/features/pantry/domain/pantry-error.ts)
- [src/features/pantry/infrastructure/pantry.repository.server.ts](../../src/features/pantry/infrastructure/pantry.repository.server.ts)
- [src/features/pantry/presentation/consumption-form.tsx](../../src/features/pantry/presentation/consumption-form.tsx)
- [src/features/pantry/presentation/guest-storage.ts](../../src/features/pantry/presentation/guest-storage.ts)
- [src/features/pantry/presentation/pantry-form.tsx](../../src/features/pantry/presentation/pantry-form.tsx)
- [src/features/pantry/presentation/pantry-model.ts](../../src/features/pantry/presentation/pantry-model.ts)
- [src/features/pantry/presentation/pantry-view.tsx](../../src/features/pantry/presentation/pantry-view.tsx)
- [src/features/pantry/presentation/use-catalog-options.ts](../../src/features/pantry/presentation/use-catalog-options.ts)
- [src/features/pantry/presentation/use-pantry.ts](../../src/features/pantry/presentation/use-pantry.ts)
- [src/server/composition/pantry.server.ts](../../src/server/composition/pantry.server.ts)
- [src/server/http/pantry-response.server.ts](../../src/server/http/pantry-response.server.ts)
- [src/server/supabase/pantry-rpc.server.ts](../../src/server/supabase/pantry-rpc.server.ts)
- [src/shared/domain/expiry.ts](../../src/shared/domain/expiry.ts)
- [src/shared/domain/quantity.ts](../../src/shared/domain/quantity.ts)
- [supabase/migrations/20261102000012_my_fridge.sql](../../supabase/migrations/20261102000012_my_fridge.sql)
- [tests/database/pantry.test.mjs](../../tests/database/pantry.test.mjs)
- [tests/e2e/pantry.spec.ts](../../tests/e2e/pantry.spec.ts)
- [tests/pantry/model.test.ts](../../tests/pantry/model.test.ts)
- [tests/pantry/routes.smoke.mjs](../../tests/pantry/routes.smoke.mjs)
- [tests/pantry/session.test.ts](../../tests/pantry/session.test.ts)

## Modificate

- [README.md](../../README.md)
- [docs/architecture/SHELL-ROUTING.md](../../docs/architecture/SHELL-ROUTING.md)
- [docs/ingredients/VERIFICATION.md](../../docs/ingredients/VERIFICATION.md)
- [package.json](../../package.json)
- [src/app/(shell)/my-fridge/page.tsx](<../../src/app/(shell)/my-fridge/page.tsx>)
- [tests/database/schema.test.mjs](../../tests/database/schema.test.mjs)
- [tests/e2e/auth.spec.ts](../../tests/e2e/auth.spec.ts)

Migrațiile 01–11, fluxurile Auth și dependențele runtime sunt neschimbate.
Fișierele complete se găsesc în workspace.
