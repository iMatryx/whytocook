# Cookly — Frigiderul virtual

Pagina `/my-fridge` permite utilizarea fără cont și administrarea inventarului
propriu după autentificare. Reutilizează catalogul normalizat și UI kitul existent.
Nu implementează matching, rețete sau un eveniment automat de gătire.

## Comportament

- Adăugare, editare și eliminare de loturi, cu ingredient ales explicit prin
  autocomplete RO/RU/EN, cantitate/unitate, dată de expirare și depozitare:
  cămară, frigider sau congelator. Textul liber nu devine ingredient nou.
- Același ingredient poate avea mai multe loturi. Nu se comasează cantități,
  date de expirare sau identități de ingrediente.
- Căutare după numele canonic fără diacritice românești, filtru de categorie,
  depozitare, expirare și cantitate zero; sortare după expirare, nume sau data
  adăugării. Filtrele lucrează pe snapshotul complet, nu pe o pagină incompletă.
- Cantitatea necunoscută este `null`, cu unitate `null`. Zero este o cantitate
  cunoscută și rămâne în listă. Loturile epuizate se pot filtra și elimina explicit.
- Maximum 500 loturi active; maximum 50 loturi într-o confirmare de consum.
  Există loading, empty, filtered-empty, error/retry și salvare în curs.

Interfața folosește Server Component pentru rută și o insulă client pentru
interacțiuni. Reutilizează tokenurile light/dark, butoanele, formularele,
combobox-ul, dialogul cu focus trap și stările de feedback existente. Fiecare
acțiune pe un lot are etichetă distinctă; la închiderea dialogului focusul revine
la declanșator, dacă acesta mai există.

## Cantități și conversii

DTO-urile folosesc șiruri zecimale, niciodată float pentru calcule. Sunt permise
maximum 12 cifre înainte de punct și 6 după punct. Formularele acceptă și virgulă,
normalizată la punct înainte de trimitere. Valorile negative, exponentul, NaN,
Infinity și bucățile fracționare sunt respinse.

Conversiile sunt explicite: g↔kg cu factor 1000, ml↔l cu factor 1000, aceeași unitate
și bucăți întregi. Browserul calculează prin BigInt la scară 10⁶, PostgreSQL prin
numeric. O conversie care ar necesita rotunjire sau ar depăși limita este refuzată.
Nu există conversii masă↔volum, bucăți↔masă, densități sau greutăți medii.

La schimbarea unității în formular, o cantitate deja introdusă este convertită
exact. Pentru o măsurare nouă într-o unitate incompatibilă, golește cantitatea,
alege noua unitate permisă și introdu valoarea măsurată. Unitățile pentru loturi
noi sunt validate și față de `ingredient_units`, nu doar față de enum.

Un lot existent păstrează unitatea măsurată chiar dacă ingredientul este retras
sau acea unitate nu mai este oferită de catalog. Editarea datei/depozitării nu
reinterpretează cantitatea. Unitățile istorice din afara celor cinci coduri
implementate sunt afișate, dar nu pot fi convertite/folosite la consum; este
necesară o măsurare într-o unitate suportată sau păstrarea cantității necunoscute.

## Expirare

`expires_on` este o dată calendaristică, nu un moment UTC. Inputul acceptă date
valide între 1900-01-01 și 9999-12-31. Etichetele compară data cu ziua curentă a
browserului: trecută, astăzi, următoarele 3 zile, termen ulterior sau necunoscută.
Ziua se actualizează periodic. Diferența dintre zile se calculează în calendar,
fără erori de 23/25 de ore la schimbarea orei. Nu se estimează termenul din numele
ingredientului și nu se garantează siguranța alimentului.

## Invitat și cont

Invitatul salvează sub cheia `cookly-pantry-v1`, cu versiune de format, revizie,
loturi și ultimele 100 operații. Datele sunt validate la citire. Coruperea,
blocarea stocării și quota produc erori explicite; datele vechi nu sunt șterse
automat. Revenirea la o revizie veche produce conflict înainte de scriere.
Evenimentele storage actualizează fila curentă; Web Locks serializează scrierile
între file când API-ul este disponibil. Fără Web Locks, verificarea valorii citite
previne conflictele observate, dar nu garantează atomicitate între două file care
scriu exact simultan; evită editările concurente în acel caz.

La autentificare se folosește exclusiv snapshotul contului verificat. Inventarul
local rămâne separat: nu este importat automat, iar datele contului nu sunt
persistate în localStorage. Nu există coadă offline sau fallback local pentru
o salvare a contului eșuată. Pentru date locale corupte, inspectează/exportă cheia
în DevTools înainte de o eventuală ștergere manuală; aplicația nu decide ștergerea.

La revenirea în filă se revalidează sesiunea. Formularul capturează contul pentru
care a fost deschis, iar serverul compară `expectedAccountId` cu actorul verificat.
Schimbarea contului produce `409 SESSION_CHANGED`, inclusiv pentru creare.
Acest UUID este numai o condiție de consistență, niciodată sursa autorizării sau
un `owner_id` transmis către SQL. Răspunsurile întârziate nu înlocuiesc snapshotul
unui cont încărcat mai recent; dacă un refresh a concurat cu o scriere reușită,
clientul recitește după commit.

## După gătit

1. Deschide „Am gătit” și completează consumul real pe loturile folosite.
2. „Verifică înainte de scădere” construiește un preview în memorie. Nu trimite
   o mutație și nu scrie în localStorage.
3. Controlează consumul și cantitatea rămasă. „Înapoi”, „Anulează” sau închiderea
   dialogului înainte de confirmare păstrează stocul.
4. Numai „Confirmă consumul” trimite `confirmed: true`. Serverul recalculă exact,
   verifică proprietarul, reviziile și stocul și aplică întregul lot de comenzi atomic.

Nu se scade dintr-o cantitate necunoscută, nu se creează stoc negativ și nu se
aleg automat loturi sau substituții. O eroare pe un lot anulează întreaga scădere.
Un preview creat înaintea altei editări este respins prin revizie. Repetarea
aceleiași cereri cu același operationId nu dublează consumul sau crearea.

## API și acces la date

| Metodă | Rută             | Contract                                                          |
| ------ | ---------------- | ----------------------------------------------------------------- |
| GET    | `/api/v1/pantry` | `{mode: "account", accountId, items}`; 401 pentru invitat         |
| POST   | `/api/v1/pantry` | `{operationId, expectedAccountId, command}`; snapshot după succes |

Comenzile sunt uniuni Zod stricte:

- `create`: `id`, `ingredientId`, `quantity`, `unitCode`, `location`, `expiresOn`.
- `update`: aceleași câmpuri și `expectedRevision`.
- `delete`: `id`, `expectedRevision`.
- `consume`: `confirmed: true`, `lines[{itemId, expectedRevision, quantity, unitCode}]`.

`kind` selectează comanda. Toate câmpurile sunt obligatorii, inclusiv cele nullable;
nu se acceptă `ownerId`. Body JSON maximum 32 KiB, citit cu limită efectivă de stream.
POST cere Origin identic cu APP_BASE_URL, inclusiv pentru Bearer. Snapshoturile și
erorile au private/no-store, Vary Cookie/Authorization, requestId și nosniff.

Erori: 400 input invalid; 401 sesiune absentă/expirată; 403 origine sau acces refuzat;
404 lot indisponibil; 409 revizie/cont schimbat, stoc insuficient sau capacitate;
503 serviciu indisponibil. Diagnosticele SQL și secretele nu sunt returnate.

Composition root-ul verifică Auth și actor_context înainte să creeze repository-ul
cu JWT-ul utilizatorului. Transportul server-only permite numai cele două RPC-uri,
cu timeout 5 s și răspuns limitat la 512 KiB. Nu se transmite cookie-ul către
Supabase și nu se utilizează service role. Repository-ul validează DTO-urile și
identitatea proprietarului snapshotului.

Migrația 12 adaugă `api.get_my_pantry()` și `api.mutate_my_pantry(uuid,jsonb)`, owned
de rolul existent NOLOGIN/NOBYPASSRLS `cookly_api`. RLS rămâne FORCE pe inventar.
Actorul se derivă numai prin `cookly_security.current_uid()`; conturile dezactivate
pierd accesul. Comenzile blochează profilul actorului pentru serializare și loturile
pentru revizii; izolarea nu depinde exclusiv de filtrele aplicației.

`pantry_operations` are PK `(owner_id, operation_id)`, FORCE RLS, numai SELECT/INSERT
pentru executor și nicio expunere directă pentru anon/authenticated. Aceeași cheie
cu alt payload este respinsă. Replay-ul întoarce snapshotul curent, fără să repete
mutația. Jurnalul este șters la ștergerea contului; o politică de retenție pentru
volume mari și rate limiting operațional nu sunt implementate în această etapă.
RPC-urile istorice și migrațiile 01–11 sunt păstrate; noile comenzi validează și
unitățile catalogului, iar reviziile detectează și editările prin RPC-uri istorice.

## Configurare și pași manuali

Se reutilizează `.env.example`, fără variabile noi. Conturile necesită URL Supabase,
cheia publishable, CSRF_SECRET și APP_BASE_URL corect; invitații pot folosi starea
locală fără configurarea Supabase. Autocomplete-ul necesită catalogul public
configurat și migrațiile lui aplicate. Fără catalog nu se inventează ingrediente
locale pentru a simula că adăugarea funcționează.

Aplică migrația 12 după 01–11 într-un mediu de test, prin procesul Supabase existent.
Nu se face reset și nu se aplică automat migrații la build. Pentru stackul local,
comanda de rulat manual după pornirea serviciilor este:

```sh
supabase migration up --local
npm run dev
```

Nu au fost aplicate migrații pe un proiect Supabase real în această sesiune.
Verifică manual:

1. Două loturi de roșii cu termene/locuri diferite; editare și eliminare confirmată.
2. Persistență guest la refresh; datele nu apar automat în cont după login.
3. Două conturi și două dispozitive/file: izolare, reîncărcare, conflict de revizie,
   schimbare de cont cu formular deschis și revenire în filă.
4. 1000 g→1 kg; refuz g→ml, bucăți fracționare și conversii care necesită rotunjire.
5. Cantitate necunoscută și zero; data de astăzi, expirată și fără dată.
6. Preview/anulare fără modificări, confirmare unică, insuficiență și un lot schimbat
   între preview și confirmare.
7. Mobil/desktop, light/dark, tastatură, focus și cititor de ecran.

Rezultatele executate și limitele sunt în [VERIFICATION.md](VERIFICATION.md), iar
inventarul fișierelor în [FILES.md](FILES.md).
