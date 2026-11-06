# Verificare reală — planificator alimentar

5 noiembrie 2026. Node 24.14.0, dependențele existente. Fără instalări,
commit automat sau aplicarea migrației într-un proiect Supabase live.

| Comandă                                                | Rezultat observat                                                                     |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| `npm test`                                             | 140 teste trecute, 0 eșecuri; include 12 teste planner                                |
| `npm run test:planner`                                 | 12/12 trecute                                                                         |
| `npm run test:db`                                      | 57/57 trecute în PostgreSQL WASM/PGlite, inclusiv 2 teste planner                     |
| `npm run typecheck`                                    | exit 0                                                                                |
| `npm run lint`                                         | exit 0, fără avertismente                                                             |
| `npm run build -- --webpack`                           | exit 0, include pagina și cele trei rute API planner                                  |
| `npm run test:planner-routes`                          | 2/2 trecute pe handlerii compilați                                                    |
| `npm run test:shopping-routes`                         | 2/2 trecute                                                                           |
| `npm run test:pantry-routes`                           | 1/1 trecut                                                                            |
| `npm run test:organization-routes`                     | 2/2 trecute                                                                           |
| `npm run test:recipe-detail-routes`                    | 2/2 trecute                                                                           |
| `npm run test:recipe-search-routes`                    | 1/1 trecut                                                                            |
| `npm run test:e2e -- --list tests/e2e/planner.spec.ts` | 4 scenarii descoperite; nu dovedește execuția lor                                     |
| `npm run test:e2e -- tests/e2e/planner.spec.ts`        | serverul nu a pornit: `listen EPERM 127.0.0.1:3100`; niciun scenariu browser executat |
| `git diff --check`                                     | exit 0                                                                                |

Execuția browser a fost cerută din nou cu permisiune extinsă; solicitarea a rămas
în așteptare. Nu se declară verificare vizuală, accesibilitate browser sau E2E
trecute. Rularea reală a celor patru scenarii și verificările manuale din
[MEAL-PLANNER.md](MEAL-PLANNER.md) rămân necesare.

Formatul fișierelor acestei sarcini a fost verificat separat. Comanda globală
`npm run format:check` rămâne neconformă în 31 fișiere preexistente din UI kit,
configurare și documentația etapelor anterioare; nu au fost reformate în masă.

Testele de model verifică FEFO/expirare, conversii și porții, alocarea unică a
stocului, suprapuneri, nutriție și costuri exacte/necunoscute, calendar UTC,
copiere și schimbarea versiunilor. Testele locale verifică revizii, replay,
păstrarea rândurilor manuale/editate, stocul schimbat și recuperarea jurnalului.
Regresia pentru inventarul schimbat a eșuat înaintea corecției și a trecut după.

Testele API au identificat o incompatibilitate reală între metadatele complete
ale seedului și schema strictă a nutriției plannerului. Adaptorul preia acum doar
câmpurile contractului; cele două teste API trec după corecție. Ele verifică și
ownerul, planul/stocul autoritativ, restricțiile profilului, originul și
invalidarea unei previzualizări schimbate. Apelurile upstream sunt simulate;
nu confirmă conectivitate sau configurare într-un proiect Supabase real.

Testele SQL aplică migrațiile și verifică izolarea A/B, lipsa accesului anonim,
RLS forțat, versiuni retrase/legacy, limita de capacitate, export/reexport atomic,
conflicte pe rânduri bifate/editate și păstrarea inventarului/istoricului.
O revizuire independentă a identificat callbackuri expirate la navigare/copiere;
au fost corectate și reexaminate. Scenariile browser aferente sunt scrise, dar
nu sunt declarate executate în acest mediu.
