"use client";
import { useEffect, useState } from "react";
import { IngredientAutocomplete } from "@/components/ingredients/ingredient-autocomplete";
import { ingredientDetailSchema } from "@/features/ingredients/contracts";
import type { IngredientSummary } from "@/features/ingredients/contracts";
import { TextField } from "@/components/ui/text-field";
import { Button } from "@/components/ui/button";
import { convertQuantity } from "@/shared/domain/quantity";
import { pantryCommandSchema, unitCodeSchema } from "../contracts";
import type { PantryItem, PantryIngredient, PantryCommand } from "../contracts";
import { useCatalogOptions } from "./use-catalog-options";
export const selectClass =
  "min-h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";
export const locations = { pantry: "Cămară", fridge: "Frigider", freezer: "Congelator" } as const;
export function PantryForm({
  item,
  id,
  onSave,
  onCancel,
  pending,
}: {
  item: PantryItem | null;
  id: string;
  onSave: (command: PantryCommand, ingredient: PantryIngredient | null) => Promise<string | null>;
  onCancel: () => void;
  pending: boolean;
}) {
  const [query, setQuery] = useState(item?.ingredient.name ?? "");
  const [selected, setSelected] = useState<IngredientSummary | null>(
    item
      ? {
          id: item.ingredient.id,
          slug: item.ingredient.slug,
          name: item.ingredient.name,
          canonicalName: item.ingredient.name,
          category: item.ingredient.categoryId
            ? { id: item.ingredient.categoryId, slug: "", name: item.ingredient.categoryName ?? "" }
            : null,
          kind: "specific",
          broader: null,
          matchedTerm: null,
        }
      : null,
  );
  const [detail, setDetail] = useState<{
    id: string;
    ingredient: PantryIngredient | null;
    error: boolean;
  } | null>(null);
  const [quantity, setQuantity] = useState(item?.quantity ?? "");
  const [unknown, setUnknown] = useState(item ? item.quantity === null : false);
  const [unit, setUnit] = useState(item?.unitCode ?? "");
  const [location, setLocation] = useState(item?.location ?? "fridge");
  const [expires, setExpires] = useState(item?.expiresOn ?? "");
  const [error, setError] = useState<string | null>(null);
  const catalog = useCatalogOptions(query);
  const selectedId = selected?.id;
  const initial = item?.ingredient;
  const ingredient =
    selectedId === initial?.id
      ? initial
      : detail && detail.id === selectedId
        ? detail.ingredient
        : null;
  useEffect(() => {
    if (!selectedId || selectedId === initial?.id) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const response = await fetch(`/api/v1/ingredients/${selectedId}?locale=ro-RO`, {
            signal: controller.signal,
            credentials: "omit",
            cache: "no-store",
          });
          if (!response.ok) throw new Error();
          const data = ingredientDetailSchema.parse(await response.json());
          const allowedUnits = data.units.flatMap((unit) => {
            const code = unitCodeSchema.safeParse(unit.code);
            return code.success ? [code.data] : [];
          });
          if (!controller.signal.aborted)
            setDetail({
              id: selectedId,
              error: false,
              ingredient: {
                id: data.id,
                name: data.canonicalName,
                slug: data.slug,
                categoryId: data.category?.id ?? null,
                categoryName: data.category?.name ?? null,
                active: true,
                allowedUnits,
              },
            });
        } catch {
          if (!controller.signal.aborted)
            setDetail({ id: selectedId, ingredient: null, error: true });
        }
      })();
    }, 0);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [selectedId, initial?.id]);
  const oldUnit =
    selectedId === item?.ingredient.id ? unitCodeSchema.safeParse(item?.unitCode) : null;
  const units = [
    ...new Set([...(ingredient?.allowedUnits ?? []), ...(oldUnit?.success ? [oldUnit.data] : [])]),
  ];
  const effectiveUnit = unit || units[0] || "";
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!ingredient) {
      setError("Selectează explicit ingredientul și așteaptă încărcarea unităților.");
      return;
    }
    const input = pantryCommandSchema.safeParse({
      kind: item ? "update" : "create",
      id,
      ...(item ? { expectedRevision: item.revision } : {}),
      ingredientId: ingredient.id,
      quantity: unknown ? null : quantity,
      unitCode: unknown ? null : effectiveUnit,
      location,
      expiresOn: expires || null,
    });
    if (!input.success) {
      setError(
        "Verifică toate câmpurile: cantitate nenegativă, maximum 6 zecimale, bucăți întregi și dată validă.",
      );
      return;
    }
    const message = await onSave(input.data, ingredient);
    if (message) setError(message);
    else onCancel();
  }
  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-5" aria-busy={pending}>
      <fieldset disabled={pending} className="space-y-5">
        <legend className="sr-only">Datele lotului</legend>
        <IngredientAutocomplete
          query={query}
          onQueryChange={setQuery}
          value={selected}
          onValueChange={(value) => {
            setSelected(value);
            if (value) {
              setQuantity("");
              setUnit("");
              setUnknown(false);
            }
          }}
          options={catalog.options}
          loading={catalog.loading}
          error={catalog.error}
        />
        {selected && !ingredient && (
          <p role="status" className="text-sm text-muted-foreground">
            {detail && detail.id === selectedId && detail.error
              ? "Unitățile nu au putut fi încărcate. Selectează ingredientul din nou sau redeschide formularul."
              : "Se încarcă unitățile ingredientului…"}
          </p>
        )}
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={unknown}
            onChange={(event) => setUnknown(event.target.checked)}
            className="size-4 accent-primary"
          />
          Nu cunosc cantitatea
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Cantitate"
            inputMode="decimal"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            disabled={unknown}
            required={!unknown}
            maxLength={20}
            hint="De exemplu 0,5. Maximum 6 zecimale."
          />
          <label className="space-y-2 text-sm font-medium">
            <span className="block">Unitate</span>
            <select
              className={selectClass}
              value={effectiveUnit}
              disabled={unknown || !units.length}
              onChange={(event) => {
                try {
                  if (quantity.trim())
                    setQuantity(
                      convertQuantity(
                        quantity.trim().replace(",", "."),
                        effectiveUnit,
                        event.target.value,
                      ),
                    );
                  setUnit(event.target.value);
                  setError(null);
                } catch (e) {
                  setError(
                    e instanceof Error
                      ? `${e.message} Golește cantitatea pentru a introduce o măsurare nouă.`
                      : "Conversie indisponibilă.",
                  );
                }
              }}
            >
              {!units.length && !effectiveUnit && <option value="">Nespecificată</option>}
              {effectiveUnit && !units.includes(effectiveUnit as (typeof units)[number]) && (
                <option value={effectiveUnit}>{effectiveUnit} (unitate existentă)</option>
              )}
              {units.map((code) => (
                <option key={code} value={code}>
                  {code === "piece" ? "bucăți" : code}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Data expirării"
            type="date"
            min="1900-01-01"
            max="9999-12-31"
            value={expires}
            onChange={(event) => setExpires(event.target.value)}
            hint="Opțională; folosește data de pe ambalaj."
          />
          <label className="space-y-2 text-sm font-medium">
            <span className="block">Loc de depozitare</span>
            <select
              className={selectClass}
              value={location}
              onChange={(event) => setLocation(event.target.value as typeof location)}
            >
              {Object.entries(locations).map(([code, label]) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </fieldset>
      {error && (
        <p role="alert" className="text-sm text-danger-foreground">
          {error}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Fiecare adăugare creează un lot separat. Conversiile între grame, mililitri și bucăți cer o
        măsurare nouă.
      </p>
      <div className="flex flex-wrap justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
          Anulează
        </Button>
        <Button type="submit" loading={pending} disabled={!ingredient}>
          Salvează lotul
        </Button>
      </div>
    </form>
  );
}
