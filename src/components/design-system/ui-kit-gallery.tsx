"use client";

import { useRef, useState, type ReactNode } from "react";

import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { AppNavigation } from "@/components/layout/app-navigation";
import { CompatibilityBadge } from "@/components/recipes/compatibility-badge";
import { RecipeCard, RecipeCardSkeleton } from "@/components/recipes/recipe-card";
import { ThemeControl } from "@/components/theme/theme-control";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Drawer, DrawerClose, DrawerContent, DrawerTrigger } from "@/components/ui/drawer";
import { Textarea } from "@/components/ui/input";
import { Chip, Tag } from "@/components/ui/tag";
import { TextField } from "@/components/ui/text-field";
import { toast } from "@/components/ui/toast";

const ingredients = [
  { value: "tomato", label: "Roșii" },
  { value: "spinach", label: "Spanac" },
  { value: "egg", label: "Ouă" },
  { value: "chickpea", label: "Năut (indisponibil în exemplu)", disabled: true },
];

const navigation = [
  { label: "Fundamente", href: "#foundations" },
  { label: "Componente", href: "#components" },
  { label: "Rețete", href: "#recipes" },
  { label: "Stări", href: "#states" },
];

function ReferenceSection({ id, title, description, children }: { id: string; title: string; description: string; children: ReactNode }) {
  return <section id={id} tabIndex={-1} aria-labelledby={`${id}-heading`} className="scroll-mt-8 border-t border-border py-12 outline-none focus-visible:ring-2 focus-visible:ring-ring sm:py-16"><div className="mb-8 max-w-2xl"><h2 id={`${id}-heading`} className="font-display text-3xl sm:text-4xl">{title}</h2><p className="mt-3 text-base leading-relaxed text-muted-foreground">{description}</p></div>{children}</section>;
}

export function UiKitGallery() {
  const [activeHref, setActiveHref] = useState("#foundations");
  const [ingredient, setIngredient] = useState("");
  const [drawerIngredient, setDrawerIngredient] = useState("");
  const [fieldError, setFieldError] = useState(false);
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});
  const [recipeOpen, setRecipeOpen] = useState(false);
  const [recipeTitle, setRecipeTitle] = useState("");
  const ingredientInput = useRef<HTMLInputElement>(null);
  const recipeOpener = useRef<HTMLElement | null>(null);

  function preview(title: string, opener: HTMLButtonElement) {
    recipeOpener.current = opener;
    setRecipeTitle(title);
    setRecipeOpen(true);
  }

  return (
    <>
      <AppNavigation items={navigation} activeHref={activeHref} onNavigate={setActiveHref} actions={<ThemeControl />} />
      <main id="main-content" tabIndex={-1} className="mx-auto max-w-7xl px-4 outline-none sm:px-8">
        <section className="grid gap-10 py-14 sm:py-20 lg:grid-cols-[1fr_17rem] lg:items-end">
          <div className="max-w-3xl"><Badge tone="accent">Biblioteca de interfețe</Badge><h1 className="mt-6 font-display text-5xl leading-[1.08] tracking-tight sm:text-6xl">Designul care ține Cookly împreună.</h1><p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">Culori, componente și stări pentru toate ecranele Cookly. Exemplele folosesc date fictive și nu salvează informații.</p></div>
          <div className="rounded-2xl bg-primary p-7 text-primary-foreground"><p className="font-display text-3xl">Pătrunjel</p><p className="mt-3 text-sm leading-relaxed">Verdele de bază al Cookly. Folosit pentru acțiuni, focus și identitate.</p><p className="mt-6 text-sm">#24563d în tema luminoasă</p></div>
        </section>

        <ReferenceSection id="foundations" title="Fundamente" description="O paletă calmă, spațiere pe multipli de 4 px și tipografie care păstrează informația ușor de parcurs.">
          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {[{ name: "Suprafață", className: "bg-background", token: "background" }, { name: "Pătrunjel", className: "bg-primary", token: "primary" }, { name: "Mentă", className: "bg-secondary", token: "secondary" }, { name: "Succes", className: "bg-success", token: "success" }, { name: "Atenție", className: "bg-warning", token: "warning" }, { name: "Eroare", className: "bg-danger", token: "danger" }].map((color) => <div key={color.token} className="overflow-hidden rounded-xl border border-border"><div aria-hidden="true" className={`h-20 border-b border-border ${color.className}`} /><div className="p-3"><p className="text-sm font-medium">{color.name}</p><p className="mt-1 text-xs text-muted-foreground">{color.token}</p></div></div>)}
          </div>
          <div className="mt-10 grid gap-8 lg:grid-cols-2"><div><h3 className="text-sm font-semibold">Tipografie</h3><p className="mt-4 font-display text-4xl">Mâncare bună, zi de zi.</p><p className="mt-4 max-w-prose text-base leading-relaxed text-muted-foreground">Sans-serif pentru text și controale. Serif de sistem pentru titluri editoriale. Descrierile rămân scurte, iar etichetele spun exact ce face fiecare acțiune.</p></div><div><h3 className="text-sm font-semibold">Grid adaptabil</h3><div aria-hidden="true" className="mt-4 grid grid-cols-4 gap-2 md:grid-cols-6 lg:grid-cols-12">{Array.from({ length: 12 }, (_, index) => <div key={index} className="h-14 rounded bg-secondary" />)}</div><p className="mt-4 text-sm leading-relaxed text-muted-foreground">4 coloane pe mobil, 6 pe tabletă și 12 pe desktop. Cardurile folosesc una, două sau trei coloane, în funcție de spațiu.</p></div></div>
        </ReferenceSection>

        <ReferenceSection id="components" title="Componente" description="Aceleași semnale vizuale pentru acțiuni, introducerea datelor și confirmare. Fiecare exemplu poate fi folosit cu tastatura.">
          <div className="space-y-10">
            <div><h3 className="mb-4 text-lg font-semibold">Butoane</h3><div className="flex flex-wrap items-center gap-3"><Button onClick={() => toast("Buton principal", { description: "Interacțiune demonstrativă, fără salvare." })}>Buton principal</Button><Button variant="secondary">Secundar</Button><Button variant="outline">Contur</Button><Button variant="ghost">Discret</Button><Button variant="destructive">Elimină</Button><Button disabled>Dezactivat</Button><Button loading>Se pregătește…</Button></div></div>
            <div className="grid gap-8 lg:grid-cols-2">
              <div className="space-y-5"><h3 className="text-lg font-semibold">Câmpuri</h3><TextField label="Numele exemplului" placeholder="De exemplu: Cina de joi" hint="Eticheta este mereu vizibilă, chiar și când scrii." required {...(fieldError ? { error: "Completează acest câmp înainte de a continua." } : {})} /><Button variant="outline" size="sm" onClick={() => setFieldError((value) => !value)}>{fieldError ? "Ascunde eroarea" : "Arată eroarea câmpului"}</Button><TextField label="Câmp dezactivat" value="Indisponibil în acest exemplu" disabled readOnly /><div className="space-y-2"><label htmlFor="example-notes" className="block text-sm font-medium">Notițe</label><Textarea id="example-notes" placeholder="Un detaliu pe care vrei să îl păstrezi…" /></div></div>
              <div className="space-y-5"><h3 className="text-lg font-semibold">Selecție și etichete</h3><Combobox id="example-ingredient" inputRef={ingredientInput} label="Ingredient demonstrativ" options={ingredients} value={ingredient} onValueChange={setIngredient} hint="Scrie «rosii» sau folosește săgețile, Enter și Escape." /><div aria-live="polite" className="min-h-10">{ingredient ? <Chip label={ingredients.find((option) => option.value === ingredient)?.label ?? ingredient} onRemove={() => { setIngredient(""); ingredientInput.current?.focus(); }} /> : <p className="py-2 text-sm text-muted-foreground">Niciun ingredient selectat.</p>}</div><div className="flex flex-wrap gap-2"><Tag>Rapid</Tag><Tag tone="accent">Vegetarian</Tag><Badge tone="info">Exemplu</Badge></div><div className="flex flex-wrap gap-2"><CompatibilityBadge status="ready" /><CompatibilityBadge status="check-quantities" /><CompatibilityBadge status="missing" /></div><p className="text-sm leading-relaxed text-muted-foreground">Compatibilitatea este transmisă de aplicație. Aceste badge-uri nu calculează potrivirea și nu garantează siguranța alimentară.</p></div>
            </div>
            <div className="grid gap-8 lg:grid-cols-2">
              <div><h3 className="mb-4 text-lg font-semibold">Modal și drawer</h3><div className="flex flex-wrap gap-3"><Dialog><DialogTrigger asChild><Button variant="outline">Deschide un modal</Button></DialogTrigger><DialogContent title="Un moment pentru confirmare" description="Acesta este un dialog demonstrativ. Poți reveni cu Escape sau cu butonul de închidere." footer={<><DialogClose asChild><Button variant="outline">Închide exemplul</Button></DialogClose><DialogClose asChild><Button onClick={() => toast.success("Exemplu confirmat", { description: "Nicio informație nu a fost salvată." })}>Confirmă exemplul</Button></DialogClose></>}><TextField label="Eticheta exemplului" defaultValue="Cină" /></DialogContent></Dialog><Drawer><DrawerTrigger asChild><Button variant="outline">Deschide un drawer</Button></DrawerTrigger><DrawerContent title="Detalii în lateral" description="Panou lateral pe ecrane mari și panou inferior pe mobil, cu focus păstrat în interior." footer={<DrawerClose asChild><Button>Închide panoul</Button></DrawerClose>}><div className="space-y-5"><TextField label="Titlu demonstrativ" defaultValue="Masa de seară" /><Combobox label="Opțiune în drawer" value={drawerIngredient} onValueChange={setDrawerIngredient} options={ingredients} /><p className="text-sm leading-relaxed text-muted-foreground">Selecția este locală. Escape închide întâi sugestiile deschise, apoi panoul.</p></div></DrawerContent></Drawer></div></div>
              <div><h3 className="mb-4 text-lg font-semibold">Notificări</h3><div className="flex flex-wrap gap-3"><Button variant="secondary" onClick={() => toast.success("Notificare demonstrativă", { description: "Exemplul de succes este vizibil. Nicio dată nu a fost salvată." })}>Notificare succes</Button><Button variant="outline" onClick={() => toast.error("Exemplu de eroare", { description: "Mesajele reale explică problema și pașii de recuperare." })}>Notificare eroare</Button></div><p className="mt-4 text-sm text-muted-foreground">Informația importantă rămâne și în pagină; toast-ul nu este singura formă de feedback.</p></div>
            </div>
          </div>
        </ReferenceSection>

        <ReferenceSection id="recipes" title="Carduri de rețete" description="Titlu, disponibilitate, timp și porții într-o structură comună. Datele, estimările și ilustrațiile de mai jos sunt demonstrative.">
          <div className="grid items-start gap-6 sm:grid-cols-2 xl:grid-cols-3">
            <RecipeCard title="Salată cu năut și verdețuri" description="Un exemplu de card cu toate cantitățile confirmate." timeLabel="20 min" servingsLabel="2 porții" costLabel="~9 lei / porție — exemplu" compatibility="ready" image={{ src: "/ui-kit/salad.svg", alt: "Ilustrație de salată cu năut și verdețuri" }} favorite={favorites.salad ?? false} onFavoriteChange={(value) => setFavorites((previous) => ({ ...previous, salad: value }))} onOpen={(event) => preview("Salată cu năut și verdețuri", event.currentTarget)} />
            <RecipeCard title="Paste cu roșii coapte" description="Prezența ingredientelor nu confirmă și cantitățile." timeLabel="30 min" servingsLabel="2 porții" costLabel="~12 lei / porție — exemplu" compatibility="check-quantities" image={{ src: "/ui-kit/pasta.svg", alt: "Ilustrație de paste cu roșii și busuioc" }} favorite={favorites.pasta ?? false} onFavoriteChange={(value) => setFavorites((previous) => ({ ...previous, pasta: value }))} onOpen={(event) => preview("Paste cu roșii coapte", event.currentTarget)} />
            <RecipeCard title="Supă de legume" description="Exemplu fără imagine și fără o estimare de cost disponibilă." timeLabel="25 min" servingsLabel="4 porții" compatibility="missing" onOpen={(event) => preview("Supă de legume", event.currentTarget)} />
          </div>
          <Dialog open={recipeOpen} onOpenChange={setRecipeOpen}><DialogContent title={recipeTitle || "Exemplu de rețetă"} description="Previzualizare vizuală. Acest UI kit nu implementează căutarea sau pașii rețetelor." onCloseAutoFocus={(event) => { event.preventDefault(); recipeOpener.current?.focus(); }}><p className="text-sm leading-relaxed text-muted-foreground">Cardul afișează datele primite de la aplicație. Comportamentul de deschidere, navigarea și salvarea sunt controlate de ecranul care îl folosește.</p></DialogContent></Dialog>
        </ReferenceSection>

        <ReferenceSection id="states" title="Fiecare stare are un răspuns" description="Încărcarea, lipsa datelor și o eroare au mesaje diferite. Acțiunile explică ce se poate face în continuare.">
          <div className="grid items-start gap-6 lg:grid-cols-3"><div><h3 className="mb-4 font-semibold">Încărcare</h3><RecipeCardSkeleton /></div><div><h3 className="mb-4 font-semibold">Fără rezultate</h3><EmptyState compact title="Nu există rezultate pentru această selecție" description="Încearcă un alt ingredient sau ajustează filtrele." action={<Button variant="outline" onClick={() => { ingredientInput.current?.focus(); document.getElementById("components")?.scrollIntoView(); }}>Alege un ingredient</Button>} /></div><div><h3 className="mb-4 font-semibold">Eroare recuperabilă</h3><ErrorState announce={false} title="Conținutul nu s-a încărcat" description="Exemplu de eroare. Verifică conexiunea și încearcă din nou." onRetry={() => toast("Reîncercare demonstrativă", { description: "UI kitul nu trimite cereri către un serviciu." })} /></div></div>
        </ReferenceSection>
      </main>
      <footer className="border-t border-border px-4 py-8 text-center text-sm text-muted-foreground">Cookly · Referință vizuală cu date fictive</footer>
    </>
  );
}
