# Cookly — Verificări shell și routing

Etapa 2 · 1 noiembrie 2026 · Bază: `b183ed9`.

## Rezultate reale

| Comandă                                           | Rezultat                                                                                                             |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `npm test`, baseline                              | 23 teste trecute                                                                                                     |
| Baseline lint/typecheck                           | Lint blocat de export PostCSS anonim; TypeScript TS2532 în accesul indexat al comboboxului                           |
| Teste native shell/import înainte de implementare | 5 eșecuri așteptate contra stuburilor (4 routing, 1 graniță server/client)                                           |
| `npm test` după implementare                      | 28 trecute, 0 eșuate                                                                                                 |
| `npm run lint`                                    | Cod 0, fără avertismente                                                                                             |
| `npm run typecheck`                               | Cod 0, tipuri Next generate                                                                                          |
| Prettier pe fișierele noi/modificate              | Cod 0; fișierele neatinse nu au fost reformatate                                                                     |
| `npm run build`                                   | Eșec de sandbox: Turbopack/PostCSS încearcă un port intern, EPERM                                                    |
| `npm run build -- --webpack`                      | Cod 0: compilare, TypeScript, 13 pagini statice generate, toate rutele cerute în tabelul buildului                   |
| `node tests/shell/prerender.smoke.mjs`            | 9 rute statice + not-found: heading, main/header/footer unice, breadcrumbs, link activ și noindex verificate în HTML |
| `npm run test:e2e -- --list`                      | Cod 0: 23 teste colectate în 3 fișiere, inclusiv 16 scenarii shell; colectare, nu execuție                           |
| `npm run dev -- --port 3101`                      | Server blocat de sandbox: listen EPERM                                                                               |
| `npm run test:e2e -- --workers=1`                 | WebServer blocat de sandbox pe 3100: listen EPERM; testele nu au început                                             |

Cererea redundantă de server separat și repetarea Turbopack în afara sandboxului au fost anulate: serverul este verificat prin E2E, iar build-ul Webpack a trecut în sandbox. Rularea E2E în afara sandboxului rămâne în așteptarea aprobării.

## Ce s-a schimbat

- Route group `(shell)` și cele 11 pagini cerute, incluzând home și detaliu dinamic.
- Cadru RSC comun, insule client pentru pathname, drawer și temă; breadcrumbs, active navigation și fallbackuri loading/error/404.
- Date de navigare centralizate, schemă Zod pentru parametrul de detaliu și teste de rutare/istoric/focus.
- Două remedieri minime ale fundației care blocau verificarea: export PostCSS numit și restrângerea locală a opțiunii indexate în combobox.
- Regula de import recunoaște fișierele `.server.tsx` și refuză importul lor din insulele client.

Revizuirea statică a identificat pierderea focusului la Back/Forward cu meniul deschis, deoarece cheia pathname elimina triggerul. Triggerul rămâne acum montat, iar schimbarea rutei închide drawerul și solicită focus pe conținut. Există scenariu de regresie E2E; comportamentul în browser nu a fost încă executat.

## Limite și verificare manuală

Buildul și HTML-ul prerandat nu substituie HTTP sau browser. Cele nouă rute statice au conținut randat verificat; home/detaliu sunt compilate și au logică de rutare testată, dar răspunsurile lor la cerere nu sunt confirmate. Nu se inventează statusuri HTTP sau rezultate de focus.

Playwright 1.64.1 cere browser revision 1248, iar cache-ul observat are revision 1243. Browserul potrivit poate necesita instalare după aprobarea accesului. Nu s-au descărcat pachete sau browsere în această etapă.

Verifică manual `/`, `/recipes`, `/recipes/demo`, `/my-fridge`, `/meal-planner`, `/shopping-list`, `/favorites`, `/assistant`, `/profile`, `/login`, `/admin`; meniu la 360 px, active state și breadcrumbs, Escape/Back/Forward, skip link și focus, zoom/temă și mesajele placeholder. Login/admin nu au încă protecție Auth și nu expun operațiuni sau date.

Nicio dependență nouă, nicio schimbare a lockfile-ului, niciun feature de business și nicio etapă următoare începută.

## Inventarul fișierelor

Mutat și adaptat: `src/app/page.tsx` → `src/app/(shell)/page.tsx`.

Create (35):

- `docs/architecture/SHELL-PLAN.md`
- `docs/architecture/SHELL-ROUTING.md`
- `docs/architecture/SHELL-VERIFICATION.md`
- `src/app/(shell)/admin/page.tsx`
- `src/app/(shell)/assistant/page.tsx`
- `src/app/(shell)/error.tsx`
- `src/app/(shell)/favorites/page.tsx`
- `src/app/(shell)/layout.tsx`
- `src/app/(shell)/loading.tsx`
- `src/app/(shell)/login/page.tsx`
- `src/app/(shell)/meal-planner/page.tsx`
- `src/app/(shell)/my-fridge/page.tsx`
- `src/app/(shell)/not-found.tsx`
- `src/app/(shell)/profile/page.tsx`
- `src/app/(shell)/recipes/[recipeId]/page.tsx`
- `src/app/(shell)/recipes/page.tsx`
- `src/app/(shell)/shopping-list/page.tsx`
- `src/components/layout/app-shell.server.tsx`
- `src/components/layout/breadcrumbs.tsx`
- `src/components/layout/mobile-navigation.tsx`
- `src/components/layout/not-found-content.server.tsx`
- `src/components/layout/page-placeholder.server.tsx`
- `src/components/layout/shell-footer.server.tsx`
- `src/components/layout/shell-header.server.tsx`
- `src/components/layout/shell-navigation-links.tsx`
- `src/components/layout/shell-page-skeleton.server.tsx`
- `src/components/layout/shell-sidebar.server.tsx`
- `src/config/navigation.ts`
- `src/config/shell-pages.ts`
- `src/shared/contracts/recipe-route.schema.ts`
- `src/shared/contracts/route-id.ts`
- `src/shared/presentation/shell-navigation.ts`
- `tests/e2e/shell.spec.ts`
- `tests/shell/navigation.test.ts`
- `tests/shell/prerender.smoke.mjs`

Modificate (9):

- `README.md`
- `package.json`
- `playwright.config.ts`
- `postcss.config.mjs`
- `src/app/not-found.tsx`
- `src/components/ui/combobox-model.ts`
- `src/components/ui/icon.tsx`
- `tests/architecture/import-boundaries.test.mjs`
- `tooling/eslint/import-boundaries.mjs`
