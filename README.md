# Cookly

Fundație pentru Cookly, cu Next.js App Router, React, TypeScript strict, Tailwind CSS și primitive shadcn/ui. Etapa 2 include shell-ul, teme, tooling și un design system reutilizabil; nu există features de business, autentificare activă, conexiune Supabase sau migrații.

**Starea verificării:** sursele și configurarea sunt create. Instalarea pnpm/dependențelor așteaptă aprobarea accesului la registry în afara sandboxului. Build-ul, pornirea și testele care folosesc pachete externe nu sunt încă verificate. Rezultatele exacte sunt în [SETUP-VERIFICATION.md](docs/architecture/SETUP-VERIFICATION.md).

## Cerințe și instalare

Node.js **24.14.0 sau o versiune 24.x ulterioară**, conform `.nvmrc` și `engines`. Este necesar Corepack pentru bootstrapul pnpm dacă pnpm nu este deja instalat.

```sh
corepack pnpm --version
corepack pnpm install
```

După activarea pnpm în PATH (de exemplu `corepack enable`, în mediul propriu), comenzile de mai jos se rulează direct cu `pnpm`. Bootstrapul prin Corepack nu cere instalarea unui pachet pnpm global cu npm. Pinul `packageManager` și `pnpm-lock.yaml` vor fi completate și verificate după aprobarea instalării; instalarea reproductibilă nu este încă demonstrată.

Opțional, copiază `.env.example` în `.env.local` la rădăcină. Shell-ul de dezvoltare nu cere credențiale. Nu completa niciodată secrete în fișierul versionat `.env.example`.

```sh
pnpm dev
```

Adresă implicită: `http://127.0.0.1:3000`. Un alt port se poate selecta cu `pnpm dev --port 3001`.

## Scripturi

| Comandă | Rol |
| --- | --- |
| `pnpm dev` | Server local Next.js, legat de loopback |
| `pnpm build` | Build de producție, fără ignorarea erorilor TypeScript |
| `pnpm start` | Server de producție pentru buildul existent |
| `pnpm lint` | ESLint Next/TypeScript și reguli locale de import |
| `pnpm typecheck` | Generare tipuri Next și `tsc --noEmit` |
| `pnpm format` / `pnpm format:check` | Prettier; documentele istorice de produs/arhitectură sunt păstrate |
| `pnpm test` | Teste Node pentru mediu și reguli de import |
| `pnpm test:architecture` | Testele regulii locale de import, fără servicii externe |
| `pnpm test:ui` | Teste native pentru filtrare, navigare combobox, etichete și contrastul tokenurilor |
| `pnpm test:watch` | Aceleași teste, în watch mode |
| `pnpm test:e2e` | Playwright: teme, persistență, hidratare, tastatură și 404 |
| `pnpm check` | Format, lint, typecheck și teste unitare/de arhitectură |

Playwright necesită browserul asociat versiunii instalate:

```sh
pnpm exec playwright install chromium
pnpm test:e2e
```

Testele E2E pornesc și opresc propriul server pe portul 3100. Nu reutilizează un server care ar putea avea altă configurație. `pnpm check` nu include build-ul sau browserul: rulează separat `pnpm build` și `pnpm test:e2e`.

## Mediu și secrete

- `src/config/env/schema.ts`: scheme Zod pure, erori cu numele variabilelor, fără valorile lor.
- `client.ts`: acces static numai la `NEXT_PUBLIC_SUPABASE_URL` și `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Ambele sunt goale sau configurate împreună; cheile privilegiate nu sunt acceptate ca publicabile.
- `server.ts`: configurația server și validare separată pentru integrarea Supabase sau viitoare mutații CSRF. Niciuna nu cere implicit cheia administrativă.
- `maintenance.ts`: validator server-only pentru viitorul executor, cu secrete distincte; executorul nu este implementat.

În producție sunt necesare `COOKLY_ENV=production` (sau `preview`) și `APP_BASE_URL` cu originea HTTPS reală. Nu folosi configurația development din exemplu la `pnpm start`. Pagina este randată dinamic și validează configurația server la cerere; build-ul nu contactează Supabase și nu cere cheile de mentenanță. Pentru un smoke local de producție se poate utiliza o origine HTTPS de test fără a o accesa în rețea, dar aceasta trebuie înlocuită la deployment.

`.env*` reale sunt ignorate. Configurația publică este inclusă la build și cere rebuild când se schimbă. Nu sunt acceptate implicit chei JWT legacy Supabase; se folosesc cheile moderne publicabile/secret, iar integrarea propriu-zisă aparține unei etape ulterioare.

## Structură și convenții active

```text
src/
  app/                     layout, homepage, loading, error, global-error, not-found
  components/theme/        provider și selector light/dark/system
  components/ui/button.tsx primitivă shadcn adaptată local
  config/env/              scheme și adaptoare de configurare
  shared/presentation/     cn pentru compunerea claselor
  styles/globals.css       Tailwind 4, tokenuri light/dark și focus
tooling/eslint/             regula locală de import și integrarea ESLint
tests/architecture/         teste native ale regulii de import
tests/e2e/                  smoke tests Playwright
```

Aliasul `@/*` indică `src/*`. `components.json` configurează shadcn pentru această structură. Se folosesc fonturi de sistem, fără descărcări de fonturi în build. `next-themes` păstrează preferința în `cookly-theme` și urmărește sistemul; selectorul devine activ după hidratare.

Regula ESLint locală verifică importuri/reexporturi statice și importuri dinamice literale: aliasuri și căi relative normalizate, contractele cross-feature după DAG, separarea browser/server și a straturilor. Nu este un analizor complet de graf/cicluri și nu înlocuiește `server-only`, autorizarea sau RLS. Nu sunt create anticipat directoare de features.

## Documentație

- [PRD](docs/product/PRD-Cookly.md)
- [README arhitectură](docs/architecture/README.md)
- [Arhitectură completă](docs/architecture/ARCHITECTURE-Cookly.md)
- [Structura țintă și convenții](docs/architecture/PROJECT-STRUCTURE.md)
- [Planul fundației](docs/architecture/SETUP-PLAN.md)
- [Verificări și limitări reale](docs/architecture/SETUP-VERIFICATION.md)
- [Design system: tokenuri, props și exemple](docs/design/DESIGN-SYSTEM.md)
- [Verificările UI kitului](docs/design/UI-KIT-VERIFICATION.md)

## Design system și UI kit

Galeria `/ui-kit` demonstrează butoane, câmpuri, combobox, tag/chip, compatibilitate, carduri de rețete, modal/drawer, toast, skeleton, empty/error states și navigare responsive. Are `noindex`, folosește date fictive și păstrează interacțiunile numai în memoria paginii. Pagina principală existentă este păstrată.

Componentele sunt în `src/components/{ui,feedback,layout,recipes}`; pagina de prezentare este în `components/design-system`. Tokenurile semantice light/dark sunt în `src/styles/globals.css`. Acest kit adaugă Radix Dialog pentru focus/dismiss modal, Radix Popover pentru sugestii poziționate și Sonner pentru toast; nu adaugă un motor de matching sau dependențe de features. Detaliile API și limitele accesibilității sunt în documentul de design.

Verificare disponibilă fără instalarea dependențelor:

```sh
node --test tests/ui-kit/*.test.* tests/architecture/import-boundaries.test.mjs
```

Rezultatul curent este 14 teste trecute (6 UI/tokenuri și 8 de import). Acesta nu include mediul Zod sau testele browser. Testele Playwright pentru UI kit sunt definite în `tests/e2e/ui-kit.spec.ts`, dar nu sunt încă executate.

Runnerul nativ Node înlocuiește propunerea opțională Vitest numai pentru testele acestei fundații; Playwright rămâne verificarea în browser. Documentele istorice nu pretind că toate fișierele arborelui țintă sunt deja implementate.

## Verificare manuală

După verificările executabile: schimbă tema, reîncarcă pagina, selectează Sistem și schimbă preferința OS; verifică mobil/desktop și absența erorilor de hidratare. Navighează doar cu tastatura, inclusiv linkul „Sari la conținut”, și verifică focusul vizibil. Evaluează separat cititorul de ecran și contrastul. Autentificarea, stocarea și fluxurile de business nu sunt demonstrabile în această etapă.

Nu începe o altă etapă fără cerere separată.
