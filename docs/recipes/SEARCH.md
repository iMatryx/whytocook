# /recipes — căutare și filtre avansate

Pagina oferă căutare după titlu și ingrediente, compatibilitate calculată pe
inventarul curent, sortare, filtre combinate și paginare. Folosește UI kitul și
tokenurile light/dark existente. Formularul poate fi pliat pe mobil; controalele
au etichete explicite, feedbackul are loading/error/empty și dialogul de rețetă
folosește focus trap, Escape și revenirea focusului la declanșator.

## Surse și demonstrare

Implicit, `/recipes` citește numai versiuni curente publicate prin noul RPC
`api.recipe_search_snapshot()`. Nu expune drafturi și nu publică automat seed-ul.
Colecția inițială are 72 de drafturi demonstrative; un catalog publicat gol este
o stare legitimă și oferă un link către `/recipes?source=demo`.

Modul demonstrativ este o alegere explicită în URL/formular. Afișează permanent
avertizarea privind datele netestate și folosește JSON-urile existente numai pe
server. Nu este un fallback silențios în caz de eroare Supabase. Costurile și
nutriția rămân necunoscute; filtrele numerice pot produce intenționat zero rezultate.

Exemple partajabile:

```text
/recipes?source=demo&q=rosii&minutes=30&meal=lunch
/recipes?source=demo&diet=vegetarian&sort=time&size=6&page=2
/recipes?source=demo&equipment=hob&equipment=pot&equipment=knife&equipment=mixing_bowl
/recipes?source=demo&compatibility=ready_to_cook&servings=2
```

Linkul partajează criteriile, nu inventarul sau scorul exact. Alt utilizator poate
avea alte rezultate de compatibilitate pentru același URL. Nu sunt introduse în
adresă cantități personale, loturi, accountId sau restricțiile private din profil.

## Semantica filtrelor

Filtrele se aplică la „Aplică filtrele”. Formularul trece la pagina 1, iar URL-ul
este serializat canonic: fără valorile implicite, liste sortate și fără duplicate.
Linkurile de paginare păstrează toate filtrele. Back/forward și refresh refac
valorile. Reset elimină filtrele și revine la pagina 1, păstrând sursa aleasă.
Pagina cerută peste ultima pagină este limitată și URL-ul este corectat prin replace.
Parametrii necunoscuți, numerele invalide și scalarii repetați produc eroare cu reset.

| Parametru             | Comportament                                                                                                                                               |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `q`                   | Maximum 120 caractere; caută toate cuvintele în titlu/nume ingrediente/aliasuri explicite RO/RU/EN, fără diacritice românești                              |
| `ingredient`          | Sluguri canonice repetate; rețeta trebuie să conțină toate ingredientele selectate                                                                         |
| `minutes`             | Durată totală maximă, 1–10080 minute                                                                                                                       |
| `difficulty`          | easy/medium/hard, OR între valorile selectate                                                                                                              |
| `meal`                | breakfast/lunch/dinner/dessert, OR                                                                                                                         |
| `cuisine`             | Sluguri de bucătărie, OR                                                                                                                                   |
| `diet`                | Sluguri de dietă, AND; folosește clasificarea editorială, fără să inventeze etichete nutritive                                                             |
| `equipment`           | Coduri canonice, inclusiv underscore; reprezintă echipamentul disponibil. Toate cerințele rețetei trebuie acoperite; metadatele goale nu trec acest filtru |
| `exclude`             | Exclude rețeta dacă apare oricare ingredient canonic, inclusiv opțional                                                                                    |
| `allergy`             | Coduri canonice ale alergenilor; contains/mayContain/indicii ale catalogului sunt excluderi. Datele neverificate sunt excluse când există alergii          |
| `budget`, `currency`  | Preț maxim per porție, numai valori verificate și în moneda MDL/RON aleasă. Nu există conversii valutare                                                   |
| `calories`, `protein` | kcal maxime și grame de proteine minime per porție; numai date nutritive verificate                                                                        |
| `servings`            | 1–20 porții pentru matching. Nu schimbă valorile nutritive deja exprimate per porție                                                                       |
| `compatibility`       | any/ready_to_cook/almost_ready/missing_ingredients                                                                                                         |
| `sort`                | compatibility, relevance, time, budget, calories, protein, name                                                                                            |
| `page`, `size`        | Pagină de la 1, respectiv 6/12/24 rezultate                                                                                                                |
| `source`              | published implicit, demo numai explicit                                                                                                                    |

AND între grupele diferite. Fără selecție, grupa nu restricționează rezultatele.
Valorile necunoscute nu devin zero și nu trec filtrele numerice, inclusiv pragul
zero. Sortarea numerică pune necunoscutele la final; la preț sunt necunoscute
pentru comparație și valorile în altă monedă. Egalitățile se rezolvă după slug,
pentru paginare deterministă. Relevanța favorizează expresia din titlu.

## Inventar, profil și matching

Wrapperul client reutilizează hook-ul My Fridge: invitatul citește localStorage
validat, contul citește inventarul propriu. La loading sau eroare nu sunt afișate
scoruri bazate pe un inventar presupus gol. Schimbarea filei/contului revalidează
starea. AbortController, un identificator complet al cererii și verificarea
accountId împiedică afișarea unui răspuns întârziat pentru alt context.

`POST /api/v1/recipes/search` primește `{filters, inventory, today, expectedAccountId}`.
Pentru invitat, inventarul trimis este validat. Dacă există sesiune sau Bearer,
identitatea este verificată, expectedAccountId trebuie să coincidă și inventarul
din body este înlocuit cu cel citit pe server. `api.recipe_search_context()`
întoarce inventarul propriu și restricțiile profilului; acestea se unesc cu filtrele
explicite. Resetarea URL-ului nu poate elimina alergiile stocate în cont.

Filtrele ieftine se aplică înainte de matching. Toți candidații rămași primesc
scor înainte de sortarea și paginarea globală; nu se sortează doar pagina curentă.
Scorurile, explicațiile și cantitățile scalate sunt disponibile în dialog.
Vizualizarea nu rezervă/scade inventarul. Calculele reutilizează motorul BigInt.

Rețetele istorice cu ingrediente repetate, unități nepermise/nesuportate sau
identități retrase rămân căutabile cu „Compatibilitate indisponibilă”. Nu opresc
scorarea celorlalte rezultate și nu trec un filtru de categorie ready. Nu se
inventează conversii sau se modifică retroactiv conținut publicat.

## Acces, eficiență și limite

Rută dinamică, răspunsuri `private, no-store`, Vary Cookie/Authorization, requestId
și nosniff. POST cere Origin identic cu APP_BASE_URL. Corpul este citit în stream,
cu limită efectivă 128 KiB. RPC-ul are timeout 5 s, redirect refuzat, răspuns limitat
la 4 MiB și doar două căi permise. Apelul public nu transmite JWT/cookie, contextul
privat transmite numai Bearer verificat, niciodată cookie-ul către Supabase.
Erorile nu expun diagnostice SQL, date ale altui cont sau secrete.

Migrația 16 folosește rolul existent cookly_api fără BYPASSRLS, search_path fix și
EXECUTE explicit. Snapshotul public filtrează published/current; contextul privat
este accesibil doar authenticated și derivă actorul din claims prin get_my_pantry.
Nu sunt oferite acces direct la tabele sau funcții de mentenanță.

Un singur RPC citește snapshotul public cu câmpurile necesare, inclusiv pașii
pentru dialog, fără N+1 pe card. Indexurile existente pe versiune/ingrediente/
taguri/pași sunt reutilizate. Căutarea normalizează documentele o dată pe snapshot,
iar inventarul este indexat o dată pentru matching. Nu se cache-uiesc rezultate
personale; cache-ul static demo conține numai datele publice din fișiere.

Capacitate explicită: maximum 1000 rețete publicate, 500 loturi, răspuns RPC 4 MiB.
Depășirea produce eroare, fără trunchiere ascunsă. Nu este implementat un index
distribuit sau un catalog nelimitat. Cu volume mai mari este necesară proiectarea
unei căutări SQL pe candidați care să păstreze sortarea globală după compatibilitate.

## Configurare și verificare manuală

Aplică migrația 16 după 01–15 în Supabase local/staging prin procesul existent:

```sh
supabase migration up --local
npm run dev
```

Modul demo poate fi utilizat fără Supabase, cu inventar guest; sursa publicată și
conturile necesită configurarea existentă. Nu au fost adăugate variabile de mediu.

Verifică manual pe desktop și mobil, light/dark, tastatură și cititor de ecran:

1. Link direct cu mai multe filtre, Apply, reset, pagina 2, refresh și Back/Forward.
2. Inventar guest, cantități necunoscute, porții diferite și schimbări între file.
3. Două conturi: schimbare cu cerere în zbor; scorurile vechi nu trebuie afișate.
4. Alergie salvată în profil: nu poate fi eliminată prin URL; demo exclude toate
   rețetele când informațiile despre alergeni rămân neverificate.
5. În staging, o rețetă publicată cu valori verificate pentru filtrele de buget,
   calorii/proteine; drafturile trebuie să rămână invizibile.
6. Focusul la deschiderea/închiderea dialogului și erori anunțate fără aria-busy permanent.

Rezultate reale și limite de execuție: [SEARCH-VERIFICATION.md](SEARCH-VERIFICATION.md).
Inventar: [SEARCH-FILES.md](SEARCH-FILES.md). Nu s-a început o etapă nouă.
