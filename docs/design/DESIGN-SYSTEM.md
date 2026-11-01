# Cookly — Design system și UI kit

Etapa 2 · Versiune 1.0 · 1 noiembrie 2026  
Referință vizuală: `/ui-kit`, după instalarea și pornirea aplicației.

## 1. Scop și stare

Sistemul definește tokenurile, primitivele și componentele vizuale reutilizabile Cookly. Galeria folosește date fictive; nu caută rețete, nu calculează compatibilitatea, nu salvează favorite și nu trimite formulare la un backend. Pagina inițială a fundației este păstrată.

La implementare, dependențele fundației nu erau instalate. Testele native de prezentare/contrast și de import pot fi executate fără React instalat; verificările Next.js, TypeScript, lint și browser necesită instalarea pachetelor. Vezi [raportul de verificare](UI-KIT-VERIFICATION.md) pentru rezultate, nu deduce că build-ul trece din existența componentelor.

Componentele sunt în `src/components`, fără imports din features și fără repository-uri. Viitoarele ecrane de feature mapează DTO-urile validate la props de prezentare. Nu se creează anticipat module de business.

## 2. Direcție vizuală

Identitatea pornește de la verdele Cookly, asociat verdețurilor: suprafețe deschise, accente de pătrunjel și mentă, spațiu generos și titluri editoriale. Culorile de status au etichetă și icon, fără a comunica doar prin culoare. Contururile separă suprafețele; umbrele sunt rezervate straturilor flotante și controalelor peste imagini.

Fără fonturi sau fotografii încărcate din servicii externe. Cele două ilustrații SVG originale din `public/ui-kit` sunt mostre vizuale și nu pretind că sunt fotografii ale unor rețete reale.

### Culori

Sursa de adevăr este `src/styles/globals.css`. Tokenurile sunt CSS variables mapate în Tailwind prin `@theme inline`; `.dark` schimbă aceleași roluri, nu numele claselor.

| Rol | Token | Light | Dark |
| --- | --- | --- | --- |
| Suprafață pagină | `background` | `#fbfcfa` | `#131b17` |
| Text principal | `foreground` | `#202c24` | `#f1f5ef` |
| Card/panou | `card` | `#ffffff` | `#1b2720` |
| Acțiune/focus | `primary` / `ring` | `#24563d` | `#b5dbb7` |
| Text pe acțiune | `primary-foreground` | `#ffffff` | `#16291d` |
| Suprafață secundară | `secondary` | `#e7eee8` | `#283b2d` |
| Text secundar | `muted-foreground` | `#536158` | `#b2c0b5` |
| Contur decorativ | `border` | `#d5ded6` | `#3c5041` |
| Contur input | `input` | `#7b8f80` | `#789580` |
| Succes | `success` / `success-foreground` | `#e7f2e9` / `#225435` | `#203e2c` / `#b9e3c3` |
| Atenție | `warning` / `warning-foreground` | `#fff3c4` / `#6a4b0e` | `#403719` / `#f4dda1` |
| Eroare/acțiune distructivă | `danger` / `danger-foreground` | `#fbe9e7` / `#8d302a` | `#472723` / `#f4c2b9` |
| Informație | `info` / `info-foreground` | `#e9f0f9` / `#2d4a70` | `#24334a` / `#c1d7f6` |

Folosește `bg-card text-card-foreground`, nu culori hex dispersate în componente. Ilustrațiile și mostra explicită de paletă pot conține valori fixe. Tokenul `destructive` rămâne pentru compatibilitatea cu configurația shadcn; butonul distructiv al acestui kit folosește perechea tonală `danger`/`danger-foreground`.

Testele calculează contrastul pe culorile opace: minimum 4,5:1 pentru perechile text/suprafață testate și 3:1 pentru conturul inputului față de pagină. Aceasta nu certifică WCAG pentru ecrane compuse, imagini, transparențe sau stări viitoare. Cerința de text este documentată de [W3C — Contrast Minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).

### Tipografie

| Utilizare | Font și clasă | Mărime de referință |
| --- | --- | --- |
| Display | Georgia/Times, `font-display text-5xl sm:text-6xl` | 48 / 60 px |
| Titlu de secțiune | `font-display text-3xl sm:text-4xl` | 30 / 36 px |
| Titlu de card | `font-display text-2xl` | 24 px |
| Subtitlu | sans, `text-lg font-semibold` | 18 px |
| Body | sans de sistem, `text-base leading-relaxed` | 16 px |
| Controale și descrieri | sans, `text-sm` | 14 px; input 16 px pe mobil |
| Badge | sans, `text-xs font-medium` | 12 px |

Mărimile sunt în rem în Tailwind și răspund preferințelor browserului. Inputurile folosesc minimum 16 px pe mobil pentru a evita zoomul automat la focus pe unele dispozitive. Folosește sentence case și linii de aproximativ 65–75 de caractere pentru text de citit. Titlurile de pagină au nivel h1, secțiunile h2, cardurile din secțiune h3; nu folosi heading doar pentru dimensiune.

### Spacing, grid și breakpoints

Baza este `--spacing: 0.25rem` (4 px la fontul de bază de 16 px). Exemple: `gap-2` = 8 px, `gap-3` = 12 px, `p-4` = 16 px, `gap-6` = 24 px, `p-8` = 32 px, `py-12` = 48 px. Evită valori arbitrare când scala oferă un rezultat potrivit.

Containerul galeriei are `max-w-7xl` (80 rem), padding 16 px pe mobil și 32 px de la `sm`. Grid de referință: 4 coloane pe mobil, 6 la `md`, 12 la `lg`. Cardurile: o coloană implicit, două la `sm`, trei la `xl`, cu gap 24 px. Gridul este ghid, nu obligația de a împărți fiecare ecran în 12 elemente.

| Prefix Tailwind | Prag implicit | Rol orientativ |
| --- | --- | --- |
| implicit | sub 40 rem | Mobil, fără overflow orizontal de la 360 px |
| `sm` | 40 rem / 640 px | Două carduri unde au spațiu; drawer lateral |
| `md` | 48 rem / 768 px | Tabletă și grid de șase coloane |
| `lg` | 64 rem / 1024 px | Navigare desktop și grid de 12 coloane |
| `xl` | 80 rem / 1280 px | Trei carduri în galerie |
| `2xl` | 96 rem / 1536 px | Disponibil, fără extinderea nelimitată a textului |

Pragurile urmează [Tailwind — Responsive design](https://tailwindcss.com/docs/responsive-design). Nu sunt introduse breakpoints concurente în JavaScript. Controalele normale sunt de 40–44 px; butonul `sm` are 36 px. Panourile folosesc înălțime dinamică de viewport și scroll intern. Skeletonurile animă numai dacă utilizatorul permite mișcarea.

## 3. Primitive și props

Tipurile exportate din fișierele componentelor sunt contractul exact. Tabelele de mai jos descriu proprietățile specifice; primitivele Input, Textarea și Badge păstrează props native, inclusiv aria și ref în React 19.

| Componentă / import | Props specifice | Variante și comportament |
| --- | --- | --- |
| `Button`, `@/components/ui/button` | `variant`, `size`, `loading`; props button native | default, secondary, outline, ghost, link, destructive; default/sm/lg/icon. `loading` dezactivează și setează aria-busy. `asChild` compune un singur copil; loading/disabled sunt interzise în acel mod |
| `Input`, `Textarea`, `@/components/ui/input` | Props native, `className` | focus vizibil, disabled, aria-invalid; textarea redimensionabilă vertical. Labelul este responsabilitatea compoziției |
| `TextField`, `@/components/ui/text-field` | `label` obligatoriu; `hint`, `error`, `id`; restul props Input | ID stabil, label, required și legături aria-describedby; eroare anunțată. Nu validează și nu trimite formularul |
| `Badge`, `@/components/ui/badge` | `tone`, children, props span | neutral, accent, success, warning, danger, info. Este informativ, nu buton |
| `Tag`, `Chip`, `@/components/ui/tag` | Tag: Badge props; Chip: `label`, `onRemove?`, `removeLabel?`, `className?` | Tag informativ; Chip are buton de eliminare doar dacă există callback. Consumatorul restaurează focusul după eliminarea elementului |
| `Skeleton`, `@/components/ui/skeleton` | Props div, className | Formă decorativă aria-hidden; mesajul de încărcare este dat de container |
| `Icon`, `@/components/ui/icon` | `name: IconName`, props svg | Iconuri decorative locale, aria-hidden; controlul părinte trebuie să aibă nume accesibil |

`Button` are implicit `type="button"`; pentru formulare alege explicit `type="submit"`. Pentru link dezactivat nu utiliza doar atributul disabled pe un anchor: randează o alternativă neinteractivă sau aplică politica de navigare în ecran.

```tsx
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";

<TextField label="Denumire" name="name" required hint="Folosește un nume scurt." />
<Button type="submit" loading={pending}>Continuă</Button>
<Button asChild variant="outline"><Link href="/">Înapoi</Link></Button>
```

Exemplele cu state/callbackuri se folosesc într-o componentă client. Validarea de formular Zod și autorizarea server nu sunt înlocuite de aria-invalid sau de un buton disabled.

## 4. Combobox controlat

Import: `@/components/ui/combobox`. Props obligatorii: `label`, `options`, `value`, `onValueChange`. `options` este readonly și are `{ value: string; label: string; disabled?: boolean }`; valorile trebuie să fie unice și stabile.

Props opționale: `id`, `name` (hidden input cu valoarea canonică), `placeholder`, `emptyMessage`, `loading`, `disabled`, `required`, `hint`, `error`, `inputRef`. Componenta este single-select; textul liber nu devine valoare validă și nu produce ingrediente noi.

- Filtrarea locală ignoră capitalizarea și diacriticele; valoarea canonică nu este modificată.
- Săgețile sus/jos parcurg opțiunile și sar peste cele dezactivate, Enter selectează, Escape revine la valoarea confirmată, Tab închide sugestiile.
- Focusul DOM rămâne pe input; aria-activedescendant indică opțiunea activă. Clickul în input nu închide lista din greșeală.
- `loading` blochează selectarea, iar empty și error au mesaje distincte.
- Nu este un motor de căutare remote și nu produce ranking sau matching.

Poziționarea și layer-ul flotant folosesc Radix Popover. Keyboard modelul urmează [W3C — Combobox pattern](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/); implementarea trebuie verificată și cu tehnologii asistive, nu doar prin ARIA în markup.

```tsx
const [ingredient, setIngredient] = useState("");
<Combobox
  label="Ingredient"
  name="ingredientId"
  options={[{ value: "tomato", label: "Roșii" }]}
  value={ingredient}
  onValueChange={setIngredient}
/>
```

## 5. Modal, drawer și notificări

`Dialog` / `DialogTrigger` / `DialogClose` / `DialogContent` sunt în `ui/dialog`. Root păstrează props Radix, inclusiv `open`/`onOpenChange`. `DialogContent` cere **title și description**, acceptă children, footer, className și evenimentele Radix pentru focus/dismiss. Titlul și descrierea sunt legate de dialog prin primitivele bibliotecii.

`Drawer` / `DrawerTrigger` / `DrawerClose` / `DrawerContent` din `ui/drawer` folosesc același mecanism modal: panou inferior sub `sm`, lateral de la `sm`. Acesta este un sheet cu tastatură/focus modal, fără gesturi de drag sau swipe; nu adaugă Vaul. Focus trapping, Escape și întoarcerea la trigger sunt delegate Radix și au scenarii E2E dedicate. Pentru deschidere programatică fără Trigger, restaurează focusul în `onCloseAutoFocus`, ca în galeria de carduri.

```tsx
<Dialog>
  <DialogTrigger asChild><Button>Deschide</Button></DialogTrigger>
  <DialogContent title="Confirmare" description="Verifică informația înainte de continuare."
    footer={<DialogClose asChild><Button variant="outline">Închide</Button></DialogClose>}>
    <p>Conținutul dialogului.</p>
  </DialogContent>
</Dialog>
```

`Toaster` și `toast` sunt în `ui/toast`. Un singur Toaster este montat în layout, sub ThemeProvider. Sunt disponibile `toast()`, `toast.success()`, `toast.error()` și API-ul Sonner. Implicit: 6 secunde, buton de închidere, poziție bottom-right, temă rezolvată și tokenuri semantice. Etichetele containerului și ale închiderii sunt în română.

```tsx
toast.success("Exemplu confirmat", { description: "Aceasta este o demonstrație vizuală." });
// Pentru un mesaj care cere acțiune: oferă și feedback persistent în pagină.
toast.error("Acțiunea nu s-a încheiat", { duration: Infinity });
```

Nu anunța succesul unei salvări înainte de răspunsul serverului în viitoarele features. Kitul nu implementează o salvare sau un retry de rețea.

## 6. Carduri și compatibilitate

`RecipeCard` și `RecipeCardSkeleton`: `@/components/recipes/recipe-card`. Props:

| Prop | Contract |
| --- | --- |
| `title` | string obligatoriu; nume accesibil al articolului |
| `description` | string opțional |
| `timeLabel`, `servingsLabel` | stringuri deja formatate de ecran |
| `costLabel` | estimare formatată; absent → „Cost indisponibil”, niciodată zero inventat |
| `image` | `{ src, alt }` opțional; lipsă/eșec → „Fără fotografie”. Galeria folosește SVG locale |
| `compatibility` | `ready`, `check-quantities` sau `missing`, primit de la consumator |
| `favorite`, `onFavoriteChange` | stare controlată și callback; controlul este ascuns dacă nu există callback |
| `href` sau `onOpen` | alternative exclusive: link, buton de previzualizare sau titlu static dacă lipsesc ambele |
| `className` | extensie de layout, fără schimbarea sensului datelor |

Imaginile remote vor necesita allowlist Next/Image și politici de acces în etapa media; nu se introduce acum un host permis arbitrar. Datele brute de API trebuie validate înainte de mapare la props.

`CompatibilityBadge` din `components/recipes/compatibility-badge` afișează exact:

| Status primit | Etichetă | Semnal |
| --- | --- | --- |
| `ready` | Poți găti | success + check |
| `check-quantities` | Verifică cantitățile | warning + alert |
| `missing` | Ingrediente lipsă | neutral + info |

Nu deduce statusul din prezența numelui unui ingredient și nu acceptă un procent de potrivire inventat. Stabilirea statusului, alergenilor și cantităților este responsabilitatea matchingului viitor, conform PRD.

```tsx
<RecipeCard
  title="Salată cu verdețuri"
  timeLabel="20 min"
  servingsLabel="2 porții"
  compatibility="check-quantities"
  onOpen={() => setPreviewOpen(true)}
/>
```

## 7. Empty, error și navigation

`EmptyState` din `components/feedback/empty-state` cere title/description; acceptă action ReactNode, icon, compact și className. Este o secțiune cu heading asociat și o acțiune opțională, nu alertă tehnică.

`ErrorState` din `components/feedback/error-state` cere title/description; acceptă onRetry, retryLabel, announce (implicit true) și className. `announce=false` este folosit pentru exemplul static din galerie; în fluxul real, o eroare nouă poate fi anunțată. onRetry este furnizat de ecran, nu executat automat de componentă.

`RecipeCardSkeleton` anunță o singură stare de încărcare pe container; formele interioare sunt ascunse cititorului de ecran. Nu se folosește skeleton drept mesaj de eroare sau rezultat gol.

`AppNavigation` din `components/layout/app-navigation` primește `items: readonly {label, href}[]`; opțional activeHref, label, actions și onNavigate. Nu citește un feature și nu inventează rute. Desktopul apare de la `lg`; sub acest prag este disponibil un drawer modal. `activeHref` este controlat de ecran, nu calculat după scroll. Pentru ancore, ținta trebuie să aibă ID și `tabIndex={-1}`; după navigarea mobilă focusul merge la țintă.

```tsx
<AppNavigation
  items={[{ label: "Componente", href: "#components" }]}
  activeHref="#components"
  actions={<ThemeControl />}
/>
<section id="components" tabIndex={-1}>…</section>
```

## 8. Verificare și limite

Comenzi relevante după instalarea pnpm și dependențelor:

```sh
pnpm test:ui
pnpm test:architecture
pnpm lint
pnpm typecheck
pnpm build
pnpm test:e2e
pnpm dev
```

Testele de prezentare și contrast pot fi executate acum și cu `node --test tests/ui-kit/*.test.*`. Scenariile Playwright acoperă tastatura comboboxului, păstrarea valorii la Escape, focus trap/restaurare, Escape pe straturi în drawer, favorite locale, toast, theme switch, navigare mobilă și overflow la 360/768/1280 px. Existența scenariilor nu înseamnă că au fost executate.

De verificat manual: layoutul real la zoom 200%, modurile light/dark/system, screen reader, focus vizibil, touch și scrollbar în panouri, texte mai lungi și contrast în compoziții noi. Nu există încă o certificare WCAG, suport pentru selecție multiplă în combobox sau gesturi swipe în drawer.

Nu se începe etapa următoare fără cerere separată.
