"use client";
import { useEffect, useState } from "react";
import { IngredientAutocomplete } from "@/components/ingredients/ingredient-autocomplete";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { categoryListSchema, ingredientDetailSchema } from "../contracts";
import type { IngredientSummary, IngredientDetail } from "../contracts";
import { useIngredientCatalog } from "./use-ingredient-catalog";

const selectStyle =
  "min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";
function numberText(value: string | null) {
  return value === null
    ? "Necunoscut"
    : value.includes(".")
      ? value.replace(/0+$/, "").replace(/\.$/, "")
      : value;
}
function IngredientInformation({ item }: { item: IngredientDetail }) {
  const values = [
    ["Energie", item.nutrition.energyKcal, "kcal"],
    ["Proteine", item.nutrition.proteinG, "g"],
    ["Carbohidrați", item.nutrition.carbohydrateG, "g"],
    ["Grăsimi", item.nutrition.fatG, "g"],
    ["Fibre", item.nutrition.fiberG, "g"],
    ["Sare", item.nutrition.saltG, "g"],
  ] as const;
  return (
    <article
      className="rounded-xl border border-border bg-card p-5 sm:p-6"
      aria-labelledby="ingredient-detail-title"
    >
      <h2 id="ingredient-detail-title" className="font-display text-2xl">
        {item.name}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">Nume canonic: {item.canonicalName}</p>
      {item.kind === "generic" && (
        <p className="mt-3 text-sm">
          Denumire generală. Nu confirmă o parte sau o variantă specifică.
        </p>
      )}
      {item.broader && (
        <p className="mt-3 text-sm">
          {item.broader.relation === "part_of" ? "Parte din" : "Variantă de"}: {item.broader.name}.
          Relația nu confirmă o substituție într-o rețetă.
        </p>
      )}
      <h3 className="mt-6 font-semibold">Denumiri alternative</h3>
      <dl className="mt-3 space-y-2 text-sm">
        {["ro-RO", "ru-RU", "en-GB"].map((locale) => (
          <div key={locale} className="grid gap-1 sm:grid-cols-[7rem_1fr]">
            <dt className="text-muted-foreground">
              {{ "ro-RO": "Română", "ru-RU": "Rusă", "en-GB": "Engleză" }[locale]}
            </dt>
            <dd lang={locale}>
              {item.aliases
                .filter((alias) => alias.locale === locale)
                .map((alias) => alias.label)
                .join(", ") || "—"}
            </dd>
          </div>
        ))}
      </dl>
      <h3 className="mt-6 font-semibold">Unități permise</h3>
      <p className="mt-2 text-sm">
        {item.units
          .map((unit) => `${unit.code}${unit.isDefault ? " (implicit)" : ""}`)
          .join(", ") || "Nespecificate"}
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        Bucățile, gramele și mililitrii nu sunt convertiți între ei fără o regulă verificată.
      </p>
      <h3 className="mt-6 font-semibold">Nutriție per 100 g</h3>
      {item.nutrition.status === "unavailable" ? (
        <EmptyState
          compact
          title="Nutriție indisponibilă"
          description="Nu există date verificate publicate pentru această identitate. Valorile lipsă nu înseamnă zero."
        />
      ) : (
        <>
          <p className="mt-2 text-sm text-muted-foreground">
            {item.nutrition.status === "partial" ? "Date parțiale. " : ""}
            {item.nutrition.source?.foodDescription}
          </p>
          <dl className="mt-4 grid gap-3 sm:grid-cols-3">
            {values.map(([label, value, unit]) => (
              <div key={label}>
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="font-medium">
                  {numberText(value)}
                  {value !== null ? ` ${unit}` : ""}
                </dd>
              </div>
            ))}
          </dl>
          {item.nutrition.source && (
            <p className="mt-4 text-xs text-muted-foreground">
              Sursă:{" "}
              {item.nutrition.source.url ? (
                <a
                  href={item.nutrition.source.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="underline"
                >
                  {item.nutrition.source.name}
                </a>
              ) : (
                item.nutrition.source.name
              )}
              ; înregistrare {item.nutrition.source.recordKey}, revizia{" "}
              {item.nutrition.source.revision}; date din {item.nutrition.source.observedOn}.
            </p>
          )}
        </>
      )}
    </article>
  );
}
export function IngredientCatalog() {
  const [query, setQuery] = useState("");
  const [locale, setLocale] = useState<"ro-RO" | "ru-RU" | "en-GB">("ro-RO");
  const [category, setCategory] = useState("");
  const [categories, setCategories] = useState<{ id: string; name: string; slug: string }[]>([]);
  const [categoryError, setCategoryError] = useState(false);
  const [selected, setSelected] = useState<IngredientSummary | null>(null);
  const [detail, setDetail] = useState<{
    key: string;
    data: IngredientDetail | null;
    error: boolean;
  } | null>(null);
  const [detailRetry, retryDetail] = useState(0);
  const catalog = useIngredientCatalog(query, locale, category);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const response = await fetch("/api/v1/ingredients/categories", {
            signal: controller.signal,
            credentials: "omit",
            cache: "no-store",
          });
          if (!response.ok) throw new Error();
          const data = categoryListSchema.parse(await response.json());
          if (!controller.signal.aborted) setCategories(data);
        } catch {
          if (!controller.signal.aborted) setCategoryError(true);
        }
      })();
    }, 0);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, []);
  const detailKey = selected ? JSON.stringify([selected.id, locale, detailRetry]) : "";
  useEffect(() => {
    if (!selected) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const response = await fetch(`/api/v1/ingredients/${selected.id}?locale=${locale}`, {
            signal: controller.signal,
            credentials: "omit",
            cache: "no-store",
          });
          if (!response.ok) throw new Error();
          const data = ingredientDetailSchema.parse(await response.json());
          if (!controller.signal.aborted) setDetail({ key: detailKey, data, error: false });
        } catch {
          if (!controller.signal.aborted) setDetail({ key: detailKey, data: null, error: true });
        }
      })();
    }, 0);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [selected, locale, detailKey]);
  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-4xl tracking-tight">Ingrediente</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Găsește denumiri în română, rusă și engleză. Alege ingredientul exact înainte să-l
          folosești într-o rețetă.
        </p>
      </header>
      <div className="grid items-start gap-5 rounded-xl border border-border bg-card p-5 lg:grid-cols-[2fr_1fr_1fr]">
        <IngredientAutocomplete
          query={query}
          onQueryChange={setQuery}
          value={selected}
          onValueChange={setSelected}
          options={catalog.items}
          loading={catalog.loading}
          error={catalog.error}
        />
        <label className="space-y-2 text-sm font-medium">
          <span className="block">Limba denumirilor</span>
          <select
            className={selectStyle}
            value={locale}
            onChange={(event) => {
              setLocale(event.target.value as typeof locale);
              setSelected(null);
              setQuery("");
            }}
          >
            <option value="ro-RO">Română</option>
            <option value="ru-RU">Русский</option>
            <option value="en-GB">English</option>
          </select>
        </label>
        <label className="space-y-2 text-sm font-medium">
          <span className="block">Categorie</span>
          <select
            className={selectStyle}
            value={category}
            onChange={(event) => {
              setCategory(event.target.value);
              setSelected(null);
            }}
          >
            <option value="">Toate categoriile</option>
            {categories.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          {categoryError && (
            <span className="block text-xs text-muted-foreground">
              Categoriile nu sunt disponibile momentan.
            </span>
          )}
        </label>
      </div>
      {catalog.error && (
        <ErrorState
          title="Căutare indisponibilă"
          description={catalog.error}
          onRetry={catalog.retry}
          retryLabel="Reîncepe căutarea"
        />
      )}
      {catalog.loading ? (
        <div
          aria-label="Se încarcă ingredientele"
          role="status"
          className="grid gap-3 sm:grid-cols-2"
        >
          {[0, 1, 2, 3].map((key) => (
            <Skeleton key={key} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : catalog.ready && !catalog.items.length ? (
        <EmptyState
          title="Nu am găsit ingrediente"
          description="Încearcă o denumire alternativă sau elimină filtrul de categorie."
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {catalog.items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className="flex min-h-24 w-full items-start justify-between gap-3 rounded-xl border border-border bg-card p-4 text-left outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => {
                  setSelected(item);
                }}
                aria-pressed={selected?.id === item.id}
              >
                <span>
                  <span className="block font-semibold" lang={locale}>
                    {item.name}
                  </span>
                  <span className="mt-1 block text-sm text-muted-foreground">
                    {item.canonicalName}
                    {item.category ? ` · ${item.category.name}` : ""}
                  </span>
                  {item.matchedTerm && item.matchedTerm !== item.name && (
                    <span className="mt-1 block text-xs text-muted-foreground">
                      Potrivire: {item.matchedTerm}
                    </span>
                  )}
                </span>
                {item.kind === "generic" && <Badge tone="neutral">General</Badge>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {catalog.nextCursor && (
        <Button variant="outline" onClick={catalog.loadMore} loading={catalog.loadingMore}>
          Mai multe ingrediente
        </Button>
      )}
      {selected && (
        <section aria-live="polite">
          {detail?.key !== detailKey ? (
            <Skeleton className="h-72 rounded-xl" />
          ) : detail.error ? (
            <ErrorState
              title="Detaliile nu sunt disponibile"
              description="Ingredientul s-ar putea să se fi modificat. Reîncearcă sau selectează alt rezultat."
              onRetry={() => retryDetail((value) => value + 1)}
            />
          ) : detail.data ? (
            <IngredientInformation item={detail.data} />
          ) : null}
        </section>
      )}
    </div>
  );
}
