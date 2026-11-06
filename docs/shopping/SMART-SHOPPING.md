# Lista inteligentă de cumpărături

`/shopping-list` este disponibilă invitaților și conturilor. Reutilizează lista
activă în care Cooking adăuga deja ingrediente; rândurile existente nu sunt
șterse. `/shopping-list?source=demo` permite demonstrarea fără Supabase configurat.
Rețetele demonstrative rămân etichetate netestate, fără publicarea drafturilor.

## Din una sau mai multe rețete

Alege 1–20 rețete și porții 1–20 pentru fiecare, apoi „Calculează lipsurile”.
Opționalele sunt excluse implicit și pot fi incluse explicit. Preview-ul arată
necesarul, disponibilul măsurat și lipsurile. Numai „Confirmă adăugarea necesarului”
scrie lista. Înainte de confirmare se recalculează; dacă stocul s-a schimbat, este
cerută o nouă revizuire, fără a adăuga silențios alte cantități.

Ingredientele folosesc identități canonice, nu potrivire aproximativă după text.
Se scalează fiecare rețetă, se însumează cerințele și apoi se scade stocul o singură
dată pentru selecția completă. kg/g și l/ml sunt compatibile; masă/volum/bucăți nu
se convertesc între ele. Bucățile fracționare și cerințele sub un micro se rotunjesc
conservator la scalarea porțiilor. Agregarea/conversia stocului este exactă BigInt.
Unitățile neverificate, ingredientele inactive și cantitățile peste limite produc
eroare, fără densități sau echivalențe inventate.

Loturile expirate sunt ignorate; expirarea astăzi rămâne vizibilă în frigider și
se verifică înainte de utilizare. Stocul necunoscut nu devine zero cert: rândul este
marcat incert și cere revizuirea cantității prin Editare înainte de transfer.
Restricțiile și alergiile din profil sunt verificate pe server la preview;
inventarul unui cont este citit din PostgreSQL, indiferent de body-ul trimis.

Selectează împreună toate rețetele aceleiași runde de cumpărături. Calculele
succesive sunt adăugări independente; nu rezervă și nu consumă inventar pentru
alte mese. Nu este implementat aici un planificator de mese cu rezervări de stoc.

## Listă, prețuri și partajare

Lista este grupată pe categorii. Permite adăugare manuală cu ingredient din
catalog sau text liber, cantitate cunoscută/necunoscută, editare, ștergere și bifare.
Identitățile canonice nebifate și certe se comasează pe dimensiuni compatibile;
rândurile bifate, transferate, incerte sau cu text liber rămân separate. Conversia
la unitatea existentă trebuie să fie exactă; când aceasta ar rotunji, se folosește
unitatea de bază permisă. Datele și reviziile vechi sunt respinse la scriere.

Prețul este introdus explicit de utilizator: sumă, MDL/RON, cantitate și unitate
de referință, data observării. Nu sunt inventate prețuri și nu există în această
etapă un feed extern. Un preț nu este prezentat drept verificat de Cookly.
La comasare, un preț nou introdus înlocuiește rata veche și se aplică întregii
cantități; o adăugare fără preț păstrează rata existentă. Formularul explică regula.

Subtotalurile se calculează separat pe monedă, în bani întregi, cu rotunjire în sus
la ban pe rând. Nu există conversii valutare. Rândurile transferate nu intră în
estimarea listei rămase. Prețurile absente, incompatibile cu unitatea, viitoare sau
mai vechi de 30 zile nu intră în subtotalul cunoscut. Se afișează numărul rândurilor
fără estimare sigură; un subtotal incomplet nu este un total garantat. Cantitățile
de pe bon pot fi revizuite în listă înainte de transfer.

„Partajează lista” arată întâi textul exportat. La acțiunea utilizatorului este
deschisă aplicația de partajare a platformei sau este folosit clipboardul; există
și text selectabil pentru copiere manuală. Nu se creează linkuri publice sau
permisiuni de acces la cont, nu se trimit ID-uri de cont/lot/rețetă și nu sunt aleși
destinatari automat. Funcționarea Share/Clipboard depinde de browser/context securizat.

## Confirmarea cumpărăturilor și transfer

Bifarea nu scrie în frigider. „Transferă cumpărăturile bifate” deschide o confirmare
pentru 1–50 rânduri. Sunt eligibile numai rândurile canonice, măsurate, certe,
netransferate, cu ingredient activ și unitate permisă. Cantitatea este exact cea
revizuită în listă. Poți alege locul de depozitare și data expirării; se creează
loturi noi, fără a suprascrie loturile existente. Textul liber nu este ghicit sau
transformat într-un ingredient. Rândurile incerte trebuie editate și confirmate.

Pentru cont, întreaga comandă este o tranzacție SQL: loturile și marcarea rândurilor
se confirmă împreună. O eroare la un rând anulează toate schimbările. operationId,
ID-urile loturilor și flagul transferred previn dublarea la retry. Nu se pot edita
rândurile transferate; ștergerea lor din listă nu șterge stocul cumpărat.

Pentru invitat, localStorage nu are tranzacții pe două chei. Există un jurnal de
recuperare, persistat înainte de scriere, și Web Locks în ordinea pantry→shopping,
folosind aceleași chei ca My Fridge. După o întrerupere, lista finalizează aceeași
operație fără alte loturi. Dacă după scrierea parțială au intervenit alte modificări
ale stocului, recuperarea se oprește și cere reconciliere manuală, fără suprascriere.
O eroare de stocare poate necesita reîncărcare și verificarea frigiderului; nu se
pretinde atomicitate nativă a localStorage. Fără Web Locks, comparațiile valorilor
anterioare și jurnalul reduc conflictele, dar nu garantează izolarea între file.

## Persistență și API

Invitații au `cookly-shopping-v1`, maximum 500 rânduri și ultimele 100 operații
pentru replay. Rândurile Cooking din `cookly-recipe-actions-v1` sunt preluate o
singură dată, fără modificarea favoritelor/istoricului. Până la 5000 identificatori
de import sunt păstrați pentru ca rândurile eliminate să nu reapară; depășirea
limitelor produce eroare explicită. Jurnalul este `cookly-shopping-transfer-v1`.
Datele corupte sau inaccesibile nu sunt înlocuite automat.

Catalogul demo guest are identificatori locali stabili derivați din slug, utilizați
exclusiv în browser. Aceștia nu sunt prezentați drept UUID-uri ale bazei de date.
La încărcare și înainte de transfer metadatele sunt reconciliate cu catalogul
curent. Ingredientele retrase sau unitățile revocate nu pot fi transferate.
Datele guest nu sunt importate automat în cont; datele contului nu sunt persistate local.

- `GET /api/v1/shopping?source=published|demo`: scope, listă, catalog și rețete.
- `POST /api/v1/shopping/preview`: source, selections, inventory, today,
  expectedAccountId, includeOptional. Nu scrie date.
- `POST /api/v1/shopping`: expectedAccountId, operationId, command
  (`append`, `update`, `remove`, `purchase`).
- SQL: `api.smart_shopping_catalog()`, `api.smart_shopping_snapshot()` și
  `api.smart_shopping_mutate(uuid,jsonb)`.

API-urile au răspunsuri private/no-store, requestId, Origin obligatoriu la POST,
body maximum 128 KiB și validare Zod strictă. Tokenul verificat este trimis numai
RPC-urilor private, fără cookie-uri upstream. RPC are timeout 5 s și limită 4 MiB.
Catalogul este limitat explicit la 1000 ingrediente active, lista la 500 rânduri;
nu există trunchiere ascunsă. Datele contului sunt protejate de owner derivat din
JWT, FORCE RLS și granturi restrictive. Nu sunt oferite editări de rânduri derived
ale viitorului planner prin acest modul.

Aplică `20261105000019_smart_shopping.sql` după 01–18 în dezvoltare/staging prin
procesul existent (`supabase migration up --local`). Migrația extinde aceleași tabele
shopping și adaugă registrul privat al operațiilor. Nu a fost aplicată live aici.

## Verificare manuală

1. Guest demo: două rețete cu ovăz, stoc 50 g, porții diferite și opționale;
   verifică preview-ul și faptul că disponibilul este scăzut o singură dată.
2. Reia lista Cooking existentă, comasează g/kg și ml/l, verifică separarea
   bucăților, textului liber și necunoscutelor. Elimină un rând și reîncarcă.
3. Introdu preț/kg, schimbă cantitatea, apoi preț vechi/viitor/incompatibil și RON;
   verifică subtotalurile separate și numărul valorilor fără estimare.
4. Deschide partajarea pe desktop/mobil; verifică textul, Cancel și copierea
   manuală când Share/Clipboard nu sunt disponibile.
5. Bifează, deschide transferul și anulează: frigiderul rămâne identic. Confirmă:
   apar loturi o singură dată, cu loc/expirare corecte. Retry nu dublează stocul.
6. În staging: două conturi, sesiune schimbată/expirată, revizie modificată în
   altă filă, ingredient retras și eșec la al doilea rând dintr-un transfer.
7. Mobil 390 px, zoom 200%, tastatură/cititor de ecran, dialoguri/Escape/focus,
   storage plin/corupt și recuperarea după închidere în timpul transferului.

[Fișiere create/modificate](FILES.md) · [Rezultate reale](VERIFICATION.md).
Nu s-a început etapa următoare și nu s-a creat commit/deploy.
