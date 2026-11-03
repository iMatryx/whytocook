# Motorul de potrivire — plan și decizii

## Scop și limite

Motor determinist TypeScript/Zod, fără AI, acces DB sau mutații de inventar.
Se folosește ca serviciu pur, cu adaptoare pentru PantryItem și RecipeSeed și un
demo CLI pentru cele 72 rețete. Nu se construiesc UI, matching HTTP, filtrele
etapei următoare sau consum automat. Nu se adaugă dependențe.

## Contract și algoritm

- Catalogul furnizează sluguri canonice, unități și aliasuri exacte pe RO/RU/EN.
  Normalizarea existentă se mută în shared/domain și este reexportată din locul
  existent; comportamentul catalogului rămâne identic. Fără fuzzy, substituții,
  relații generic/specific sau conversii crud/fiert. Aliasurile ambigue sunt erori.
- `createMatchingEngine({catalog,recipes})` validează și compilează o singură dată
  referințele și rețetele. `match({inventory,today,servings?,preferences?})` returnează
  un rezultat validabil și serializabil, cu error/empty explicite. Input invalid
  nu produce rezultate parțiale aparent valide. Maximum 1000 rețete și 500 loturi.
- Inventarul este indexat o singură dată pe ingredient/dimensiune și agregat prin
  BigInt în micrograme, microlitri sau microbucăți (g/ml/piece × 10^6). Unitățile
  incompatibile, referințele necunoscute, ingredientele inactive și loturile expirate
  sunt ignorate cu diagnostic. `null` nu devine zero, iar zero nu devine prezență.
- Cerința per porții se scalează în unitatea de bază și se rotunjește în sus la
  micro-unitate, respectiv la bucată întreagă; rezultatul precizează rotunjirea.
  Nu se rotunjește în jos și nu se folosesc float pentru decizia de suficiență.
  Loturile se reutilizează independent între rețete, fără consum în timpul căutării.
- Fiecare linie precizează required/optional, sufficient/insufficient/missing/
  unknown_quantity, cantitatea cerută/disponibilă/lipsă și motivele incertitudinii.
  Ingredientele duplicate din aceeași rețetă sunt respinse pentru a evita dublarea
  stocului. Ingredientele opționale nu blochează pregătirea și nu umflă scorul.
- `ready_to_cook`: toate liniile obligatorii sunt suficiente. `almost_ready`:
  cel mult o linie obligatorie deficitară și acoperire medie de cantitate ≥80%.
  Altfel `missing_ingredients`. Pragul este o decizie inițială de produs, documentată.
- Scor 0–100: prezența ingredientelor obligatorii 50%, acoperirea cantităților 30%,
  timpul 10%, etichetele preferate 10%. Fără preferință, componentele timp/taguri
  sunt neutre (100%). Timp peste durata preferată: raport preferat/total. Taguri:
  fracția preferințelor prezente. Componentele și contribuțiile sunt explicite.
  Raporturile interne folosesc basis points întregi; sortare stabilă scor/key.
- Alergiile sunt coduri validate. contains și mayContain sunt excluderi, inclusiv
  pentru ingrediente opționale; metadatele neverificate exclud rețeta când există
  alergii. Indiciile catalogului se adaugă declarațiilor. Nu se promite certificare
  alimentară și nu se folosesc scoruri pentru a reintroduce o rețetă exclusă.
- Rețetele demonstrative sunt etichetate în rezultate. Niciun scor nu le promovează
  la verificate; nu se inventează nutriție sau prețuri.

## Livrare și verificare

- [x] Teste înainte de implementare pentru identități/sinonime, unități, loturi,
      porții, cantități necunoscute, alergii, scor, praguri, validare și determinism.
- [x] Contracte în `src/features/matching/contracts`, serviciu și calcule în
      `application`, reutilizarea normalizării în `src/shared/domain`.
- [x] Adaptoare ale contractelor publice pantry/recipes, fără importuri private.
- [x] Demo și benchmark în `scripts/matching`, cu colecția reală și inventar fix.
      Raportul măsoară compilarea și potrivirile repetate, fără prag fragil de timp în teste.
- [x] Documentație cu formule, exemple, inventar de fișiere și rezultate reale.
- [x] npm test, lint, typecheck, build Webpack, format pe fișierele etapei și
      revizuire independentă. Testele existente ale DB rulează ca regresie dacă e necesar;
      această etapă nu schimbă schema sau politicile de acces.

Complexitate țintă: compilare O(catalog+aliasuri+linii), cerere
O(loturi+linii rețete+R log R). Nu se caută inventarul de la zero pentru fiecare linie.
