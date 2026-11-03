# Pantry / My Fridge

Contract, arhitectură, API și pași manuali: [MY-FRIDGE.md](../../../docs/pantry/MY-FRIDGE.md).

- `contracts/`: DTO-uri Zod browser-safe; punctul public pentru alte features.
- `domain/`: coduri de erori, fără framework sau DB.
- `application/`: service și repository port; validează comanda și contul snapshotului.
- `infrastructure/`: repository server-only, validează inclusiv ownerId de la RPC.
- `presentation/`: stare browser, adaptor localStorage, formulare, filtre și preview.
- `src/shared/domain/quantity.ts`, `expiry.ts`: primitive pure folosite de browser/teste;
  aritmetică exactă și date calendaristice, fără dependențe de features.
- `src/server/composition/pantry.server.ts`: actor verificat și adaptoare concrete.

`PantryForm` primește lotul/null, ID stabil, pending, onSave și onCancel.
`ConsumptionForm` primește snapshotul, ziua curentă și callbacks; preview-ul nu scrie.
`PantryView` captează contextul contului când deschide dialogul și furnizează callbacks
legate de acel context. Hook-ul nu persistă snapshoturile contului în browser.

Verificări: `npm run test:pantry`, `npm run test:db`, build urmat de
`npm run test:pantry-routes`; `npm run test:e2e -- tests/e2e/pantry.spec.ts --workers=1`.
