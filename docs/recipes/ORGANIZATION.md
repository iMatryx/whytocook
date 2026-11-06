# Etapa 5 — Favorite, colecții și istoric

Pagina `/favorites` este disponibilă autentificaților și invitaților. Favoritele și „Am gătit” din pagina rețetei alimentează această pagină. Utilizatorul poate crea, redenumi și șterge colecții și adăuga/elimina rețete din favorite sau istoric în oricâte colecții. Ștergerea istoricului și a unei colecții cere confirmare. Eliminarea unui favorit nu elimină rețeta din colecții.

## Persistență și securitate

- Invitați: extensie compatibilă a cheii existente `cookly-recipe-actions-v1`; câmpul `collections` este implicit gol pentru datele vechi. Operațiile păstrează cumpărăturile și registrul de idempotency Cooking. Maximum 500 favorite, 50 colecții × 500 membri și ultimele 100 preparări locale și ultimele 100 operații pentru deduplicare. Stocarea invalidă sau plină produce eroare, fără înlocuire automată. Web Locks serializează modificările între taburi unde sunt disponibile; comparația valorii anterioare respinge scrierile stale.
- Conturi: date exclusiv prin sesiune verificată și RPC cu tokenul utilizatorului. API-ul nu primește un owner arbitrar: `expectedAccountId` confirmă identitatea verificată. POST verifică origin, content type, dimensiunea corpului și Zod; răspunsurile sunt private/no-store. Sesiunile expirate sau invalide produc erori și nu activează modul invitat.
- Migrarea `20261103000018_recipe_organization.sql` extinde schema fără modificarea migrărilor anterioare. Aplică RLS ENABLE/FORCE, granturi restrictive, chei compuse pentru proprietatea membrilor și unicitate pentru numele normalizate și perechile colecție/rețetă. RPC derivă owner din JWT și serializează mutațiile aceluiași cont prin lock pe profil.
- Istoricul este separat în `recipe_history`, cu backfill din operațiile Cooking existente și trigger pentru preparările noi. Ștergerea elimină toate rândurile istoricului contului, nu doar cele 100 afișate. `get_recipe_actions` citește aceeași sursă; replay-ul operațiilor Cooking șterse nu recreează istoricul.
- Registrul tehnic preexistent `recipe_action_operations` și `operations` local rămân pentru deduplicarea retry-urilor. Ștergerea istoricului din interfață nu reprezintă ștergerea acestui registru; el include încă metadatele operațiilor, inclusiv data, rețeta și porțiile. O politică de retenție/anonimizare pentru registru necesită o decizie separată.

## Decizii și limite

Istoricul înregistrează preparări confirmate, nu vizualizări. Preparări distincte ale aceleiași rețete sunt legitime; duplicatele aceleiași operații sunt prevenite. Colecțiile sunt independente de favorite. Nu există sincronizare/import automat din browser în cont și nici între dispozitive pentru invitați. Acțiunile demo ale utilizatorilor autentificați rămân în memoria paginii, conform comportamentului Cooking existent, și nu se salvează în cont.

Numele colecțiilor se normalizează NFC, prin trim, comprimarea spațiilor Unicode și comparație case-insensitive; limita este 80 caractere. Numele lungi sunt afișate cu împărțire pe rânduri. Crearea și redenumirea sunt intenții distincte (`saveCollection.create`); o redenumire învechită nu recreează o colecție ștearsă, iar retry-ul identic al creării nu șterge membrii. Rețetele retrase din catalog nu sunt deschise din cont; pot fi eliminate din favorite/colecții. Pentru invitați, titlul este derivat din slug deoarece stocarea existentă nu include titlul; disponibilitatea se verifică în pagina rețetei. Pagina revalidează la focus, schimbare de vizibilitate și evenimente storage; erorile și schimbările de cont ascund snapshot-ul vechi. Revalidarea anulează dialogurile de confirmare și formularele vechi, inclusiv la trecerea în alt cont.

API-ul folosește limita existentă de 4 MiB pentru snapshotul RPC; un volum excesiv produce eroare explicită, fără trunchiere silențioasă. Nu există paginare în UI: conturile afișează ultimele 100 preparări; colecțiile sunt limitate la 50, fiecare cu 500 membri. Absența Web Locks reduce garanția de serializare între taburi la comparația stării înainte de scriere. Configurația Supabase reală nu a fost schimbată și migrarea nu a fost aplicată unui mediu extern.

## Fișiere ale etapei

Create:

- `src/features/recipes/contracts/organization.schema.ts` — tipuri/validare.
- `src/features/recipes/presentation/organization-storage.ts` — mutații locale.
- `src/features/recipes/presentation/use-organization.ts` — încărcare, persistență și revalidare.
- `src/features/recipes/presentation/organization-view.tsx` — UI responsive.
- `src/server/composition/recipe-organization.server.ts` — autentificare și compoziție RPC.
- `src/app/api/v1/recipes/organization/route.ts` — GET/POST privat.
- `supabase/migrations/20261103000018_recipe_organization.sql` — colecții, istoric și RLS.
- `tests/organization/local.test.ts`, `tests/organization/routes.smoke.mjs`, `tests/database/organization.test.mjs`, `tests/e2e/organization.spec.ts`.
- `docs/superpowers/plans/2026-11-03-recipe-organization.md` `docs/recipes/ORGANIZATION-VERIFICATION.md` și acest document.

Modificate:

- `src/app/(shell)/favorites/page.tsx` — înlocuiește placeholder-ul și permite invitați.
- `src/features/recipes/contracts/index.ts` — exporturi publice.
- `src/features/recipes/presentation/recipe-actions-storage.ts` — schema locală compatibilă cu colecții.
- `src/server/supabase/recipe-rpc.server.ts` — allowlist pentru noile RPC private.
- `package.json` — `test:organization`, inclus în `npm test`, și `test:organization-routes`.
- `src/server/http/recipe-response.server.ts` — mesaje de eroare specifice organizării.
- `tests/e2e/auth.spec.ts` — Favorite este acum disponibilă invitaților.
- `README.md`, `src/features/recipes/README.md`, `docs/architecture/SHELL-ROUTING.md` — integrarea documentației.

Modificările locale preexistente Cooking nu fac parte din această listă.

## Verificare manuală

1. Aplică migrarea într-un Supabase de dezvoltare; autentifică două conturi și verifică izolarea, persistența după logout/login și de pe alt dispozitiv.
2. Într-un browser invitat, salvează o rețetă demo și confirmă „Am gătit”; verifică `/favorites`, creează Fitness/Rapid, adaugă rețeta, reîncarcă pagina și elimină favoritul. Colecția trebuie păstrată.
3. Șterge istoricul cu confirmare și verifică pagina rețetei: marcarea anterioară dispare, favoritele/cumpărăturile/inventarul rămân intacte.
4. Verifică navigarea numai cu tastatura, dialogurile și revenirea focusului, ecran îngust și nume de colecții lungi.
5. Verifică două taburi, sesiune expirată/schimbată, rețetă retrasă, localStorage blocat/plin și reconectare după eroare.

Comenzi: `npm run test:organization`, `npm test`, `npm run test:db`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm run test:e2e -- tests/e2e/organization.spec.ts tests/e2e/cooking.spec.ts`.

## API și verificare

`GET /api/v1/recipes/organization` returnează scope guest fără acces la provider
dacă nu există credențiale; browserul citește apoi datele locale validate. O
sesiune furnizată dar invalidă nu este tratată ca guest. Pentru cont întoarce
favoritele, colecțiile, ultimele 100 preparări și titlurile publicate disponibile.
`POST` primește `{expectedAccountId,command}`; comenzile sunt `favorite`,
`saveCollection` (`id`, `name`, `create`), `deleteCollection`, `membership` și
`clearHistory`. Ownerul nu poate fi ales din body. API-ul cere Origin corect,
JSON de maximum 128 KiB și răspunde private/no-store, cu requestId. RPC-urile
au timeout 5 s și nu primesc cookie-uri. Datele de cont nu sunt salvate local.

Rezultate executate, inclusiv blocajul testelor browser: [ORGANIZATION-VERIFICATION.md](ORGANIZATION-VERIFICATION.md).
Nu s-a început o altă etapă și nu s-au creat commit/deploy în această sarcină.
