import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import type { RecipeSeed } from "../../src/features/recipes/contracts/index.ts";
import type { PantryItem } from "../../src/features/pantry/contracts/index.ts";
import {
  inventoryForMatching,
  recipesForMatching,
} from "../../src/features/matching/application/adapters.ts";
import { createMatchingEngine } from "../../src/features/matching/application/matching.service.ts";

test("pantry adapter preserves lot identity, unknown quantities and historical units without mutating its source", () => {
  const lot: PantryItem = {
    id: "00000000-0000-4000-8000-000000000001",
    ingredient: {
      id: "00000000-0000-4000-8000-000000000002",
      slug: "rosii",
      name: "Roșii",
      categoryId: null,
      categoryName: null,
      active: true,
      allowedUnits: ["g"],
    },
    quantity: null,
    unitCode: null,
    location: "fridge",
    expiresOn: "2026-11-05",
    revision: "1",
    createdAt: "2026-11-03T00:00:00Z",
    updatedAt: "2026-11-03T00:00:00Z",
  };
  const before = structuredClone(lot);
  const mapped = inventoryForMatching([lot]);
  assert.deepEqual(mapped, [
    {
      id: lot.id,
      ingredient: { slug: "rosii" },
      quantity: null,
      unit: null,
      expiresOn: "2026-11-05",
    },
  ]);
  assert.equal(inventoryForMatching([{ ...lot, quantity: "1", unitCode: "cup" }])[0]!.unit, "cup");
  mapped[0]!.ingredient = { slug: "changed" };
  assert.deepEqual(lot, before);
});

test("recipe adapter preserves all matching semantics and demo/allergen status from the real seed", async () => {
  const bundle = JSON.parse(await readFile("data/recipes/demonstration.v1.json", "utf8")) as {
    recipes: RecipeSeed[];
  };
  const source = bundle.recipes[0]!;
  const before = structuredClone(source);
  const mapped = recipesForMatching([source]);
  assert.equal(mapped[0]!.baseServings, 2);
  assert.equal(mapped[0]!.dataClass, "demonstration");
  assert.equal(mapped[0]!.allergens.status, "unverified");
  assert.equal(mapped[0]!.ingredients[0]!.ingredientSlug, "fulgi-de-ovaz");
  assert.equal(mapped[0]!.ingredients[0]!.quantity, "100");
  mapped[0]!.ingredients[0]!.quantity = "1";
  assert.deepEqual(source, before);
});

test("collection demo evaluates all 72 recipes and never recommends an unreviewed recipe for an allergy", async () => {
  const { loadMatchingExample } = await import("../../scripts/matching/example.ts");
  const { configuration, request } = await loadMatchingExample();
  const engine = createMatchingEngine(configuration);
  const result = engine.match(request);
  assert.equal(result.status, "ready");
  assert.equal(result.summary.evaluated, 72);
  assert.equal(result.summary.matched, 72);
  assert.ok(result.groups.ready_to_cook.length > 0);
  assert.equal(result.groups.ready_to_cook[0]!.dataClass, "demonstration");
  const allergic = engine.match({ ...request, allergies: ["milk"] });
  assert.equal(allergic.status, "empty");
  assert.equal(allergic.excluded.length, 72);
});

test("recipe projections reject cooked-weight requirements that pantry cannot distinguish from raw stock", async () => {
  const bundle = JSON.parse(await readFile("data/recipes/demonstration.v1.json", "utf8")) as {
    recipes: RecipeSeed[];
  };
  const recipe = structuredClone(bundle.recipes[0]!);
  recipe.ingredients[0]!.state = "cooked";
  assert.throws(() => recipesForMatching([recipe]), /UNSUPPORTED_COOKED_QUANTITY/);
});
