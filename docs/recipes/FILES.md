# Colecția inițială — fișiere

Implementarea de date, schema SQL și instrumentele de mai jos existau deja în
workspace la începutul acestei verificări. Au fost păstrate și executate; această
continuare corectează două cazuri de validare/roundtrip, adaugă documentația finală
și extinde testele. Lista nu atribuie acestei
continuări modificările anterioare ale frigiderului, Auth sau UI kitului.

## Date și contracte

- `data/recipes/demonstration.v1.json`: 72 rețete demonstrative.
- `data/recipes/verified.v1.json`: colecția verificată separată, inițial goală.
- `data/recipes/references.v1.json`: ingrediente canonice, echipamente și etichete.
- `data/recipes/README.md`: reguli de editare a datelor.
- `src/features/recipes/contracts/recipe-bundle.schema.ts`: contracte Zod și tipuri;
  modificat pentru a păstra textele exacte și a raporta URL-uri invalide fără excepții.
- `src/features/recipes/contracts/index.ts`: exporturi publice.
- `src/features/recipes/application/validate-bundle.ts`: validare semantică și raport.
- `src/features/recipes/README.md`: limitele modulului.

## Instrumente și migrații

- `scripts/recipes/catalog.ts`: catalogul de referințe și indicii editoriale de alergeni.
- `scripts/recipes/io.ts`: fișiere limitate la 8 MiB, export stabil, SQL și protecție la suprascriere.
- `scripts/recipes/cli.ts`: validate, export și generare SQL de import.
- `scripts/recipes/reference-sql.ts`: generarea migrației de referințe.
- `scripts/recipes/check.ts`: verificarea colecției și a reproductibilității artefactelor.
- `supabase/migrations/20261103000013_recipe_seed_schema.sql`: extensia schemei, import/export
  și controlul accesului; completate controalele pentru text și URL înainte de aplicare.
- `supabase/migrations/20261103000014_recipe_references.sql`: referințele generate.
- `supabase/migrations/20261103000015_initial_recipes.sql`: seed-ul generat.
- `package.json`: scripturile `test:recipes` și `recipes:*`, deja prezente.

## Teste și documentație

- `tests/recipes/validation.test.ts`: contracte, referințe, verificare și afirmații
  nutriționale; adăugat testul de regresie pentru URL-uri malformate.
- `tests/recipes/io.test.ts`: roundtrip CLI; extins cu raport de import invalid,
  fișier prea mare/inexistent, colecție goală și verificarea artefactelor fără suprascriere.
- `tests/database/recipes.test.mjs`: migrații și comportament SQL; extins cu refuzul
  mutării conținutului importat într-un draft manual, roundtrip cu spații păstrate,
  refuzul textelor goale/URL-urilor invalide și formatat.
- `docs/architecture/RECIPE-SEED-PLAN.md`: planul existent, actualizat la starea verificată.
- `docs/recipes/INITIAL-COLLECTION.md`: ghidul existent, formatat în această continuare.
- `docs/recipes/COMPLETENESS.json`: raport reproductibil, zero erori și 310 avertizări.
- `docs/recipes/VERIFICATION.md`: creat în această continuare, rezultate reale și limite.
- `docs/recipes/FILES.md`: acest inventar, creat în această continuare.
- `README.md`: legături și comenzi ale etapei, deja prezente.

Nu au fost adăugate dependențe în această continuare. Nu au fost modificate
migrațiile 01–12, fluxurile frigiderului sau autentificarea. Nu s-a făcut commit,
deploy sau import într-un proiect Supabase real.
