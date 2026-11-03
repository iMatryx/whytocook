# Căutare rețete — verificare

3 noiembrie 2026. Verificări executate în workspace, Node.js 24.14.0. Nu au fost
folosite credențiale reale și nu a fost aplicată migrația 16 într-un proiect
Supabase live. Testele DB folosesc PostgreSQL efemer prin PGlite.

Prettier pe fișierele etapei și `git diff --check` au trecut. Verificarea globală
`npm run format:check` rămâne eșuată pe 31 fișiere preexistente din afara sarcinii.

| Comandă                                                     | Rezultat real                                                                                           |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `npm test`                                                  | PASS: 103 teste — 28 fundație/UI/shell, 21 securitate, 8 ingrediente, 9 pantry, 20 recipes, 17 matching |
| `npm run test:db`                                           | PASS: 52 teste, inclusiv noul test al snapshotului public/contextului privat                            |
| `npm run test:recipe-search-routes`                         | PASS: 1 test al handlerului compilat, multiple scenarii de acces și validare                            |
| `npm run lint`                                              | PASS, fără avertizări                                                                                   |
| `npm run typecheck`                                         | PASS, Next typegen și TypeScript strict                                                                 |
| `npm run build -- --webpack`                                | PASS, /recipes și /api/v1/recipes/search incluse                                                        |
| `npm run test:e2e -- tests/e2e/recipes.spec.ts --list`      | PASS colectare: 5 scenarii; nu reprezintă execuție Chromium                                             |
| `npm run test:e2e -- tests/e2e/recipes.spec.ts --workers=1` | Blocat înainte de browser: listen EPERM 127.0.0.1:3100                                                  |

După eroarea sandboxului a fost solicitată rerularea cu permisiuni extinse;
aprobarea era încă în așteptare la redactarea raportului. Nu sunt raportate teste
Chromium trecute, capturi vizuale sau verificări cu cititor de ecran. Build-ul a
fost executat explicit cu Webpack; nu se pretinde verificarea Turbopack.

## Acoperire

Cele 7 teste noi de căutare verifică roundtrip/canonicalizare URL, respingerea
scalarilor repetați și parametrilor invalizi, sinonime și diacritice, toate grupele
de filtre, echipamente cu underscore, valori numerice necunoscute și monedă,
sortarea globală după scor înainte de paginare, limitarea paginii și alergii.

Testul SQL aplică toate migrațiile 01–16 și verifică: cele 72 drafturi sunt
invizibile, o rețetă publicată normal este proiectată în contractul Zod, bugetul și
nutriția necunoscute rămân null, contextul privat este refuzat pentru anon, iar
alergiile celor două conturi sunt izolate. Nu este un test de rețea PostgREST live.

Smoke testul de rută invocă handlerul din build în proces. Colecția demo este
reală, providerul Supabase este simulat. Verifică: demo guest fără apeluri upstream,
72 rezultate, excluderea necunoscutelor la protein filter, Origin refuzat, corp
prea mare, obiecte/cantități invalide, private/no-store, păstrarea alergiilor din
profil, citirea stocului contului în locul inventarului fals trimis de client,
409 la schimbarea contului și compatibilitate indisponibilă pentru rețeta legacy
cu ingredient repetat fără oprirea celorlalte rezultate.

Scenariile browser definite acoperă linkuri directe, Apply/reset, refresh,
Back/Forward, paginare, inventar local real din localStorage, dialog/focus,
empty/error/retry, layout mobil, alergii și aria-busy pe eroare de inventar.
Execuția și QA vizuală rămân de făcut într-un mediu cu portul 3100 disponibil.

## Probleme identificate și rezolvate

- Testul SQL a expus o coliziune de coloane id în CTE; proiecția a fost calificată
  și testul a trecut. Typecheck a expus inferența locale:string în fixture, corectată
  prin tipul explicit al snapshotului, fără relaxarea tipurilor.
- Revizuirea independentă a identificat codurile de echipament cu underscore
  respinse de schema generică de slug. Testul a fost observat eșuat înaintea
  corecției și trece după schema dedicată. Metadatele de echipament necunoscute
  nu trec filtrul de echipament disponibil.
- O rețetă publicată legacy cu două linii ale aceluiași ingredient putea invalida
  configurația matching și întregul query. Smoke testul compilat a reprodus HTTP
  503, apoi a trecut cu 200, două rezultate și score null numai pentru acel caz.
- Eroarea inventarului putea rămâne într-un container aria-busy permanent. Starea
  este acum busy numai la încărcarea efectivă; a fost adăugat scenariul browser,
  definit/colectat, dar neexecutat în Chromium.

## Limitări și pași manuali

Migrația 16 trebuie aplicată incremental în local/staging și verificată cu
PostgREST real. Nu există momentan rețete verificate în seed-ul livrat; filtrarea
numerică și alergiile pot produce legitim zero rezultate în demo. Pentru QA cu
date verificate folosește în staging înregistrări și dovezi reale, fără promovarea
în bloc a datelor demonstrative.

Snapshotul public este limitat la 1000 rețete și 4 MiB răspuns; contextul de
inventar la 500 loturi și body la 128 KiB. Nu este o soluție pentru un catalog
nelimitat. Nu există cache personal sau FX. Nu s-au adăugat dependențe ori migrații
retroactive și nu s-au schimbat politicile existente ale frigiderului.

Rulează manual cele 5 scenarii Chromium, apoi verifică mobil/desktop, light/dark,
tabulare și cititor de ecran, două conturi cu cereri întârziate și restricții în
profil. Ghid complet: [SEARCH.md](SEARCH.md). Fișiere: [SEARCH-FILES.md](SEARCH-FILES.md).
Nu a fost începută etapa următoare.
