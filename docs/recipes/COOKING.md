# Pagina rețetei și Cooking

Deschide `/recipes/terci-de-ovaz-cu-mere?source=demo` sau un titlu din căutare.
Structura rutei rămâne `[recipeId]`, cu parametru slug canonic de maximum 100 caractere.
Implicit sunt disponibile exclusiv versiunile curente publicate. Demo trebuie ales
explicit și nu publică drafturile. Inventarul privat este citit autoritativ pe server;
invitatul folosește inventarul local validat. Nu există apel AI necesar la utilizare.

## Detaliu și cantități

Fotografia are alt/credit și fallback la lipsă/eroare. Migrația 17 adaugă metadatele
fotografiei per versiune; fotografia unui conținut publicat este imuabilă. Numai
terciul demo are în prezent o imagine, generată cu AI și etichetată ilustrativ.
Assetul este `public/recipes/oatmeal-apple-demo.png`; nu pretinde o rețetă testată.

Porțiile 1–20 sunt păstrate în URL. Unitățile kg/g, l/ml și piece folosesc aceleași
primitive BigInt ca matchingul. Displayul folosește g/ml/piece; fracțiile de bucată
și cerințele sub un micro se rotunjesc în sus, explicit. Nu se convertesc masa în
volum, bucăți în masă, căni sau linguri fără echivalențe verificate. Unitățile
istorice nesuportate rămân vizibile cu scalare/compatibilitate indisponibilă.

Ingredientele includ necesar scalat, disponibil măsurat, deficit, opționale și
cantități necunoscute. Stocul expirat nu devine suficient. Nutriția include toate
cele șase valori per porție și proveniența numai când este verificată; în demo
rămâne indisponibilă. Ajustarea porțiilor nu multiplică valorile deja per porție.
Alergenii, posibilele urme și statutul sunt afișate separat. Restricțiile explicite
se unesc cu cele din profil; rețetele blocate nu permit Cooking/cumpărături/gătit.

Sugestiile folosesc suprapunerea ingredientelor semnificative, dieta și apropierea
duratei, cu ordine deterministă și maximum patru rezultate. Nu consideră apa,
sarea și uleiul un motiv suficient de similaritate. Respectă alergiile, urmele,
statutul verificării și ingredientele excluse, inclusiv indiciile din catalog.
Linkurile din căutare/sugestii păstrează sursa, porțiile și restricțiile explicite.

## Cooking

Dialog cu focus trap, Escape, pași mari, anterior/următor, progres și finalizare.
Fiecare pas are timer din metadatele `timer_seconds`, dacă există, sau durată
editabilă inițială de 5 minute, fără a deduce automat timpi din instrucțiuni.
Pornire/pauză/reset și cronometre paralele; celelalte cronometre sunt listate.
Deadline-uri absolute evită acumularea erorilor la suspendarea intervalului JS.
La revenire se recalculează timpul rămas; schimbarea ceasului nu îl poate crește
peste timpul rămas la pornire. Nu există notificare push, alarmă audio garantată
sau rulare garantată cu browserul închis.

Progresul este validat și păstrat în sessionStorage per cont/sursă/slug/revizie/porții.
Poate fi reluat în aceeași filă; nu este sincronizat cu serverul. Coruperea ori
refuzul stocării oferă eroare și continuare în memorie, fără suprascriere silențioasă.
Resetul explicit reîncepe sesiunea. În timpul revalidării inventarului interfața
și dialogurile sunt ascunse/inactive, dar sesiunea Cooking este păstrată pentru
același context. Contul, porțiile, restricțiile sau versiunea schimbate invalidează
contextul vechi. Răspunsurile întârziate sunt abandonate.

Ecranul aprins este opt-in: context securizat, API detectat, solicitare explicită,
stări requesting/active/refuz/eliberare/nesuportat. Lockul este eliberat la ascundere
și închidere; se recere la revenire numai cât opțiunea rămâne activă. Sistemul îl
poate refuza sau elibera, de exemplu din cauza bateriei. Aceste condiții urmează
[Screen Wake Lock API](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API),
[WakeLock.request](https://developer.mozilla.org/en-US/docs/Web/API/WakeLock/request)
și [Page Visibility API](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API).

## Favorite, cumpărături, gătit și consum

Invitatul păstrează favoritele, cumpărăturile și jurnalul gătit în
`cookly-recipe-actions-v1`. Scrierile verifică versiunea brută, validează Zod și
folosesc Web Locks unde există. Altă filă modificată cere reîncărcare, fără
suprascriere. Capacitate: 500 favorite, 500 rânduri shopping, ultimele 100 marcări
gătite și 100 operații. Nu există migrare automată în cont.

Cont/publicat: favoritele și lista activă existente sunt reutilizate; jurnalul de
operații înregistrează și marcările ca gătit. Cont/demo: acțiuni exclusiv în memoria
paginii, etichetate astfel; nu se salvează rețete draft în listele contului.
Nu sunt construite aici paginile complete Favorites sau Shopping List.

Cumpărăturile au preview editabil al deficitului obligatoriu măsurat și confirmare.
Opționalele nu se adaugă automat; stocul necunoscut este semnalat. Rândurile sunt
adăugate separat, fără comasări/conversii presupuse. Retry-ul aceleiași operații
nu dublează un lot de cumpărături; o nouă confirmare este o nouă adăugare.

„Am gătit” deschide dialogul de confirmare. Marcarea nu schimbă inventarul.
„Revizuiește consumul” folosește formularul pantry existent numai pentru loturile
rețetei: alegi cantitățile reale, vezi ce rămâne, apoi apeși „Confirmă consumul”.
Numai ultima acțiune scrie în inventar. Reviziile și scope-ul previn consumul pe
loturi vechi sau în alt cont. Niciun timer, pas, favorit sau shopping nu scade stoc.

## API și bază de date

- `POST /api/v1/recipes/detail`: `{slug,source,servings,allergy,exclude,inventory,today,expectedAccountId}`.
- `POST /api/v1/recipes/actions`: `{slug,revision,operationId,expectedAccountId,command}`;
  command este favorite/shopping/cooked, validat strict și derivat din contul verificat.
- `api.recipe_detail_metadata(slug)`: fotografie, timere și nutriție publică pentru
  versiunea curentă; drafturile nu sunt accesibile anonim.
- `api.get_recipe_actions(slug)` și `api.apply_recipe_action(...)`: numai authenticated,
  owner din actor, RLS forțat, search_path fix și granturi explicite. Operația SQL
  de shopping este atomică, blochează profilul, verifică referințele/unitățile și
  revizia, ține operationId și payload pentru replay/conflict. Nu accesează pantry.

Origin verificat, body maximum 128 KiB, răspuns privat no-store, requestId și
Vary Cookie/Authorization. RPC timeout 5 s/4 MiB, fără redirecționări; JWT numai la
apelurile private și cookie-urile nu sunt trimise upstream. Metadatele trebuie să
corespundă ID-ului/reviziei/numărului de pași din snapshot, altfel conflict 409.
Se reutilizează limitele căutării: 1000 rețete publicate și 500 loturi, fără
cache al rezultatelor personale. Detaliul scorează numai rețeta cerută.

Aplică migrația `20261103000017_recipe_cooking.sql` după 01–16 prin procesul existent
în local/staging (`supabase migration up --local`). Nu este aplicată de build și
nu a fost aplicată automat unei baze live. Nu s-au adăugat dependențe sau secrete.

## Verificare manuală

1. Desktop/mobil, light/dark, tastatură și cititor de ecran: ingrediente, porții,
   focus la navigarea Cooking, Escape, lipsa overflowului, eroare/fotografie lipsă.
2. Timer 2 secunde, pauză/reset, alt pas, reload, ascundere/revenire, mai multe
   timere; progresul se reia numai în aceeași filă/context.
3. Pe dispozitiv real HTTPS: Wake Lock permis/refuzat/nesuportat, schimbare filă,
   revenire și închidere. Verifică starea reală a ecranului, nu doar eticheta UI.
4. Favorite, shopping cu preview și gătit: stocul rămâne identic. Deschide consumul,
   alege lotul, anulează preview-ul; apoi confirmă și verifică scăderea exactă.
5. În staging cu o rețetă publicată: două conturi, refresh, schimbare cont în timpul
   unei cereri și retry după pierderea răspunsului. Niciun context vechi nu apare.
6. Fotografie/nutriție verificate, alergie salvată în profil, rețetă retrasă și
   revizie schimbată: datele necunoscute nu devin zero, restricțiile rămân active.

[Fișiere](COOKING-FILES.md) · [Rezultate reale](COOKING-VERIFICATION.md).
Nu s-a început etapa următoare.
