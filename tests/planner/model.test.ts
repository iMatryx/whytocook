import assert from "node:assert/strict";
import { test } from "node:test";
import {
  addPlannerDays,
  plannerMonday,
  analyzePlannerWeek,
} from "../../src/shared/domain/meal-planner.ts";
import type {
  PlannerWeek,
  PlannerEntry,
  PlannerRecipe,
} from "../../src/features/meal-planner/contracts/index.ts";
import type { PantryIngredient } from "../../src/features/pantry/contracts/index.ts";
const food: PantryIngredient = {
  id: "00000000-0000-4000-8000-000000000001",
  slug: "rosii",
  name: "Roșii",
  categoryId: null,
  categoryName: "Legume",
  active: true,
  allowedUnits: ["g", "kg"],
};
const recipe: PlannerRecipe = {
  id: null,
  key: "salata",
  revision: 1,
  versionId: null,
  dataClass: "demonstration",
  title: "Salată",
  summary: "",
  servings: 2,
  totalMinutes: 10,
  difficulty: "easy",
  mealTypes: [],
  cuisines: [],
  diets: [],
  equipment: [],
  tags: [],
  ingredients: [
    {
      ingredientSlug: "rosii",
      name: "Roșii",
      quantity: "500",
      unit: "g",
      optional: false,
      preparation: "",
    },
  ],
  steps: ["Taie."],
  allergens: { status: "unverified", contains: [], mayContain: [] },
  nutrition: null,
  budget: null,
  fullNutrition: { status: "unavailable", perServing: null, source: null },
  budgetSource: null,
};
const entry = (day: string, overrides: Partial<PlannerEntry> = {}): PlannerEntry => ({
  id: crypto.randomUUID(),
  recipeKey: recipe.key,
  recipeRevision: 1,
  versionId: null,
  plannedOn: day,
  slot: "lunch",
  servings: 2,
  prepOn: null,
  costPerServing: null,
  ...overrides,
});
const week = (entries: PlannerEntry[], overrides: Partial<PlannerWeek> = {}): PlannerWeek => ({
  startsOn: "2026-11-02",
  revision: "1",
  budget: null,
  entries,
  exportedRevision: null,
  ...overrides,
});
test("calendar arithmetic is stable across DST, leap day and year boundaries", () => {
  assert.equal(addPlannerDays("2026-10-25", 1), "2026-10-26");
  assert.equal(addPlannerDays("2024-02-28", 1), "2024-02-29");
  assert.equal(addPlannerDays("2026-12-31", 1), "2027-01-01");
  assert.equal(plannerMonday("2026-11-05"), "2026-11-02");
});
test("weekly inventory is allocated once, detects overlap and consolidates shopping", () => {
  const meals = [entry("2026-11-05"), entry("2026-11-06")];
  const a = analyzePlannerWeek(
    week(meals),
    [recipe],
    [food],
    [{ id: "lot", ingredientSlug: "rosii", quantity: "0.6", unit: "kg", expiresOn: null }],
    "2026-11-05",
  );
  assert.equal(a.shopping[0]!.quantity, "400");
  assert.equal(a.ingredients[0]!.required, "1000");
  assert.equal(a.ingredients[0]!.allocated, "600");
  assert.equal(a.resources[1]!.overlap, true);
  assert.equal(a.resources[1]!.shortage, "400");
  assert.equal(a.unknownNutritionMeals, 2);
});
test("expiry is evaluated at planned use or prep date and never mistaken for shared stock", () => {
  const inventory = [
    { id: "early", ingredientSlug: "rosii", quantity: "500", unit: "g", expiresOn: "2026-11-05" },
  ];
  const a = analyzePlannerWeek(
    week([entry("2026-11-05"), entry("2026-11-08")]),
    [recipe],
    [food],
    inventory,
    "2026-11-05",
  );
  assert.equal(a.shopping[0]!.quantity, "500");
  assert.equal(a.resources[1]!.overlap, false);
  const prep = analyzePlannerWeek(
    week([entry("2026-11-08", { prepOn: "2026-11-05" })]),
    [recipe],
    [food],
    inventory,
    "2026-11-05",
  );
  assert.equal(prep.shopping.length, 0);
  assert.equal(prep.prepGroups[0]!.servings, 2);
});
test("nutrition and budget aggregate exact portions while unknown, stale and foreign costs remain explicit", () => {
  const source = {
    name: "Fixture",
    url: "https://example.com/source",
    recordId: "fixture",
    license: "Test fixture",
    observedOn: "2026-11-05",
  };
  const full: PlannerRecipe = {
    ...recipe,
    fullNutrition: {
      status: "verified",
      source,
      perServing: {
        energyKcal: "250",
        proteinG: "10.5",
        carbohydrateG: "20",
        fatG: "5",
        fiberG: "2",
        saltG: "0.1",
      },
    },
  };
  const a = analyzePlannerWeek(
    week(
      [
        entry("2026-11-05", {
          servings: 3,
          costPerServing: { amount: "12.50", currency: "MDL", observedOn: "2026-11-05" },
        }),
      ],
      { budget: { amount: "30", currency: "MDL" } },
    ),
    [full],
    [food],
    [],
    "2026-11-05",
  );
  assert.equal(a.nutrients.energyKcal, "750");
  assert.equal(a.nutrients.proteinG, "31.5");
  assert.equal(a.budget.subtotals.MDL, "37.50");
  assert.equal(a.budget.state, "exceeded");
  assert.equal(a.days[3]!.nutrients.saltG, "0.3");
  const unknown = analyzePlannerWeek(
    week(
      [
        entry("2026-11-05", {
          costPerServing: { amount: "10", currency: "RON", observedOn: "2026-11-05" },
        }),
      ],
      { budget: { amount: "100", currency: "MDL" } },
    ),
    [recipe],
    [food],
    [],
    "2026-11-05",
  );
  assert.equal(unknown.budget.state, "unverifiable");
  assert.equal(unknown.unknownNutritionMeals, 1);
  const stale = analyzePlannerWeek(
    week([
      entry("2026-11-05", {
        costPerServing: { amount: "10", currency: "MDL", observedOn: "2026-09-01" },
      }),
    ]),
    [recipe],
    [food],
    [],
    "2026-11-05",
  );
  assert.equal(stale.budget.unknownMeals, 1);
});
test("all seven days and repeated recipes exceed shopping's ordinary 20-selection limit safely", () => {
  const meals = Array.from({ length: 28 }, (_, i) =>
    entry(addPlannerDays("2026-11-02", Math.floor(i / 4)), {
      slot: (["breakfast", "lunch", "dinner", "snack"] as const)[i % 4]!,
      servings: 1,
      prepOn: i < 8 ? "2026-11-02" : null,
    }),
  );
  const a = analyzePlannerWeek(week(meals), [recipe], [food], [], "2026-11-02");
  assert.equal(a.shopping[0]!.quantity, "7000");
  assert.equal(a.days.length, 7);
  assert.equal(a.prepGroups[0]!.servings, 8);
});
test("unavailable versions and profile exclusions block generation instead of silently recalculating", () => {
  const pinned = week([entry("2026-11-05", { recipeRevision: 2 })]);
  assert.equal(analyzePlannerWeek(pinned, [recipe], [food], [], "2026-11-05").complete, false);
  assert.equal(
    analyzePlannerWeek(week([entry("2026-11-05")]), [recipe], [food], [], "2026-11-05", {
      allergies: [],
      excluded: ["rosii"],
    }).complete,
    false,
  );
});
