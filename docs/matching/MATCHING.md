# Cookly — motorul de potrivire v1

Motorul rulează sincron, fără apeluri AI, acces la rețea sau citire/scriere în DB.
Rețetele sunt evaluate independent pe același snapshot de inventar. Rezultatul
este o recomandare explicată; nu rezervă și nu consumă stoc. Confirmarea consumului
rămâne responsabilitatea fluxului My Fridge deja existent.

## Intrări și integrare

`createMatchingEngine(configuration)` validează și compilează configurația o dată.
Obiectul returnat are `match(request): MatchingResult`. La schimbarea catalogului,
rețetelor sau reviziilor, creează un motor nou; nu există cache global sau cu date
personale. Același motor poate evalua snapshoturi independente fără să rețină stocul.

Configurația conține:

- `catalog.ingredients[]`: `slug`, `name`, `units`, `aliases[{locale,label}]`,
  `active` (implicit true) și `allergenHints` (implicit []).
- `recipes[]`: `key`, `revision`, `title`, `dataClass`, `baseServings`,
  `ingredients[{ingredientSlug,quantity,unit,optional}]`, `totalMinutes`, `tags`,
  `allergens{status,contains,mayContain}`.

Cererea conține:

- `inventory[]`: `id`, `ingredient` ca `{slug}` sau `{alias,locale}`, `quantity`,
  `unit`, `expiresOn`. Cantitatea și unitatea sunt ambele cunoscute sau ambele null.
- `today`: dată calendaristică explicită, fără dependență de ceasul serverului.
- `servings`: opțional, 1–20; dacă lipsește se folosesc porțiile de bază ale fiecărei rețete.
- `allergies`: codurile canonice ale alergenilor, implicit [].
- `preferences`: `maxTotalMinutes` și `preferredTags`, ambele opționale.

Schemele stricte sunt în `src/features/matching/contracts`. Se acceptă maximum
1000 rețete, 60 ingrediente/rețetă și 500 loturi/cerere. Cantitățile sunt șiruri
zecimale cu maximum 12 cifre întregi și 6 zecimale. Valorile negative, NaN,
exponenții, datele imposibile, bucățile fracționare și loturile cu ID duplicat sunt
respinse. Folosește adaptorul pantry pentru cantitățile deja normalizate de formular.

`inventoryForMatching(items: readonly PantryItem[])` păstrează identitățile loturilor,
cantitățile necunoscute și unitățile istorice pentru diagnostic. Nu persistă nimic.
`recipesForMatching(seeds: readonly RecipeSeed[])` păstrează porțiile, opționalitatea,
revizia, clasa de date și statutul alergenilor. Adaptoarele folosesc numai contractele
publice ale celorlalte features. Proiecțiile de rețetă invalide aruncă o eroare
care trebuie tratată la încărcarea sursei.

```ts
import { createMatchingEngine } from "@/features/matching/application/matching.service";
import { inventoryForMatching, recipesForMatching } from "@/features/matching/application/adapters";

// În composition root, după încărcarea snapshoturilor autorizate și validate:
const engine = createMatchingEngine({
  catalog: matchingCatalogSnapshot,
  recipes: recipesForMatching(recipeSeeds),
});
const result = engine.match({
  inventory: inventoryForMatching(pantryItems),
  today: "2026-11-03",
  servings: 2,
  allergies: ["milk"],
  preferences: { maxTotalMinutes: 30, preferredTags: ["vegetarian"] },
});
```

Acest exemplu descrie integrarea din composition, nu adaugă un endpoint nou.
Un consumator din alt feature importă doar `matching/contracts`; composition-ul
compune serviciile. Furnizorul real de rețete publicate se conectează separat;
seed-urile demonstrative nu sunt expuse ca rețete publicate prin această etapă.

## Identități și sinonime

Slugurile sunt identități canonice exacte. Aliasurile se rezolvă integral și pe
limba declarată (`ro-RO`, `ru-RU`, `en-GB`), folosind aceeași normalizare ca în
catalogul existent: litere mici, NFC, variantele românești fără diacritice și ё→е.
й rămâne distinct de и. Nu se aplică prefixe, fuzzy matching, traducere automată
sau relații generic/specific. Un alias ambiguu invalidează configurația înainte
de potrivire; un alias necunoscut din inventar produce diagnostic și nu oferă stoc.

Identitățile alimentelor preparate trebuie să fie explicite: fasolea uscată nu
poate acoperi fasolea fiartă/scursă, chiar dacă numele sunt asemănătoare. Adaptorul
respinge linii RecipeSeed cu `state: cooked` prin `UNSUPPORTED_COOKED_QUANTITY`,
deoarece pantry nu înregistrează randament crud→gătit. Pentru alimente gata
preparate folosește identitatea canonică distinctă, cu gramajul acelei identități
(ca în seed-urile actuale cu `ready-to-eat`). Nu există conversii de randament.

## Cantități, loturi și porții

Unitățile compatibile sunt g/kg, ml/l și bucăți întregi. Stocul este agregat prin
BigInt în micro-unități de bază: 1 g = 10⁶, 1 kg = 10⁹, similar pentru ml/l.
Nu se folosesc densități, greutăți medii pe bucată, conversii masă/volum sau
substituții. Agregatele pot depăși limita unui lot individual și sunt afișate exact.

Cerința este `cantitateBază × porțiiCerute / porțiiBază`. Când rezultatul nu este
reprezentabil exact, se rotunjește în sus la o micro-unitate de g/ml sau la o
bucată întreagă. `rounding` precizează `up_to_micro_unit` sau `whole_piece`.
De exemplu, 1 g pentru 3 porții devine 0,333334 g la o porție; 1 ou pentru
3 porții cere 1 ou la o porție. Aceasta evită promisiunile bazate pe rotunjire în jos.

Loturile expirate înainte de `today`, ingredientele inactive, unitățile nepermise
și referințele necunoscute sunt ignorate cu diagnostic. Data de astăzi și data
necunoscută nu exclud lotul. Aceste comparații nu certifică siguranța alimentului.
Zero rămâne zero; cantitatea null indică prezență nemăsurată și nu acoperă cerința.

Fiecare ingredient din rezultat are `role` required/optional, `status`
sufficient/insufficient/missing/unknown_quantity, unitatea de bază, cantitatea
cerută, disponibilul măsurat, `shortage`, `quantityUncertain`, `rounding` și `issues`.
`shortage` este deficitul față de stocul **măsurat**. Dacă există loturi nemăsurate,
nu reprezintă automat o cantitate de cumpărat; măsurarea poate schimba rezultatul.
Rețeta nu poate repeta același ingredient canonic: agregă liniile înainte de import.

## Clasificare și scor explicabil

Sunt returnate trei grupuri; în fiecare, ordinea este descrescătoare după scor,
apoi crescătoare după cheia rețetei, independent de ordinea rețetelor la intrare.

- `ready_to_cook`: toate ingredientele obligatorii au cantități suficiente.
- `almost_ready`: cel mult un ingredient obligatoriu deficitar și media acoperirii
  cantităților obligatorii de cel puțin 80%.
- `missing_ingredients`: toate celelalte rețete eligibile, inclusiv incertitudinea
  cantitativă care nu trece pragul anterior.

Opționalele sunt descrise, dar nu blochează pregătirea și nu influențează scorul.
Pragul de 80% și ponderile sunt alegeri inițiale de produs, nu rezultate ale unui
model învățat. Sunt fixate în versiunea `cookly-matching-v1` și pot fi revizuite
explicit într-o versiune viitoare.

| Componentă      | Pondere | Calcul                                                                                                |
| --------------- | ------: | ----------------------------------------------------------------------------------------------------- |
| Compatibilitate |     50% | Fracția ingredientelor obligatorii prezente în unitatea compatibilă sau cu cantitate încă necunoscută |
| Cantități       |     30% | Media `min(stocMăsurat / necesar, 1)` pe ingredient obligatoriu                                       |
| Timp            |     10% | 100% dacă nu există preferință sau durata se încadrează; altfel `duratăPreferată / duratăRețetă`      |
| Preferințe      |     10% | Fracția etichetelor preferate prezente; 100% dacă nu există etichete preferate                        |

Raporturile se calculează în basis points întregi (0–10000), trunchiate în jos.
Punctele fiecărei contribuții sunt de asemenea trunchiate la două zecimale;
totalul este suma contribuțiilor. Fiecare componentă întoarce `score`, `weight`,
`points` și `explanation`. Scorul nu decide excluderea pentru alergii sau categoria
ready: o rețetă cu puțin stoc insuficient poate avea scor mare, dar nu este ready.

Exemplu: 80 g din cele 100 g necesare, fără alte lipsuri sau preferințe: 50 puncte
pentru prezență + 24 pentru cantitate + 10 timp + 10 preferințe = 94, `almost_ready`.
79,999999 g este sub pragul de 80%; două ingrediente deficitare rămân în
`missing_ingredients`, chiar dacă au individual 99% din cantitate.

## Alergii și proveniența datelor

Alergiile sunt filtre aplicate înaintea scorului. `contains`, `mayContain` și
indiciile explicite de alergeni din catalog exclud rețeta, inclusiv când ingredientul
este opțional sau lipsește din inventar. Nu se elimină automat ingredientul din
rețetă și nu se deduce că încălzirea ar elimina alergenul.

Când există alergii, o rețetă cu alergeni `unverified` este exclusă chiar și cu
liste goale. Codurile necunoscute de alergii sunt erori de cerere; nu se ignoră.
Rețetele excluse apar numai în `excluded`, cu motive și codurile relevante, fără
scor de recomandare. Absența unui cod dintr-o listă verificată reprezintă informația
furnizorului snapshotului, nu o verificare medicală efectuată de motor.

Toate cele 72 seed-uri actuale au alergeni neverificați; pentru orice alergie,
demo-ul le exclude pe toate. Fără alergii, rețetele rămân explicit `demonstration`
și au avertizări. Motorul nu inventează nutriție, prețuri sau statut de verificare.

## Loading, empty, error și performanță

Serviciul este sincron și nu necesită o stare loading internă. CLI-ul afișează
progres pe stderr, JSON pe stdout, exit 1 la eroare și mesaj explicit când toate
rețetele sunt excluse. Consumatorul UI va gestiona încărcarea snapshoturilor înainte
de invocare; nu este adăugat un ecran nou în această etapă.

`status: ready` înseamnă că există rezultate evaluate, inclusiv grupul missing;
nu înseamnă că există neapărat rețete gata de gătit. `empty` înseamnă zero rețete
eligibile, `error` înseamnă configurație/cerere invalidă. Fără inventar, rețetele
se evaluează ca lipsuri și există diagnostic `EMPTY_INVENTORY`.

Configurația invalidează întreaga evaluare dacă are referințe greșite, aliasuri
ambigue, rețete duplicate sau ingrediente retrase; nu se returnează recomandări
parțiale aparent valide. Rezultatele nu includ datele complete ale loturilor și
nu sunt cache-uite. Încărcarea datelor private/autorizarea rămâne la composition.

Compilarea indexează catalogul, aliasurile, liniile și mulțimile de alergeni/taguri.
Per cerere, inventarul este agregat o dată. Cost: O(loturi + total linii + R log R),
fără căutare liniară în inventar pentru fiecare ingredient. Nu se serializază
rezultatul cu Zod încă o dată în bucla de calcul; schema de rezultat este verificată
în teste și disponibilă consumatorului.

## Demonstrare și verificare manuală

```sh
npm run test:matching
npm run matching:demo
npm run matching:demo -- --servings 4
npm run matching:demo -- --allergy milk
npm run matching:benchmark -- --iterations 50
```

Demo-ul folosește un inventar fix de 13 loturi și ziua explicită 2026-11-03, pentru
reproductibilitate. Nu este inventarul unui utilizator. Benchmarkul măsoară separat
compilarea, mediana și p95 pentru 72/1000 rețete cu 500 loturi; copiile sintetice
nu sunt adăugate în seed. Include validarea cererii, calculele și sortarea, exclude
IO și serializarea JSON. Nu există prag de performanță fragil în testele automate.

Verifică manual interpretarea ponderilor/pragului de 80%, rotunjirea porțiilor și
mesajele pentru cantitate necunoscută. Înaintea integrării web, conectează numai
snapshoturi autorizate și metadate de alergeni revizuite; păstrează confirmarea
consumului separată. Nu au fost implementate UI, API de matching, planificare de
mese sau etapa următoare. Rezultate reale: [VERIFICATION.md](VERIFICATION.md).
