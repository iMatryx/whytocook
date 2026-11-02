# Cookly — Supabase și reguli de acces

Etapa 3, 2 noiembrie 2026. Completează schema închisă din migrațiile 01–04.
Migrațiile 05–07 adaugă acces controlat, iar 08 extinde profilul și preferințele; istoricul nu este rescris. Vezi și [Auth/profil](AUTH-PROFILE.md).

## Ce este implementat

- Configurație locală PostgreSQL 15, Auth email/parolă și TOTP, Storage privat.
- Provisionare atomică a profilului, stării active și preferințelor la signup;
  fără copierea `raw_user_meta_data`, fără atribuirea automată de roluri.
- Proiecții `api` cu `security_invoker=true` și coloane explicite; cantitățile și
  reviziile `bigint` sunt șiruri în DTO, fără pierderea preciziei JSON/JavaScript.
- RPC-uri de mutație cu proprietar derivat din JWT, verificare RLS, FK compuse,
  revizii și protejarea conținutului publicat. Nu există un RPC generic de SQL/CRUD.
- Roluri evaluate din `user_roles` la fiecare cerere/operație, nu din metadatele
  utilizatorului. Editor/admin necesită JWT AAL2 pentru acces editorial.
- Adaptor server-only per cerere, verificare Auth și context DB, verificarea
  proprietarului resursei și semnare de download privat pentru 60 secunde.
- Endpointuri GET demonstrabile: `/api/v1/auth/context` și `/api/v1/admin/access`.
  Ambele acceptă Bearer explicit sau sesiune cookie verificată și răspund `private, no-store`.

Nu există conexiune PostgreSQL privilegiată în aplicația web. Adaptorul folosește
cheia publicabilă + JWT-ul utilizatorului. Cheia de mentenanță existentă în
validatorul separat nu este importată sau folosită de aceste module.

## Model de încredere și roluri

| Rol PostgreSQL       | Drepturi                                                                                                               |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `anon`               | SELECT pe proiecțiile publice; fără date personale, mutații sau Storage privat                                         |
| `authenticated`      | SELECT public/own prin RLS; EXECUTE pe RPC-urile aprobate, fără INSERT/UPDATE/DELETE direct pe tabele                  |
| `cookly_api`         | NOLOGIN, NOINHERIT, NOBYPASSRLS; execută RPC, drepturi minimale pe tabele și triggeri; nu este proprietarul tabelelor  |
| `cookly_authz`       | NOLOGIN/NOBYPASSRLS; citește numai starea și rolurile propriului `auth.uid()` prin politici de bază nerecursive        |
| `cookly_provisioner` | NOLOGIN/NOBYPASSRLS; INSERT numai în profil/stare/preferințe, folosit de triggerul de signup                           |
| `service_role`       | Nu primește grants Cookly/API în aceste migrații; nu este clientul pentru operații de utilizator                       |
| Operator migrare     | Proprietar/administrator de încredere; poate administra schema și face bootstrap-ul rolurilor, în afara aplicației web |

Rolurile aplicației `editor`, `moderator`, `admin` sunt rânduri în `user_roles`,
nu roluri PostgreSQL și nu valori acceptate din corpul cererii. `moderator` nu
are drepturi editoriale. Admin/editor nu primesc acces la datele personale ale
altui utilizator. Un cont `disabled` sau `deleting` pierde accesul privat și
capabilitățile; catalogul public rămâne public.

Helperii din `cookly_security` au `search_path=''`, referințe calificate și niciun
argument de tip „alt user ID” pentru evaluarea actorului. Politicile pe stări/roluri
nu reapelează helperul și nu generează recursie. `auth.uid()` identifică subiectul
JWT, nu `current_user`, care se schimbă în interiorul RPC-ului definer.

Rolul operatorului primește membership în cele trei roluri NOLOGIN pentru a
transfera ownership-ul funcțiilor. `anon`/`authenticated` nu primesc membership.
CREATE temporar pe scheme este revocat la final. Nicio funcție expusă nu este
deținută de un superuser sau de proprietarul tabelelor. EXECUTE este revocat
explicit pentru PUBLIC în aceeași migrație, înaintea granturilor minime.

## Matricea tuturor celor 37 de tabele

FORCE RLS din migrația 04 rămâne activ. `api` conține numai views și funcții,
nu tabele. `app_private` și `cookly_security` nu se expun în Data API.

| Tabele                                                                                                                                                                                                                                                | Citire                                                                                                             | Scriere din aplicație                                                                                                          |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `units`, `serving_units`, `ingredient_categories`, `ingredients`, `ingredient_aliases`, `allergens`, `ingredient_allergens`, `data_sources`, `tags`, `ingredient_unit_conversions`, `ingredient_substitutions`, `nutrition_data`, `ingredient_prices` | Referințe comune; RLS permite SELECT; numai proiecțiile enumerate mai jos sunt endpointuri                         | Fără grants sau RPC de scriere în această etapă                                                                                |
| `recipes`, `recipe_versions`                                                                                                                                                                                                                          | Public: numai rețete published și versiunea curentă; editor/admin AAL2 pot citi drafturi prin proiecția editorială | Executor + rol editorial/MFA; draft/publicare/retragere, cu audit                                                              |
| `recipe_servings`, `recipe_ingredients`, `recipe_steps`, `recipe_tags`                                                                                                                                                                                | După vizibilitatea versiunii-părinte; views publice verifică explicit published/current inclusiv pentru editor     | Executor editorial; triggerii refuză orice modificare a copiilor publicați                                                     |
| `profiles`                                                                                                                                                                                                                                            | Numai profilul contului activ curent                                                                               | UPDATE doar display_name/locale/time_zone prin RPC; fără rol, owner sau status editabil                                        |
| `user_preferences`, `user_ingredient_exclusions`, `user_allergen_exclusions`, `user_preference_tags`                                                                                                                                                  | Numai contul activ curent; fără proiecție HTTP în această etapă                                                    | Preferințele, dieta și alergenii se salvează atomic prin save_my_profile; excluderile de ingrediente nu au încă RPC de editare |
| `pantry_items`, `meal_plans`, `meal_plan_entries`, `shopping_lists`, `shopping_list_items`                                                                                                                                                            | Numai owner activ; fiecare copil are propria politică                                                              | Numai RPC-uri care derivă owner și verifică resursa/revizia                                                                    |
| `favorites`                                                                                                                                                                                                                                           | Numai owner activ                                                                                                  | RPC set/unset; adăugarea cere rețetă publicată                                                                                 |
| `shopping_list_item_sources`                                                                                                                                                                                                                          | Numai owner activ; fără proiecție HTTP                                                                             | Fără scriere client; generarea/reconcilierea nu sunt implementate                                                              |
| `ai_requests`                                                                                                                                                                                                                                         | Numai owner activ; fără proiecție HTTP                                                                             | Fără grant de scriere sau integrare AI                                                                                         |
| `account_states`, `user_roles`                                                                                                                                                                                                                        | Numai helperul de autorizare, pentru subiectul curent                                                              | Stare inițială prin provisioner; schimbările privilegiate numai prin operator, nu client/RPC public                            |
| `audit_logs`                                                                                                                                                                                                                                          | Fără citire client                                                                                                 | INSERT editorial prin executor, actor curent; fără UPDATE/DELETE în aplicație                                                  |

Migrația 08 adaugă `equipment_types` (SELECT public, fără scriere client) și
`user_equipment` (SELECT propriu, INSERT/DELETE numai prin RPC-ul profilului).
Bugetul per masă, moneda și persoanele sunt în `user_preferences`. Ambele tabele
noi au FORCE RLS. `get_my_profile` este privat; `profile_options` întoarce numai
dicționare publice; `save_my_profile` nu acceptă owner sau rol.

Un grant SELECT pe tabela suport este necesar pentru `security_invoker`; USAGE
pe schema privată nu o transformă în endpoint Data API. RLS rămâne protecția
datelor și la acces SQL, iar schemele expuse limitează suprafața HTTP.
Nu adăuga `GRANT ALL` din exemplele generice Supabase.

## Suprafața Data API

Public, numai SELECT:

- `recipes`, `recipe_servings`, `recipe_ingredients`, `recipe_steps`, `recipe_tags`;
- `ingredients`, `ingredient_aliases`, `ingredient_categories`, `units`, `tags`,
  `allergens`, `ingredient_allergens`.

Autentificat, numai SELECT și owner activ:
`my_profile`, `my_pantry`, `my_meal_plans`, `my_meal_entries`, `my_shopping_lists`,
`my_shopping_items`, `my_favorites`.

Editorial (authenticated + rol live + AAL2), numai SELECT:
`editor_recipe_versions`, `editor_recipe_servings`, `editor_recipe_ingredients`,
`editor_recipe_steps`, `editor_recipe_tags`. Proiecția versiunii oferă `recipe_id`,
`id`, `updated_at` pentru ciclul draft → citire → editare → publicare.

RPC-uri autentificate:

| Funcție                                                                                                                      | Regula                                                                                                    |
| ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `actor_context()`                                                                                                            | Actor activ, roluri curente și AAL, fără token/email/metadate brute                                       |
| `update_my_profile(...)`                                                                                                     | Numai câmpuri explicite; fusul validat în pg_timezone_names; profilul folosește ultima scriere            |
| `save_pantry_item(...)`, `save_meal_plan(...)`, `save_meal_entry(...)`, `save_shopping_list(...)`, `save_shopping_item(...)` | ID NULL = creare, expected_revision NULL; ID existent = owner verificat + revizie exactă; returnează UUID |
| `delete_pantry_item`, `delete_meal_plan`, `delete_meal_entry`, `delete_shopping_list`, `delete_shopping_item`                | ID + revizie; același răspuns pentru resursă absentă și resursă străină                                   |
| `set_shopping_progress(...)`                                                                                                 | Progres propriu în limitele necesarului; nu modifică inventarul                                           |
| `set_favorite(...)`                                                                                                          | Owner derivat, fără duplicare; nu poate favoriza un draft                                                 |
| `save_recipe_draft(...)`, `publish_recipe(...)`, `withdraw_recipe(...)`                                                      | Editor/admin activ + AAL2, verificări repetate în DB și audit în aceeași tranzacție                       |

Semnăturile exacte sunt în migrația 06; parametrii `p_quantity` și
`p_purchased_quantity` sunt șiruri zecimale, `p_expected_revision` este bigint.
`p_expected_updated_at` trebuie păstrat cu precizia PostgreSQL, fără conversie
intermediară la JavaScript Date care ar pierde microsecundele. RPC-ul de draft
înlocuiește atomic colecțiile din payload; nu acceptă SQL, owner sau status.
Versiunea rețetei este returnată ca UUID; recitește proiecția editorială pentru
revizia finală, după toate modificările copiilor.

`P0002` = resursă absentă/inaccesibilă; `40001` = revizie expirată sau conflict de
serializare; `42501` = refuz; `22023` = input invalid; `23514` = invariantă încălcată.
Un client trebuie să reîncarce starea la revizie expirată; nu repeta automat același
payload stale. Serializarea reală/deadlock cer retry limitat al întregii tranzacții.
Nu se expun mesajele SQL brute în viitoarele endpointuri de business.

Planul/masa cu surse de cumpărături nu poate fi șters, iar rețeta/porțiile unei
mese legate nu pot fi modificate, până la implementarea reconcilierii atomice.
Părinții și intrările sunt blocate înainte de verificarea legăturilor. Mutarea
între planuri și modificarea cantităților articolelor generate nu sunt oferite
prin aceste RPC-uri. Crearea meselor, liniilor manuale și bifarea rămân posibile.

## Auth și server

`createVerifiedRequest` cere Bearer JWT, validează formatul/lungimea, apoi contactează
`/auth/v1/user`. Nu folosește decodarea locală sau `getSession()` ca dovadă de
identitate. Citește apoi `api.actor_context()` cu același token și verifică același
UUID. Schimbările de rol/status sunt reevaluate la următoarea cerere și în fiecare
RPC. Nu există cache global al actorului sau client partajat între utilizatori.

Implementarea REST folosește native fetch în locul unor dependențe SDK noi.
Supabase Auth deține în continuare parolele, tokenurile și MFA. Pagini/formulare de
login, înregistrare, recuperare/confirmare/resetare, MFA și profil sunt implementate.
Sesiunea web este ținută într-un cookie HttpOnly criptat, iar proxy-ul Next face
refresh. Endpointurile acceptă Bearer explicit sau sesiunea cookie verificată.
Mutațiile Server Action verifică Origin; detalii în [AUTH-PROFILE.md](AUTH-PROFILE.md).
OAuth și sesiunea client Supabase/Realtime nu sunt implementate.

Modulele server-only acceptă numai cheia `sb_publishable_*`. Secret/service role
nu se folosește nici pe server pentru datele utilizatorului. Fetch este no-store,
fără redirects, timeout 5 secunde și maximum 256 KiB pe răspuns. Auth/context și
răspunsurile resurselor sunt validate Zod. `requireOwnedResource` verifică din nou
ID/owner după SELECT prin RLS; verificarea prealabilă nu înlocuiește autorizarea
din RPC, evitând dependența de un preflight care poate deveni stale.

`requireRole` este exclusiv server-side și primește actor verificat, niciodată
JSON din client. Nu permite AAL1 pentru operații editoriale. Backendul returnează
numai cod/mesaj sigur/requestId, fără SQL, stack, headers, email sau JWT.
Server Actions folosesc cookie și verifică Origin; Data API primește JWT Bearer. Nu transforma ulterior GET-urile în mutații și nu accepta roluri din body.

## Storage

| Bucket privat     | Politici și limite                                                                                                            |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `recipe-media`    | Imagini JPEG/PNG/WebP, maximum 5 MiB; upload/read/delete numai editor/admin AAL2 activ, `owner_id=auth.uid()` și path propriu |
| `account-exports` | JSON/ZIP, maximum 50 MiB; numai download pentru owner activ; fără upload/update/delete client                                 |

Numele sunt fixe în migrații și adaptor: `<user-uuid>/<object-uuid>.<extensie>`;
fără subdirectoare libere, traversal, SVG sau suprascriere prin upsert/UPDATE.
MIME/size se verifică de serviciul Storage; politica SQL nu dovedește că octeții
unei imagini sunt siguri. Bucketul media rămâne privat până la un pipeline explicit
de verificare/publicare. Nu există încă generare de exporturi sau job privilegiat.
Nu șterge rânduri reale din `storage.objects` prin SQL ca să elimini fișiere;
folosește API-ul Storage. Fixture-ul de test verifică numai metadatele/politicile.

`createPrivateDownload` cere path propriu și, pentru media, rol/MFA; Storage
reverifică RLS la semnare. URL-ul rezultat trebuie să aibă originea și calea așteptate;
expiră în 60 secunde. URL-ul semnat este o capabilitate: nu îl loga sau pune în cache
public. Dezactivarea contului nu revocă un link deja emis înaintea expirării.
Nu există politică de acces anonim la fișiere în această etapă.

## Configurare locală

Prerechizite: Node din `.nvmrc`, Docker funcțional și Supabase CLI instalat conform
documentației oficiale. CLI și imaginile nu sunt descărcate automat de build/test.

```sh
supabase --version
supabase start
```

Nu rula `supabase init` peste configurația versionată. Pornirea unui proiect local
nou aplică migrațiile. Pentru reaplicare **numai pe stackul local dispensabil**,
după salvarea datelor necesare:

```sh
supabase db reset --local
```

Resetul distruge datele locale; nu este o verificare de producție. În acest task
nu s-a executat niciun reset. `supabase/config.toml` expune numai `api`, cu maximum
200 rânduri/răspuns. `app_private`, `cookly_security`, `auth`, `storage` nu se adaugă
la lista schemelor Data API. Storage/Auth au propriile API-uri.

Copiază `.env.example` în `.env.local`, păstrând celelalte setări ale proiectului,
apoi completează numai URL-ul API și cheia **publishable** afișate de stackul local.
CLI-urile recente afișează chei moderne; dacă instalarea oferă doar chei JWT legacy,
actualizează CLI-ul în loc să relaxezi validatorul. Nu copia întregul output al
`supabase status` în `.env.local`: poate conține și secrete administrative.
Nu comite `.env.local`. `SUPABASE_SECRET_KEY` poate rămâne gol; accesul web nu îl cere.
Numele bucketurilor existente în exemplu trebuie să rămână cele din migrații.

```sh
npm ci
npm test
npm run test:db
npm run dev
```

PGlite trebuie instalat ca dependență dev înainte de testele DB; vezi rezultatul
efectiv în [SUPABASE-VERIFICATION.md](SUPABASE-VERIFICATION.md). Runnerul nu acceptă
URL de DB și nu poate accesa proiectul hosted. Testul de schemă anterior verifică
explicit snapshotul 01–04; `access.test.mjs` verifică întreaga secvență 01–08.

Auth local cere confirmarea emailului și schimbarea sigură a parolei. Citește
emailurile în serviciul local de mail (port 54324), fără SMTP real. Redirecturile
sunt exacte, către callbackul local rezervat; OAuth nu este implementat; confirmarea emailului folosește pagina token_hash și template-urile versionate. TOTP este activat; editorul finalizează challenge-ul din /auth/mfa, iar serverul păstrează noul token AAL2 pentru operațiile editoriale.

Bootstrap editorial: operatorul de încredere verifică UUID-ul unui cont creat prin
Auth și introduce rolul în `app_private.user_roles` prin SQL administrativ local.
Nu există prim-admin automat, secret în repository sau endpoint de autopromovare.
La bootstrap pe un mediu real, înregistrează aprobarea și evenimentul de audit în
procesul administrativ; managementul rolurilor în UI/RPC este o sarcină separată.

În hosted, `config.toml` nu înlocuiește configurarea proiectului: operatorul trebuie
să seteze schemele expuse, HTTPS Site URL/redirecturi exacte, email/SMTP, MFA și
rate limits/captcha conform mediului. Nu aplica migrațiile pe un proiect folosit
înainte de reconcilierea istoricului și verificarea backupului. Bucketurile presupun
un proiect nou, fără alte politici permisive care le-ar putea lărgi accesul.

## Teste și verificări manuale

Testele Node server folosesc stub HTTP exclusiv pentru serviciul extern; dovedesc
validarea/erorile/caching-ul adaptorului, nu verificarea criptografică Supabase.
Testele DB folosesc PostgreSQL PGlite și roluri reale în acea bază, cu fixture-uri
minimale pentru auth.uid/JWT/Storage; nu înlocuiesc serviciile Auth/Storage/PostgREST.

Pe stack real, verifică anon/A/B/editor/admin/disabled: SELECT, POST RPC direct,
metadate `role=admin`, ID străin, owner fals, revizie veche, AAL1/AAL2, grant revocat,
publicare/retragere, upload MIME/size/path și expirarea linkului semnat. Testează
operațiile concurente și retry-ul. Rulează Security Advisor și inspectează politicile
existente înainte de orice lansare. Formularele Auth/profil includ pending, error, success și stări pentru opțiuni indisponibile. UI-ul existent este păstrat.

## Referințe primare

- [RLS Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security)
  pentru politici și limitările bypassului.
- [Funcții DB](https://supabase.com/docs/guides/database/functions) pentru definer,
  search_path și revocarea EXECUTE.
- [Storage access control](https://supabase.com/docs/guides/storage/security/access-control)
  pentru politicile pe metadatele obiectelor.
- [Configurația CLI](https://supabase.com/docs/guides/local-development/cli/config)
  pentru setările Auth, DB și API.
- [API keys](https://supabase.com/docs/guides/getting-started/api-keys) pentru cheia
  publicabilă și rolurile anon/authenticated.
- [Auth getUser](https://supabase.com/docs/reference/javascript/auth-getuser)
  pentru verificarea utilizatorului la serviciul Auth.
