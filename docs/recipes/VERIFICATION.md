# Colecția inițială — verificare

3 noiembrie 2026. Verificările au fost rulate pe implementarea existentă în
workspace, cu testele extinse în această continuare. Nu au fost folosite
credențiale reale și nu au fost aplicate migrații într-un proiect Supabase real.

## Rezultate executate

| Comandă                      | Rezultat                                                                                              |
| ---------------------------- | ----------------------------------------------------------------------------------------------------- |
| `npm test`                   | PASS: 79 teste — 28 fundație/UI/shell, 21 securitate, 8 ingrediente, 9 pantry, 13 rețete              |
| `npm run test:db`            | PASS: 51 teste, inclusiv testele părinte; 10 pentru seed-ul de rețete                                 |
| `npm run recipes:check`      | PASS: 72 demonstrative, 0 verificate, SQL și raport reproductibile                                    |
| `npm run lint`               | PASS, fără avertizări                                                                                 |
| `npm run typecheck`          | PASS, Next typegen și TypeScript strict                                                               |
| `npm run build -- --webpack` | PASS, build de producție                                                                              |
| `npm run format:check`       | FAIL: 31 fișiere din afara sarcinii. Inițial erau 33; cele două fișiere ale etapei au fost formatate. |

Build-ul a fost verificat explicit cu Webpack. Nu este raportat un rezultat
pentru Turbopack. PGlite execută SQL-ul într-un PostgreSQL efemer și încarcă toate
migrațiile 01–15; nu reprezintă un test PostgREST/Auth/Storage într-un Supabase real.

## Datele livrate

| Grup                   | Număr |
| ---------------------- | ----: |
| Mic dejun              |    12 |
| Prânz                  |    20 |
| Cină                   |    24 |
| Desert                 |    16 |
| Vegetarian             |    63 |
| Candidate high-protein |    22 |
| Total distinct         |    72 |

Grupele vegetarian și high-protein se suprapun cu mesele. Raportul include
72 avertizări de nutriție indisponibilă, 72 de alergeni neverificați, 72 de
verificare culinară necesară, 72 de buget neverificat și 22 de high-protein
neverificat: 310 avertizări, zero erori. Modul `--strict` respinge intenționat
colecția demonstrativă. Nicio valoare nutritivă sau sumă de bani nu a fost inventată.

## Acoperire

Testele verifică cantități pozitive, unități canonice permise, bucăți întregi,
referințe și chei duplicate, date incomplete, surse și statut coerent, pragul
high-protein, export/import JSON fără pierderi, fișiere invalide și inexistente,
limita de 8 MiB, raportul pe disc și stdout și refuzul suprascrierii artefactelor.
Starea goală are `EMPTY_COLLECTION`; progresul și erorile sunt în CLI. Nu a fost
adăugat un ecran nou care să necesite skeleton sau empty state vizual.

Testele SQL verifică toate cele 72 înregistrări, accesul anonim refuzat, drafturi
invizibile public, retry idempotent, conflict pe aceeași revizie, revizii noi,
rollback pe întregul bundle, refuzul publicării datelor demonstrative și
imutabilitatea conținutului. Testele cu dovezi nutritive sintetice rulează numai
ca fixtures și sunt anulate prin rollback; nu ajung în colecția livrată.

Testul suplimentar de mutare a conținutului importat a trecut de la prima rulare:
protecția era deja asigurată de `guard_recipe_content`. Nu se pretinde o corecție
SQL sau un ciclu RED→GREEN pentru acest caz.

## Corecții din revizuirea independentă

- Zod elimina spațiile de la marginile textelor, ceea ce schimba hash-ul după
  export SQL și revalidare. Testul SQL a eșuat pe diferența de titlu înaintea
  corecției, apoi a trecut cu textul exact și reimport `imported: 0, skipped: 1`.
- Un URL cu port nenumeric arunca `TypeError` din interiorul `safeParse`, în loc
  să producă raport. Testul a reprodus excepția, apoi a trecut după validarea fără
  transformări și fără constructor URL care poate arunca.
- SQL accepta URL-uri cu port invalid/depășit, IPv4 invalid și text alcătuit numai
  din tab/newline/NBSP. Testele au reprodus lipsa refuzului înainte de completarea
  controalelor. SQL folosește acum aceeași listă de spații Unicode ca `trim` din JS
  și verifică formatul hostului, IPv4 și portul. Limitele de lungime includ și
  spațiile păstrate, astfel încât validarea nu produce texte prea lungi pentru DB.

După corecții, revizuirea focalizată nu a mai identificat probleme materiale;
suita completă, verificarea SQL și build-ul au fost rerulate cu succes. Migrația
13 este nouă și neaplicată în acest workspace; pentru un mediu în care ar fi
deja aplicată, corecțiile trebuie livrate ca migrație nouă, fără rescrierea istoricului.

## Limite și verificări manuale

- Rețetele sunt propuneri demonstrative: timpii, porțiile și pașii nu au fost
  validați prin gătire de probă. Ingredientele economice reprezintă o intenție
  editorială; nu sunt certificate prețuri locale MDL/RON.
- Nutriția și sursa ei sunt explicit indisponibile. Colecția verificată rămâne
  goală până la revizie umană cu dovezi și surse. Listele de alergeni sunt orientative.
- Aplică incremental migrațiile 13–15 în Supabase local/staging și verifică
  reimportul, exportul, permisiunile și păstrarea versiunii publicate la revizie nouă.
- Verifică practic rețetele, etichetele produselor, alergenii, porțiile, temperaturile,
  sursele și licențele înainte de promovare la `verified`.
- Nu sunt incluse UI de rețete, matching, calcule nutritive automate, prețuri live,
  import CSV sau integrare cu AI. Formatul JSON îndeplinește cerința „CSV sau JSON”.

Ghid: [INITIAL-COLLECTION.md](INITIAL-COLLECTION.md). Inventar:
[FILES.md](FILES.md). Nu a fost începută etapa următoare.
