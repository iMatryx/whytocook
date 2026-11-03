import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";
process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_recipe_detail_test_only";
process.env.APP_BASE_URL = "https://cookly.example";
process.env.COOKLY_ENV = "production";
const require = createRequire(import.meta.url);
const detail = require("../../.next/server/app/api/v1/recipes/detail/route.js").routeModule.userland
  .POST;
const action = require("../../.next/server/app/api/v1/recipes/actions/route.js").routeModule
  .userland.POST;
const a = "00000000-0000-4000-8000-000000000001";
const b = "00000000-0000-4000-8000-000000000002";
const input = (overrides = {}) => ({
  slug: "terci-de-ovaz-cu-mere",
  source: "demo",
  servings: 4,
  allergy: [],
  exclude: [],
  inventory: [
    { id: "oats", ingredientSlug: "fulgi-de-ovaz", quantity: "0.05", unit: "kg", expiresOn: null },
  ],
  today: "2026-11-03",
  expectedAccountId: null,
  ...overrides,
});
const request = (body, authorization = null, origin = "https://cookly.example") =>
  new Request("https://cookly.example/api/v1/recipes/detail", {
    method: "POST",
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      ...(authorization ? { Authorization: authorization } : {}),
    },
    body: JSON.stringify(body),
  });
test("compiled detail handler scales real demo, reports inventory, restrictions, metadata, 404 and validation", async () => {
  const response = await detail(request(input()));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  const body = await response.json();
  assert.equal(body.accountId, null);
  assert.equal(body.servings, 4);
  assert.equal(body.metadata.photo.generated, true);
  assert.equal(body.metadata.nutrition.status, "unavailable");
  assert.equal(body.metadata.stepTimers.length, body.recipe.steps.length);
  const oats = body.compatibility.ingredients.find((i) => i.ingredientSlug === "fulgi-de-ovaz");
  assert.equal(oats.available, "50");
  assert.equal(oats.required, "200");
  assert.equal(oats.shortage, "150");
  assert.equal(
    body.scaledIngredients.find((i) => i.ingredientSlug === "fulgi-de-ovaz").quantity,
    "200",
  );
  assert.ok(body.similar.every((r) => r.key !== body.recipe.key));
  const blocked = await (await detail(request(input({ allergy: ["milk"] })))).json();
  assert.equal(blocked.blocked, true);
  assert.equal(blocked.compatibility, null);
  assert.equal(
    blocked.similar.length,
    0,
    "unverified allergen recipes are never recommended for allergies",
  );
  assert.equal((await detail(request(input({ slug: "no-such-recipe" })))).status, 404);
  assert.equal((await detail(request(input({ servings: 0 })))).status, 400);
  assert.equal((await detail(request(input(), null, "https://attacker.example"))).status, 403);
});
test("compiled action handler requires account, rejects switched sessions, forwards idempotent validated commands", async () => {
  const previous = globalThis.fetch;
  let writes = 0;
  const command = { kind: "cooked", servings: 4 };
  const body = { slug: "recipe-test", revision: 1, operationId: a, expectedAccountId: a, command };
  globalThis.fetch = async (url, init) => {
    if (String(url).endsWith("/auth/v1/user")) return Response.json({ id: a });
    if (String(url).endsWith("/actor_context"))
      return Response.json({ id: a, roles: [], aal: "aal1" });
    if (String(url).endsWith("/recipe_search_context"))
      return Response.json({
        accountId: a,
        items: [],
        allergies: ["milk"],
        excludedIngredients: [],
      });
    if (String(url).endsWith("/apply_recipe_action")) {
      writes++;
      assert.equal(
        new Headers(init.headers).get("authorization"),
        "Bearer example.payload.signature",
      );
      assert.equal(new Headers(init.headers).has("cookie"), false);
      assert.deepEqual(JSON.parse(init.body), {
        p_slug: body.slug,
        p_revision: 1,
        p_operation_id: a,
        p_command: command,
      });
      return Response.json({
        favorite: false,
        lastCookedAt: "2026-11-03T12:00:00+00:00",
        addedCount: 0,
      });
    }
    throw new Error("Unexpected upstream request");
  };
  try {
    assert.notEqual((await action(request(body))).status, 200);
    const token = "Bearer example.payload.signature";
    assert.equal((await action(request({ ...body, expectedAccountId: b }, token))).status, 409);
    assert.equal(
      (await action(request({ ...body, command: { ...command, servings: "4" } }, token))).status,
      400,
    );
    assert.equal(writes, 0);
    const response = await action(request(body, token));
    assert.equal(response.status, 200);
    assert.equal((await response.json()).accountId, a);
    assert.equal(writes, 1);
    const restricted = await (await detail(request(input({ expectedAccountId: a }), token))).json();
    assert.equal(restricted.blocked, true, "stored allergies cannot be omitted by the client");
  } finally {
    globalThis.fetch = previous;
  }
});
