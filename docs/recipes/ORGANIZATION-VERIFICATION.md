# Verificări — favorite, colecții și istoric

Executate local la 2026-11-04, Node 24.14.0, Next.js 16.4.3. Nu s-au adăugat
dependențe și nu s-au aplicat migrații unei baze live. S-a continuat codul necomis
existent în workspace, păstrând modificările Cooking din etapa anterioară.

| Comandă                                                                  | Rezultat real                                                                                                          |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `npm run test:organization`                                              | PASS, 7 teste locale                                                                                                   |
| `npm test`                                                               | PASS, 118 teste: 28 foundation/UI/shell, 21 security, 8 ingredients, 9 pantry, 28 recipes, 17 matching, 7 organization |
| `npm run test:db`                                                        | PASS, 54 teste PostgreSQL prin PGlite, migrațiile 01–18                                                                |
| `node --test tests/database/organization.test.mjs`                       | PASS, integrare SQL pentru organizare, backfill și izolare                                                             |
| `npm run lint`                                                           | PASS, zero erori/avertizări                                                                                            |
| `npm run typecheck`                                                      | PASS, inclusiv scenariile Playwright                                                                                   |
| `npm run build -- --webpack`                                             | PASS, producție, ruta `/favorites` și noul API compilate                                                               |
| `npm run test:organization-routes`                                       | PASS, 2 teste pe handlerii compilați                                                                                   |
| `npm run test:recipe-detail-routes`                                      | PASS, 2 teste de regresie                                                                                              |
| `npm run test:recipe-search-routes`                                      | PASS, 1 test de regresie                                                                                               |
| `npm run test:prerender`                                                 | PASS, rute dinamice și absența HTML-ului static privat; verificare de manifest, nu browser                             |
| `npm run test:e2e -- tests/e2e/organization.spec.ts`                     | BLOCAT înaintea testelor: `listen EPERM 127.0.0.1:3100`                                                                |
| `npx --no-install playwright test tests/e2e/organization.spec.ts --list` | PASS, 6 scenarii colectate; nu sunt declarate executate                                                                |
| `npm run format:check`                                                   | FAIL pe 31 fișiere preexistente, în afara etapei; fișierele organizării sunt formatate separat                         |
| `git diff --check`                                                       | PASS, fără probleme de whitespace                                                                                      |

S-a solicitat permisiunea pentru testele browser în afara sandboxului, deoarece
regulile mediului cer escaladare după refuzul portului local. Cererea este în
așteptare; rezultatele browser nu sunt presupuse. Build-ul folosește opțiunea
Webpack deja documentată în proiect, fără modificarea scriptului implicit.

## Ce a fost verificat

- Compatibilitate cu stocarea v1 fără colecții: favoritele, cumpărăturile și
  preparările existente sunt păstrate. Colecțiile nu sunt șterse la eliminarea
  favoritelor. Scrierile stale și datele corupte nu înlocuiesc stocarea.
- Unicitate a numelor normalizate și a membrilor. Teste RED→GREEN pentru nume
  Unicode echivalente, spații Unicode în SQL și redenumire după ștergere.
  Crearea identică retrimisă păstrează membrii; redenumirea țintei dispărute
  eșuează și nu recreează o colecție goală.
- SQL executat efectiv: utilizatorii A/B nu își pot accesa colecțiile, ID-ul
  altui cont nu poate fi preluat, tabelele private nu sunt expuse direct și
  anonimii nu pot apela RPC-urile private. Rețetele retrase rămân eliminabile,
  fără expunerea titlurilor versiunilor retrase.
- Preparările din migrația 17 sunt preluate prin backfill în 18; cele noi sunt
  înregistrate prin trigger. Istoricul afișează maximum 100, dar clear șterge
  toate rândurile proprii. Retry-ul unei operații Cooking șterse nu o recreează.
  Favoritele și colecțiile rămân intacte.
- API compilat cu date externe simulate: GET guest fără provider, no-store și
  Vary, Origin, JSON, limită body, expectedAccountId, sesiuni schimbate/expirate,
  owner derivat pe server și erori SQL mascate cu mesaje utile pentru colecții.
- Review independent al stocării/RLS/integrării. Problema confirmată a
  redenumirii învechite a fost corectată și verificată; review-ul final nu a
  identificat alte blocaje de cod.

Scenariile browser scrise acoperă persistența invitatului pe mobil, favorite,
colecții și istoric independente, JSON local corupt, retry, cont schimbat fără
scriere guest, API/origin/no-store, anularea confirmării istoricului la schimbarea
contului, redenumire, nume duplicat și dialogul de ștergere/Escape/focus.
Testul Auth anterior care cerea login pentru `/favorites` a fost adaptat la
cerința nouă de acces pentru invitați.

## Limite și verificări rămase

Interacțiunile browser, layout-ul efectiv la zoom/cititor de ecran și două conturi
Supabase reale necesită verificare în dezvoltare/staging cu migrația 18 aplicată.
PGlite testează PostgreSQL și politicile, nu serviciile Supabase Auth/PostgREST.
Lista de pași manuali și inventarul fișierelor sunt în [ORGANIZATION.md](ORGANIZATION.md).

Istoricul vizibil este șters; registrul tehnic de operații Cooking rămâne pentru
idempotency, inclusiv metadatele operațiilor. Local, garanția de replay acoperă
ultimele 100 operații reținute. Guest are ultimele 100 preparări, 500 favorite și
50 colecții × 500 membri. Nu există import automat în cont sau paginare a UI-ului.
Titlurile guest vechi sunt derivate din slug. Volumul RPC este limitat la 4 MiB;
un snapshot foarte mare produce eroare explicită. Nu s-a început altă etapă.
