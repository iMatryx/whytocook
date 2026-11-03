# Cookly

Motorul determinist de potrivire este disponibil ca serviciu TypeScript, cu
cantități exacte, scor explicabil și alergii ca excluderi. Contractele, integrarea
și limitele sunt în [ghidul matching](docs/matching/MATCHING.md), iar rezultatele
executate în [verificări](docs/matching/VERIFICATION.md).

```sh
npm run test:matching
npm run matching:demo
npm run matching:benchmark
```

Cookly folosește Next.js App Router, React, TypeScript strict, Tailwind CSS,
primitive shadcn/ui și PostgreSQL/Supabase. Sunt implementate fundația, shell-ul,
schema și politicile de acces, autentificarea, profilul, catalogul de ingrediente și frigiderul virtual.
Colecția inițială de rețete, instrumentele de seed și motorul de matching sunt disponibile.
Pagina `/recipes` oferă căutare, filtre avansate, URL partajabil și compatibilitate
cu inventarul. Catalogul publicat și colecția demo explicită rămân separate.
Ghid: [căutare și filtre](docs/recipes/SEARCH.md),
[verificări](docs/recipes/SEARCH-VERIFICATION.md),
[fișiere](docs/recipes/SEARCH-FILES.md).

**Verificare:** rezultatele curente și limitele de execuție sunt în
[raportul seed-ului de rețete](docs/recipes/VERIFICATION.md),
[raportul frigiderului](docs/pantry/VERIFICATION.md), [raportul catalogului](docs/ingredients/VERIFICATION.md) și
[AUTH-VERIFICATION.md](docs/database/AUTH-VERIFICATION.md). Migrațiile și integrarea
cu serviciile Supabase nu sunt încă validate live în acest mediu.

## Cerințe și instalare

Node.js **24.14.0 sau o versiune 24.x ulterioară**, conform `.nvmrc` și `engines`.

Checkoutul actual conține `package-lock.json` și dependențe instalate prin npm. Pentru această etapă am păstrat instalarea și lockfile-ul existente, fără dependențe noi. Pentru reproducerea acestui checkout:

```sh
npm ci
```

Planul inițial prevede pnpm, care nu este disponibil acum în PATH. Reconcilierea managerului/lockfile-ului nu este făcută în etapa de routing. Scripturile individuale pot fi rulate prin `npm run <script>` pe instalarea curentă; comenzile pnpm din tabel rămân disponibile când CLI-ul este configurat. Scriptul agregat `check` folosește încă pnpm intern; în mediul actual rulează verificările individual.

Copiază `.env.example` în `.env.local` la rădăcină. Shell-ul pornește fără credențiale; datele catalogului cer Supabase, iar autentificarea cere și CSRF_SECRET. Nu completa niciodată secrete în fișierul versionat `.env.example`.

```sh
npm run dev
```

Adresă implicită: `http://127.0.0.1:3000`. Un alt port se poate selecta cu `npm run dev -- --port 3001`.

## Scripturi

| Comandă                             | Rol                                                                                 |
| ----------------------------------- | ----------------------------------------------------------------------------------- |
| `pnpm dev`                          | Server local Next.js, legat de loopback                                             |
| `pnpm build`                        | Build de producție, fără ignorarea erorilor TypeScript                              |
| `pnpm start`                        | Server de producție pentru buildul existent                                         |
| `pnpm lint`                         | ESLint Next/TypeScript și reguli locale de import                                   |
| `pnpm typecheck`                    | Generare tipuri Next și `tsc --noEmit`                                              |
| `pnpm format` / `pnpm format:check` | Prettier; documentele istorice de produs/arhitectură sunt păstrate                  |
| `pnpm test`                         | Teste Node pentru mediu și reguli de import                                         |
| `pnpm test:architecture`            | Testele regulii locale de import, fără servicii externe                             |
| `pnpm test:ui`                      | Teste native pentru filtrare, navigare combobox, etichete și contrastul tokenurilor |
| `pnpm test:watch`                   | Aceleași teste, în watch mode                                                       |
| `pnpm test:e2e`                     | Playwright: teme, persistență, hidratare, tastatură și 404                          |
| `pnpm check`                        | Format, lint, typecheck și teste unitare/de arhitectură                             |

Playwright necesită browserul asociat versiunii instalate:

```sh
pnpm exec playwright install chromium
pnpm test:e2e
```

Testele E2E pornesc și opresc propriul server prin npm pe portul 3100. Nu reutilizează un server care ar putea avea altă configurație. `pnpm check` nu include build-ul sau browserul: rulează separat `pnpm build` și `pnpm test:e2e`.

## Mediu și secrete

- `src/config/env/schema.ts`: scheme Zod pure, erori cu numele variabilelor, fără valorile lor.
- `client.ts`: acces static numai la `NEXT_PUBLIC_SUPABASE_URL` și `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Ambele sunt goale sau configurate împreună; cheile privilegiate nu sunt acceptate ca publicabile.
- `server.ts`: configurația server și validare separată pentru integrarea Supabase sau viitoare mutații CSRF. Niciuna nu cere implicit cheia administrativă.
- `maintenance.ts`: validator server-only pentru viitorul executor, cu secrete distincte; executorul nu este implementat.

În producție sunt necesare `COOKLY_ENV=production` (sau `preview`) și `APP_BASE_URL` cu originea HTTPS reală. Nu folosi configurația development din exemplu la `pnpm start`. Pagina este randată dinamic și validează configurația server la cerere; build-ul nu contactează Supabase și nu cere cheile de mentenanță. Pentru un smoke local de producție se poate utiliza o origine HTTPS de test fără a o accesa în rețea, dar aceasta trebuie înlocuită la deployment.

`.env*` reale sunt ignorate. Configurația publică este inclusă la build și cere rebuild când se schimbă. Nu sunt acceptate implicit chei JWT legacy Supabase; se folosesc cheile moderne publicabile/secret, iar integrarea Auth/profil folosește numai cheia publicabilă și JWT-ul utilizatorului.

## Structură și convenții active

```text
src/
  app/                     root providers, (shell) pentru rute și /ui-kit separat
  components/layout/       cadru RSC și insule client de navigare
  components/theme/        provider și selector light/dark/system
  components/ui/button.tsx primitivă shadcn adaptată local
  config/env/              scheme și adaptoare de configurare
  shared/presentation/     cn pentru compunerea claselor
  styles/globals.css       Tailwind 4, tokenuri light/dark și focus
tooling/eslint/             regula locală de import și integrarea ESLint
tests/architecture/         teste native ale regulii de import
tests/e2e/                  smoke tests Playwright
```

Aliasul `@/*` indică `src/*`. `components.json` configurează shadcn pentru această structură. Se folosesc fonturi de sistem, fără descărcări de fonturi în build. `next-themes` păstrează preferința în `cookly-theme` și urmărește sistemul; selectorul devine activ după hidratare.

Regula ESLint locală verifică importuri/reexporturi statice și importuri dinamice literale: aliasuri și căi relative normalizate, contractele cross-feature după DAG, separarea browser/server și a straturilor. Nu este un analizor complet de graf/cicluri și nu înlocuiește `server-only`, autorizarea sau RLS. Nu sunt create anticipat directoare de features.

## Shell și routing

Rutele sunt `/`, `/recipes`, `/recipes/[recipeId]`, `/ingredients`, `/my-fridge`, `/meal-planner`, `/shopping-list`, `/favorites`, `/assistant`, `/profile`, `/login` și `/admin`. `/recipes/demo` este un placeholder de detaliu, nu o rețetă încărcată. `/ui-kit` își păstrează layoutul separat.

Route group-ul `(shell)` oferă header, sidebar desktop, drawer mobil, footer, breadcrumbs și loading/error/404. Paginile sunt Server Components; insulele client gestionează pathname, focusul și tema. Login și profilul sunt funcționale după configurarea Supabase; profilul și celelalte rute private sunt protejate server-side, iar admin cere rol și MFA.

```sh
npm test
npm run lint
npm run typecheck
npm run build -- --webpack
npm run test:prerender
npm run test:e2e -- --workers=1
```

`test:prerender` verifică HTML-ul unui build existent, fără a pretinde testare HTTP. Webpack permite buildul în sandboxul care blochează portul intern Turbopack; scriptul implicit de build rămâne neschimbat. Detalii: [routing și limite](docs/architecture/SHELL-ROUTING.md), [rezultate reale](docs/architecture/SHELL-VERIFICATION.md).

## Documentație

- [PRD](docs/product/PRD-Cookly.md)
- [README arhitectură](docs/architecture/README.md)
- [Arhitectură completă](docs/architecture/ARCHITECTURE-Cookly.md)
- [Structura țintă și convenții](docs/architecture/PROJECT-STRUCTURE.md)
- [Planul fundației](docs/architecture/SETUP-PLAN.md)
- [Verificări și limitări reale](docs/architecture/SETUP-VERIFICATION.md)
- [Design system: tokenuri, props și exemple](docs/design/DESIGN-SYSTEM.md)
- [Verificările UI kitului](docs/design/UI-KIT-VERIFICATION.md)
- [Shell și routing](docs/architecture/SHELL-ROUTING.md)
- [Verificările shell-ului](docs/architecture/SHELL-VERIFICATION.md)

## Design system și UI kit

Galeria `/ui-kit` demonstrează butoane, câmpuri, combobox, tag/chip, compatibilitate, carduri de rețete, modal/drawer, toast, skeleton, empty/error states și navigare responsive. Are `noindex`, folosește date fictive și păstrează interacțiunile numai în memoria paginii. Pagina principală existentă este păstrată.

Componentele sunt în `src/components/{ui,feedback,layout,recipes}`; pagina de prezentare este în `components/design-system`. Tokenurile semantice light/dark sunt în `src/styles/globals.css`. Acest kit adaugă Radix Dialog pentru focus/dismiss modal, Radix Popover pentru sugestii poziționate și Sonner pentru toast; nu adaugă un motor de matching sau dependențe de features. Detaliile API și limitele accesibilității sunt în documentul de design.

Verificare disponibilă fără instalarea dependențelor:

```sh
node --test tests/ui-kit/*.test.* tests/architecture/import-boundaries.test.mjs
```

Raportul etapei UI kit a înregistrat 14 teste trecute; fundația are 28 teste, iar autentificarea adaugă teste de securitate în npm test; rezultatele curente sunt în raportul Auth. Acesta nu include testele browser. Testele Playwright pentru UI kit sunt definite în `tests/e2e/ui-kit.spec.ts`, dar nu sunt încă executate.

Runnerul nativ Node înlocuiește propunerea opțională Vitest numai pentru testele acestei fundații; Playwright rămâne verificarea în browser. Documentele istorice nu pretind că toate fișierele arborelui țintă sunt deja implementate.

## Verificare manuală

După verificările executabile: schimbă tema, reîncarcă pagina, selectează Sistem și schimbă preferința OS; verifică mobil/desktop și absența erorilor de hidratare. Navighează doar cu tastatura, inclusiv linkul „Sari la conținut”, și verifică focusul vizibil. Evaluează separat cititorul de ecran și contrastul. Autentificarea/profilul necesită stackul Supabase configurat; matchingul și celelalte fluxuri de business rămân sarcini separate.

Nu începe o altă etapă fără cerere separată.

## Schema bazei de date — etapa 3

Schema este în `supabase/migrations/`: tabele private, rețete versionate,
unități/porții/substituții, date personale cu FK compuse pe proprietar și acces
controlat prin RLS, RPC-uri restrânse și integrarea Auth/profil descrisă mai jos.

- [Schema, ERD și fiecare relație](docs/database/SCHEMA.md)
- [Rezultatele verificării și limite](docs/database/VERIFICATION.md)
- [Planul acestei sarcini](docs/architecture/DATABASE-PLAN.md)

`npm run test:db` rulează teste PostgreSQL în memorie prin PGlite, exclusiv pentru
dezvoltare. Nu utilizează URL-uri, credențiale sau o bază conectată. Fixture-ul
`tests/database/bootstrap.sql` este numai pentru această bază izolată, niciodată
pentru Supabase. Comenzile de aplicare manuală a migrațiilor sunt în documentul
schemei; nu pornesc automat la build sau la pornirea aplicației.

## Autentificare și profil — etapa 3

Înregistrare, login/logout, confirmare e-mail, recuperare/resetare, cookie persistent
HttpOnly, refresh și protecție server pentru rutele private. Căutarea /recipes
rămâne publică. Profilul păstrează limbă, buget **per masă pentru toate persoanele**,
monedă, dietă, alergeni, echipamente și numărul de persoane. MFA TOTP susține accesul
editorial AAL2. Nu există service role key în codul client sau în fluxurile web.

- [Configurare Auth și profil](docs/database/AUTH-PROFILE.md)
- [RLS, Storage și acces](docs/database/SUPABASE-SECURITY.md)
- [Verificări reale și pași manuali](docs/database/AUTH-VERIFICATION.md)
- [Fișiere create/modificate](docs/database/ACCESS-AUTH-FILES.md)

Config local versionat: `supabase/config.toml`. Pornește Docker și CLI, aplică toate
migrațiile înaintea folosirii Auth și copiază în `.env.local` numai URL-ul API și
cheia publishable a stackului. Generează CSRF_SECRET local, separat de alte secrete;
APP_BASE_URL trebuie să coincidă exact cu originea browserului. Nu copia toate
cheile afișate de CLI în configurația web. Pentru hosted, configurează și template-urile
email, Site URL și redirecturile conform documentației, fără a folosi un reset de DB.

```sh
npm test
npm run test:db
npm run lint
npm run typecheck
npm run build -- --webpack
npm run test:prerender
npm run test:access-routes
npm run test:e2e
```

`test:prerender` verifică acum manifestul și absența HTML-ului privat static:
headerul cu sesiune face rutele dinamice. `test:access-routes` invocă handlerii
compilați în proces cu un provider HTTP de test; nu reprezintă integrare HTTP live.

## Catalog de ingrediente — etapa 4

Catalog public `/ingredients`: 32 identități editoriale, aliasuri RO/RU/EN,
căutare fără diacritice, prefixe și sinonime explicite, autocomplete și paginare
keyset. Ingredientele generale și specifice au UUID-uri distincte. Nu se presupun
substituții sau conversii între bucăți, masă și volum. Seed-ul nu include cifre
nutriționale neverificate; API-ul poate publica date verificate cu proveniență.

- [API, model, configurare și verificare manuală](docs/ingredients/CATALOG.md)
- [Rezultate reale și limitări](docs/ingredients/VERIFICATION.md)
- [Fișiere create/modificate](docs/ingredients/FILES.md)

Aplică migrațiile noi 09–11 după cele existente. Nu sunt aplicate automat de build.
`npm test` include testele catalogului; `npm run test:ingredient-routes` verifică
handlerii compilați după build. Testele SQL cer PGlite, iar cele Playwright cer
Chromium și permisiunea de a porni serverul local; vezi raportul acestei etape.

## Frigider virtual — etapa 4

`/my-fridge` este public: inventar local pentru invitați și inventar propriu în
PostgreSQL pentru conturi verificate. Include loturi separate, CRUD, autocomplete,
categorii, filtre/sortare, expirare și conversii exacte g/kg, ml/l. Cantitatea
necunoscută este distinctă de zero. „Am gătit” arată un preview și scade cantitățile
numai la confirmare, atomic și fără dublare la retry. Inventarele guest și cont
rămân separate; nu există import automat sau coadă offline pentru cont.

- [Comportament, API, securitate și configurare](docs/pantry/MY-FRIDGE.md)
- [Rezultate reale și limitări](docs/pantry/VERIFICATION.md)
- [Fișiere create/modificate](docs/pantry/FILES.md)

Migrația 12 se aplică după cele existente. `npm test` include testele pantry;
`npm run test:pantry-routes` invocă handlerii după build. PGlite 0.5.14 este folosit
numai de testele SQL izolate și este acum instalat în devDependencies. Nu s-au
adăugat dependențe runtime pentru acest modul.

## Bază inițială de rețete — etapa 4

72 rețete originale demonstrative, în grupele mic dejun/prânz/cină/desert, cu
63 clasificări vegetariene și 22 candidate high-protein. Rețetele verificate sunt
separate într-un fișier inițial gol. Nutriția și prețurile necunoscute rămân null,
cu raport explicit; seed-ul rămâne draft și nu publică rețete demonstrative.

JSON cu validare Zod, referințe canonice, import→SQL atomic/idempotent, export
inclusiv din DB prin funcție de mentenanță, verificare de drift și raport cu
zero erori/310 avertizări. Migrațiile 13–15 extind schema existentă fără a modifica
01–12. Sunt 24 ingrediente noi explicite, fără substituții sau conversii inventate.

- [Contract, schemă, surse, import/export și pași manuali](docs/recipes/INITIAL-COLLECTION.md)
- [Raport de completitudine](docs/recipes/COMPLETENESS.json)
- [Verificările executate](docs/recipes/VERIFICATION.md)
- [Fișierele acestei sarcini](docs/recipes/FILES.md)

```sh
npm run recipes:check
npm run recipes:validate -- --input data/recipes/demonstration.v1.json
npm run test:recipes
npm run test:db
```

Instrumentele CLI nu aplică SQL și nu accesează secrete sau servicii externe.
Nu există UI nou sau integrare matching în această sarcină.
