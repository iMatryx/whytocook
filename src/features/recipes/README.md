# Recipes — colecția inițială și căutare

Modulul păstrează contractele/seed-ul inițial și adaugă căutarea din `/recipes`.
Contractul filtrelor, API-ul, sursele și limitele sunt în
[SEARCH.md](../../../docs/recipes/SEARCH.md).

- `contracts/search*`: filtre, rezultate și codec URL browser-safe.
- `application/search-catalog.ts`: index, filtrare și pagination după scorare globală.
- `presentation/`: formular, carduri, dialog, loading/empty/error și sincronizare URL.
- Composition root leagă matchingul și inventarul; feature-ul nu importă internale
  ale altor features. Migrația 16 oferă snapshot public și context privat.

- `contracts/`: bundle/recipe/source Zod și tipuri browser-safe; export public prin index.
- `application/validate-bundle.ts`: verifică referințele, unitățile, duplicatele și
  coerența afirmațiilor; întoarce toate erorile/avertizările pentru raport.
- `scripts/recipes/`: adaptor Node pentru fișiere, catalog, import→SQL, export JSON
  și verificarea reproductibilității; nu este importat de codul browserului.
- `data/recipes/`: datele editabile și separarea demonstrativ/verificat.
- `supabase/migrations/20261103000013*`–`15*`: schema, referințele și seed-ul inițial.

Ghid, contracte și exemple: [INITIAL-COLLECTION.md](../../../docs/recipes/INITIAL-COLLECTION.md).
Nu se importă direct implementări din alte features; ingredientele sunt rezolvate
prin snapshotul de referințe. Nu se modifică implementarea catalogului sau a frigiderului.
