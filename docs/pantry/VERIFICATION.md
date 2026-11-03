# My Fridge — verificare

2 noiembrie 2026, Node.js 24.14.0, npm și PGlite 0.5.14 instalat în checkout.
Nu au fost utilizate credențiale reale în teste și nu au fost aplicate migrații
pe un proiect Supabase local/hosted. SQL-ul rulează într-o bază efemeră separată.

| Comandă executată                                          | Rezultat real                                                                |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `npm test`                                                 | PASS: 28 fundație/UI/shell + 21 securitate + 8 catalog + 9 pantry = 66 teste |
| `npm run test:db`                                          | PASS: 41 teste, inclusiv scenariile părinte și subtestele, zero eșecuri      |
| `npm run lint`                                             | PASS, zero warnings                                                          |
| `npm run typecheck`                                        | PASS, Next typegen și tsc strict                                             |
| `npm run build -- --webpack`                               | PASS, `/my-fridge` și `/api/v1/pantry` incluse                               |
| `npm run test:pantry-routes`                               | PASS: 1 test al handlerilor compilați, inclusiv schimbarea contului          |
| `npm run test:access-routes`                               | PASS: 1 test de regresie Auth/roluri                                         |
| `npm run test:ingredient-routes`                           | PASS: 1 test de regresie catalog public                                      |
| `npm run test:prerender`                                   | PASS: verificări manifest/absență HTML privat static pentru 9 rute           |
| `npm run test:e2e -- tests/e2e/pantry.spec.ts --list`      | PASS colectare: 6 teste; nu este execuție Chromium                           |
| `npm run test:e2e -- tests/e2e/pantry.spec.ts --workers=1` | Blocat înainte de browser: `listen EPERM 127.0.0.1:3100`                     |

Build-ul verificat folosește explicit Webpack; nu este raportat un rezultat pentru
Turbopack. Testele de rută invocă handlerii construiți în proces și simulează
providerul HTTP; nu sunt teste de rețea PostgREST sau Supabase live.

## Ce este acoperit

Testele native execută codul real pentru aritmetică exactă, conversii și refuzul
rotunjirii, bucăți fracționare, date/expirare, `null` versus zero, filtre/sortare,
loturi distincte, stale revisions, preview fără efecte, consum confirmat, replay,
date locale corupte, stocare indisponibilă și conflict cu o altă valoare locală.
Un lot retras își păstrează unitatea la editarea metadatelor.

Testul SQL My Fridge aplică toate migrațiile 01–12 și verifică anon, doi utilizatori,
citire proprie, refuzul editării/ștergerii/consumului altui cont, confirmare obligatorie,
rollback pentru un lot invalid, cantitate insuficientă, unități incompatibile,
revizie veche, retry idempotent, update/delete și cont dezactivat. Suitele SQL
istorice de schemă, Auth/RLS/Storage și catalog au trecut în aceeași comandă.

Smoke testul HTTP verifică identitate, Origin, input strict, corp prea mare,
ownerId upstream neașteptat, private/no-store, requestId și 400/401/403/404/409/503
fără diagnostic SQL. Testul de service pentru un formular al contului X folosit
după autentificarea în Y a fost observat RED→GREEN: comanda este refuzată înainte
de repository. Smoke-ul compilat confirmă `409 SESSION_CHANGED` pentru același caz.

## Probleme găsite și corectate

- Testul istoric DELETE RESTRICT aștepta exclusiv SQLSTATE 23503. Motorul instalat
  a returnat 23001 (RESTRICT violation), iar ștergerea era deja corect blocată.
  Testul acceptă numai cele două coduri de integritate pentru cele două DELETE-uri;
  schema și constrângerile nu au fost slăbite. Baseline-ul eșuat și rularea verde
  după corecție au fost observate efectiv.
- Testele SQL noi au identificat o coliziune de nume între variabile PL/pgSQL și
  coloane. Migrația nouă folosește calificarea explicită a variabilelor; suitele trec.
- Unitatea unui lot existent putea cădea implicit pe prima unitate din catalog.
  Testele native/SQL de retragere a ingredientului au fost RED→GREEN; cantitatea
  nu mai este reinterpretată la editarea datei sau depozitării.
- Revizuirea independentă a identificat formularul stale după schimbarea contului
  într-o altă filă. Clientul păstrează contextul dialogului, revalidează la focus,
  ignoră răspunsurile vechi și recitește după un commit concurent cu refresh-ul.
  Serverul verifică expectedAccountId față de actorul real. Testele de service și
  handler compilat trec; scenariile de browser sunt definite, dar încă neexecutate.

Revizuirea nu a găsit alte blocaje în SQL/RLS, CSRF, precizie, atomicitate sau replay.
Aceasta nu echivalează cu un audit complet sau cu integrare Supabase reală.

## Limite și verificare rămasă

Restricția asupra portului a persistat și după aprobarea din conversație; execuția
extinsă nu a produs rezultate. Nu sunt raportate teste Chromium trecute sau
capturi vizuale. Pentru verificarea în terminalul utilizatorului:

```sh
npm run test:e2e -- tests/e2e/pantry.spec.ts --workers=1
```

Cele șase scenarii cu stubs API acoperă CRUD/persistență guest, conversie în
formular, filtre/ștergere confirmată, preview/anulare/confirmare, coruperea datelor,
conflict de cont fără copie locală, schimbare de cont cu formular deschis și
răspuns vechi după încărcarea altui cont. Pentru rulare sunt necesare Chromium
instalat și portul 3100 liber. Ele nu înlocuiesc testarea cu sesiuni Supabase reale.

Rămân manuale: aplicarea migrației 12 în staging/local Supabase, cele două conturi,
sincronizarea între dispozitive, conflictele între file, expirarea sesiunii,
mobil/light/dark, cititorul de ecran și planuri SQL pe volum realist. Nu există
benchmarkuri, import automat guest→cont, coadă offline, densități, conversii de
bucăți în grame sau integrare automată cu rețete. Fără Web Locks, atomicitatea
guest între file care scriu simultan nu poate fi garantată; vezi [MY-FRIDGE.md](MY-FRIDGE.md).

## Fișiere și integritate

Lista completă este în [FILES.md](FILES.md). Migrațiile 01–11 și fișierele Auth
funcționale sunt păstrate. `package-lock.json` și dependența PGlite provin din
instalarea utilizatorului, existentă înaintea acestei sarcini; nu au fost rescrise.
În package.json au fost adăugate doar scripturile pantry și integrarea în npm test.
Nu s-a făcut commit/deploy și nu s-a început etapa următoare.
