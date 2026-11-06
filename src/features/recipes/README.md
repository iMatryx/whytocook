# Recipes — colecție, căutare și Cooking

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

## Detaliu și Cooking

`/recipes/<slug>` folosește aceleași surse explicite și același context de inventar.
Contractele `detail*`, modelul exact de porții/similaritate și prezentările pentru
detaliu/acțiuni/Cooking sunt separate de composition root și SQL. Migrația 17
adaugă fotografii și jurnalul idempotent al acțiunilor, reutilizând favoritele și
lista de cumpărături existente. Consumul rămâne în modulul pantry și cere preview
și confirmare. Ghid: [COOKING.md](../../../docs/recipes/COOKING.md).

## Organizare alimentară

`/favorites` include favorite, colecții și istoricul preparărilor pentru invitați
și conturi. Contractul `organization.schema.ts`, stocarea compatibilă v1 și UI-ul
sunt în același modul; `recipe-organization.server.ts` compune sesiunea verificată
cu RPC-urile private din migrația 18. Unicitate pe owner/nume normalizat și pe
colecție/rețetă; redenumirea nu recreează o colecție ștearsă. Istoricul este separat
de registrul Cooking pentru ca ștergerea să nu fie anulată de un retry.
Ghid: [ORGANIZATION.md](../../../docs/recipes/ORGANIZATION.md).
