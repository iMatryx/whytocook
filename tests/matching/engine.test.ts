import assert from "node:assert/strict";
import { test } from "node:test";
import { createMatchingEngine } from "../../src/features/matching/application/matching.service.ts";
import { matchingResultSchema } from "../../src/features/matching/contracts/index.ts";

const catalog = {
  ingredients: [
    {
      slug: "rosii",
      name: "Roșii",
      units: ["g", "kg", "piece"],
      aliases: [
        { locale: "ro-RO", label: "Roșii" },
        { locale: "en-GB", label: "tomatoes" },
        { locale: "ru-RU", label: "помидоры" },
      ],
      active: true,
      allergenHints: [],
    },
    {
      slug: "lapte",
      name: "Lapte",
      units: ["ml", "l", "g"],
      aliases: [],
      active: true,
      allergenHints: ["milk"],
    },
    {
      slug: "ou",
      name: "Ou",
      units: ["piece", "g"],
      aliases: [],
      active: true,
      allergenHints: ["eggs"],
    },
  ],
};
const line = (slug = "rosii", quantity = "100", unit = "g", optional = false) => ({
  ingredientSlug: slug,
  quantity,
  unit,
  optional,
});
const recipe = (patch: Record<string, unknown> = {}) => ({
  key: "salata",
  revision: 1,
  title: "Salată de test",
  dataClass: "demonstration",
  baseServings: 2,
  ingredients: [line()],
  totalMinutes: 20,
  tags: ["vegetarian"],
  allergens: { status: "verified", contains: [], mayContain: [] },
  ...patch,
});
const lot = (
  quantity: string | null = "100",
  unit: string | null = "g",
  patch: Record<string, unknown> = {},
) => ({
  id: "lot-1",
  ingredient: { slug: "rosii" },
  quantity,
  unit,
  expiresOn: null,
  ...patch,
});
const input = (inventory: unknown[] = [lot()], patch: Record<string, unknown> = {}) => ({
  inventory,
  today: "2026-11-03",
  ...patch,
});
const engine = (recipes: unknown[] = [recipe()], source: unknown = catalog) =>
  createMatchingEngine({ catalog: source, recipes });

test("canonical ingredients, explicit RO/RU/EN synonyms and exact unit aggregation match without mutating stock", () => {
  const inventory = [
    lot("0.05", "kg"),
    lot("50", "g", { id: "lot-2", ingredient: { alias: "TOMATOES", locale: "en-GB" } }),
  ];
  const before = structuredClone(inventory);
  const result = engine().match(input(inventory));
  assert.equal(result.status, "ready");
  const match = result.groups.ready_to_cook[0]!;
  assert.equal(match.ingredients[0]!.available, "100");
  assert.equal(match.ingredients[0]!.required, "100");
  assert.equal(match.score.total, 100);
  assert.deepEqual(inventory, before);
  for (const [alias, locale] of [
    ["  ROSII  ", "ro-RO"],
    ["помидоры", "ru-RU"],
  ]) {
    assert.equal(
      engine().match(input([lot("100", "g", { ingredient: { alias, locale } })])).groups
        .ready_to_cook.length,
      1,
    );
  }
  assert.ok(matchingResultSchema.safeParse(result).success);
});

test("almost_ready needs at least 80 percent measured coverage and at most one deficient required line", () => {
  const matcher = engine();
  const almost = matcher.match(input([lot("80")]));
  assert.equal(almost.groups.almost_ready.length, 1);
  assert.equal(almost.groups.almost_ready[0]!.ingredients[0]!.status, "insufficient");
  assert.equal(almost.groups.almost_ready[0]!.ingredients[0]!.shortage, "20");
  assert.equal(almost.groups.almost_ready[0]!.score.total, 94);
  assert.equal(matcher.match(input([lot("79.999999")])).groups.missing_ingredients.length, 1);
  const two = engine([recipe({ ingredients: [line(), line("lapte", "100", "ml")] })]);
  assert.equal(
    two.match(input([lot("99"), lot("99", "ml", { id: "milk", ingredient: { slug: "lapte" } })]))
      .groups.missing_ingredients.length,
    1,
  );
});

test("missing optional ingredients do not block ready or inflate a required-only score", () => {
  const result = engine([recipe({ ingredients: [line(), line("lapte", "50", "ml", true)] })]).match(
    input(),
  );
  const match = result.groups.ready_to_cook[0]!;
  assert.equal(match.ingredients[1]!.role, "optional");
  assert.equal(match.ingredients[1]!.status, "missing");
  assert.equal(match.score.total, 100);
  assert.equal(match.requiredSummary.total, 1);
});

test("null quantities, zero stock and expired lots never imply sufficient stock", () => {
  const unknown = engine().match(input([lot(null, null)])).groups.missing_ingredients[0]!;
  assert.equal(unknown.ingredients[0]!.status, "unknown_quantity");
  assert.equal(unknown.ingredients[0]!.quantityUncertain, true);
  assert.equal(unknown.ingredients[0]!.shortage, "100");
  assert.equal(
    engine().match(input([lot("0")])).groups.missing_ingredients[0]!.ingredients[0]!.status,
    "missing",
  );
  const expired = engine().match(input([lot("100", "g", { expiresOn: "2026-11-02" })]));
  assert.equal(expired.groups.ready_to_cook.length, 0);
  assert.ok(expired.diagnostics.some((issue) => issue.code === "EXPIRED_LOT"));
  assert.equal(
    engine().match(input([lot("100", "g", { expiresOn: "2026-11-03" })])).groups.ready_to_cook
      .length,
    1,
  );
});

test("only compatible dimensions count, without inventing density or piece weights", () => {
  const milk = engine([recipe({ ingredients: [line("lapte", "100", "ml")] })]);
  const result = milk.match(input([lot("100", "g", { ingredient: { slug: "lapte" } })]));
  assert.equal(result.groups.missing_ingredients[0]!.ingredients[0]!.available, "0");
  assert.ok(
    result.groups.missing_ingredients[0]!.ingredients[0]!.issues.includes("INCOMPATIBLE_UNIT"),
  );
  assert.equal(
    milk.match(input([lot("0.1", "l", { ingredient: { slug: "lapte" } })])).groups.ready_to_cook
      .length,
    1,
  );
  assert.equal(engine().match(input([lot("1", "piece")])).groups.ready_to_cook.length, 0);
});

test("portions scale conservatively including whole pieces and sub-micro requirements", () => {
  const match =
    engine().match(input([lot("149.999999")], { servings: 3 })).groups.missing_ingredients[0] ??
    engine().match(input([lot("149.999999")], { servings: 3 })).groups.almost_ready[0]!;
  assert.equal(match.ingredients[0]!.required, "150");
  assert.equal(match.ingredients[0]!.shortage, "0.000001");
  const eggs = engine([recipe({ baseServings: 3, ingredients: [line("ou", "1", "piece")] })]);
  const egg = eggs.match(
    input([lot("1", "piece", { ingredient: { slug: "ou" } })], { servings: 1 }),
  ).groups.ready_to_cook[0]!;
  assert.equal(egg.ingredients[0]!.required, "1");
  assert.equal(egg.ingredients[0]!.rounding, "whole_piece");
  const fraction = engine([recipe({ baseServings: 3, ingredients: [line("rosii", "1")] })]);
  assert.equal(
    fraction.match(input([lot("0.333333")], { servings: 1 })).groups.ready_to_cook.length,
    0,
  );
  const rounded = fraction.match(input([lot("0.333334")], { servings: 1 })).groups
    .ready_to_cook[0]!;
  assert.equal(rounded.ingredients[0]!.rounding, "up_to_micro_unit");
});

test("allergy exclusions precede scoring including traces, optional ingredients and missing review", () => {
  for (const patch of [
    { allergens: { status: "verified", contains: ["milk"], mayContain: [] } },
    { allergens: { status: "verified", contains: [], mayContain: ["milk"] } },
    { allergens: { status: "unverified", contains: [], mayContain: [] } },
    { ingredients: [line(), line("lapte", "1", "ml", true)] },
  ]) {
    const result = engine([recipe(patch)]).match(input([lot("1000")], { allergies: ["milk"] }));
    assert.equal(result.status, "empty");
    assert.equal(result.excluded.length, 1);
    assert.equal(result.groups.ready_to_cook.length, 0);
  }
  assert.equal(engine().match(input([], { allergies: ["milk"] })).excluded.length, 0);
});

test("time and tag preferences have explicit contributions and deterministic ranking", () => {
  const matcher = engine([recipe({ key: "b" }), recipe({ key: "a" })]);
  const result = matcher.match(
    input(undefined, {
      preferences: { maxTotalMinutes: 10, preferredTags: ["vegetarian", "rapid"] },
    }),
  );
  assert.deepEqual(
    result.groups.ready_to_cook.map((r) => r.recipeKey),
    ["a", "b"],
  );
  const score = result.groups.ready_to_cook[0]!.score;
  assert.equal(score.total, 90);
  assert.equal(score.components.time.score, 50);
  assert.equal(score.components.time.points, 5);
  assert.equal(score.components.preferences.score, 50);
  assert.equal(score.components.compatibility.points, 50);
  assert.ok(score.components.quantities.explanation.length > 0);
  assert.deepEqual(
    result,
    matcher.match(
      input(undefined, {
        preferences: { maxTotalMinutes: 10, preferredTags: ["vegetarian", "rapid"] },
      }),
    ),
  );
});

test("empty input and invalid dates, quantities, portions and duplicate lots produce explicit states", () => {
  assert.equal(engine([]).match(input()).status, "empty");
  const empty = engine().match(input([]));
  assert.equal(empty.groups.missing_ingredients.length, 1);
  assert.ok(empty.diagnostics.some((d) => d.code === "EMPTY_INVENTORY"));
  for (const value of [
    input([], { today: "2026-02-30" }),
    input([], { servings: 0 }),
    input([], { servings: 1.5 }),
    input([lot("-1")]),
    input([lot("NaN")]),
    input([lot("1e3")]),
    input([lot("0.5", "piece")]),
    input([lot("1", null)]),
    input([lot(), lot()]),
    input([], { allergies: ["unknown"] }),
  ]) {
    const result = engine().match(value);
    assert.equal(result.status, "error");
    assert.equal(result.error!.code, "INVALID_REQUEST");
    assert.equal(result.groups.ready_to_cook.length, 0);
    assert.ok(matchingResultSchema.safeParse(result).success);
  }
});

test("invalid recipes and ambiguous alias catalogs cannot silently produce recommendations", () => {
  for (const recipes of [
    [recipe({ ingredients: [line("unknown")] })],
    [recipe({ ingredients: [line(), line()] })],
    [recipe({ ingredients: [line("rosii", "1", "ml")] })],
    [recipe({ ingredients: [line("rosii", "1", "g", true)] })],
    [recipe(), recipe()],
  ])
    assert.equal(engine(recipes).match(input()).error!.code, "INVALID_CONFIGURATION");
  const ambiguous = {
    ingredients: catalog.ingredients.map((ingredient, index) => ({
      ...ingredient,
      aliases:
        index === 1
          ? [...ingredient.aliases, { label: "ROSII", locale: "ro-RO" }]
          : ingredient.aliases,
    })),
  };
  assert.equal(engine([recipe()], ambiguous).match(input()).status, "error");
});

test("unknown, unsupported and inactive inventory entries are diagnosed without substitutes", () => {
  const result = engine().match(
    input([
      lot("100", "g", { ingredient: { alias: "tomato", locale: "en-GB" } }),
      lot("100", "cup", { id: "unsupported" }),
    ]),
  );
  assert.equal(result.groups.ready_to_cook.length, 0);
  assert.ok(result.diagnostics.some((d) => d.code === "UNKNOWN_INGREDIENT"));
  assert.ok(result.diagnostics.some((d) => d.code === "UNSUPPORTED_UNIT"));
  const inactive = structuredClone(catalog);
  inactive.ingredients[0]!.active = false;
  const unready = engine([recipe()], inactive).match(input());
  assert.equal(unready.status, "error");
});

test("large unit aggregates stay exact and compiled state is isolated from caller mutations", () => {
  const recipes = [recipe({ ingredients: [line("rosii", "999999999999", "kg")] })];
  const matcher = engine(recipes);
  recipes[0]!.ingredients = [];
  const result = matcher.match(input([lot("999999999999", "kg"), lot("1", "kg", { id: "lot-2" })]));
  assert.equal(result.groups.ready_to_cook[0]!.ingredients[0]!.available, "1000000000000000");
  assert.ok(matchingResultSchema.safeParse(result).success);
  result.groups.ready_to_cook[0]!.ingredients[0]!.available = "0";
  assert.equal(matcher.match(input([lot("100", "kg")])).groups.ready_to_cook.length, 0);
});
