import assert from "node:assert/strict";
import { test } from "node:test";
import {
  aggregateShopping,
  estimateShopping,
  mergeShopping,
  shoppingText,
} from "../../src/features/shopping/application/shopping-model.ts";
import type { ShoppingItem } from "../../src/features/shopping/contracts/index.ts";
import type { PantryIngredient } from "../../src/features/pantry/contracts/index.ts";
const food: PantryIngredient = {
  id: "00000000-0000-4000-8000-000000000001",
  slug: "rosii",
  name: "Roșii",
  active: true,
  allowedUnits: ["g", "kg", "ml", "piece"],
  categoryId: null,
  categoryName: "Legume",
};
const recipe = (key: string, q: string, unit = "g", optional = false) => ({
  key,
  servings: 2,
  ingredients: [{ ingredientSlug: "rosii", name: "Roșii", quantity: q, unit, optional }],
});
const row = (overrides: Partial<ShoppingItem> = {}): ShoppingItem => ({
  id: crypto.randomUUID(),
  revision: "1",
  label: "Roșii",
  category: "Legume",
  ingredient: food,
  quantity: "500",
  unitCode: "g",
  checked: false,
  price: null,
  transferred: false,
  uncertain: false,
  ...overrides,
});
test("multiple recipes aggregate quantities before deducting measured inventory once", () => {
  const result = aggregateShopping(
    [recipe("a", "0.5", "kg"), recipe("b", "500")],
    [
      { slug: "a", servings: 2 },
      { slug: "b", servings: 2 },
    ],
    [food],
    [{ id: "lot", ingredientSlug: "rosii", quantity: "600", unit: "g", expiresOn: null }],
    "2026-11-05",
    false,
  );
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0]!.quantity, "400");
  assert.equal(result.items[0]!.unitCode, "g");
});
test("portion scaling, incompatible dimensions, optional items and expiry never fabricate coverage", () => {
  const r = aggregateShopping(
    [recipe("a", "1", "piece"), recipe("b", "100", "ml"), recipe("c", "1", "g", true)],
    [
      { slug: "a", servings: 1 },
      { slug: "b", servings: 2 },
      { slug: "c", servings: 2 },
    ],
    [food],
    [
      {
        id: "expired",
        ingredientSlug: "rosii",
        quantity: "10000",
        unit: "ml",
        expiresOn: "2026-11-04",
      },
      { id: "unknown", ingredientSlug: "rosii", quantity: null, unit: null, expiresOn: null },
    ],
    "2026-11-05",
    false,
  );
  assert.deepEqual(
    r.items.map((i) => [i.unitCode, i.quantity]),
    [
      ["ml", "100"],
      ["piece", "1"],
    ],
  );
  assert.ok(r.items.every((i) => i.uncertain));
  assert.ok(r.explanations.length);
  assert.throws(() =>
    aggregateShopping(
      [recipe("a", "1", "cup")],
      [{ slug: "a", servings: 2 }],
      [food],
      [],
      "2026-11-05",
      false,
    ),
  );
});
test("list merging keeps canonical dimensions separate, unknowns separate and checked purchases intact", () => {
  const a = row(),
    b = row({ quantity: "0.5", unitCode: "kg" }),
    c = row({ checked: true });
  const result = mergeShopping([a, c], [b]);
  assert.equal(result.length, 2);
  assert.equal(result[0]!.quantity, "1000");
  assert.equal(result[1]!.quantity, "500");
  assert.equal(mergeShopping([row({ quantity: null, unitCode: null })], [b]).length, 2);
  assert.equal(mergeShopping([a], [row({ ingredient: null })]).length, 2);
  assert.equal(mergeShopping([row({ uncertain: true })], [b]).length, 2);
  const precise = mergeShopping(
    [row({ quantity: "0.000001", unitCode: "kg" })],
    [row({ quantity: "0.000001", unitCode: "g" })],
  );
  assert.equal(precise[0]!.unitCode, "g");
  assert.equal(precise[0]!.quantity, "0.001001");
});
test("cost estimates use dated entered unit prices, exact cents, separate currencies and explicit unknown totals", () => {
  const price = {
    amount: "12.50",
    currency: "MDL" as const,
    basisQuantity: "1",
    basisUnit: "kg" as const,
    observedOn: "2026-11-05",
  };
  const result = estimateShopping(
    [
      row({ price }),
      row({ quantity: "1", unitCode: "g", price: { ...price, amount: "1", currency: "RON" } }),
      row(),
      row({ price: { ...price, observedOn: "2026-09-01" } }),
      row({ price: { ...price, basisUnit: "ml" } }),
    ],
    "2026-11-05",
  );
  assert.deepEqual(result.subtotals, { MDL: "6.25", RON: "0.01" });
  assert.equal(result.unknown, 3);
  assert.equal(result.complete, false);
  assert.deepEqual(
    estimateShopping([row({ price: { ...price, observedOn: "2026-12-01" } })], "2026-11-05")
      .subtotals,
    { MDL: "0.00", RON: "0.00" },
  );
  assert.match(shoppingText([row({ price })], "2026-11-05"), /estim/);
  assert.doesNotMatch(shoppingText([row()], "2026-11-05"), /00000000/);
});
test("an explicitly entered price survives a canonical merge and a later unpriced add preserves it", () => {
  const price = {
    amount: "20",
    currency: "MDL" as const,
    basisQuantity: "1",
    basisUnit: "kg" as const,
    observedOn: "2026-11-05",
  };
  const merged = mergeShopping([row()], [row({ price })]);
  assert.deepEqual(merged[0]!.price, price);
  assert.equal(merged[0]!.quantity, "1000");
  assert.deepEqual(mergeShopping(merged, [row()])[0]!.price, price);
});
