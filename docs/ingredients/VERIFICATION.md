# Catalog de ingrediente — verificare

Actualizare la verificarea frigiderului virtual: PGlite 0.5.14 este instalat, iar
suita SQL a catalogului a trecut. Rezultatele curente ale checkoutului sunt în
[raportul My Fridge](../pantry/VERIFICATION.md); blocajul PGlite din raportul inițial
de mai jos este istoric. Integrarea Supabase live rămâne neverificată.

Verificat la 2 noiembrie 2026, Node.js 24.14.0, instalarea npm existentă.
Nu au fost aplicate migrații pe un proiect Supabase local sau hosted.

| Comandă executată                                               | Rezultat real                                                                                          |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `npm test`                                                      | PASS: 28 fundație/UI/shell + 21 securitate + 8 catalog = 57 teste                                      |
| `npm run lint`                                                  | PASS, zero warnings                                                                                    |
| `npm run typecheck`                                             | PASS: generare tipuri Next și `tsc --noEmit`                                                           |
| `npm run build -- --webpack`                                    | PASS, inclusiv `/ingredients` și cele trei rute API dinamice                                           |
| `npm run test:ingredient-routes`                                | PASS: 1 test, handleri compilați, provider HTTP simulat                                                |
| `npm run test:access-routes`                                    | PASS: 1 test de regresie Auth, handleri compilați                                                      |
| `npm run test:prerender`                                        | PASS: manifest și absența HTML-ului privat static pentru 9 rute                                        |
| `npm run test:db`                                               | FAIL înainte de SQL: `ERR_MODULE_NOT_FOUND` pentru `@electric-sql/pglite` în cele trei fișiere de test |
| `npm run test:e2e -- tests/e2e/ingredients.spec.ts --list`      | PASS colectare: 3 teste; nu reprezintă execuție în browser                                             |
| `npm run test:e2e -- tests/e2e/ingredients.spec.ts --workers=1` | Blocat înainte de teste: `listen EPERM 127.0.0.1:3100`                                                 |
| `git diff --check`                                              | PASS                                                                                                   |

Build-ul a folosit explicit Webpack. Nu este raportată o verificare reușită a
build-ului Turbopack implicit. Nu sunt ignorate erori TypeScript/ESLint la build.

## Ce dovedesc testele executate

Testele native verifică normalizarea NFC/diacritice, ё/й, limitele Zod, coerența
nutriției, legarea cursorului de filtre, refuzul amestecării reviziilor, validarea
rezultatelor RPC, eliminarea diagnosticelor SQL și absența cookie/JWT upstream.
Datele editoriale păstrează cele 32 de sluguri distincte și paritatea JSON/migrație.

Smoke testul catalogului invocă handlerii construiți în proces: input invalid,
parametri duplicați, paginare, cursor incompatibil, detaliu, categorii, 404/409/503,
no-store și lipsa identității utilizatorului în transportul public. Nu deschide
port și nu verifică proxy-ul Next sau PostgREST live.

Revizuirea independentă a codului nu a identificat defecte concrete. Aceasta nu
înlocuiește executarea migrațiilor și a testelor RLS.

## Blocaje și verificări încă necesare

PGlite este un instrument de test PostgreSQL în memorie, nu o dependență runtime.
Testele SQL istorice îl importau deja, însă nu este declarat/instalat în checkout.
Încercarea de instalare a eșuat la DNS pentru `registry.npmjs.org`; reluarea cu
acces extins a fost solicitată și nu a returnat încă un rezultat. Manifestul și
lockfile-ul nu pretind că instalarea a reușit. După autorizarea accesului la registry:

```sh
npm install --save-dev --save-exact @electric-sql/pglite
npm run test:db
```

Noul test SQL construiește numai o bază efemeră cu toate migrațiile, fără URL-uri sau
credențiale reale. Verifică normalizarea JS/SQL, citirea anon, lipsa dreptului DML,
sinonime/prefixe, separarea piept/pui, paginarea exhaustivă, invalidarea reviziei,
inactivarea, nutriția verificată pe identitatea exactă și invalidarea la TRUNCATE.
**Aceste verificări nu au fost executate cu succes aici.** SQL-ul și RLS rămân de
validat în execuție, inclusiv într-un stack Supabase real.

Reluarea E2E cu permisiunea de a asculta pe portul local a fost solicitată; nu a
returnat încă un rezultat. Cele trei teste folosesc stubs API și acoperă tastatura,
alias englez cu etichetă română, răspuns întârziat și retry/error/empty. Nici măcar
un E2E trecut cu aceste stubs nu ar demonstra integrarea bazei de date.

Pentru execuția ulterioară sunt necesare Chromium instalat și portul 3100 liber:

```sh
npm run test:e2e -- tests/e2e/ingredients.spec.ts --workers=1
```

Verifică separat endpointurile pe Supabase, politicile anon/authenticated, planurile
`EXPLAIN` pe volum realist, mobil/light/dark și cititorul de ecran. Checklistul
funcțional și comenzile de aplicare a migrațiilor sunt în [CATALOG.md](CATALOG.md).
Nu sunt raportate benchmarkuri, audit complet de accesibilitate sau date nutritive
reale verificate. Seed-ul nu conține valori numerice nutriționale.

## Integritatea lucrului existent

Migrațiile 01–08, fișierele Auth și cele două documente deja modificate de utilizator
(`SUPABASE-ACCESS-PLAN.md`, `AUTH-VERIFICATION.md`) sunt păstrate. Catalogul extinde
Combobox fără schimbarea filtrării locale implicite și adaugă un link de navigare;
nu implementează etapa următoare și nu face commit/deploy.
