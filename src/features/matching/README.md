# Matching

Motor determinist, independent de AI, DB și React. Primește snapshoturi explicite,
produce rezultate serializabile și nu modifică inventarul.

- `contracts/`: scheme Zod și tipuri publice ale configurației, cererii și rezultatului.
- `application/matching.service.ts`: compilare reutilizabilă, rezolvare aliasuri,
  index de stoc, excluderi pentru alergii și clasificare pe rețetă.
- `application/quantity.ts`: agregare BigInt, scalare conservatoare și afișare.
- `application/scoring.ts`: componentele explicabile ale scorului.
- `application/adapters.ts`: proiecții din contractele publice PantryItem/RecipeSeed.

Ghidul complet, formulele și exemplele sunt în
[MATCHING.md](../../../docs/matching/MATCHING.md). Rezultate reale:
[VERIFICATION.md](../../../docs/matching/VERIFICATION.md). Inventar:
[FILES.md](../../../docs/matching/FILES.md).

```sh
npm run test:matching
npm run matching:demo
npm run matching:demo -- --allergy milk
npm run matching:benchmark
```
