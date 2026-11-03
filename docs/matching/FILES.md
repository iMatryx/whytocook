# Motorul de potrivire — fișiere

## Create

- `src/features/matching/contracts/matching.schema.ts`: scheme de intrare și rezultat.
- `src/features/matching/contracts/index.ts`: exporturi publice.
- `src/features/matching/application/matching.service.ts`: compilare, potrivire și excluderi.
- `src/features/matching/application/quantity.ts`: calcule BigInt și rotunjire conservatoare.
- `src/features/matching/application/scoring.ts`: scorul și explicațiile.
- `src/features/matching/application/adapters.ts`: contractele pantry/recipes către DTO matching.
- `src/features/matching/README.md`: limitele modulului și comenzi.
- `src/shared/domain/ingredient-search-key.ts`: normalizarea exactă reutilizată.
- `scripts/matching/example.ts`: datele exemplului din catalog și cele 72 seed-uri.
- `scripts/matching/demo.ts`: demo cu progres, rezultate goale și erori.
- `scripts/matching/benchmark.ts`: măsurători locale, fără scrieri în DB.
- `tests/matching/engine.test.ts`: calcule, alergii, clasificare, validare și determinism.
- `tests/matching/adapters.test.ts`: proiecții, izolare și integrare cu seed-ul real.
- `tests/matching/cli.test.ts`: exit codes și rezultatul gol/invalid în CLI.
- `docs/architecture/MATCHING-PLAN.md`: plan și decizii.
- `docs/matching/MATCHING.md`: contract, formule și integrare.
- `docs/matching/FILES.md`: acest inventar.
- `docs/matching/VERIFICATION.md`: rezultate reale și limitări.

## Modificate

- `src/features/ingredients/domain/search-key.ts`: reexportă aceeași normalizare din shared;
  comportamentul și interfața existente sunt păstrate.
- `package.json`: scripturi test/demo/benchmark și includerea matching în `npm test`.
- `README.md`: descriere și comenzi pentru etapa matching.

Nu au fost modificate migrații, datele seed, politicile Supabase, UI, Auth sau
fluxul de consum al inventarului. Nu au fost adăugate dependențe. Modificările
anterioare din workspace la pantry/recipes nu sunt atribuite acestei sarcini.
