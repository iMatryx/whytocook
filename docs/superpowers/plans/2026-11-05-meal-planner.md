# Planificator alimentar pe 7 zile — plan

Scop: calendar cu breakfast/lunch/dinner/snack, porții, mutări, copiere, meal prep,
resurse, nutriție și buget, shopping consolidat. Planificarea nu marchează gătit și
nu consumă stoc. Fără deps noi, fără aplicare live sau commit automat.

## Contracte și decizii

- Feature `meal-planner`, public contracts în `src/features/meal-planner/contracts/index.ts`.
  Week: startsOn (7 zile calendaristice, fără DST), revision string `0` când absent,
  budget|null, entries max56, exportedRevision|null. Fiecare slot poate conține mai
  multe rețete; idempotency previne retrimiterea aceleiași operații.
- Entry: UUID, recipeKey/revision/versionId (pin), plannedOn, slot, servings1–20,
  prepOn|null în săptămână și <= plannedOn, costPerServing|null introdus cu dată/monedă.
  Rețetele înlocuite/retrase nu sunt recalculate silențios; apar indisponibile.
- Comenzi saveEntry(create distinct), removeEntry, configure budget, copyWeek.
  Toate au expectedRevision de săptămână și operationId. Copiere numai într-o
  săptămână inexistentă, cu ID-uri noi, mutarea datelor/prepOn și păstrarea datelor
  prețurilor. Guest are chei per sursă/săptămână, contul tabelele existente meal_plans/entries.
- Bugetul este plafon de referință și semnalizare; nu inventăm costuri și nu blocăm
  salvarea unui plan parțial. Rată explicită per porție sau preț verificat recent
  din rețetă, maximum30zile; subtotal cunoscut, unknown/exceeded/within, fără FX.
- Nutriție completă din metadate verificate, subtotaluri zilnice/săptămânale cu
  număr de mese necunoscute. Unknown nu devine zero. Se afișează proveniența.
- Stocul este alocat virtual în ordine prepOn/plannedOn, FEFO și pe dimensiuni
  exacte. Expirarea se verifică la data utilizării (și azi). Un lot nu este folosit
  de două mese. Suprapuneri/deficite și necunoscute sunt explicite, fără scrieri.
- Meal prep grupează aceeași rețetă/versiune și dată de pregătire, însumează porțiile.
- Export shopping: preview și confirmare; același agregat al săptămânii, scădere
  unică și expirare la utilizare, max100 ingrediente per export. Nu se consumă stoc.
  Exportul înlocuiește numai rândurile proprii anterioare nemodificate/nebifate.
  Rândurile editate/bifate blochează înlocuirea; cele transferate sunt păstrate.
  Rândurile sunt inserate separat, fără a șterge cantități manuale comasate.
  Exportul ține reviziile rândurilor generate; orice comasare manuală ulterioară
  schimbă revizia și cere reconciliere, nu șterge datele utilizatorului.
- SQL migrația20: metadata rețete publice (versionId, nutrition, budgetSource),
  state/mutate/export private; RLS/owner derivat, revizii, replay și tranzacții.
  Guest export două chei cu jurnal și locks, fără import automat în cont.
- UI: calendar 7 coloane pe ecran mare, 7 secțiuni verticale pe mobil; tokenuri
  existente verde #24563d/fundal #fbfcfa/dark; Georgia titluri, sans forme și cantități.

## Pași

- [x] Teste RED→GREEN pentru date/copiere, salvare locală, cost/nutriție, FEFO/expirări,
      competiție între mese, meal prep și export fără duplicate/pierdere de rânduri.
- [x] Migrația20 și teste SQL izolare/replay/revizii/copiere/metadata/export atomic,
      păstrând meal history și pantry neschimbate.
- [x] Compoziție și API bootstrap/mutate/analysis/export, profil/inventar autoritativ.
- [x] UI calendar, editor/mutare, buget, prep, preview shopping și guest persistent.
- [x] Review, verificări native/SQL/API, lint/TS/build și documentație.
- [ ] Execuție browser: portul 3100 blocat de sandbox; 4 scenarii scrise și descoperite,
      fără rezultate E2E pretinse. Vezi docs/planner/VERIFICATION.md.

Nu se reiau implementările Cooking/Organization/Shopping, iar schimbările necomise
anterioare rămân în workspace. Browserul poate necesita aprobarea portului local.
