# Ingredients

Catalog public, fără mutații de business. Contractul HTTP, regulile editoriale,
configurarea și exemplele sunt în [CATALOG.md](../../../docs/ingredients/CATALOG.md).

- `domain/`: normalizare pură și coduri de eroare; fără framework/DB.
- `contracts/`: DTO-uri și scheme Zod publice; import cross-feature numai prin `contracts`.
- `application/`: service, repository/cursor ports; validează termenul și continuarea.
- `infrastructure/`: repository RPC și codec server-only; DTO-urile upstream sunt validate.
- `presentation/`: hook asincron și pagină interactivă; fără importuri din infrastructură.
- `src/server/composition/ingredients.server.ts`: compune adaptoarele concrete.
- `src/app/api/v1/ingredients/`: adaptoare GET; nu accesează direct DB.
- `src/components/ingredients/ingredient-autocomplete.tsx`: control reutilizabil cu props tipate,
  controlat prin `query`, `onQueryChange`, `value`, `onValueChange`, `options`, `loading`, `error`.

`Combobox` a fost extins compatibil cu `queryValue`, `onQueryChange` și
`filterMode="remote"`; implicit rămâne filtrarea locală existentă. Consumatorul
remote furnizează rezultatele și selecția; nu trebuie să transforme textul liber în UUID.

Teste: `npm run test:ingredients`, `npm run test:ingredient-routes` (după build),
`npm run test:db` (PGlite), `npm run test:e2e -- tests/e2e/ingredients.spec.ts --workers=1`.
Testele de rută și browser cu stubs nu înlocuiesc verificarea PostgreSQL/Supabase.
