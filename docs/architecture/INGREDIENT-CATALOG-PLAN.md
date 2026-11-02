# Cookly — catalog de ingrediente

Etapa 4, catalog normalizat, implementare în workspace-ul existent. Nu se modifică
PRD-ul, rapoartele Auth editate de utilizator sau migrațiile deja versionate 01–08.

## Contract și decizii

- Catalog inițial editorial, 32 identități, nume canonic român, aliasuri RO/RU/EN,
  categorii și unități permise. Fără densități sau substituții inventate.
- Identități generale și specifice distincte; părinte numai generic, legătură
  explicită part_of/variant_of, fără matching/echivalență automată.
- Normalizare NFC, transliterare explicită a diacriticelor românești, ё→е;
  й rămâne diferit de и. Fără transliterare rusă→latină sau distanță fuzzy.
- PostgreSQL simple FTS cu prefixe pe cuvinte, GIN pe nume/aliasuri; aliasul exact
  are prioritate înaintea prefixelor. Toate limbile sunt căutate, locale alege eticheta.
- GET /api/v1/ingredients, /categories și /[ingredientId], publice, Zod, 20 implicit,
  maxim 50, query maxim 80 caractere/8 cuvinte. Cursor keyset legat de query, locale,
  categorie, limită și revizia catalogului. Revizie schimbată → 409 și restart.
- no-store pentru această primă integrare, fără date personale sau JWT în repository;
  cache-ul public versionat este amânat până la verificarea serviciilor reale.
- Nutriția este afișată numai din rânduri explicit verificate, cu sursă/descriptor,
  dată și valori per100g. Nu se importă cifre din memorie. Lipsă = unavailable/NULL.

## Pași și fișiere

1. Teste pentru normalizare, DTO/cursor, paginare, anon/public și identități distincte.
2. Migrație 09: alias RU, chei/tsvector, clasificare, unități, revizie și verificare
   nutriție; migrație 10: catalog editorial; 11: RPC search/detail/categories.
3. Feature ingredients: contracts, domain, application/ports/service, infrastructure
   repository și codec; composition root server; adaptoare HTTP subțiri.
4. Extensie compatibilă a Combobox pentru sugestii remote (fără refiltrare locală),
   componentă IngredientAutocomplete și pagină publică /ingredients cu rezultate,
   categorii, detaliu, loading/empty/error și paginare.
5. Teste Node/SQL/Playwright, revizuire independentă, lint/typecheck/build și docs.

## Verificare

PGlite este cerut numai pentru execuția SQL izolată. Dacă rețeaua nu este aprobată,
nu declarăm SQL/RLS testate. CLI/Docker și portul browserului se verifică separat.
Nu se aplică migrații pe un proiect remote și nu se folosește service role.

Limite: seed restrâns, traduceri editoriale fără certificare externă, nicio valoare
nutrițională numerică seed-uită în lipsa unei surse primare accesibile/verificate.
Nu se implementează matching, frigider sau administrare de catalog în această etapă.

## Stare la livrare

Implementarea și documentația sunt prezente. Testele Node, lint, typecheck, build
Webpack și smoke-urile handlerilor compilați au trecut. Execuția SQL și browser
rămâne blocată de instrumentul PGlite lipsă și permisiunea de port; rezultatele
exacte și pașii rămași sunt în [raport](../ingredients/VERIFICATION.md).
