"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { shoppingCommandSchema, itemFieldsSchema } from "../contracts";
import type { ShoppingBootstrap, ShoppingCommand, ShoppingItem } from "../contracts";
const select =
  "min-h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";
export { select as shoppingSelect };
export function ItemForm({
  catalog,
  item,
  busy,
  onSave,
  onCancel,
  today,
}: {
  catalog: ShoppingBootstrap["catalog"];
  item?: ShoppingItem;
  busy: boolean;
  onSave: (c: ShoppingCommand) => Promise<boolean>;
  onCancel: () => void;
  today: string;
}) {
  const [ingredientId, setIngredientId] = useState(item?.ingredient?.id ?? ""),
    [error, setError] = useState<string | null>(null);
  const food = catalog.find((c) => c.id === ingredientId);
  return (
    <form
      className="space-y-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        const f = new FormData(e.currentTarget),
          quantity = String(f.get("quantity") ?? "").trim(),
          amount = String(f.get("price") ?? "").trim();
        const fields = itemFieldsSchema.safeParse({
          label: food?.name ?? String(f.get("label") ?? ""),
          category: food?.categoryName ?? String(f.get("category") ?? "Altele"),
          quantity: quantity || null,
          unitCode: quantity ? String(f.get("unit")) : null,
          checked: item?.checked ?? false,
          uncertain: quantity ? false : true,
          price: amount
            ? {
                amount,
                currency: f.get("currency"),
                basisQuantity: f.get("basisQuantity"),
                basisUnit: f.get("basisUnit"),
                observedOn: f.get("observedOn"),
              }
            : null,
        });
        if (!fields.success) {
          setError(
            "Verifică denumirea, cantitatea pozitivă, bucățile întregi și prețul cu maximum două zecimale.",
          );
          return;
        }
        const command = shoppingCommandSchema.parse(
          item
            ? { kind: "update", id: item.id, expectedRevision: item.revision, fields: fields.data }
            : {
                kind: "append",
                items: [
                  { ...fields.data, id: crypto.randomUUID(), ingredientId: ingredientId || null },
                ],
              },
        );
        if (await onSave(command)) onCancel();
      }}
    >
      <fieldset key={ingredientId} disabled={busy} className="space-y-4">
        <legend className="sr-only">Datele rândului de cumpărături</legend>
        {!item && (
          <label className="block space-y-2 text-sm">
            <span>Ingredient canonic (pentru transfer în frigider)</span>
            <select
              className={select}
              value={ingredientId}
              onChange={(e) => setIngredientId(e.target.value)}
            >
              <option value="">Text liber, fără transfer automat</option>
              {catalog.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {!food && (
          <>
            <TextField
              name="label"
              label="Denumire"
              required
              maxLength={120}
              defaultValue={item?.label ?? ""}
            />
            <TextField
              name="category"
              label="Categorie"
              required
              maxLength={80}
              defaultValue={item?.category ?? "Altele"}
            />
          </>
        )}
        {food && (
          <p className="text-sm">
            {food.name} · {food.categoryName ?? "Altele"}
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            name="quantity"
            label="Cantitate de cumpărat (gol = necunoscută)"
            inputMode="decimal"
            defaultValue={item?.quantity ?? ""}
          />
          <label className="space-y-2 text-sm">
            <span>Unitate</span>
            <select
              name="unit"
              className={select}
              defaultValue={item?.unitCode ?? food?.allowedUnits[0] ?? "g"}
            >
              {(food?.allowedUnits ?? ["g", "kg", "ml", "l", "piece"]).map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </label>
        </div>
        <fieldset className="space-y-4 rounded-xl border p-4">
          <legend className="px-1 text-sm font-medium">Preț introdus opțional</legend>
          <p className="text-xs text-muted-foreground">
            Introduceți un preț observat, nu o presupunere. Datele mai vechi de 30 zile nu intră în
            subtotal. La comasare, prețul nou introdus se aplică întregii cantități; fără un preț
            nou se păstrează cel existent.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              name="price"
              label="Preț pentru cantitatea de referință"
              inputMode="decimal"
              defaultValue={item?.price?.amount ?? ""}
            />
            <label className="space-y-2 text-sm">
              <span>Monedă</span>
              <select
                name="currency"
                className={select}
                defaultValue={item?.price?.currency ?? "MDL"}
              >
                <option>MDL</option>
                <option>RON</option>
              </select>
            </label>
            <TextField
              name="basisQuantity"
              label="Cantitate de referință a prețului"
              inputMode="decimal"
              defaultValue={item?.price?.basisQuantity ?? "1"}
            />
            <label className="space-y-2 text-sm">
              <span>Unitate de referință a prețului</span>
              <select
                name="basisUnit"
                className={select}
                defaultValue={
                  item?.price?.basisUnit ??
                  (item?.unitCode === "ml" || food?.allowedUnits.includes("ml")
                    ? "l"
                    : item?.unitCode === "piece" || food?.allowedUnits.includes("piece")
                      ? "piece"
                      : "kg")
                }
              >
                {["g", "kg", "ml", "l", "piece"].map((u) => (
                  <option key={u}>{u}</option>
                ))}
              </select>
            </label>
            <TextField
              name="observedOn"
              label="Data observării prețului"
              type="date"
              max={today}
              defaultValue={item?.price?.observedOn ?? today}
            />
          </div>
        </fieldset>
      </fieldset>
      {error && (
        <p role="alert" className="text-sm text-danger-foreground">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" loading={busy}>
          Salvează rândul
        </Button>
        <Button variant="outline" type="button" disabled={busy} onClick={onCancel}>
          Anulează
        </Button>
      </div>
    </form>
  );
}
