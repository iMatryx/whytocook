# Planificator alimentar pe 7 zile — etapa 5

`/meal-planner` oferă șapte zile calendaristice și patru tipuri de masă: mic dejun,
prânz, cină și gustări. Fiecare poziție poate conține mai multe rețete. Editorul
permite alegerea rețetei, 1–20 porții, mutarea datei/slotului și data opțională de
pregătire în avans. Copierea deplasează datele și creează ID-uri noi, numai într-o
săptămână fără plan salvat. Datele observării prețurilor rămân cele originale.

Demo fără infrastructură: `/meal-planner?source=demo&startsOn=2026-11-02`.
Catalogul demonstrativ existent are 72 rețete; valorile nutritive necunoscute nu
sunt prezentate ca verificate. Sursa demonstrativă este exclusiv pentru invitați.
Un cont folosește rețetele publicate și restricțiile profilului.

## Plan, preparare și stoc

Planificarea nu înscrie o preparare în istoric și nu consumă inventarul. Marcarea
preparării rămâne în pagina rețetei și modul Cooking, cu confirmarea existentă.
Planul păstrează slugul, revizia și versiunea rețetei selectate. Dacă rețeta este
retrasă, înlocuită sau exclusă de profil, masa apare indisponibilă și generarea
completă este blocată. Editorul permite selectarea explicită a versiunii curente;
copierea nu actualizează automat versiunile indisponibile.

Necesarul se scalează pentru fiecare masă, apoi stocul este alocat virtual o
singură dată, în ordinea datei de pregătire/servire, cu prioritate loturilor care
expiră primele. Expirarea se verifică la data folosirii și cel puțin la data
curentă. Conversiile sunt numai g↔kg și ml↔l; bucățile sunt rotunjite conservator
la unități întregi. Nu se inventează densități. Ingredientele opționale sunt
excluse din necesarul automat. Loturile cu cantități necunoscute rămân incerte.

Se afișează totalul necesar, alocat și lipsă pe ingredient, plus mesele ale căror
resurse au fost deja alocate altor mese. Această alocare privește săptămâna
deschisă; planuri diferite/suprapuse nu rezervă global același stoc. Meal prep
grupează porțiile aceleiași versiuni și date de pregătire; gruparea nu confirmă
gătirea și nu evaluează durata sigură de păstrare a preparatelor.

## Nutriție și buget

Totalurile zilnice și săptămânale însumează toate porțiile planificate pentru
energie, proteine, carbohidrați, grăsimi, fibre și sare. Sunt incluse numai date
verificate cu sursă; numărul meselor necunoscute este afișat separat. Subtotalul
nu reprezintă aportul unei singure persoane. Sursele sunt accesibile în UI.

Bugetul maxim este un plafon de referință: depășirea este semnalată, iar utilizatorul
poate revizui planul. Salvarea unui plan incomplet nu este interzisă. Calculul
folosește un cost per porție introdus și datat sau costul verificat al rețetei,
vechi de maximum 30 zile la data relevantă. Nu există prețuri inventate, feed de
prețuri sau schimb valutar. MDL și RON rămân separate; costurile vechi, necunoscute
sau în altă monedă împiedică afirmația că întregul plan respectă plafonul.

## Lista consolidată

Butonul generează o previzualizare a deficitului întregii săptămâni și cere
confirmare. Contul recalculează pe server din planul și inventarul autoritativ;
invitatul compară din nou inventarul salvat, sub lockul comun al frigiderului,
înainte de scriere. O schimbare de context invalidează confirmarea veche.

Exportul creează rânduri proprii, independente de rândurile manuale existente.
Reexportul înlocuiește numai rândurile proprii nemodificate și nebifate. Rândurile
editate/bifate produc conflict și rămân intacte; cele transferate în frigider sunt
păstrate și detașate de exportul ulterior. Rândurile eliminate manual nu sunt
șterse din alte liste; cele din liste arhivate rămân istorice. Un export gol poate
curăța necesarul propriu anterior nemodificat. Lista nu consumă și nu transferă
ingrediente; cumpărăturile se confirmă separat în modulul Shopping.

## Persistență și API

- Invitați: `cookly-meal-plan-v1:{source}:{startsOn}`, separat de cont. Jurnalul
  `cookly-planner-shopping-v1` recuperează scrierea întreruptă a planului și listei.
  Nu suprascrie date corupte sau editări ulterioare. Web Locks coordonează filele
  unde sunt disponibile; altfel există comparații înainte de scriere, fără o
  garanție tranzacțională între procese independente.
- Conturi: tabelele existente `meal_plans`/`meal_plan_entries`, plus registre de
  operații și legături de export. RLS forțat, owner derivat din sesiune, revizii,
  replay și tranzacții. Nu există import automat al datelor invitatului.
- `GET /api/v1/planner?startsOn=YYYY-MM-DD&source=published|demo`: catalog și plan.
  Citirea nu creează un plan.
- `POST /api/v1/planner`: saveEntry, removeEntry, configure, copyWeek.
- `POST /api/v1/planner/analyze`: agregate fără scrieri.
- `POST /api/v1/planner/export`: recalculare și export confirmat în cont.

Toate intrările sunt validate Zod, originul mutațiilor este verificat, răspunsurile
sunt private/no-store. Inventarul și planul trimise de clientul autentificat nu
înlocuiesc datele contului. Rețetele incompatibile cu alergiile sunt excluse.

Limite explicite: 56 mese/săptămână, 100 ingrediente/export, 500 rânduri/listă,
1000 rețete/catalog. Registrele locale păstrează maximum 100 operații recente,
cu eliminarea chitanțelor tehnice mai vechi la limita de octeți. Spațiul local este
limitat de browser; datele excesive nu sunt trunchiate silențios.

## Instalare și verificare manuală

Migrația `20261105000020_meal_planner.sql` se aplică după 01–19 prin procesul
existent, în dezvoltare/staging (`supabase migration up --local`). Nu este aplicată
de build și nu a fost aplicată unui proiect live în această sesiune. Fără migrație,
contul nu are noile RPC-uri. Nu s-au introdus dependențe.

1. În demo adaugă aceeași rețetă de două ori, schimbă porțiile și mută o masă.
   Reîncarcă pagina și verifică persistența și cele patru tipuri de masă.
2. Adaugă stoc măsurat în frigider. Verifică deficitul total, expirările și
   avertizarea când două mese au nevoie de același lot.
3. Introdu un preț per porție și plafon mai mic; verifică avertizarea, moneda și
   faptul că nutriția necunoscută nu este certificată.
4. Grupează pregătirea în avans și copiază într-o săptămână goală; verifică datele,
   porțiile, bugetul și că planul sursă rămâne intact.
5. Confirmă exportul de două ori: numărul rândurilor nu crește. Editează/bifează un
   rând generat și verifică refuzul înlocuirii, fără pierderea rândurilor manuale.
6. Verifică două conturi reale, revenirea din altă filă, sesiune expirată și
   retragerea/actualizarea unei rețete într-un mediu Supabase cu migrația aplicată.
7. Verifică mobil 360–390px, zoom 200%, tastatură, focusul dialogurilor și temele.
   Istoricul și inventarul trebuie să rămână neschimbate după simpla planificare.

Fișierele sunt în [FILES.md](FILES.md), rezultatele reale în
[VERIFICATION.md](VERIFICATION.md). Etapa următoare necesită o cerere separată.
