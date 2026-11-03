# Colecția inițială de rețete — plan

## Contract și decizii

Se livrează 72 rețete originale demonstrative pentru Moldova/România, într-un
bundle JSON versionat. Categoriile sunt mic dejun, prânz, cină, desert, vegetarian
și candidate high-protein. Nu se inventează cifre nutritive, prețuri sau verificări.
Fișierul verificat este separat și inițial gol; verificarea reală rămâne editorială.

Schema existentă de rețete/versionare/ingrediente/porții/pași se reutilizează.
Migrațiile 01–12 și modificările existente ale frigiderului rămân intacte.
Se adaugă echipament pe versiune, alergeni declarați cu status, date nutritive cu
proveniență, verificare editorială și registru de import. Rețetele seed rămân draft;
cele demonstrative nu se publică și nu primesc eticheta nutrițională verificată.

Ingrediente suplimentare canonice explicite, cu aliasuri RO/RU/EN și unități,
sunt adăugate separat, fără echivalențe automate pentru variante crude/fierte.
Importul folosește slugul canonic, nu caută sinonime și nu substituie ingrediente.

JSON este formatul de import/export ales (CSV nu este necesar cererii „CSV sau JSON”).
CLI-ul rulează offline, validează Zod, rezolvă referințele și produce raport și SQL;
nu deschide conexiuni la baze de date și nu citește secrete. Erorile blochează SQL-ul;
lipsurile editoriale sunt avertizări, cu opțiune strictă pentru pipeline editorial.

Import SQL atomic, invoker, rezervat mentenanței, fără EXECUTE pentru web roles.
Cheia namespace/key/revision și hash-ul payloadului fac retry-ul idempotent;
schimbarea aceluiași revision este conflict, o revizie nouă creează versiune draft
nouă și nu înlocuiește versiunea publicată. Importurile nu suprascriu rețete manuale.
Versiunile importate sunt păstrate ca artefacte: corecțiile se fac prin revizie nouă.

## Pași și teste

- [x] Contracte Zod și validator semantic în `src/features/recipes/{contracts,application}`;
      teste RED→GREEN: referințe, unități, duplicate, verificare/proveniență și high-protein.
- [x] Referințe noi și 72 rețete cu cantități, porții, pași, timp, dificultate,
      echipament, alergeni, sursă nutrițională nullable, buget și status explicit.
- [x] CLI `scripts/recipes/`: validate/report, export JSON și import→SQL. Teste
      roundtrip, fișier invalid/incomplet, gol, SQL quoting și refuz overwrite implicit.
- [x] Migrații 13 schema/importer, 14 referințe, 15 colecție generată. Teste PGlite:
      toate datele, anon/private, idempotency, conflict/revizie, rollback și demo nonpublic.
- [x] Documentație, raport de completitudine generat reproductibil, inventar fișiere,
      lint/typecheck/build/test și revizuire independentă.

Verificat la 3 noiembrie 2026. Rezultate și limita verificării globale de formatare:
`docs/recipes/VERIFICATION.md`. Nu au fost aplicate migrații într-un Supabase real.

## Puncte de validat

Pragul tehnic pentru o afirmație high-protein verificată este cel puțin 20% din
energia declarată provenită din proteine, împreună cu nutriție și revizie verificate.
Regula numerică nu este folosită pentru a inventa valori: seed-ul are numai candidați.
Sursele primare pentru regulă și temperaturile din pași se consemnează în documentație.
Caracterul economic este o intenție editorială, nu un preț curent certificat.

Nu se construiesc în această sarcină UI de catalog rețete, matching, admin sau AI.
Loading/empty/error se aplică instrumentelor CLI și rapoartelor, nu unui ecran nou.
