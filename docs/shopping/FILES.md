# Fișiere — lista inteligentă

Create în această sarcină:

- `src/features/shopping/contracts/index.ts` — Zod și tipuri publice pentru listă/preț/preview/comenzi.
- `src/features/shopping/application/shopping-model.ts` — acces la motorul de calcul comun.
- `src/shared/domain/shopping.ts` — agregare, conversii, costuri exacte și export text.
- `src/features/shopping/presentation/shopping-storage.ts` — stare guest, import Cooking, validări și replay.
- `src/features/shopping/presentation/use-shopping.ts` — scope, încărcare/salvare și revalidare.
- `src/features/shopping/presentation/shopping-view.tsx` — selector, preview, categorii, bifare, share și confirmări.
- `src/features/shopping/presentation/item-form.tsx` — adăugare/editare și prețuri introduse.
- `src/components/shopping/shopping.client.tsx` — compoziția UI/pantry și Web Locks comune.
- `src/components/shopping/local-shopping.ts` — import guest, transfer și jurnal de recuperare pe două chei.
- `src/server/composition/shopping.server.ts` — bootstrap/preview/mutate, inventar autoritativ și profil.
- `src/app/api/v1/shopping/route.ts`, `src/app/api/v1/shopping/preview/route.ts` — HTTP GET/POST.
- `supabase/migrations/20261105000019_smart_shopping.sql` — extensia tabelelor existente, RPC, RLS și transfer atomic.
- `tests/shopping/model.test.ts`, `tests/shopping/storage.test.ts` — calcule, guest, replay și recuperare.
- `tests/shopping/routes.smoke.mjs` — handlere compilate și context verificat.
- `tests/database/shopping.test.mjs` — integrare PostgreSQL reală în PGlite.
- `tests/e2e/shopping.spec.ts` — scenarii browser pentru întregul flux guest.
- `docs/superpowers/plans/2026-11-05-smart-shopping.md` — plan și decizii.
- `docs/shopping/SMART-SHOPPING.md`, `FILES.md`, `VERIFICATION.md` — ghid și evidența verificărilor.

Modificate pentru integrare:

- `src/app/(shell)/shopping-list/page.tsx` — înlocuiește placeholderul și permite guest.
- `src/server/supabase/recipe-rpc.server.ts` — allowlist publică/privată pentru cele trei RPC.
- `src/server/http/recipe-response.server.ts` — erori HTTP sigure pentru shopping.
- `src/features/pantry/contracts/index.ts`, `src/features/recipes/contracts/index.ts` — extensii `.ts` pentru contractele publice browser/Node, fără schimbarea comportamentului.
- `tests/e2e/auth.spec.ts` — lista de cumpărături nu mai cere login invitaților.
- `package.json` — test:shopping în suita normală și test:shopping-routes, fără dependențe noi.
- `README.md`, `docs/architecture/SHELL-ROUTING.md` — documentația integrării.

Fișierele necomise ale etapelor Cooking/Organization au fost păstrate. Migrațiile
01–18 și catalogul/rețetele existente nu au fost rescrise.
