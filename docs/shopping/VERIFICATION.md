# Verificări — lista inteligentă

Executate local la 2026-11-05, Node 24.14.0 și Next.js 16.4.3. Nu s-au adăugat
dependențe sau secrete și nu s-a aplicat SQL unui mediu live.

| Comandă                                                              | Rezultat real                                                                                                                       |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `npm run test:shopping`                                              | PASS, 10 teste pentru calcul, prețuri, guest și recuperare                                                                          |
| `npm test`                                                           | PASS, 128 teste: 28 foundation/UI/shell, 21 security, 8 ingredients, 9 pantry, 28 recipes, 17 matching, 7 organization, 10 shopping |
| `npm run test:db`                                                    | PASS, 55 teste PostgreSQL în PGlite, cu migrațiile 01–19                                                                            |
| `node --test tests/database/shopping.test.mjs`                       | PASS, integrarea SQL și tranzacțiile shopping/pantry                                                                                |
| `npm run test:shopping-routes`                                       | PASS, 2 teste pe handlerii compilați                                                                                                |
| `npm run test:recipe-detail-routes`                                  | PASS, 2 teste de regresie                                                                                                           |
| `npm run test:pantry-routes`                                         | PASS, 1 test de regresie                                                                                                            |
| `npm run test:organization-routes`                                   | PASS, 2 teste de regresie                                                                                                           |
| `npm run lint`                                                       | PASS, zero erori/avertizări                                                                                                         |
| `npm run typecheck`                                                  | PASS                                                                                                                                |
| `npm run build -- --webpack`                                         | PASS, producție, pagină și ambele rute API shopping                                                                                 |
| `npm run test:prerender`                                             | PASS, manifest și absența HTML-ului static privat; nu este verificare HTTP/browser                                                  |
| `npm run test:e2e -- tests/e2e/shopping.spec.ts`                     | BLOCAT înainte de teste: `listen EPERM 127.0.0.1:3100`                                                                              |
| `npx --no-install playwright test tests/e2e/shopping.spec.ts --list` | PASS, 3 scenarii colectate; nu sunt declarate executate                                                                             |
| `npm run format:check`                                               | FAIL pe 31 fișiere preexistente, în afara acestei etape                                                                             |
| `git diff --check`                                                   | PASS                                                                                                                                |

Fișierele acestei etape au fost formatate separat. Nu s-au reformatat în masă
UI kitul/configurația veche. Pentru testele browser s-a solicitat permisiunea de
a porni serverul în afara sandboxului, conform regulilor mediului după refuzul
portului local; cererea este în așteptare. Build-ul Webpack este alternativa
documentată în proiect și nu schimbă scriptul implicit de build.

## Acoperire și dovezi

- Două rețete cu 500 g fiecare și stoc de 600 g generează 400 g de cumpărat:
  disponibilul se scade o singură dată din suma rețetelor.
- Porții, pieces rotunjite conservator, opționale, loturi expirate/necunoscute și
  dimensiuni incompatibile. Unitățile fără echivalență verificată sunt refuzate.
- Merge g/kg și l/ml fără pierdere de precizie; fallback la unitatea de bază când
  unitatea existentă ar rotunji. Rânduri incerte, bifate sau libere separate.
- Bani întregi, rotunjire în sus la ban, MDL/RON separate, prețuri absente, vechi,
  viitoare și incompatibile. Prețul explicit nou nu se pierde la comasare.
- Guest: import Cooking o singură dată, fără pierderea favoritelor; eliminările
  nu reapar. JSON corupt este păstrat. Transfer întrerupt după scrierea pantry
  este recuperat fără loturi duplicate; modificările ulterioare ale stocului
  opresc recuperarea și nu sunt suprascrise. Catalogul curent este reverificat.
- SQL real: anon fără acces privat, doi actori izolați prin RLS, rânduri Cooking
  existente, categorii canonice, revizii, prețuri invalide, unități istorice,
  condiția checked și transferuri all-or-nothing. Eșecul unui al doilea rând nu
  creează primul lot; replay nu creează alte loturi. Rândurile transferate sunt
  protejate. Depășirea exactei limite de 500 anulează append-ul; catalogul peste
  1000 produce eroare, fără trunchiere silențioasă.
- API compilat cu provider simulat: demo real, deficit 150 g din necesar 200 g și
  stoc guest 50 g, Origin/body/schema, mutații guest refuzate, cont schimbat,
  alergii din profil și inventar cont autoritativ. Un stoc client falsificat de
  10.000 kg nu înlocuiește stocul gol citit din contextul PostgreSQL al contului.

Review-ul independent a confirmat două probleme reale, reproduse prin teste
RED→GREEN: pierderea prețului nou la merge și încrederea în metadatele guest vechi
la transfer. Ambele au fost corectate în modelele comune/SQL și adaptorul local;
review-ul final a confirmat corecțiile. Observația inițială despre limita de 500
a fost retrasă: snapshotul ridică eroare în aceeași tranzacție și produce rollback.

## Ce rămâne de verificat manual

Scenariile Playwright scrise acoperă selecție multiplă, preview fără scriere,
preț introdus, categorii, bifare, text de partajat, transfer numai după confirmare,
persistență, mobil și storage corupt. Continuarea a adăugat și scenariul schimbării contului înainte de transfer: nicio scriere în contul nou sau în storage guest și anularea confirmărilor vechi. TypeScript și colectarea celor trei scenarii au trecut; execuția necesită încă server permis.
Nu au fost efectuate capturi de ecran și nu se declară verificat layout-ul în browser.

PGlite nu validează serviciile Supabase Auth/PostgREST live. Aplică migrația 19 în
dezvoltare/staging și verifică două conturi, sesiuni/revizii schimbate, Share/Clipboard,
focusul dialogurilor, cititorul de ecran și mobilul. Pașii sunt în
[SMART-SHOPPING.md](SMART-SHOPPING.md).

Limite deliberate: prețuri introduse, fără feed sau FX; partajare text fără link
public; calcule independente fără rezervarea inventarului între mese; maximum
500 rânduri, 20 rețete într-un calcul și 50 rânduri într-un transfer. Guest are
limita de replay a ultimelor 100 operații și un jurnal de recuperare, fără a
pretinde tranzacții native pe două chei localStorage. Nu s-a început altă etapă.

La continuarea cerută de utilizator, solicitarea veche de execuție externă a fost
anulată fiind încă în așteptare și comanda Playwright a fost relansată cu cerere
nouă. Nu există încă rezultat de execuție browser. Chromium compatibil este
prezent în cache; blocajul observat rămâne accesul la serverul local din sandbox.
