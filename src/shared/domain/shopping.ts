import {
  baseMicros,
  displayMicros,
  scaleRequirement,
  supportedUnit,
  unitTable,
} from "./cooking-quantity.ts";
import { quantityMicros, quantityText, convertQuantity } from "./quantity.ts";
export type ShoppingFood = {
  id: string;
  slug: string;
  name: string;
  categoryId: string | null;
  categoryName: string | null;
  active: boolean;
  allowedUnits: ("g" | "kg" | "ml" | "l" | "piece")[];
};
export type EnteredPrice = {
  amount: string;
  currency: "MDL" | "RON";
  basisQuantity: string;
  basisUnit: "g" | "kg" | "ml" | "l" | "piece";
  observedOn: string;
};
export type ListItem = {
  id: string;
  revision: string;
  ingredient: ShoppingFood | null;
  label: string;
  category: string;
  quantity: string | null;
  unitCode: "g" | "kg" | "ml" | "l" | "piece" | null;
  checked: boolean;
  price: EnteredPrice | null;
  transferred: boolean;
  uncertain: boolean;
};
type Recipe = {
  key: string;
  servings: number;
  ingredients: { ingredientSlug: string; quantity: string; unit: string; optional: boolean }[];
};
type Inventory = {
  id: string;
  ingredientSlug: string;
  quantity: string | null;
  unit: string | null;
  expiresOn: string | null;
};
export function aggregateShopping(
  recipes: readonly Recipe[],
  selections: readonly { slug: string; servings: number }[],
  catalog: readonly ShoppingFood[],
  inventory: readonly Inventory[],
  today: string,
  includeOptional: boolean,
) {
  const totals = new Map<
      string,
      { food: ShoppingFood; unit: "g" | "ml" | "piece"; required: bigint }
    >(),
    explanations: string[] = [];
  if (
    !selections.length ||
    selections.length > 20 ||
    new Set(selections.map((s) => s.slug)).size !== selections.length
  )
    throw new Error("Alege 1–20 rețete distincte.");
  for (const s of selections) {
    const recipe = recipes.find((r) => r.key === s.slug);
    if (!recipe || !Number.isInteger(s.servings) || s.servings < 1 || s.servings > 20)
      throw new Error("Rețetă sau porții invalide.");
    for (const i of recipe.ingredients) {
      if (i.optional && !includeOptional) continue;
      const food = catalog.find((f) => f.slug === i.ingredientSlug && f.active);
      if (!food || !supportedUnit(i.unit) || !food.allowedUnits.includes(i.unit))
        throw new Error("Ingredient sau unitate fără conversie sigură. Verifică rețeta.");
      if (i.unit === "piece" && quantityMicros(i.quantity) % 1000000n)
        throw new Error("Bucățile trebuie să fie întregi.");
      const unit = unitTable[i.unit].base;
      if (!food.allowedUnits.includes(unit))
        throw new Error("Unitatea de bază nu este permisă pentru ingredient.");
      const scaled = scaleRequirement(
          baseMicros(i.quantity, i.unit),
          unit,
          s.servings,
          recipe.servings,
        ),
        key = `${food.slug}:${unit}`,
        previous = totals.get(key);
      totals.set(key, { food, unit, required: (previous?.required ?? 0n) + scaled.required });
      if (scaled.rounding)
        explanations.push(`${food.name}: necesar rotunjit în sus pentru ${s.servings} porții.`);
    }
  }
  const items: ListItem[] = [];
  for (const { food, unit, required } of [...totals.values()].sort((a, b) =>
    `${a.food.slug}:${a.unit}`.localeCompare(`${b.food.slug}:${b.unit}`),
  )) {
    let available = 0n,
      uncertain = false;
    for (const lot of inventory) {
      if (lot.ingredientSlug !== food.slug) continue;
      if (lot.expiresOn && lot.expiresOn < today) continue;
      if (lot.quantity === null || !lot.unit || !supportedUnit(lot.unit)) {
        uncertain = true;
        continue;
      }
      if (unitTable[lot.unit].base !== unit) continue;
      if (lot.unit === "piece" && quantityMicros(lot.quantity) % 1000000n) {
        uncertain = true;
        continue;
      }
      available += baseMicros(lot.quantity, lot.unit);
    }
    const shortage = required > available ? required - available : 0n;
    explanations.push(
      `${food.name}: necesar ${displayMicros(required)} ${unit}, disponibil măsurat ${displayMicros(available)} ${unit}${uncertain ? "; există stoc nemăsurat sau nesuportat" : ""}.`,
    );
    if (shortage > 0n)
      items.push({
        id: crypto.randomUUID(),
        revision: "1",
        ingredient: food,
        label: food.name,
        category: food.categoryName ?? "Altele",
        quantity: quantityText(shortage),
        unitCode: unit,
        checked: false,
        price: null,
        transferred: false,
        uncertain,
      });
  }
  if (items.length > 100)
    throw new Error("Selecția depășește 100 ingrediente. Împarte rețetele în grupuri mai mici.");
  return { items, explanations: explanations.slice(0, 200) };
}
export function mergeShopping(existing: readonly ListItem[], incoming: readonly ListItem[]) {
  const items = existing.map((i) => ({ ...i }));
  for (const line of incoming) {
    const same = items.find(
      (i) =>
        !i.checked &&
        !i.uncertain &&
        !i.transferred &&
        !line.checked &&
        !line.uncertain &&
        !line.transferred &&
        i.ingredient &&
        line.ingredient?.id === i.ingredient.id &&
        i.quantity !== null &&
        line.quantity !== null &&
        i.unitCode &&
        line.unitCode &&
        unitTable[i.unitCode].base === unitTable[line.unitCode].base,
    );
    if (
      same &&
      same.quantity !== null &&
      same.unitCode &&
      line.quantity !== null &&
      line.unitCode
    ) {
      try {
        const added = convertQuantity(line.quantity, line.unitCode, same.unitCode);
        same.quantity = quantityText(quantityMicros(same.quantity) + quantityMicros(added));
      } catch {
        const base = unitTable[same.unitCode].base;
        if (!same.ingredient?.allowedUnits.includes(base))
          throw new Error("Conversia necesită rotunjire.");
        same.quantity = quantityText(
          baseMicros(same.quantity, same.unitCode) + baseMicros(line.quantity, line.unitCode),
        );
        same.unitCode = base;
      }
      same.revision = String(BigInt(same.revision) + 1n);
      same.price = line.price ?? same.price;
      same.uncertain ||= line.uncertain;
    } else {
      if (items.some((i) => i.id === line.id)) throw new Error("Identificator duplicat.");
      items.push({ ...line });
    }
  }
  if (items.length > 500) throw new Error("Lista poate avea maximum 500 rânduri.");
  return items;
}
export function estimateShopping(items: readonly ListItem[], today: string) {
  const cents: { MDL: bigint; RON: bigint } = { MDL: 0n, RON: 0n };
  let unknown = 0;
  for (const i of items) {
    if (i.transferred) continue;
    const p = i.price;
    if (
      !p ||
      i.quantity === null ||
      !i.unitCode ||
      p.observedOn > today ||
      Date.parse(`${today}T00:00:00Z`) - Date.parse(`${p.observedOn}T00:00:00Z`) > 30 * 86400000 ||
      unitTable[i.unitCode].base !== unitTable[p.basisUnit].base
    ) {
      unknown++;
      continue;
    }
    const basis = baseMicros(p.basisQuantity, p.basisUnit);
    if (basis <= 0n) {
      unknown++;
      continue;
    }
    const [whole, part = ""] = p.amount.split("."),
      unitCents = BigInt(whole!) * 100n + BigInt(part.padEnd(2, "0"));
    const numerator = unitCents * baseMicros(i.quantity, i.unitCode);
    cents[p.currency] += (numerator + basis - 1n) / basis;
  }
  const money = (v: bigint) => `${v / 100n}.${String(v % 100n).padStart(2, "0")}`;
  return {
    subtotals: { MDL: money(cents.MDL), RON: money(cents.RON) },
    unknown,
    complete: unknown === 0,
  };
}
export function shoppingText(items: readonly ListItem[], today: string) {
  const estimate = estimateShopping(items, today);
  return [
    "Lista de cumpărături Cookly",
    ...items
      .filter((i) => !i.transferred)
      .map(
        (i) =>
          `${i.checked ? "[x]" : "[ ]"} ${i.label}: ${i.quantity ?? "cantitate de stabilit"} ${i.unitCode ?? ""} (${i.category})${i.uncertain ? " — verifică stocul necunoscut" : ""}`,
      ),
    `Subtotal estimat din prețuri introduse: ${estimate.subtotals.MDL} MDL; ${estimate.subtotals.RON} RON.`,
    `${estimate.unknown} rânduri fără estimare sigură. Prețurile nu sunt garantate; monedele nu sunt convertite.`,
  ].join("\n");
}
