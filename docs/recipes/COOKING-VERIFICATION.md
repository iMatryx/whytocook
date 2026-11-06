# Verificări — pagina rețetei și Cooking

Executate local la 2026-11-03, Node 24.14.0, Next.js 16.4.3. Nu s-au folosit
credențiale/secrete reale sau o bază live. PostgreSQL este executat prin PGlite;
handlerii compilați folosesc provider HTTP simulat, datele demo sunt cele reale.

| Comandă                                                             | Rezultat observat                                                                                       |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `npm run lint`                                                      | PASS, zero avertizări/erori                                                                             |
| `npm run typecheck`                                                 | PASS, inclusiv testele Playwright                                                                       |
| `npm test`                                                          | PASS: 111 teste (28 foundation/UI/shell, 21 security, 8 ingredients, 9 pantry, 28 recipes, 17 matching) |
| `npm run test:db`                                                   | PASS: 53 teste, toate migrațiile 01–17 executate în baze izolate                                        |
| `node --test tests/database/recipe-cooking.test.mjs`                | PASS: izolare, foto/timere, replay, rollback, revizii și stoc existent neschimbat                       |
| `npm run build -- --webpack`                                        | PASS, paginile și API-urile compilate                                                                   |
| `npm run test:recipe-detail-routes`                                 | PASS: 2 teste pentru detail/actions                                                                     |
| `npm run test:recipe-search-routes`                                 | PASS: 1 test, inclusiv context autoritativ după extragerea helperului comun                             |
| `npm run test:access-routes`                                        | PASS: 1 test                                                                                            |
| `npm run test:ingredient-routes`                                    | PASS: 1 test                                                                                            |
| `npm run test:pantry-routes`                                        | PASS: 1 test                                                                                            |
| `npm run test:prerender`                                            | PASS: manifest și absența HTML-ului static privat; nu reprezintă test HTTP/browser                      |
| `npm run build`                                                     | BLOCAT în sandbox: port intern Turbopack/PostCSS, `Operation not permitted`                             |
| `npm run test:e2e -- tests/e2e/cooking.spec.ts`                     | BLOCAT înainte de teste: `listen EPERM 127.0.0.1:3100`                                                  |
| `npx --no-install playwright test tests/e2e/cooking.spec.ts --list` | Colectare validă; interacțiunile nu sunt declarate executate                                            |

S-a cerut rularea build-ului implicit și a testelor browser în afara sandboxului,
conform regulilor mediului. În lipsa aprobării, nu sunt prezentate ca trecute.
Build-ul Webpack este alternativa documentată în proiect și nu schimbă scriptul
implicit. Nu necesită portul intern blocat al Turbopack.

`npm run format:check` raportează și fișiere preexistente neformatate în afara
acestei etape (UI kit, configurație, documentație veche). Nu au fost reformate în
masă. Fișierele acestei etape au fost formatate separat; `git diff --check` nu
raportează probleme de whitespace.

## Acoperire nouă

- Conversii kg/g, l/ml, întregi piece, porții, micro-unități, cantități mari și
  refuzul unităților incompatibile/fractionale/notației exponențiale.
- URL cu restricții, parametri repetați/invalizi și sesiune timer coruptă.
- Deadline/pauză/reset, interval suspendat, dublă pornire și ceas mutat înapoi.
- Wake Lock refuzat, cerere rezolvată după unmount, hide/reacquire, dublu enable
  și release întârziat care nu suprascrie starea nouă.
- Stocare guest validată, conflicte între versiuni, replay și protejarea datelor
  corupte. Similaritate deterministă cu excluderi de alergeni/urme/opționale.
- SQL: published/current, anonim fără acțiuni private, două conturi, favorite și
  shopping izolate, shopping batch atomic, replay fără dublare, payload/revizie
  diferite respinse. Stocul real de 300 g și revizia sa rămân neschimbate.
- API: demo real, metadate, porții și disponibil, 404/400/403, no-store,
  autentificare, context schimbat și alergii din profil neeliminabile din body.
- Review independent: corectate revalidarea care închidea Cooking, restricțiile
  proaspete care trebuiau să invalideze dialogurile, sincronizarea favoritelor,
  sesiunea în memorie și păstrarea erorilor de scriere locală.

Cele șapte scenarii Cooking Playwright acoperă navigarea, timerul, focusul,
favorite/shopping/cooked, confirmarea separată a consumului, mobil/erori,
hide/focus/wake lock simulat, fallback în memorie/restricții noi, refresh favorite
și refuzul scrierii în storage. Testele shell au fost adaptate de la placeholder
la pagina reală. Aceste scenarii necesită încă execuție browser cu port permis;
simularea Wake Lock nu înlocuiește verificarea pe dispozitiv real.

Nu s-au aplicat migrații în Supabase live. Fotografia demo nu validează rețeta;
nutriția necunoscută și fotografiile lipsă au stări explicite. Verificările reale
Supabase Auth/PostgREST, ecranul fizic, cititorul de ecran și comportamentul pe
dispozitive sunt pașii manuali din [COOKING.md](COOKING.md).
