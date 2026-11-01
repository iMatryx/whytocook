# Cookly — Structura proiectului și convenții

Versiune: 1.0 · Data: 1 noiembrie 2026 · Etapa: 1 / 01 — Arhitectură și planificare  
Stare: convenții pentru implementarea viitoare; nu inițializează aplicația.

## 1. Stare existentă și scopul schimbării

La inspecție există numai [PRD-ul](../product/PRD-Cookly.md) și [arhitectura completă](ARCHITECTURE-Cookly.md). Nu există cod funcțional, package manager ales, configurații TypeScript sau schema DB. Această etapă adaugă documentele de organizare, un `.env.example` fără secrete și reguli `.gitignore`. Nu creează anticipat sute de fișiere goale, endpointuri, servicii fictive sau features V2.

**Convenția fizică nouă este `src/features`, în locul propunerii orientative `src/modules`.** Aceasta concretizează cererea curentă, păstrând modular monolith, RLS, RPC și fluxurile existente. Documentul de arhitectură rămâne sursa mecanismelor; aici se stabilesc numele și regulile de implementare.

## 2. Features și corespondența cu arhitectura

| Feature fizic | Modul/concept anterior | Date și responsabilitate | Etapă |
|---|---|---|---|
| `auth` | `identity` | Sesiuni prin adaptor Auth; profil, preferințe, status, capabilități, export/ștergere | MVP |
| `ingredients` | Partea de taxonomie din `catalog` | Ingrediente canonice, aliasuri, unități, conversii aprobate și clasificări/alergeni | MVP |
| `pantry` | `inventory` | Loturi, revizii, consum, mișcări și compensări; frigider/congelator/cămară | MVP |
| `recipes` | Partea editorială din `catalog`, plus `favorites` ca subdomeniu | Rețete și versiuni, publicare, pași, media, favorite private | MVP |
| `matching` | `matching` | Eligibilitate, filtre stricte, disponibilitate, ranking și cursor | MVP |
| `shopping` | `shopping` | Listă personală, linii și proveniență, reconciliere, bifări | MVP |
| `meal-planner` | `meal-planning` | Mese pe dată locală, rețetă/versionId, porții și revizii | MVP |
| `nutrition` | `nutrition-pricing` | Referințe nutriționale și subdomeniu `pricing` pentru prețuri/estimări | MVP |
| `admin` | `admin` | Ecrane și coordonare autorizată, fără duplicarea datelor de domeniu | MVP |
| `ai` | `ai` | Solicitări, provider port, cote, buget, variante private validate | V2 |
| `community` | `community` | Propuneri, comentarii, ratinguri, moderare și contestații | V2 |
| `billing` | `billing` | Abonamente, evenimente verificate și drepturi premium | V2 |

Profilul nu devine un feature generic separat. Favoritele rămân date private, cu repository și servicii proprii în `recipes`, fără includere în proiecțiile publice ale rețetelor. Separarea taxonomiei de rețete nu permite lui `ingredients` să citească tabelele `recipes`; relația este într-un singur sens prin contracte și porturi.

## 3. Arborele țintă — rădăcină și infrastructură comună

**Legendă:** `[acum]` există la finalul acestei etape; `[MVP]` se creează numai la implementarea funcționalității relevante; `[V2]` este rezervare documentară. Fișierele fără marcaj dintr-un subarbore `[MVP]` sau `[V2]` moștenesc acel marcaj. Arborele este detaliat pentru granițe și fișierele importante; nu pretinde că enumeră toate componentele vizuale ce vor rezulta din design.

```text
Cookly/
├── README.md                                      [acum] intrare în proiect
├── .env.example                                   [acum] contract fără secrete
├── .gitignore                                     [acum] ignorare date locale
├── docs/                                          [acum]
│   ├── product/PRD-Cookly.md
│   └── architecture/
│       ├── README.md
│       ├── ARCHITECTURE-Cookly.md
│       └── PROJECT-STRUCTURE.md
├── package.json                                   [MVP] dependențe/scripturi reale
├── <lockfile-unic>                                [MVP] ales cu package managerul
├── tsconfig.json                                  [MVP] strict și alias @/*
├── next.config.ts                                 [MVP] server, imagini, securitate/cache
├── next-env.d.ts                                  [generat] nu se editează manual
├── eslint.config.mjs                              [MVP] reguli și granițe de import
├── postcss.config.mjs                             [MVP] integrare Tailwind după versiune
├── components.json                                [MVP] config generator shadcn/ui
├── vitest.config.ts                               [MVP] propunere runner unit/contract
├── playwright.config.ts                           [MVP] propunere runner E2E
├── public/                                        [MVP] numai asseturi publice statice
│   └── brand/                                     logo/iconuri cu drepturi confirmate
├── src/                                           [MVP]
│   ├── app/                                       arbore separat în §4
│   ├── features/                                  detaliere în §5–6
│   ├── workflows/
│   │   ├── contracts/
│   │   │   ├── confirm-cooking.schema.ts
│   │   │   └── regenerate-shopping.schema.ts
│   │   ├── application/
│   │   │   ├── confirm-cooking.service.ts
│   │   │   ├── regenerate-shopping.service.ts
│   │   │   ├── match-context.port.ts
│   │   │   ├── export-account.service.ts
│   │   │   └── delete-account.service.ts
│   │   ├── infrastructure/
│   │   │   ├── supabase-cooking-workflow.repository.ts
│   │   │   ├── supabase-shopping-workflow.repository.ts
│   │   │   └── supabase-match-context.repository.ts
│   │   └── server.ts                              facade server pentru coordonare
│   ├── components/
│   │   ├── ui/                                    primitive shadcn/ui
│   │   ├── feedback/
│   │   │   ├── empty-state.tsx
│   │   │   ├── error-state.tsx
│   │   │   └── pending-indicator.tsx
│   │   └── layout/                                shell, navigație, skip-link
│   ├── config/
│   │   ├── env/
│   │   │   ├── client.ts                          numai NEXT_PUBLIC_*
│   │   │   ├── server.ts                          configurare server obișnuită
│   │   │   └── maintenance.ts                     secrete executor, validare separată
│   │   └── limits.ts                              limite de produs, fără secrete
│   ├── server/
│   │   ├── composition/
│   │   │   ├── create-request-context.ts
│   │   │   ├── create-services.ts                 registrează adaptoarele per cerere
│   │   │   └── create-maintenance-services.ts     separat de cereri obișnuite
│   │   ├── supabase/
│   │   │   ├── create-user-client.ts              JWT și cookie-uri per cerere
│   │   │   ├── create-public-client.ts            explicit fără sesiune
│   │   │   ├── create-maintenance-client.ts       privilegiat, numai mentenanță
│   │   │   └── database.generated.ts              generat din schema aplicată
│   │   ├── http/
│   │   │   ├── parse-request.ts
│   │   │   ├── to-http-error.ts
│   │   │   ├── csrf.ts
│   │   │   └── response.ts
│   │   ├── observability/
│   │   │   ├── logger.ts
│   │   │   ├── redaction.ts
│   │   │   └── tracing.ts
│   │   ├── jobs/
│   │   │   ├── job-handler.port.ts
│   │   │   ├── job-runner.ts
│   │   │   └── verify-scheduler-request.ts
│   │   ├── cache/
│   │   │   ├── catalog-cache.ts
│   │   │   └── invalidate-catalog.ts
│   │   └── audit/                                 adaptor append-only și citire autorizată
│   ├── shared/
│   │   ├── domain/
│   │   │   ├── quantity.ts
│   │   │   ├── money.ts
│   │   │   ├── calendar-date.ts
│   │   │   ├── result.ts
│   │   │   └── domain-error.ts
│   │   ├── contracts/
│   │   │   ├── decimal.schema.ts
│   │   │   ├── api-error.schema.ts
│   │   │   ├── pagination.schema.ts
│   │   │   └── request-id.ts
│   │   ├── application/
│   │   │   ├── actor-context.ts
│   │   │   ├── authorization.port.ts
│   │   │   ├── clock.port.ts
│   │   │   ├── audit.port.ts
│   │   │   └── transaction-command.port.ts
│   │   └── presentation/
│   │       ├── api-client.ts                      fetch same-origin și ApiError
│   │       └── cn.ts                              compunere clase, fără reguli de produs
│   ├── styles/globals.css                         Tailwind și tokenuri de design
│   ├── instrumentation.ts                         bootstrap observabilitate
│   └── proxy.ts                                   nume după versiunea Next.js aleasă
├── supabase/                                      [MVP]
│   ├── config.toml                                mediu local, fără credențiale
│   ├── migrations/
│   │   ├── <timestamp>_create_security_foundation.sql
│   │   ├── <timestamp>_create_ingredient_catalog.sql
│   │   ├── <timestamp>_create_recipe_versions.sql
│   │   ├── <timestamp>_create_pantry_and_plans.sql
│   │   └── <timestamp>_create_workflow_rpcs.sql
│   ├── seed.sql                                   numai date sintetice/licențiate
│   └── tests/
│       ├── rls/                                   membri A/B, anon, editor și admin
│       ├── rpc/                                   integritate, acces direct, idempotență
│       └── storage/                               politici obiecte și proprietari
├── tests/                                         [MVP]
│   ├── integration/                               RPC și adaptoare cu DB reală locală
│   ├── e2e/                                       parcursuri și accesibilitate
│   ├── architecture/                              granițe de import și bundle server/client
│   ├── fixtures/                                  fabrici/date sintetice comune
│   └── setup/                                     bootstrap Node, DOM și DB separate
├── scripts/                                       [MVP] verificări și generare tipuri
└── .github/workflows/ci.yml                        [MVP, condiționat de GitHub]
```

`<lockfile-unic>` înseamnă unul singur dintre lockfile-urile package managerului ales; nu este un nume literal. Fișierele de configurare Vitest/Playwright și CI sunt propuneri, nu dependențe deja aprobate/instalate. `next-env.d.ts` este generat și ignorat în Git conform convenției inițiale; politica se reverifică la versiunea Next.js fixată. `database.generated.ts` este generat și versionat pentru review de contract, cu verificare CI de drift. Convențiile Next pentru rutare și fișiere speciale sunt documentate în [Project structure](https://nextjs.org/docs/app/getting-started/project-structure).

## 4. Arborele App Router și responsabilitatea rutelor

```text
src/app/                                          [MVP]
├── layout.tsx                                    html/lang, providers minimi, skip-link
├── error.tsx                                     boundary local, componentă client
├── global-error.tsx                              fallback pentru root layout
├── not-found.tsx
├── (public)/
│   ├── page.tsx                                  prima căutare / explorare
│   ├── search/
│   │   ├── page.tsx
│   │   ├── loading.tsx
│   │   └── error.tsx
│   └── recipes/[recipeId]/
│       ├── page.tsx
│       ├── loading.tsx
│       └── not-found.tsx
├── (auth)/
│   ├── sign-in/page.tsx
│   ├── sign-up/page.tsx
│   ├── verify-email/page.tsx
│   └── reset-password/page.tsx
├── auth/callback/route.ts                        callback SDK/PKCE, redirect allowlist
├── (account)/
│   ├── layout.tsx                                shell pentru cont; nu e singurul auth gate
│   ├── error.tsx
│   ├── pantry/{page,loading}.tsx
│   ├── favorites/{page,loading}.tsx
│   ├── meal-planner/{page,loading}.tsx
│   ├── shopping/{page,loading}.tsx
│   └── profile/{page,loading}.tsx
├── admin/
│   ├── layout.tsx                                capabilități și MFA, reverificate la operații
│   ├── page.tsx
│   ├── loading.tsx
│   ├── error.tsx
│   ├── recipes/page.tsx
│   ├── ingredients/page.tsx
│   ├── references/page.tsx
│   └── users/page.tsx
└── api/
    ├── internal/jobs/run/route.ts                 semnătură scheduler, fără sesiune browser
    └── v1/
        ├── auth/{sign-in,sign-up,sign-out,recovery}/route.ts
        ├── ingredients/route.ts
        ├── recipes/route.ts
        ├── recipes/[recipeId]/route.ts
        ├── matches/route.ts
        ├── inventory/route.ts
        ├── inventory/lots/route.ts
        ├── inventory/lots/[lotId]/route.ts
        ├── favorites/route.ts
        ├── favorites/[recipeId]/route.ts
        ├── meal-plan/route.ts
        ├── meal-plan/entries/route.ts
        ├── meal-plan/entries/[entryId]/route.ts
        ├── cooking/preview/route.ts
        ├── cooking/confirmations/route.ts
        ├── cooking/confirmations/[confirmationId]/compensations/route.ts
        ├── shopping-list/route.ts
        ├── shopping-list/{preview,regenerate}/route.ts
        ├── shopping-list/items/route.ts
        ├── shopping-list/items/[itemId]/route.ts
        ├── profile/route.ts
        ├── account/{exports,deletion}/route.ts
        ├── account/jobs/[jobId]/route.ts
        ├── media/uploads/route.ts
        ├── media/uploads/[uploadId]/finalization/route.ts
        └── admin/
            ├── recipes/route.ts
            ├── recipes/[recipeId]/route.ts
            ├── recipes/[recipeId]/{publication,withdrawal}/route.ts
            ├── ingredients/route.ts
            ├── ingredients/[ingredientId]/route.ts
            ├── references/route.ts
            ├── references/[referenceId]/route.ts
            ├── users/[userId]/status/route.ts
            └── roles/route.ts
```

`{a,b}` este prescurtare documentară pentru două fișiere/directoare separate, nu nume literal. Route groups nu schimbă URL-ul. `/pantry` este ruta UI, în timp ce `/api/v1/inventory` păstrează contractul arhitectural stabilit. Similar: UI `/meal-planner` și `/shopping`, API `/meal-plan` și `/shopping-list`. Nu se redenumesc endpointurile doar pentru a egala numele feature-ului.

Rutele au numai adaptare: verifică transportul, parsează params/query/body, obțin contextul, cheamă serviciul și mapează rezultatul. Validarea actorului, proprietății și drepturilor este repetată în serviciu/DB când este relevant. RSC cheamă serviciile furnizate de composition root direct în proces, nu propriul API HTTP. Nu se adaugă un al doilea set paralel de Server Actions pentru aceleași comenzi.

UI empty și erorile de business sunt componente de feature, nu fișiere Next inventate (`empty.tsx` nu este convenție de rutare). `loading.tsx` este pentru încărcarea segmentului; operațiile mici au stare pending locală. `error.tsx` tratează excepțiile neașteptate, cu requestId și retry sigur, fără a pretinde că eroarea înseamnă zero rezultate.

Extensiile de rutare V2 se adaugă numai odată cu feature-ul: `(account)/ai`, pagini `community`, pagini de abonament, API pentru adaptări/propuneri/checkout și webhookul de billing. Semnătura webhookului se verifică pe corpul original și nu folosește CSRF-ul browserului.

## 5. Șablonul unui feature și entrypointuri

```text
src/features/pantry/                              [MVP, exemplu complet]
├── README.md                                     scop, ownership, dependențe, RPC-uri
├── contracts/
│   ├── index.ts                                  exporturi explicite browser-safe
│   ├── pantry-lot.schema.ts                       DTO de răspuns, fără rând DB
│   ├── create-pantry-lot.schema.ts                input serializabil, owner derivat server
│   ├── update-pantry-lot.schema.ts                input + expectedRevision
│   └── pantry-snapshot.schema.ts                  loturi și revizie
├── domain/
│   ├── pantry-lot.ts                             entitate și invariante
│   ├── select-consumption-lots.ts                 funcție deterministă
│   └── select-consumption-lots.test.ts
├── application/
│   ├── ports/
│   │   ├── pantry.repository.ts                  interfață, nu SDK
│   │   └── ingredient-reader.port.ts             port definit de consumator
│   ├── create-pantry-lot.service.ts               un use case
│   ├── update-pantry-lot.service.ts
│   ├── get-pantry.service.ts
│   ├── preview-consumption.service.ts
│   ├── pantry-lot.mapper.ts                      domeniu → DTO
│   └── create-pantry-lot.service.test.ts
├── infrastructure/
│   ├── supabase-pantry.repository.ts             implementează portul prin views/RPC
│   ├── pantry-row.mapper.ts                      DB → domeniu, inclusiv decimal/null
│   └── pantry-rpc.schema.ts                      validare răspuns DB extern
├── presentation/
│   ├── client.ts                                 exporturi explicite de componente client
│   ├── components/
│   │   ├── pantry-list.tsx
│   │   ├── pantry-form.tsx
│   │   ├── pantry-empty.tsx
│   │   ├── pantry-error.tsx
│   │   └── pantry-skeleton.tsx
│   ├── hooks/use-pantry-form.ts
│   └── api/pantry.api.ts                         transport browser → /api/v1/inventory
└── server.ts                                     factory/use case-uri, import server-only
```

Fiecare feature adoptă numai straturile/fișierele necesare. Un feature fără persistență proprie, cum este matching în MVP, nu primește repository CRUD gol. Nu se generează automat un `types.ts`, `utils.ts`, `constants.ts` sau `service.ts` generic în fiecare folder.

Entrypointuri permise:

- `contracts/index.ts`: scheme/DTO-uri publice tipate, fără domeniu intern, credențiale sau SDK.
- `server.ts`: factory/adaptor de compoziție server-only, nu service singleton cu JWT capturat. Consumat de `src/server/composition` și de workflow composition, nu de browser sau de alt feature direct.
- `presentation/client.ts`: exporturi numai client-safe, cu directiva potrivită dacă este entrypoint de componente client. Nu reexportă RSC sau server.ts.
- Prezentarea server-specifică, dacă devine necesară, are un entrypoint separat `presentation/server.ts`, marcat server-only; nu intră în barrelul client.

Nu există `src/features/index.ts` sau `src/features/<feature>/index.ts` care reexportă tot. Importurile interne sunt relative și nu trec prin propriul barrel public, pentru a evita ciclurile.

## 6. Fișierele importante ale fiecărui feature

În fiecare subarbore se aplică șablonul din §5; lista următoare completează fișierele specifice, nu reprezintă un al doilea șablon de straturi. Toate directoarele V2 sunt doar documentate acum.

```text
src/features/
├── auth/                                         [MVP]
│   ├── contracts/{sign-in,sign-up,profile,preferences}.schema.ts
│   ├── domain/{account-status,capability}.ts
│   ├── application/ports/{auth-provider,profile-repository}.port.ts
│   ├── application/{sign-in,get-profile,update-profile}.service.ts
│   ├── infrastructure/{supabase-auth-provider,supabase-profile.repository}.ts
│   ├── presentation/{components,hooks,api}/
│   └── server.ts
├── ingredients/                                  [MVP]
│   ├── contracts/{ingredient,ingredient-search,unit}.schema.ts
│   ├── domain/{ingredient-id,unit-dimension,convert-quantity}.ts
│   ├── application/ports/ingredient.repository.ts
│   ├── application/{resolve-ingredients,search-ingredients}.service.ts
│   ├── infrastructure/{supabase-ingredient.repository,ingredient-row.mapper}.ts
│   ├── presentation/components/ingredient-combobox.tsx
│   └── server.ts
├── pantry/                                       [MVP] detaliat în §5
├── recipes/                                      [MVP]
│   ├── contracts/{recipe-summary,recipe-detail,recipe-visibility,favorite}.schema.ts
│   ├── domain/{recipe,recipe-version,publication-status}.ts
│   ├── application/ports/{recipe.repository,media-storage.port}.ts
│   ├── application/{get-recipe,list-recipes,publish-recipe,withdraw-recipe}.service.ts
│   ├── infrastructure/{supabase-recipe.repository,recipe-row.mapper}.ts
│   ├── favorites/
│   │   ├── domain/favorite.ts
│   │   ├── application/favorite.repository.ts
│   │   ├── application/{list-favorites,set-favorite}.service.ts
│   │   └── infrastructure/supabase-favorite.repository.ts
│   ├── presentation/components/{recipe-card,recipe-detail,favorites-empty}.tsx
│   └── server.ts
├── matching/                                     [MVP]
│   ├── contracts/{match-request,match-result,match-filter,match-cursor}.schema.ts
│   ├── domain/{evaluate-availability,apply-strict-filters,rank-matches}.ts
│   ├── application/ports/match-context-reader.port.ts
│   ├── application/search-matches.service.ts
│   ├── presentation/components/{match-form,match-results,matching-empty}.tsx
│   └── server.ts
├── shopping/                                     [MVP]
│   ├── contracts/{shopping-list,shopping-item,shopping-preview}.schema.ts
│   ├── domain/{aggregate-requirements,reconcile-shopping-list}.ts
│   ├── application/ports/shopping.repository.ts
│   ├── application/{get-shopping-list,check-shopping-item}.service.ts
│   ├── infrastructure/supabase-shopping.repository.ts
│   ├── presentation/components/{shopping-list,shopping-empty,shopping-conflict}.tsx
│   └── server.ts
├── meal-planner/                                 [MVP]
│   ├── contracts/{meal-entry,meal-plan,upsert-meal}.schema.ts
│   ├── domain/{meal-entry,meal-slot,plan-revision}.ts
│   ├── application/ports/{meal-plan.repository,recipe-reader.port}.ts
│   ├── application/{get-meal-plan,upsert-meal,remove-meal}.service.ts
│   ├── infrastructure/supabase-meal-plan.repository.ts
│   ├── presentation/components/{meal-calendar,meal-form,meal-plan-empty}.tsx
│   └── server.ts
├── nutrition/                                    [MVP]
│   ├── contracts/{nutrition-estimate,estimate-coverage,cost-estimate}.schema.ts
│   ├── domain/{calculate-nutrition,reference-coverage}.ts
│   ├── application/ports/nutrition-reference.repository.ts
│   ├── application/estimate-nutrition.service.ts
│   ├── infrastructure/supabase-nutrition-reference.repository.ts
│   ├── pricing/
│   │   ├── domain/{reference-price,calculate-recipe-cost}.ts
│   │   ├── application/price-reference.repository.ts
│   │   ├── application/estimate-cost.service.ts
│   │   └── infrastructure/supabase-price-reference.repository.ts
│   ├── presentation/components/{nutrition-panel,cost-panel,partial-estimate}.tsx
│   └── server.ts
├── ai/                                           [V2]
│   ├── contracts/{adaptation-request,adaptation-result,ai-job}.schema.ts
│   ├── domain/{ai-budget,validate-adaptation}.ts
│   ├── application/ports/{ai-provider,ai-job.repository,budget.repository}.ts
│   ├── application/{request-adaptation,accept-variant}.service.ts
│   ├── infrastructure/{provider-adapter,prompt-registry,supabase-ai.repository}.ts
│   ├── presentation/components/{adaptation-form,ai-progress,ai-error}.tsx
│   └── server.ts
├── community/                                    [V2]
│   ├── contracts/{submission,comment,rating,report,moderation-decision}.schema.ts
│   ├── domain/{submission-status,moderation-rule}.ts
│   ├── application/ports/community.repository.ts
│   ├── application/{submit-recipe,report-content,moderate-submission}.service.ts
│   ├── infrastructure/supabase-community.repository.ts
│   ├── presentation/components/{submission-form,comment-list,report-dialog}.tsx
│   └── server.ts
├── admin/                                        [MVP]
│   ├── contracts/{admin-command,audit-query}.schema.ts
│   ├── application/ports/{catalog-admin,account-admin,audit-reader}.port.ts
│   ├── application/{publish-editorial-recipe,change-account-status}.service.ts
│   ├── presentation/components/{admin-shell,publication-form,audit-table}.tsx
│   └── server.ts
└── billing/                                      [V2]
    ├── contracts/{checkout-request,entitlement,subscription}.schema.ts
    ├── domain/{subscription-status,resolve-entitlements}.ts
    ├── application/ports/{payment-provider,billing.repository}.ts
    ├── application/{create-checkout,apply-provider-event}.service.ts
    ├── infrastructure/{payment-provider-adapter,supabase-billing.repository}.ts
    ├── presentation/components/{subscription-panel,billing-error}.tsx
    └── server.ts
```

Toate features vor avea `contracts/index.ts` și propriul README atunci când se implementează, chiar dacă nu sunt repetate în acest arbore. Serviciile de administrare primesc porturi către proprietarii datelor; `admin` nu are nevoie de un repository universal care poate modifica orice tabel.

## 7. Responsabilitatea straturilor și fluxul unei schimbări

| Locație | Conține | Nu conține |
|---|---|---|
| `src/app` | Rutare, layouturi, RSC și adaptoare HTTP foarte subțiri | Ranking, interogări SDK, conversii, reguli duplicate |
| `contracts` | Schematizare serializabilă, DTO, coduri de transport | Entități DB brute, config, acces la rețea |
| `domain` | Entități, valori, algoritmi puri și erori de domeniu | Zod, Next/React, fetch, SDK, process.env |
| `application` | Un use case per serviciu, porturi, mapare DTO, autorizare prin context/port | Cookie-uri, HTTP status, client Supabase concret |
| `infrastructure` | Repository implementat, mapări DB, adaptoare provider | UI și acces direct din alt feature |
| `presentation` | UI și transport browser, loading/empty/error locale | SQL, chei, importuri server |
| `workflows` | Coordonare explicită multi-feature și portul tranzacțional | O colecție fără ownership de reguli mutate arbitrar |
| `server` | Compoziție per request, HTTP, SDK clients, logging, joburi și cache | Domeniu comercial ascuns în utilitare |
| `config` | Validarea mediului și limite configurate | Secrete hardcodate, acces arbitrar la process.env din features |
| `shared` | Primitive și porturi stabile cu minimum două utilizări reale | `helpers.ts`/`common.ts` care absorb orice logică |
| `supabase` | Migrații autoritative, politici, RPC, seed și teste DB | A doua schemă ORM concurentă sau secrete |
| `public` | Asseturi publice de aplicație | Exporturi de cont, uploaduri, fișiere private |

Exemplu de traseu pentru adăugarea unui lot: formular pantry → `presentation/api/pantry.api.ts` → Route Handler inventory → schemă de input → RequestContext → serviciu `create-pantry-lot` → port `PantryRepository` → adaptor Supabase → RPC cu RLS/invariante → mapper DTO → UI confirmat. Datele DB nu sunt returnate integral prin `return row`.

Confirmarea gătitului și regenerarea listei intră prin `workflows`; un apel HTTP nu execută update pantry și update plan ca două tranzacții independente. SQL-ul menține invariantele chiar la apel direct al RPC. Matching citește snapshotul prin `MatchContextReader`, implementat de adaptorul read-model din workflows; nu importă repository-ul pantry/recipes și nu face N+1 interogări.

## 8. Convenții de numire

| Element | Regulă | Exemplu |
|---|---|---|
| Foldere și fișiere de aplicație | Engleză, `kebab-case`, singular pentru concept, plural pentru colecție când este natural | `meal-planner`, `create-pantry-lot.service.ts` |
| Componente React/exporturi tipuri | `PascalCase`; fișierul rămâne kebab-case | `PantryForm` în `pantry-form.tsx` |
| Funcții/variabile | `camelCase`, verb precis pentru operațiune | `rankMatches`, `confirmCooking` |
| Hookuri | Prefix `use`, fișier `use-*.ts` | `usePantryForm`, `use-pantry-form.ts` |
| Scheme Zod | `PascalCase` + `Schema`; fișier `*.schema.ts` | `CreatePantryLotSchema` |
| DTO/input/output | `CreatePantryLotInput`, `PantryLotDto`; fără prefix `I` pentru interfețe | `MatchResultDto` |
| Porturi | Nume după rol, fără SDK | `PantryRepository`, `RecipeReader`, `Clock` |
| Adaptoare | Furnizor + responsabilitate | `SupabasePantryRepository` |
| Constante | `UPPER_SNAKE_CASE` pentru valori globale fixe; fără enum general gigantic | `MAX_MATCH_INGREDIENTS` |
| Tabele/coloane SQL | `snake_case`, tabele plural, FK `*_id` | `pantry_lots`, `owner_id`, `recipe_version_id` |
| RPC SQL | Verb și resursă, nume stabil explicit | `api.confirm_cooking`, `api.regenerate_shopping_list` |
| Migrații | Timestamp unic UTC + verb + scop | `<timestamp>_add_pantry_revision.sql` |
| Teste | Fișier alăturat `*.test.ts(x)`; E2E `*.spec.ts`; integrare `*.integration.test.ts` | `rank-matches.test.ts` |
| ADR-uri viitoare | Număr + subiect în `docs/architecture/decisions/` | `0001-adopt-feature-boundaries.md` |

Numele tabelelor de mai sus sunt convenții fizice viitoare, nu o migrare de nume deja folosite în DB. `recipeVersionId` în TypeScript corespunde lui `recipe_version_id` în mapper. Textele UI sunt în română; identificatorii și comentariile tehnice folosesc o limbă consecventă și nu traduc numele API-urilor.

Excepții: numele speciale Next (`page.tsx`, `layout.tsx`, `route.ts`, `loading.tsx`, `error.tsx`) și fișierele generate nu se redenumesc pentru stil. Exporturile sunt named; default export este folosit când frameworkul/configurația îl cere.

## 9. Reguli TypeScript

`strict: true` este obligatoriu. Se propun suplimentar `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, `forceConsistentCasingInFileNames` și `noEmit`; `moduleResolution` și opțiunile JSX se aliniază versiunii Next.js. Acestea sunt cerințe pentru viitorul `tsconfig.json`, nu o configurație deja verificată. Flagul strict poate evolua odată cu TypeScript; upgrade-urile trec prin CI. [TypeScript — strict](https://www.typescriptlang.org/tsconfig/strict.html)

- Fără `any` pentru date externe: `unknown` + parsare/guard. `catch` restrânge tipul înainte de acces.
- Fără `as SomeDto` pentru a pretinde validarea JSON sau a rândurilor DB. Fără `!` pentru mediu, utilizator sau elemente care pot lipsi.
- Fără `@ts-ignore`. O excepție `@ts-expect-error` trebuie motivată, limitată și urmărită; nu ascunde erori de arhitectură.
- Importurile doar de tip folosesc `import type`. `satisfies` verifică un obiect fără să îi piardă tipurile utile.
- Preferă discriminated unions și switch exhaustiv pentru availability, coverage și erori; fără booleeni incompatibili precum `isComplete` și `isUnavailable` simultan.
- Tipurile domeniului sunt independente de wire DTO și de tipurile generate DB. ID-urile domeniului pot fi branded prin constructori validați; UUID-ul brut nu devine ID autorizat doar pentru că are format corect.
- `readonly` la input/snapshot unde previne mutații accidentale; nu se modifică array-uri partajate de cache.
- Datele calendaristice sunt string validate `YYYY-MM-DD` cu validare reală de calendar; momentele sunt ISO UTC. `Date` nu traversează JSON ca obiect implicit.
- Zecimalele sunt string în transport și obiect decimal/fixed precision în calcule; `Number()` nu este conversie monetară implicită.
- `null` exprimă necunoscutul/absența definită în contract; câmpul omis într-un PATCH înseamnă „nu modifica”. `undefined` nu este trimis ca valoare JSON. Empty array este rezultat valid, nu eroare.
- Nu se folosește timpul curent sau ID aleator în algoritmi fără port `Clock`/generator când afectează testarea și idempotența.

## 10. DTO-uri, scheme Zod și mapări

Se definește o singură schemă pentru fiecare graniță contractuală, cu tip dedus, nu o interfață manuală separată cu aceleași câmpuri. `z.input` și `z.output` sunt distincte dacă există transformări; tipul DTO reprezintă forma serializată, nu un obiect de clasă sau tip DB. Mecanismul de parsare și inferență este descris în [Zod — Basic usage](https://zod.dev/basics).

| Tip de date | Locație | Responsabilitate |
|---|---|---|
| Input browser/HTTP | `contracts/create-*.schema.ts` | Câmpuri acceptate, lungimi, valori, unități și limite; fără owner arbitrar |
| Form values | `presentation` | Poate conține input string incomplet, mapat înainte de cerere; nu este entitate de domeniu |
| Command tipat intern | `application` | Payload deja parsat + ActorContext verificat; nu presupune că validarea înlocuiește autorizarea |
| Entitate/value object | `domain` | Invariante și comportament, independent de Zod |
| Rând/view/RPC extern | `infrastructure` | Tip generat + schemă pentru rezultate calculate/JSON și mapare în domeniu |
| Output DTO | `contracts/*.schema.ts` | Structură serializabilă minimală; sursă, coverage și revizie explicite |

Reguli:

1. Se parsează body/query/params/headers relevante pe server și răspunsurile providerilor la intrare. Clientul validează pentru UX, fără a deveni autoritate.
2. Comenzile resping câmpurile necunoscute relevante securității; `ownerId`, `role`, `accountStatus` nu sunt ignorate tăcut într-un formular de profil. Nu se aplică automat `partial()` unei entități complete pentru un PATCH.
3. Preprocesarea este explicită: stringul gol nu devine `0`; `"false"` nu se convertește prin truthiness; 1–20 porții și maximum 30 ingrediente rămân limite server/DB unde se aplică.
4. Inputurile au limite de bytes înainte de parsare, apoi de lungime/număr de elemente. Schemele nu execută requesturi HTTP sau queryuri DB.
5. Regulile care cer stare persistentă — acces, stoc suficient, unicitate, status publicare — sunt în application/DB, nu într-un refinement Zod cu I/O ascuns.
6. `safeParse` este preferat pentru erori așteptate la intrarea HTTP; serviciul primește tipul parsat. `.parse()` rămâne acceptabil la granițe interne unde eroarea este mapată controlat.
7. DTO-urile importante sunt validate și la ieșirea graniței server pentru a detecta mapperi greșiți; validarea fiecărei linii mari se calibrează prin măsurare, fără returnarea de coloane private.
8. Maparea DB→domain păstrează numeric/string și null/unknown; domain→DTO exclude câmpuri interne. Pentru datele incomplete se emit `complete`, `partial` sau `unavailable`, nu total zero inventat.

`PantryLotDto` include ID, ingredient, stare cantitate, locație, dată opțională și revizie. `MatchResultDto` include versiunea rețetei, status pe ingredient, deficit, motiv de eligibilitate și estimări. `ApiErrorDto` include cod stabil, mesaj sigur, fieldErrors după caz, requestId și retryable. Câmpurile exacte se fixează odată cu endpointul, fără schimbarea convențiilor de mai sus.

## 11. Repository layer, service layer și compoziție

### 11.1 Repository

Interfața este în `application/ports`, definită de consumator. Exprimă operații precise (`getSnapshot`, `createLot`, `confirmConsumption`) cu tipuri de domeniu/command, nu `SupabaseClient`, query builder sau `Record<string, unknown>` generic. Nu se construiește un `BaseRepository<T>` universal dacă ascunde ownership, revizii și tranzacții.

Implementarea `infrastructure/supabase-*.repository.ts` este server-only, folosește clientul injectat per request și mapări explicite. Citirile folosesc proiecții `api` aprobate; mutațiile folosesc RPC restrânse din arhitectură. Nu există fallback automat la secret key când RLS refuză cererea. Cheia publicabilă și JWT-ul persoanei păstrează contextul său; mentenanța are client separat.

Accesul SQL autoritativ este versionat în `supabase/migrations`. Schemele `api`/`app_private`, rolurile limitate, RLS, grants și verificarea apelurilor directe se păstrează conform §9 din arhitectură. O funcție care devine accesibilă REST este analizată ca endpoint, nu ca helper privat sigur implicit.

### 11.2 Serviciu/use case

Un fișier `verb-resource.service.ts` execută un use case. Primește dependențe explicite: repository/reader port, autorizare, Clock/audit unde sunt necesare. Nu citește cookie-uri, `process.env`, singletonul SDK sau HTTP Request. Verifică actorul/capabilitatea, rulează domeniul și cere persistența; întoarce DTO/Result tipat fără status HTTP.

ActorContext este derivat server-side și nu se acceptă prin body. Mutarea codului din Route Handler în serviciu nu elimină nevoia verificării în RPC/RLS, fiindcă Data API poate fi apelată direct. Revizia și idempotența fac parte din command, nu dintr-o convenție UI opțională.

### 11.3 Compoziție și tranzacții

`create-services.ts` construiește numai serviciile necesare cererii și le injectează adaptoarele. Nu creează un singleton autentificat și nu importă automat adaptoarele AI/billing V2. `server.ts` al feature-ului este un factory/façadă tipată, fără reexport de config sau SDK.

Pentru un feature care are nevoie de datele altuia: consumatorul definește un reader port cu tipuri din contractele furnizorului; composition root leagă portul la serviciul autorizat al furnizorului. Feature-ul nu importă `server.ts` sau `application` al vecinului. Pentru un read snapshot cross-feature, un adaptor din workflows furnizează proiecția SQL verificată, cu ownership comun explicit.

Confirmarea gătitului/regenerarea listei folosesc un port tranzacțional de workflow și o singură RPC cu locking/revizii/idempotență. Nu se simulează o tranzacție prin trei metode de repository chemate consecutiv în HTTP. Refolosirea cheii cu alt payload este conflict; retry-ul unei comenzi finalizate întoarce rezultatul anterior, înainte de verificarea reviziilor vechi.

## 12. Reguli de import și prevenirea ciclurilor

Alias unic de proiect: `@/* → src/*`. Aliasurile sunt comoditate de rezolvare, nu protecție de securitate. Într-un feature se folosesc importuri relative; peste granițe se folosesc entrypointuri explicite. Fără `../../../other-feature/infrastructure` și fără aliasuri wildcard care ocolesc regula.

| Importator | Poate importa | Nu poate importa |
|---|---|---|
| `shared/domain` | Primitive pure și biblioteca decimal aprobată | Features, application, config, SDK/UI/Zod |
| `shared/contracts` | Zod și primitive de contract sigure | Server, React, SDK, features |
| `shared/application` | Tipuri/porturi pure, shared domain/contracts | Adaptoare și config |
| Feature `domain` | Propriul domain, shared/domain | Contracts Zod, application, infrastructure, presentation, alte features |
| Feature `contracts` | Zod, shared/contracts; tipuri și scheme Zod publice de runtime din `contracts/index.ts` al altui feature numai în DAG-ul de mai jos | Domain intern, server.ts, SDK/config/UI |
| Feature `application` | Propriul domain/contracts/porturi, shared; contracte publice ale furnizorilor declarați | Alte application/server/repository-uri; React/Next/Supabase concrete |
| Feature `infrastructure` | Propriile porturi/domain/contracts, SDK și helperi server explicit permiși | Presentation sau repository-uri ale altui feature; composition root |
| Feature `presentation` client | Propriile contracts, shared/presentation, components/ui și contracte publice necesare | Application/domain/server.ts/infrastructure, process.env, SDK DB |
| Feature `server.ts` | Propriile servicii și porturi; server-only | Alt feature server, secrete exportate, UI client barrel |
| `workflows/application` | Contracte publice și porturi proprii, shared, autorizare abstractă | Repository-uri concrete, Next.js, SDK |
| `server/composition` | Entrypointuri server și adaptoare explicite ale tuturor feature-urilor necesare | Import de la browser, state global autentificat |
| `app` server/rute | Composition root, contracte, entrypointuri presentation aprobate, helperi HTTP | SDK/query DB și infrastructura unui feature direct |
| `components/ui` | Biblioteci UI aprobate și utilitare client-safe | Features, server, config cu secrete |

Infrastructura feature-urilor poate folosi numai helperi `server/supabase`, `server/cache` sau `server/observability` care nu importă la rândul lor feature-uri. Nu se creează dependența `infrastructure → server/composition → infrastructure`. Compoziția este singurul loc autorizat să importe concret infrastructura feature-urilor din exterior.

Contractele urmează un DAG, fără cicluri, inclusiv la `import type`:

- `auth` și `ingredients` depind numai de primitive shared.
- `recipes` poate folosi contractele `ingredients`.
- `pantry` poate folosi contractele `ingredients`.
- `meal-planner` poate folosi contractele `recipes`/`ingredients`.
- `nutrition` poate folosi contractele `ingredients`/`recipes`.
- `shopping` și `matching` pot folosi contractele `auth`, `ingredients`, `recipes`, `pantry`, `meal-planner`, `nutrition`, după nevoie; nu depind unul de altul.
- `ai` V2 consumă contractele de bază și `matching`; `community` V2 consumă `auth`/`recipes`; `billing` V2 consumă `auth`.
- `admin` consumă contracte autorizate pentru operațiile administrative; celelalte features nu depind de `admin`.

Aceste permisiuni sunt limite maxime, nu obligații de import. Schemele Zod publice pot fi importate la runtime din `contracts/index.ts` pentru compunere, de exemplu `RecipeDetailSchema` care reutilizează `IngredientSchema`, numai în sensul DAG-ului și fără efecte secundare server. Dacă este utilizat numai tipul dedus, `import type` este obligatoriu. Nu se duplică o schemă doar pentru a evita un import runtime permis. O dependență suplimentară justificată se înscrie în DAG înainte de cod; nu se rezolvă un ciclu prin mutarea aleatorie a tipurilor în shared. Serviciile primesc ActorContext din shared/application, fără dependență circulară de serviciul auth.

Viitoarea configurație ESLint `no-restricted-imports` și/sau un verificator de graph aprobat va acoperi deep imports, server/client și cicluri. Restricțiile verifică și căile relative și exporturile indirecte; o regulă care blochează doar `@/features/*/infrastructure` este insuficientă. `server-only` previne importul accidental în bundle; nu înlocuiește autorizarea sau politicile DB.

## 13. Error handling, loading și accesibilitate

Codurile stabile rămân cele din arhitectură: validation 400, auth 401, forbidden 403, not-found 404, conflict 409, regulă de domeniu 422, limitare 429, dependență 503, neașteptat 500. Pentru resursele private ale altcuiva poate fi folosit 404 pentru a nu divulga existența. Lipsa de rezultate este 200 cu array gol.

`shared/domain/domain-error.ts` definește erori de domeniu fără status HTTP. Application întoarce un `Result` discriminat pentru erori așteptate; excepțiile necunoscute sunt capturate la graniță, logate redactat și mapate prin `server/http/to-http-error.ts`. Mapperul DB traduce coduri autoritative în erori de aplicație fără text SQL expus. Nu se prinde orice eroare pentru a returna `[]` sau succes.

Frontendul primește `ApiErrorDto`, păstrează inputul corectabil și oferă acțiune adecvată. Retry-ul automat este limitat la operații sigure/idempotente; conflictul pe snapshot cere preview nou. Stocul insuficient după schimbarea preview-ului este 409; inputul de consum nepermis fără conflict de snapshot este 422. `fieldErrors` nu conține inputuri sensibile sau stack trace.

| Suprafață | Loading | Empty | Error / accesibilitate |
|---|---|---|---|
| Ingrediente/matching | Pending, anularea răspunsurilor vechi, anunț accesibil | Îndemn la selecție sau ajustare filtre | Retry fără pierdere selecție; tastatură în combobox |
| Pantry/favorite | Schelet inițial și pending local | Adăugare lot/căutare rețetă | Formular păstrat, rollback optimist, focus pe eroare |
| Plan/listă | Stare pe zona mutată/bifată | Adăugare masă/element | Conflict cu reîncărcare; alternativă la drag-and-drop |
| Auth/profil | Buton ocupat | Onboarding minim unde este cazul | Mesaje sigure, labeluri, logout golește datele contului |
| Admin | Stare de operațiune și confirmare | Nicio intrare/coadă goală | Drepturi reverificate, operațiune auditată |
| AI/comunitate/billing V2 | Progres și stări de job | Fără conținut/abonament | Fallback și moderare; fără rezultat AI neverificat |

Nici statutul, nici eroarea nu sunt comunicate numai prin culoare. Screen reader, focus/restaurare și navigarea completă cu tastatura se verifică manual; alegerea shadcn/ui nu certifică singură accesibilitatea produsului.

## 14. Configurare și variabile de mediu

### 14.1 Separarea configurației

`src/config/env/client.ts` validează și exportă numai valorile publice necesare. `server.ts` este server-only și validează configurația cererilor obișnuite. `maintenance.ts` este server-only și validează separat secretele executorului când acesta este inițializat; buildul sau pagina publică nu cer cheia administrativă doar pentru că un modul a fost importat.

Procesul de implementare va valida Zod la bootstrapul contextului potrivit, cu mesaje care arată numele variabilei, nu valoarea. Valorile goale pentru chei obligatorii sunt erori, nu credențiale implicite. Validarea unui job nu se amână până după începerea unei ștergeri; disponibilitatea executorului este condiție de lansare a exportului/ștergerii MVP.

În afara `config/env` și a adaptorului de build/test, citirea directă `process.env` este interzisă. Variabilele se injectează prin config/porturi, fără a returna obiectul complet în props sau loguri. Parametrii CLI/CI sunt separați de runtime; `NODE_ENV` este gestionat de toolchain, nu reutilizat ca mediu comercial preview/producție.

### 14.2 Contractul `.env.example`

| Variabilă | Vizibilitate | Obligatorie pentru | Validare / observații |
|---|---|---|---|
| `COOKLY_ENV` | Server, neconfidențială | Inițializare | `development`, `test`, `preview`, `production`; exemplul folosește development |
| `APP_BASE_URL` | Server, neconfidențială | Auth/redirect/CSRF | URL de origine fără credențiale; HTTPS în producție, localhost HTTP permis local; allowlist callback se configurează separat |
| `LOG_LEVEL` | Server, neconfidențială | Logger | Enum debug/info/warn/error; info implicit propus |
| `SUPABASE_MEDIA_BUCKET` | Server, neconfidențială | Media editorială | Nume de bucket privat; existența/politicile se verifică separat |
| `SUPABASE_EXPORTS_BUCKET` | Server, neconfidențială | Export cont | Bucket privat separat; nu se confundă cu public/ |
| `NEXT_PUBLIC_SUPABASE_URL` | Public/browser | Auth și acces server user-context | URL HTTPS în mediu găzduit; endpoint local permis numai în development/test |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public/browser | Auth și Data API | Cheie publicabilă, non-empty; nu este mecanism de autorizare și nu poate fi înlocuită cu secret key |
| `CSRF_SECRET` | Secret server | Mutații browser | Valoare aleatorie cu entropie adecvată, minimum 32 bytes generați sigur; fără fallback constant |
| `SUPABASE_SECRET_KEY` | Secret mentenanță | Admin Auth, export/ștergere unde este necesar | Injectat numai executorului dacă hostingul permite; nu se folosește în repository-urile de utilizator |
| `JOBS_SIGNING_SECRET` | Secret mentenanță | Verificare scheduler | Semnătură HMAC cu timestamp/anti-replay; minimum 32 bytes generați sigur, valoare distinctă de CSRF_SECRET |

Modelul conține exact aceste 10 variabile, fără token real. Valorile neconfidențiale sunt defaults de dezvoltare; producția nu trebuie să moștenească accidental localhost sau `COOKLY_ENV=development`. Cheia privilegiată, cheia CSRF și cheia schedulerului sunt goale intenționat.

`NEXT_PUBLIC_*` ajunge în bundle la build; aceste valori trebuie setate pentru mediul buildului și nu se presupune că se schimbă după promovarea aceluiași bundle în alt proiect Supabase. Accesarea publică se face explicit/static, nu prin copierea întregului `process.env`. Fișierele `.env*` stau la rădăcină chiar când sursa este în `src`. Aceste comportamente sunt descrise în [Next.js — Environment variables](https://nextjs.org/docs/app/guides/environment-variables).

În model nu există `DATABASE_URL`: aplicația de utilizator folosește Data API. Conexiunea DB pentru migrații și tokenurile CLI sunt secrete ale jobului CI autorizat; nu se adaugă în config client sau în exemplu până nu este ales mecanismul de deploy. SMTP se configurează în serviciul Auth, fără a introduce arbitrar credențiale în aplicație.

V2 poate adăuga `AI_PROVIDER_API_KEY`, model, timeout, plafon de cost și chei/webhook pentru procesator; numele finale sunt condiționate de furnizori. Nu există flag public care să acorde premium sau să ocolească verificările. Feature flags server nu înlocuiesc capabilitățile și nu justifică expunerea unui endpoint neconfigurat.

### 14.3 Igienă și medii

`.gitignore` exclude `.env`, `.env.*` cu excepția `.env.example`, buildurile și rapoartele locale. Nu ignoră lockfile-ul ales, migrațiile, testele sau tipurile DB versionate. Fișierele deja urmărite de Git nu sunt protejate retroactiv de o regulă de ignorare; dacă ajunge un secret în istoric, se rotește și se urmează procedura de incident.

Local/staging/preview/producție au date și credențiale distincte; testează numai cu date sintetice. Modelul de mediu nu creează bucketuri, utilizatori, politici sau acces la un cont Supabase. Nu se execută în această etapă nicio autentificare externă.

## 15. Organizarea testelor și verificările viitoare

Propunere pentru inițializare: Vitest pentru domeniu/servicii/contracte și teste UI cu utilitare React justificate, Playwright pentru E2E și o suită DB reală locală pentru RLS/RPC. Nu sunt instalate și nici alese versiunile; alegerea finală este documentată în package.json și README la etapa de inițializare. Nu se adaugă framework doar pentru o schimbare documentară.

| Nivel | Locație și convenție | Ce verifică |
|---|---|---|
| Unit domain | Alăturat `domain/*.test.ts` | Matching, conversii, coverage și calcule, fără SDK sau DOM |
| Unit application | Alăturat `application/*.service.test.ts` | Autorizare, porturi, rezultate, retry/idempotență la nivel de comandă |
| Contract | Alăturat `contracts/*.schema.test.ts` | Câmpuri interzise, limite, zecimale, null/omitted și mapări de output |
| UI | Alăturat `presentation/**/*.test.tsx` | Interacțiune accesibilă și stări loading/empty/error; evită snapshoturi uriașe |
| Integrare | `tests/integration/<feature>/*.integration.test.ts` | Repository cu DB locală, tranzacții reale, concurență, mapping și erori |
| DB/RLS | `supabase/tests/{rls,rpc,storage}/` | Anon/A/B/editor/admin, views, grants, apel direct, funcții definer și politici obiecte |
| E2E | `tests/e2e/<flow>.spec.ts` | Ingrediente→rețetă, pantry→plan→listă, auth, admin și retragere |
| Arhitectură | `tests/architecture/` și reguli lint | Importuri interzise, cicluri, export indirect server, izolarea entrypointurilor |

`fixtures` sunt fabrici deterministe sau JSON sintetice, fără parole reale, inventare personale sau chei de producție. Mockurile sunt pentru porturi externe în unit tests; testele RLS nu înlocuiesc DB cu mock. Suita concurenței pornește cereri independente reale și verifică efectul unic, nu doar faptul că un mock a fost apelat.

SQL-ul cu invariante repetate necesită teste de paritate pe exemple de domeniu: cantități insuficiente/necunoscute, două mese cu stoc comun, liste regenerate și chei repetate. Accesibilitatea include verificări automate potrivite și evaluare manuală cu tastatură/cititor de ecran.

Scripturi viitoare convenite ca interfață, indisponibile acum:

| Script package viitor | Comportament cerut |
|---|---|
| `dev`, `build`, `start` | Next.js; build fără ignorarea erorilor TypeScript |
| `lint`, `typecheck` | ESLint inclusiv granițe; TypeScript noEmit |
| `test:unit`, `test:integration`, `test:e2e` | Suite separate, mediu explicit de test |
| `test:db`, `test:architecture` | Politici/RPC reale și verificări de graph |
| `db:types`, `db:types:check` | Generare tipuri și detectare drift după migrații |

Ordinea CI propusă: config/secrete → lint/typecheck → unit/contract → migrații + DB/RLS/integrare → build → E2E critic și verificare bundle. Nu se pretinde că un `lint` validează RLS sau că un build reușit demonstrează autorizarea.

## 16. Verificarea acestei etape și checklist manual

Verificările actuale trebuie să se limiteze la artefactele existente: fișiere și legături Markdown locale, acoperirea celor 12 features, corespondența cu arhitectura, modelul de mediu cu valori secrete goale și regulile Git. Niciun test funcțional, typecheck, build sau test RLS nu poate fi raportat ca trecut în lipsa aplicației.

Verificarea regulilor Git fără inițializarea proiectului se poate face printr-un repository temporar în directorul temporar al sistemului, copierea `.gitignore` acolo și `git check-ignore --no-index` pe căi sintetice. Nu este necesară citirea unui fișier de mediu real. `.env.example` trebuie să fie permis, iar `.env.local`, `.env.production.local`, `node_modules` și rapoartele generate trebuie ignorate. README-urile, migrațiile și un lockfile ales trebuie să rămână eligibile pentru versionare.

De verificat manual:

- Acceptarea denumirilor `features`, `pantry` și `meal-planner` și a diferenței deliberate față de rutele API existente.
- Acceptarea ownershipului: profil în auth, favorite în recipes, prețuri în nutrition/pricing; fără dublarea feature-urilor anterioare.
- Claritatea granițelor server/client și a porturilor pentru apeluri cross-feature; nicio funcție client nu primește secret key.
- Alegerea package managerului, versiunilor, runnerelor și CI la inițializare, cu justificarea dependențelor.
- Confirmarea mediilor, schedulerului și izolării secretelor înainte de activarea fluxurilor private.

Nu se inițializează aplicația și nu se începe o altă etapă fără cerere separată. Acest arbore reprezintă destinația structurii, nu implementarea funcționalităților sale.
