# Datele inițiale Cookly

`demonstration.v1.json`: 72 propuneri originale, netestate practic.
`verified.v1.json`: gol până există verificări reale și dovezi.
`references.v1.json`: identități canonice/equipment/tags necesare rețetelor.

Nu introduce valori nutritive sau prețuri presupuse. Necunoscut înseamnă null,
nu zero. Pentru corecții după import, mărește revision și generează migrație nouă.

```sh
npm run recipes:validate -- --input data/recipes/demonstration.v1.json
npm run recipes:check
```

Schema, sursele, fluxul de import/export și pașii manuali sunt în
[ghid](../../docs/recipes/INITIAL-COLLECTION.md).
