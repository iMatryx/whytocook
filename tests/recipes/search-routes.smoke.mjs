import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";
import { recipeFiltersSchema } from "../../src/features/recipes/contracts/search.schema.ts";
process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_recipe_search_test_only";
process.env.APP_BASE_URL = "https://cookly.example";
process.env.COOKLY_ENV = "production";
const require = createRequire(import.meta.url);
const { POST } = require("../../.next/server/app/api/v1/recipes/search/route.js").routeModule
  .userland;
const a = "00000000-0000-4000-8000-000000000001",
  b = "00000000-0000-4000-8000-000000000002";
const line = {
  ingredientSlug: "rosii",
  name: "Roșii",
  quantity: "100",
  unit: "g",
  optional: false,
  preparation: "",
};
const published = {
  id: a,
  key: "public-good",
  revision: 1,
  dataClass: "unreviewed",
  title: "Salată",
  summary: "",
  servings: 2,
  totalMinutes: 10,
  difficulty: "easy",
  mealTypes: [],
  cuisines: [],
  diets: [],
  equipment: ["knife"],
  tags: [],
  ingredients: [line],
  steps: ["Taie roșiile."],
  allergens: { status: "unverified", contains: [], mayContain: [] },
  nutrition: null,
  budget: null,
};
const snapshot = {
  catalog: {
    ingredients: [
      { slug: "rosii", name: "Roșii", units: ["g"], aliases: [], active: true, allergenHints: [] },
    ],
  },
  recipes: [
    published,
    { ...published, key: "public-split", ingredients: [line, { ...line, quantity: "20" }] },
  ],
};
const input = (filters = {}) => ({
  filters: recipeFiltersSchema.parse({ source: "demo", ...filters }),
  inventory: [],
  today: "2026-11-03",
  expectedAccountId: null,
});
const request = (body = input(), origin = "https://cookly.example", authorization = null) =>
  new Request("https://cookly.example/api/v1/recipes/search", {
    method: "POST",
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      ...(authorization ? { Authorization: authorization } : {}),
    },
    body: JSON.stringify(body),
  });
test("compiled recipe API handles real demo, origin/body limits, inventory, authoritative account and profile exclusions", async () => {
  const previous = globalThis.fetch;
  let calls = 0,
    profileAllergies = ["milk"];
  globalThis.fetch = async (url, init) => {
    calls++;
    if (String(url).endsWith("/auth/v1/user")) return Response.json({ id: a });
    if (String(url).endsWith("/actor_context"))
      return Response.json({ id: a, roles: [], aal: "aal1" });
    assert.equal(new Headers(init.headers).has("cookie"), false);
    if (String(url).endsWith("/recipe_search_context"))
      return Response.json({
        accountId: a,
        items: [],
        allergies: profileAllergies,
        excludedIngredients: [],
      });
    if (String(url).endsWith("/recipe_search_snapshot")) return Response.json(snapshot);
    throw new Error("Unexpected upstream request");
  };
  try {
    const response = await POST(request());
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.equal((await response.json()).total, 72);
    assert.equal(calls, 0, "demo guest performs no provider call");
    const mixed = await POST(request(input({ source: "published" })));
    assert.equal(mixed.status, 200);
    const mixedBody = await mixed.json();
    assert.equal(mixedBody.total, 2);
    assert.equal(
      mixedBody.items.find((item) => item.recipe.key === "public-split").compatibility,
      null,
    );
    assert.ok(mixedBody.items.find((item) => item.recipe.key === "public-good").compatibility);
    const empty = await POST(request(input({ protein: "1" })));
    assert.equal((await empty.json()).total, 0);
    assert.equal((await POST(request(input(), "https://attacker.example"))).status, 403);
    assert.equal((await POST(request({ ...input(), unknown: "field" }))).status, 400);
    assert.equal(
      (
        await POST(
          request({
            ...input(),
            inventory: [
              { id: "x", ingredientSlug: "rosii", quantity: "1", unit: null, expiresOn: null },
            ],
          }),
        )
      ).status,
      400,
    );
    const oversized = new Request("https://cookly.example/api/v1/recipes/search", {
      method: "POST",
      headers: { Origin: "https://cookly.example", "Content-Type": "application/json" },
      body: " ".repeat(131073),
    });
    assert.equal((await POST(oversized)).status, 400);
    const account = await POST(
      request(
        { ...input(), expectedAccountId: a },
        "https://cookly.example",
        "Bearer example.payload.signature",
      ),
    );
    assert.equal(account.status, 200);
    const body = await account.json();
    assert.equal(body.accountId, a);
    assert.equal(
      body.total,
      0,
      "stored milk allergy cannot be bypassed by omitted URL allergy filter",
    );
    assert.equal(body.excludedCount, 72);
    profileAllergies = [];
    const forgedInventory = [
      { id: "forged", ingredientSlug: "rosii", quantity: "100000", unit: "g", expiresOn: null },
    ];
    const authoritative = await POST(
      request(
        { ...input({ source: "published" }), expectedAccountId: a, inventory: forgedInventory },
        "https://cookly.example",
        "Bearer example.payload.signature",
      ),
    );
    assert.equal(authoritative.status, 200);
    const measured = (await authoritative.json()).items.find(
      (item) => item.recipe.key === "public-good",
    ).compatibility;
    assert.equal(measured.category, "missing_ingredients");
    assert.equal(
      measured.ingredients[0].available,
      "0",
      "account stock comes from PostgreSQL, not submitted guest stock",
    );
    const switched = await POST(
      request(
        { ...input(), expectedAccountId: b },
        "https://cookly.example",
        "Bearer example.payload.signature",
      ),
    );
    assert.equal(switched.status, 409);
    assert.equal((await switched.json()).error.code, "SESSION_CHANGED");
  } finally {
    globalThis.fetch = previous;
  }
});
