import assert from "node:assert/strict";
import { test } from "node:test";
import {
  parseRecipeQuery,
  recipeQueryString,
} from "../../src/features/recipes/contracts/search-query.ts";
import { createRecipeSearch } from "../../src/features/recipes/application/search-catalog.ts";
import type {
  SearchRecipe,
  RecipeSnapshot,
} from "../../src/features/recipes/contracts/search.schema.ts";

const base: SearchRecipe = {
  id: null,
  key: "salata",
  revision: 1,
  dataClass: "verified",
  title: "Salată de roșii",
  summary: "Simplă",
  servings: 2,
  totalMinutes: 15,
  difficulty: "easy",
  mealTypes: ["lunch"],
  cuisines: ["romania"],
  diets: ["vegetarian"],
  equipment: ["knife"],
  tags: ["vegetarian"],
  ingredients: [
    {
      ingredientSlug: "rosii",
      name: "Roșii",
      quantity: "100",
      unit: "g",
      optional: false,
      preparation: "Tăiate",
    },
  ],
  steps: ["Taie și servește."],
  allergens: { status: "verified", contains: [], mayContain: [] },
  nutrition: { calories: "120", protein: "8" },
  budget: { amount: "5", currency: "MDL" },
};
const catalog: RecipeSnapshot["catalog"] = {
  ingredients: [
    {
      slug: "rosii",
      name: "Roșii",
      units: ["g"],
      aliases: [{ locale: "en-GB", label: "tomatoes" }],
      active: true,
      allergenHints: [],
    },
  ],
};
const filters = (query = "") => {
  const parsed = parseRecipeQuery(new URLSearchParams(query));
  assert.ok(parsed.success);
  return parsed.data;
};
const search = (recipes: SearchRecipe[] = [base]) => createRecipeSearch({ recipes, catalog });
test("query codec roundtrips combinable filters, canonicalizes lists and rejects invalid/duplicate scalar parameters", () => {
  const f = filters(
    "q=ro%C8%99ii&meal=lunch&diet=vegetarian&equipment=pot&equipment=knife&exclude=ou&page=2&size=6&minutes=30&budget=10.50&currency=RON&protein=8&source=demo",
  );
  assert.deepEqual(filters(recipeQueryString(f)), f);
  assert.deepEqual(f.equipment, ["knife", "pot"]);
  for (const q of [
    "page=0",
    "page=1&page=2",
    "minutes=abc",
    "budget=-1",
    "sort=sql",
    "calories=NaN",
    "size=999",
    "surprise=1",
    "q=" + "a".repeat(121),
  ])
    assert.equal(parseRecipeQuery(new URLSearchParams(q)).success, false);
  assert.equal(recipeQueryString(filters()), "");
});
test("text searches title and explicit ingredient aliases without Romanian accents", async () => {
  for (const q of ["q=salata", "q=rosii", "q=tomatoes"])
    assert.equal((await search().search(filters(q))).total, 1);
  assert.equal((await search().search(filters("q=orez"))).total, 0);
});
test("equipment URLs accept canonical underscore codes and require every tool", async () => {
  const selected = filters("equipment=mixing_bowl&equipment=knife");
  assert.deepEqual(selected.equipment, ["knife", "mixing_bowl"]);
  assert.deepEqual(filters(recipeQueryString(selected)), selected);
  const service = search([{ ...base, equipment: ["knife", "mixing_bowl"] }]);
  assert.equal((await service.search(selected)).total, 1);
  assert.equal((await service.search(filters("equipment=knife"))).total, 0);
  assert.equal(
    (await search([{ ...base, equipment: [] }]).search(filters("equipment=knife"))).total,
    0,
  );
});
test("all filter groups combine and equipment selection covers all required tools", async () => {
  const service = search();
  const q =
    "minutes=20&difficulty=easy&meal=lunch&cuisine=romania&diet=vegetarian&ingredient=rosii&equipment=knife&budget=6&currency=MDL&calories=130&protein=7";
  assert.equal((await service.search(filters(q))).total, 1);
  for (const extra of [
    "minutes=10",
    "difficulty=hard",
    "meal=dinner",
    "cuisine=moldova",
    "diet=vegan",
    "equipment=pot",
    "exclude=rosii",
    "budget=4",
    "currency=RON",
    "calories=100",
    "protein=9",
  ]) {
    const params = new URLSearchParams(q);
    const [k, v] = extra.split("=");
    params.set(k!, v!);
    assert.equal((await service.search(filters(params.toString()))).total, 0, extra);
  }
});
test("unknown nutrition and budget never pass numeric filters or compare across currencies", async () => {
  const service = search([
    { ...base, key: "unknown", nutrition: null, budget: null },
    { ...base, key: "ron", budget: { amount: "1", currency: "RON" } },
  ]);
  assert.equal((await service.search(filters())).total, 2);
  assert.equal((await service.search(filters("budget=100&currency=MDL"))).total, 0);
  assert.equal((await service.search(filters("protein=0"))).total, 1);
  assert.equal((await service.search(filters("calories=9999"))).total, 1);
});
test("matching scores sort the complete filtered set before pagination and pages clamp deterministically", async () => {
  const recipes = Array.from({ length: 15 }, (_, n) => ({
    ...base,
    key: `recipe-${String(n).padStart(2, "0")}`,
  }));
  const scored: string[][] = [];
  const service = createRecipeSearch({ recipes, catalog }, async (candidates) => {
    scored.push(candidates.map((r) => r.key));
    return new Map(
      candidates.map((r, n) => [
        r.key,
        { score: n, category: "missing_ingredients" as const, explanations: [], ingredients: [] },
      ]),
    );
  });
  const result = await service.search(filters("sort=compatibility&size=6&page=2"));
  assert.equal(scored[0]!.length, 15);
  assert.equal(result.items[0]!.recipe.key, "recipe-08");
  assert.equal(result.pages, 3);
  assert.equal((await service.search(filters("page=999&size=6"))).page, 3);
});
test("allergies exclude traces, optional allergens and unverified metadata before scoring", async () => {
  const service = search([
    { ...base, key: "unknown", allergens: { ...base.allergens, status: "unverified" } },
    { ...base, key: "trace", allergens: { ...base.allergens, mayContain: ["milk"] } },
    base,
  ]);
  const result = await service.search(filters("allergy=milk"));
  assert.equal(result.total, 1);
  assert.equal(result.excludedCount, 2);
  assert.equal(result.items[0]!.recipe.key, "salata");
});
