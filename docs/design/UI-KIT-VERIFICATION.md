# Cookly — Verificare UI kit

Etapa 2 · 1 noiembrie 2026 · Bază: commit `8b4b604`.

## Implementare și scop

Tokenuri semantice light/dark, extensia Button existent, Input/Textarea/TextField, Badge/Tag/Chip, combobox controlat, modal și drawer responsive, toast, navigare, RecipeCard și CompatibilityBadge, Skeleton/EmptyState/ErrorState. Galeria de referință este `/ui-kit`, cu metadata noindex și date fictive. Homepage-ul și regulile de mediu ale fundației sunt păstrate.

Dependențe noi declarate, fără instalare confirmată: `@radix-ui/react-dialog` pentru focus și dismiss modal; `@radix-ui/react-popover` pentru poziționarea/layeringul sugestiilor; `sonner` pentru toast și regiunea de notificări. Sunt utilizate cu primitivele și tokenurile shadcn deja prezente; nu se adaugă cmdk, Vaul, icon package, Storybook sau state manager.

## Comenzi și rezultate reale

| Comandă | Rezultat |
| --- | --- |
| `git status --short` înainte de schimbări | Curat |
| `COREPACK_HOME=/private/tmp/cookly-corepack corepack pnpm --version` | Eșec în sandbox: ENOTFOUND registry.npmjs.org |
| `corepack pnpm --version`, cu escaladare | În așteptarea aprobării; nu se presupune succes |
| `node --test tests/ui-kit/presentation.test.ts` înainte de implementare | 3 eșuate, 1 trecut contra stuburilor — red phase |
| Aceeași comandă după implementare | 4 trecute, 0 eșuate |
| `node --test tests/ui-kit/tokens.test.mjs` înainte de tokenuri | 2 eșuate — perechile de tokenuri nu existau încă în forma testată |
| Aceeași comandă după tokenuri | 2 trecute, 0 eșuate |
| `node --test tests/ui-kit/*.test.* tests/architecture/import-boundaries.test.mjs` | 14 trecute, 0 eșuate |

Testele tokenurilor verifică perechi text/suprafață la minimum 4,5:1 și contur input/pagină la 3:1 în ambele teme. Nu este un audit WCAG complet și nu verifică pixels randate, transparențe sau toate stările de hover.

Revizuirea statică a identificat redeschiderea comboboxului prin click pe inputul deja focalizat și scrollul opțiunii active înainte de montarea portalului. Au fost corectate prin handler de click și scroll în callbackul ref al nodului activ, după montare; este adăugat scenariu de regresie Playwright pentru redeschidere. Preview-ul de card păstrează openerul explicit pentru restaurarea focusului.

## Verificări neexecutate și limitări

- Instalarea pachetelor, generarea lockfile-ului, format/lint, typecheck, build și pornirea Next.js nu sunt confirmate. `node_modules` lipsește din etapa anterioară.
- Cele cinci scenarii noi Playwright sunt scrise, dar neexecutate: combobox/chip, focus modal, straturi în drawer, card/favorite/preview/toast și responsive/theme/navigation.
- Fără capturi de browser sau validare vizuală efectivă: acestea necesită aplicația pornită. Nu există rezultate inventate pentru a suplini lipsa execuției.
- Combobox single-select/local, fără creare de ingrediente sau căutare remote. Drawer-ul este un sheet modal, fără swipe/drag.
- Prețurile și disponibilitatea din galerie sunt exemple; nu sunt măsurători sau rezultate reale de matching. Favoritele se resetează la reîncărcare.

## Verificare manuală după instalare

1. Rulează `pnpm dev` și deschide `/ui-kit` pe desktop și mobil.
2. Schimbă light/dark/system, reîncarcă pagina și verifică focusul și textele lungi la zoom 200%.
3. Parcurge comboboxul cu săgeți/Enter/Escape/Tab; verifică touch, liste lungi și opțiuni dezactivate.
4. Verifică focus trap, închidere în ordinea straturilor și restaurarea focusului pentru modal, drawer și preview.
5. Verifică screen reader, stările de eroare, notificările și faptul că statusurile au etichete, nu doar culoare.

Nu s-au implementat features de business și nu s-a început etapa următoare.

## Fișiere create/modificate

Create (27):

- `docs/architecture/UI-KIT-PLAN.md`
- `docs/design/DESIGN-SYSTEM.md`
- `docs/design/UI-KIT-VERIFICATION.md`
- `public/ui-kit/pasta.svg`
- `public/ui-kit/salad.svg`
- `src/app/ui-kit/page.tsx`
- `src/components/design-system/ui-kit-gallery.tsx`
- `src/components/feedback/empty-state.tsx`
- `src/components/feedback/error-state.tsx`
- `src/components/layout/app-navigation.tsx`
- `src/components/recipes/compatibility-badge.tsx`
- `src/components/recipes/compatibility.ts`
- `src/components/recipes/recipe-card.tsx`
- `src/components/ui/badge.tsx`
- `src/components/ui/combobox-model.ts`
- `src/components/ui/combobox.tsx`
- `src/components/ui/dialog.tsx`
- `src/components/ui/drawer.tsx`
- `src/components/ui/icon.tsx`
- `src/components/ui/input.tsx`
- `src/components/ui/skeleton.tsx`
- `src/components/ui/tag.tsx`
- `src/components/ui/text-field.tsx`
- `src/components/ui/toast.tsx`
- `tests/e2e/ui-kit.spec.ts`
- `tests/ui-kit/presentation.test.ts`
- `tests/ui-kit/tokens.test.mjs`

Modificate (5):

- `README.md`
- `package.json`
- `src/app/layout.tsx`
- `src/components/ui/button.tsx`
- `src/styles/globals.css`
