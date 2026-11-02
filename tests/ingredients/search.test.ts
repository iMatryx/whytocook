import assert from "node:assert/strict";
import { test } from "node:test";

import { ingredientSearchKey } from "../../src/features/ingredients/domain/search-key.ts";
import {
  ingredientSearchInputSchema,
  ingredientDetailSchema,
} from "../../src/features/ingredients/contracts/ingredient.schema.ts";

test("search normalization handles Romanian spellings and decomposed accents", () => {
  for (const word of ["Roșii", "ROŞII", "  rosii  ", "Ros\u0326ii"]) {
    assert.equal(ingredientSearchKey(word), "rosii");
  }
  assert.equal(ingredientSearchKey("Făină de grâu"), "faina de grau");
});
test("Russian yo is searchable without erasing the short-i distinction", () => {
  assert.equal(ingredientSearchKey("ЗЕЛЁНЫЙ"), "зеленый");
  assert.notEqual(ingredientSearchKey("й"), ingredientSearchKey("и"));
  assert.equal(ingredientSearchKey("куриная грудка"), "куриная грудка");
});
test("public search bounds and locale are validated", () => {
  const valid = ingredientSearchInputSchema.parse({ query: "piept pui", locale: "ru-RU" });
  assert.equal(valid.limit, 20);
  for (const value of [
    { query: "x" },
    { query: "%_" },
    { query: "a".repeat(81) },
    { limit: 51 },
    { locale: "xx" },
    { categoryId: "bad" },
    { query: "a b c d e f g h i" },
  ]) {
    assert.equal(ingredientSearchInputSchema.safeParse(value).success, false);
  }
});
test("unknown nutrition cannot be represented as verified zero measurements", () => {
  const value = {
    id: "10000000-0000-4000-8000-000000000002",
    slug: "test",
    canonicalName: "Test",
    name: "Test",
    matchedTerm: null,
    category: null,
    kind: "specific",
    broader: null,
    aliases: [],
    units: [],
    nutrition: {
      status: "unavailable",
      basis: "100g",
      energyKcal: null,
      proteinG: null,
      carbohydrateG: null,
      fatG: null,
      fiberG: null,
      saltG: null,
      source: null,
    },
  };
  assert.equal(ingredientDetailSchema.safeParse(value).success, true);
  assert.equal(
    ingredientDetailSchema.safeParse({
      ...value,
      nutrition: { ...value.nutrition, energyKcal: "0" },
    }).success,
    false,
  );
  assert.equal(
    ingredientDetailSchema.safeParse({
      ...value,
      nutrition: { ...value.nutrition, status: "available" },
    }).success,
    false,
  );
});
