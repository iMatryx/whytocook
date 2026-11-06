# Cookly — Shell-ul aplicației și routing

Etapa 2 · 1 noiembrie 2026 · Fără funcționalități de business.

Document istoric al shell-ului. Actualizare etapa 4: `/my-fridge` este acum public,
cu inventar guest local și inventar privat pentru cont; detalii în
[My Fridge](../pantry/MY-FRIDGE.md). Celelalte fluxuri Auth/catalog sunt documentate
în rapoartele etapelor respective, nu în stările placeholder de mai jos.

## Rute și comportament

| URL                   | Pagina               | Stare actuală                                                                    |
| --------------------- | -------------------- | -------------------------------------------------------------------------------- |
| `/`                   | Acasă                | Textul fundației păstrat, legături spre rețete/frigider/plan                     |
| `/recipes`            | Rețete               | Căutare, filtre URL, paginare și compatibilitate; demo explicit prin source=demo |
| `/recipes/[recipeId]` | Detalii rețetă       | Detaliu pe slug, inventar, porții și Cooking; vezi docs/recipes/COOKING.md       |
| `/my-fridge`          | Frigiderul meu       | Inventar în pregătire, fără afirmația că inventarul utilizatorului este gol      |
| `/meal-planner`       | Planificator de mese | Calendar 7 zile, porții, prep, buget și shopping; guest local și cont cu RLS     |
| `/shopping-list`      | Lista de cumpărături | Listă inteligentă, guest local și cont cu RLS                                    |
| `/favorites`          | Favorite             | Salvarea rețetelor nu este activată                                              |
| `/assistant`          | Asistent             | AI nu este activat, nu există chat sau apel extern                               |
| `/profile`            | Profil               | Fără date personale sau presupunerea unei sesiuni                                |
| `/login`              | Autentificare        | Fără formular de credențiale sau autentificare simulată                          |
| `/admin`              | Administrare         | Prezentare publică fără date, roluri sau operațiuni administrative               |

`home` este ruta `/`, nu o rută suplimentară `/home`. Numele actuale cerute pentru URL-uri înlocuiesc propunerile orientative `/pantry` și `/shopping` din documentele de planificare. Modulele fizice viitoare rămân `pantry`, `shopping`, `meal-planner`; contractele API nu sunt redenumite și nu sunt implementate acum.

`/ui-kit` rămâne separat, cu propria navigare de referință. Nu primește un al doilea header sau sidebar din shell.

## Layout și limite server/client

Route group-ul `src/app/(shell)` nu apare în URL. Layoutul său randează `AppShell`, un Server Component care compune:

- `ShellHeader`: brand, navigare de cont desktop, selector de temă și declanșator mobil.
- `ShellSidebar`: navigare principală desktop de la `lg` (1024 px), grupată în Descoperă, Organizează și Administrare.
- Un singur `<main id="main-content" tabIndex={-1}>`, cu breadcrumbs și conținutul paginii.
- `ShellFooter`: text și link real către `/recipes`.

Pagini, texte, footer, header, sidebar, skeleton și starea 404 sunt Server Components. Sufixul `.server.tsx` este convenția proiectului, iar `import "server-only"` protejează granița la build. Regula ESLint permite explicit aceste fișiere și continuă să refuze importul lor din insulele client.

Insulele client sunt `ShellNavigationLinks` (usePathname/aria-current), `MobileNavigation` (drawer/focus), `Breadcrumbs` (pathname în layoutul persistent) și selectorul de temă existent. Pagina nu devine Client Component doar pentru că layoutul include aceste insule; children sunt randate pe server.

Shell-ul folosește tokenurile și primitivele UI kitului, fără biblioteci noi. Containerele au lățime maximă 80 rem, padding responsive și coloană de conținut `minmax(0,1fr)` pentru a evita overflowul.

## Navigare activă, focus și breadcrumbs

`src/config/navigation.ts` este sursa comună pentru cele zece destinații de navigare. Texte mai lungi și mesaje placeholder sunt separate în `src/config/shell-pages.ts`.

Helper-ele pure din `shared/presentation/shell-navigation.ts` normalizează trailing slash/query/hash și compară segmente complete: `/recipes/demo` activează Rețete, `/recipes-extra` nu. Acasă este activ numai la `/`. Linkul exact folosește `aria-current="page"`; secțiunea părinte a detaliului folosește `location`.

Breadcrumbs au numele accesibil „Traseu de navigare”; ultimul element este text cu aria-current, nu link către sine. Detaliul are Acasă → Rețete → Detalii rețetă. Nu afișează un titlu de rețetă inventat sau identificatorul brut în locul lui.

Pe mobil, toate cele zece destinații sunt disponibile într-un drawer modal, inclusiv Cont și Admin. Escape/închiderea normală restaurează focusul la trigger. Alegerea unei rute mută focusul la main. Triggerul rămâne montat când pathname se schimbă; starea drawerului este ajustată pentru noua rută și tratează și Back/Forward când panoul era deschis. Testele browser dedicate nu trebuie confundate cu verificarea statică a acestui mecanism.

Linkul global „Sari la conținut” este păstrat. Navigarea permite deschiderea în alt tab prin modificatori; în acel caz nu închide meniul ca și cum s-ar fi navigat în tabul curent.

## Placeholder, validare și erori

`PagePlaceholder` este Server Component cu h1, descriere, status „În pregătire” și o secțiune h2. Textele nu presupun că utilizatorul este conectat sau că un inventar/catalog a fost deja interogat. Nu există butoane false de salvare, login sau administrare.

Ruta păstrează numele structural `[recipeId]`, dar acceptă sluguri canonice lowercase, maximum 100 caractere. Slug invalid → `notFound()`. Existența este verificată separat de API-ul de detaliu: numai published/current implicit sau colecția demonstrativă la `source=demo`. Un slug inexistent produce răspuns API 404 și stare de negăsit în UI. Pagina include Cooking; vezi [COOKING.md](../recipes/COOKING.md).

`(shell)/loading.tsx` păstrează cadrul și afișează un skeleton cu status accesibil; nu introduce întârzieri artificiale. `(shell)/error.tsx` oferă eroare recuperabilă și reset. Pentru 404 în shell se randează numai conținutul, iar pentru un URL complet necunoscut, root not-found construiește cadrul: nu se dublează main/header.

Next.js poate întoarce 200 pentru un not-found într-un răspuns deja streamuit și 404 pentru răspunsuri nestreamuite. Nu se pretinde un HTTP 404 verificat pentru detaliul invalid înainte de testarea serverului. Mecanismul și noindex sunt descrise în [Next.js — not-found](https://nextjs.org/docs/app/api-reference/file-conventions/not-found).

Toate paginile acestui shell au `noindex, nofollow` cât timp sunt placeholders. Profilul și adminul nu sunt protejate prin Auth în această etapă și nu oferă capabilități privilegiate. În etapa de autentificare trebuie adăugate autorizarea server, RLS și gate-urile adecvate; ascunderea linkului nu este control de acces.

## Verificare și reproducere

În mediul actual există `node_modules` și `package-lock.json`, instalate între etape. Sunt păstrate; nu se adaugă dependențe și nu se migrează managerul de pachete în această sarcină. pnpm nu este disponibil în PATH, astfel verificările sunt rulate prin npm pe instalarea existentă.

```sh
npm test
npm run test:shell
npm run lint
npm run typecheck
npm run build -- --webpack
npm run test:prerender
npm run test:e2e -- --list
npm run test:e2e -- --workers=1
npm run dev
```

Opțiunea Webpack verifică producția în sandbox fără portul intern folosit de Turbopack/PostCSS. Scriptul implicit build rămâne neschimbat. `test:prerender` cere un build existent și verifică HTML-ul celor nouă rute statice și fallbackul 404; home și detaliul sunt dinamice și necesită verificare la cerere.

Runnerul Playwright pornește propriul server prin `npm run dev`, fără să instaleze pachete și fără să reutilizeze un server necunoscut. Sunt definite 16 scenarii de shell (11 rute plus navigare/istoric/404/cont), 23 în total cu suitele anterioare. Instalarea Playwright curentă cere Chromium revision 1248; cache-ul local observat are 1243. Un browser compatibil poate necesita `npm exec playwright install chromium` înainte de rulare.

Rezultatele reale și inventarul fișierelor sunt în [SHELL-VERIFICATION.md](SHELL-VERIFICATION.md). Manual: verifică toate URL-urile, desktop/mobil la 360 px, zoom 200%, tastatură/cititor de ecran, focus după meniu/istoric, tema și conținutul loading/error. Nu începe etapa următoare fără cerere separată.

Actualizare etapa 5: `/favorites` este publică pentru starea locală a invitaților;
conținutul conturilor rămâne privat și verificat la API. Colecțiile, istoricul și
migrația 18 sunt descrise în [ORGANIZATION.md](../recipes/ORGANIZATION.md).

Actualizare lista inteligentă: `/shopping-list` este publică pentru invitați,
cu datele contului verificate prin API. Migrația 19 și agregarea/transferul sunt
în [SMART-SHOPPING.md](../shopping/SMART-SHOPPING.md).

Actualizare planificator: `/meal-planner` este publică pentru invitați și permite
persistență privată în cont. Calendarul, alocarea virtuală, bugetul și migrația 20
sunt documentate în [MEAL-PLANNER.md](../planner/MEAL-PLANNER.md).
