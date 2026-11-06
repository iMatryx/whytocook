import {
  baseMicros,
  displayMicros,
  scaleRequirement,
  supportedUnit,
  unitTable,
} from "./cooking-quantity.ts";
import { quantityMicros, quantityText } from "./quantity.ts";
import type { ListItem, ShoppingFood } from "./shopping.ts";
export const nutrientKeys = [
  "energyKcal",
  "proteinG",
  "carbohydrateG",
  "fatG",
  "fiberG",
  "saltG",
] as const;
type Nutrients = Record<(typeof nutrientKeys)[number], string>;
type Budget = { amount: string; currency: "MDL" | "RON" };
type Entry = {
  id: string;
  recipeKey: string;
  recipeRevision: number;
  versionId: string | null;
  plannedOn: string;
  slot: "breakfast" | "lunch" | "dinner" | "snack";
  servings: number;
  prepOn: string | null;
  costPerServing: (Budget & { observedOn: string }) | null;
};
type Week = {
  startsOn: string;
  revision: string;
  budget: Budget | null;
  entries: Entry[];
  exportedRevision: string | null;
};
type Recipe = {
  key: string;
  revision: number;
  versionId: string | null;
  title: string;
  servings: number;
  ingredients: { ingredientSlug: string; quantity: string; unit: string; optional: boolean }[];
  allergens: { status: string; contains: string[]; mayContain: string[] };
  budget: Budget | null;
  budgetSource: { observedOn: string } | null;
  fullNutrition: { status: string; perServing: Nutrients | null; source: unknown };
};
type Inventory = {
  id: string;
  ingredientSlug: string;
  quantity: string | null;
  unit: string | null;
  expiresOn: string | null;
};
export function addPlannerDays(day: string, amount: number) {
  const timestamp = Date.parse(`${day}T00:00:00Z`);
  if (
    !Number.isFinite(timestamp) ||
    new Date(timestamp).toISOString().slice(0, 10) !== day ||
    !Number.isInteger(amount)
  )
    throw new Error("Dată calendaristică invalidă.");
  const next = new Date(timestamp + amount * 86400000).toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(next))
    throw new Error("Săptămâna depășește intervalul calendaristic.");
  return next;
}
export function plannerMonday(day: string) {
  const n = new Date(`${day}T00:00:00Z`).getUTCDay();
  return addPlannerDays(day, -((n + 6) % 7));
}
export function plannerShoppingFingerprint(items: readonly ListItem[]) {
  return JSON.stringify(
    items
      .map((i) => [i.ingredient?.slug ?? null, i.quantity, i.unitCode, i.uncertain])
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
  );
}
const emptyNutrients = (): Nutrients => ({
  energyKcal: "0",
  proteinG: "0",
  carbohydrateG: "0",
  fatG: "0",
  fiberG: "0",
  saltG: "0",
});
const micros = (v: string) => {
  const [whole, fraction = ""] = v.split(".");
  return BigInt(whole!) * 1000000n + BigInt(fraction.padEnd(6, "0"));
};
function sumNutrients(target: Nutrients, values: Nutrients, servings: number) {
  for (const key of nutrientKeys)
    target[key] = displayMicros(
      micros(target[key]) + quantityMicros(values[key]) * BigInt(servings),
    );
}
const slots = { breakfast: 0, lunch: 1, dinner: 2, snack: 3 };
export function analyzePlannerWeek(
  week: Week,
  recipes: readonly Recipe[],
  catalog: readonly ShoppingFood[],
  inventory: readonly Inventory[],
  today: string,
  restrictions: { allergies: readonly string[]; excluded: readonly string[] } = {
    allergies: [],
    excluded: [],
  },
) {
  const days = Array.from({ length: 7 }, (_, i) => ({
      date: addPlannerDays(week.startsOn, i),
      nutrients: emptyNutrients(),
      unknownMeals: 0,
      entryCount: 0,
    })),
    nutrients = emptyNutrients(),
    warnings: string[] = [],
    unavailable: string[] = [];
  let unknownNutritionMeals = 0,
    unknownCost = 0,
    unknownForBudget = 0,
    complete = true;
  const money: { MDL: bigint; RON: bigint } = { MDL: 0n, RON: 0n };
  type Lot = { id: string; original: bigint; remaining: bigint; expiresOn: string | null };
  const stocks = new Map<string, Lot[]>(),
    unknownStock = new Set<string>();
  for (const lot of inventory) {
    if (lot.quantity === null || !lot.unit || !supportedUnit(lot.unit)) {
      unknownStock.add(lot.ingredientSlug);
      continue;
    }
    try {
      const amount = baseMicros(lot.quantity, lot.unit);
      if (lot.unit === "piece" && amount % 1000000n) throw new Error("Fractional piece");
      const key = `${lot.ingredientSlug}:${unitTable[lot.unit].base}`,
        list = stocks.get(key) ?? [];
      list.push({ id: lot.id, original: amount, remaining: amount, expiresOn: lot.expiresOn });
      stocks.set(key, list);
    } catch {
      unknownStock.add(lot.ingredientSlug);
    }
  }
  for (const list of stocks.values())
    list.sort(
      (a, b) =>
        (a.expiresOn ?? "9999-12-31").localeCompare(b.expiresOn ?? "9999-12-31") ||
        a.id.localeCompare(b.id),
    );
  const resources: {
    entryId: string;
    ingredientSlug: string;
    name: string;
    required: string;
    allocated: string;
    shortage: string;
    unit: "g" | "ml" | "piece";
    uncertain: boolean;
    overlap: boolean;
  }[] = [];
  const totals = new Map<
    string,
    {
      food: ShoppingFood;
      unit: "g" | "ml" | "piece";
      required: bigint;
      allocated: bigint;
      uncertain: boolean;
    }
  >();
  const prep = new Map<
    string,
    { prepOn: string; recipeKey: string; title: string; servings: number; entryIds: string[] }
  >();
  const ordered = [...week.entries].sort(
    (a, b) =>
      (a.prepOn ?? a.plannedOn).localeCompare(b.prepOn ?? b.plannedOn) ||
      slots[a.slot] - slots[b.slot] ||
      a.id.localeCompare(b.id),
  );
  for (const entry of ordered) {
    const day = days.find((d) => d.date === entry.plannedOn);
    if (!day) throw new Error("Masa nu aparține săptămânii.");
    day.entryCount++;
    const recipe = recipes.find(
      (r) =>
        r.key === entry.recipeKey &&
        r.revision === entry.recipeRevision &&
        r.versionId === entry.versionId,
    );
    const blocked =
      recipe &&
      (recipe.ingredients.some((i) => restrictions.excluded.includes(i.ingredientSlug)) ||
        (restrictions.allergies.length > 0 &&
          (recipe.allergens.status !== "verified" ||
            restrictions.allergies.some(
              (a) =>
                recipe.allergens.contains.includes(a) || recipe.allergens.mayContain.includes(a),
            ))));
    if (!recipe || blocked) {
      complete = false;
      unavailable.push(entry.id);
      warnings.push(
        `${entry.plannedOn}: rețeta este indisponibilă, revizia s-a schimbat sau nu respectă restricțiile.`,
      );
      unknownNutritionMeals++;
      day.unknownMeals++;
      unknownCost++;
      unknownForBudget++;
      continue;
    }
    const nutrition = recipe.fullNutrition;
    if (nutrition.status === "verified" && nutrition.perServing) {
      sumNutrients(nutrients, nutrition.perServing, entry.servings);
      sumNutrients(day.nutrients, nutrition.perServing, entry.servings);
    } else {
      unknownNutritionMeals++;
      day.unknownMeals++;
    }
    const quoted =
        entry.costPerServing ??
        (recipe.budget && recipe.budgetSource
          ? { ...recipe.budget, observedOn: recipe.budgetSource.observedOn }
          : null),
      reference = entry.plannedOn > today ? entry.plannedOn : today;
    if (
      quoted &&
      quoted.observedOn <= today &&
      Date.parse(`${reference}T00:00:00Z`) - Date.parse(`${quoted.observedOn}T00:00:00Z`) <=
        30 * 86400000
    ) {
      const value = micros(quoted.amount) * BigInt(entry.servings);
      money[quoted.currency] += (value + 9999n) / 10000n;
      if (week.budget && quoted.currency !== week.budget.currency) unknownForBudget++;
    } else {
      unknownCost++;
      unknownForBudget++;
    }
    if (entry.prepOn) {
      const key = `${entry.prepOn}:${recipe.key}:${recipe.versionId ?? recipe.revision}`,
        group = prep.get(key) ?? {
          prepOn: entry.prepOn,
          recipeKey: recipe.key,
          title: recipe.title,
          servings: 0,
          entryIds: [],
        };
      group.servings += entry.servings;
      group.entryIds.push(entry.id);
      prep.set(key, group);
    }
    const useDate =
      (entry.prepOn ?? entry.plannedOn) > today ? (entry.prepOn ?? entry.plannedOn) : today;
    for (const ingredient of recipe.ingredients) {
      if (ingredient.optional) continue;
      const food = catalog.find((i) => i.slug === ingredient.ingredientSlug && i.active);
      if (
        !food ||
        !supportedUnit(ingredient.unit) ||
        !food.allowedUnits.includes(ingredient.unit)
      ) {
        complete = false;
        warnings.push(`${recipe.title}: ingredient/unitate nesuportată; necesarul este incomplet.`);
        continue;
      }
      const unit = unitTable[ingredient.unit].base;
      if (!food.allowedUnits.includes(unit)) {
        complete = false;
        warnings.push(`${food.name}: unitatea de bază nu este permisă.`);
        continue;
      }
      const raw = baseMicros(ingredient.quantity, ingredient.unit);
      if (ingredient.unit === "piece" && raw % 1000000n) {
        complete = false;
        warnings.push(`${food.name}: bucăți fracționare neconvertibile.`);
        continue;
      }
      const { required } = scaleRequirement(raw, unit, entry.servings, recipe.servings),
        key = `${food.slug}:${unit}`,
        lots = (stocks.get(key) ?? []).filter((l) => !l.expiresOn || l.expiresOn >= useDate),
        initial = lots.reduce((n, l) => n + l.original, 0n),
        before = lots.reduce((n, l) => n + l.remaining, 0n);
      let remaining = required;
      for (const lot of lots) {
        const used = lot.remaining < remaining ? lot.remaining : remaining;
        lot.remaining -= used;
        remaining -= used;
        if (!remaining) break;
      }
      const allocated = required - remaining,
        uncertain = unknownStock.has(food.slug),
        overlap = remaining > 0n && initial > before;
      resources.push({
        entryId: entry.id,
        ingredientSlug: food.slug,
        name: food.name,
        required: displayMicros(required),
        allocated: displayMicros(allocated),
        shortage: displayMicros(remaining),
        unit,
        uncertain,
        overlap,
      });
      const total = totals.get(key) ?? {
        food,
        unit,
        required: 0n,
        allocated: 0n,
        uncertain: false,
      };
      total.required += required;
      total.allocated += allocated;
      total.uncertain ||= uncertain;
      totals.set(key, total);
    }
  }
  const ingredients = [...totals.values()]
    .sort((a, b) => `${a.food.slug}:${a.unit}`.localeCompare(`${b.food.slug}:${b.unit}`))
    .map((i) => ({
      ingredientSlug: i.food.slug,
      name: i.food.name,
      required: displayMicros(i.required),
      allocated: displayMicros(i.allocated),
      shortage: displayMicros(i.required - i.allocated),
      unit: i.unit,
      uncertain: i.uncertain,
    }));
  const shopping: ListItem[] = [...totals.values()]
    .filter((i) => i.required > i.allocated)
    .map((i) => ({
      id: crypto.randomUUID(),
      revision: "1",
      ingredient: i.food,
      label: i.food.name,
      category: i.food.categoryName ?? "Altele",
      quantity: quantityText(i.required - i.allocated),
      unitCode: i.unit,
      checked: false,
      price: null,
      transferred: false,
      uncertain: i.uncertain,
    }));
  if (shopping.length > 1000) throw new Error("Planul depășește capacitatea de agregare.");
  const formatMoney = (v: bigint) => `${v / 100n}.${String(v % 100n).padStart(2, "0")}`,
    state = week.budget
      ? money[week.budget.currency] > micros(week.budget.amount) / 10000n
        ? "exceeded"
        : unknownForBudget
          ? "unverifiable"
          : "within"
      : "none";
  return {
    days,
    nutrients,
    unknownNutritionMeals,
    unavailable,
    warnings: warnings.slice(0, 200),
    complete,
    resources,
    ingredients,
    shopping,
    prepGroups: [...prep.values()],
    budget: {
      subtotals: { MDL: formatMoney(money.MDL), RON: formatMoney(money.RON) },
      unknownMeals: week.budget ? unknownForBudget : unknownCost,
      state,
      limit: week.budget,
    },
  };
}
