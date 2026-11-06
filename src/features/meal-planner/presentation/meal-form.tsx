"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { plannerCommandSchema } from "../contracts";
import type { PlannerBootstrap, PlannerEntry, PlannerCommand } from "../contracts";
import { addPlannerDays } from "@/shared/domain/meal-planner";
export const slotLabels = {
  breakfast: "Mic dejun",
  lunch: "Prânz",
  dinner: "Cină",
  snack: "Gustări",
} as const;
export const plannerSelect =
  "min-h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";
export function MealForm({
  data,
  entry,
  day,
  slot,
  busy,
  onSave,
  onClose,
  today,
}: {
  data: PlannerBootstrap;
  entry?: PlannerEntry;
  day: string;
  slot: PlannerEntry["slot"];
  busy: boolean;
  onSave: (c: PlannerCommand) => Promise<boolean>;
  onClose: () => void;
  today: string;
}) {
  const [date, setDate] = useState(entry?.plannedOn ?? day),
    [recipeKey, setRecipeKey] = useState(entry?.recipeKey ?? data.recipes[0]?.key ?? ""),
    [error, setError] = useState<string | null>(null);
  const recipe = data.recipes.find((r) => r.key === recipeKey),
    changed =
      entry &&
      recipe &&
      (entry.recipeRevision !== recipe.revision || entry.versionId !== recipe.versionId);
  return (
    <form
      className="space-y-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        const f = new FormData(e.currentTarget),
          price = String(f.get("cost") ?? "").trim();
        if (!recipe) {
          setError("Alege o rețetă disponibilă.");
          return;
        }
        const command = plannerCommandSchema.safeParse({
          kind: "saveEntry",
          create: !entry,
          entry: {
            id: entry?.id ?? crypto.randomUUID(),
            recipeKey: recipe.key,
            recipeRevision: recipe.revision,
            versionId: recipe.versionId,
            plannedOn: date,
            slot: f.get("slot"),
            servings: Number(f.get("servings")),
            prepOn: String(f.get("prepOn") ?? "") || null,
            costPerServing: price
              ? { amount: price, currency: f.get("currency"), observedOn: f.get("observedOn") }
              : null,
          },
        });
        if (!command.success) {
          setError("Verifică data, porțiile întregi (1–20), prețul și data pregătirii.");
          return;
        }
        if (await onSave(command.data)) onClose();
      }}
    >
      <fieldset disabled={busy} className="space-y-4">
        <legend className="sr-only">Planificarea mesei</legend>
        <label className="block space-y-2 text-sm">
          <span>Rețetă</span>
          <select
            className={plannerSelect}
            value={recipeKey}
            onChange={(e) => setRecipeKey(e.target.value)}
            required
          >
            <option value="" disabled>
              Alege rețeta
            </option>
            {data.recipes.map((r) => (
              <option key={r.key} value={r.key}>
                {r.title}
              </option>
            ))}
          </select>
        </label>
        {changed && (
          <p className="text-sm text-warning-foreground">
            Versiunea rețetei s-a schimbat. Salvarea va folosi versiunea curentă selectată.
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            name="plannedOn"
            label="Data mesei"
            type="date"
            min={data.week.startsOn}
            max={addPlannerDays(data.week.startsOn, 6)}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
          <label className="space-y-2 text-sm">
            <span>Tipul mesei</span>
            <select name="slot" className={plannerSelect} defaultValue={entry?.slot ?? slot}>
              {Object.entries(slotLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <TextField
            key={recipeKey}
            name="servings"
            label="Porții planificate"
            type="number"
            min={1}
            max={20}
            required
            defaultValue={entry?.servings ?? recipe?.servings ?? 2}
          />
          <TextField
            name="prepOn"
            label="Pregătește în avans la (opțional)"
            type="date"
            min={data.week.startsOn}
            max={date}
            defaultValue={entry?.prepOn ?? ""}
          />
        </div>
        <fieldset className="space-y-3 rounded-xl border p-4">
          <legend className="px-1 text-sm font-medium">Cost introdus per porție (opțional)</legend>
          <p className="text-xs text-muted-foreground">
            Fără un preț introdus sau o sursă verificată recentă, costul rămâne necunoscut.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField
              name="cost"
              label="Cost per porție"
              inputMode="decimal"
              defaultValue={entry?.costPerServing?.amount ?? ""}
            />
            <label className="space-y-2 text-sm">
              <span>Moneda costului</span>
              <select
                name="currency"
                className={plannerSelect}
                defaultValue={
                  entry?.costPerServing?.currency ?? data.week.budget?.currency ?? "MDL"
                }
              >
                <option>MDL</option>
                <option>RON</option>
              </select>
            </label>
            <TextField
              name="observedOn"
              label="Data observării costului"
              type="date"
              max={today}
              min="1900-01-01"
              defaultValue={entry?.costPerServing?.observedOn ?? today}
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
        <Button type="submit" loading={busy} disabled={!recipe}>
          Salvează masa
        </Button>
        <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
          Anulează
        </Button>
      </div>
    </form>
  );
}
