import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";
process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_shopping_test_only";
process.env.APP_BASE_URL = "https://cookly.example";
process.env.COOKLY_ENV = "production";
const require = createRequire(import.meta.url),
  { GET, POST } = require("../../.next/server/app/api/v1/shopping/route.js").routeModule.userland,
  preview = require("../../.next/server/app/api/v1/shopping/preview/route.js").routeModule.userland
    .POST;
const a = "00000000-0000-4000-8000-000000000001",
  b = "00000000-0000-4000-8000-000000000002",
  token = "Bearer example.payload.signature",
  base = "https://cookly.example/api/v1/shopping";
const input = {
  source: "demo",
  selections: [{ slug: "terci-de-ovaz-cu-mere", servings: 4 }],
  inventory: [
    { id: "oats", ingredientSlug: "fulgi-de-ovaz", quantity: "0.05", unit: "kg", expiresOn: null },
  ],
  today: "2026-11-05",
  expectedAccountId: null,
  includeOptional: false,
};
const req = (body, auth = null, origin = "https://cookly.example") =>
  new Request(base, {
    method: "POST",
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      ...(auth ? { Authorization: auth } : {}),
    },
    body: JSON.stringify(body),
  });
test("compiled shopping endpoints serve explicit demo, calculate exact deficits and validate mutations/origin", async () => {
  const response = await GET(new Request(`${base}?source=demo`));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  const boot = await response.json();
  assert.equal(boot.recipes.length, 72);
  assert.equal(boot.accountId, null);
  assert.ok(boot.catalog[0].id);
  const result = await preview(req(input));
  assert.equal(result.status, 200);
  assert.equal(
    (await result.json()).items.find((i) => i.ingredient.slug === "fulgi-de-ovaz").quantity,
    "150",
  );
  assert.equal((await GET(new Request(`${base}?source=invalid`))).status, 400);
  assert.equal(
    (await preview(req({ ...input, selections: [{ slug: "missing", servings: 1 }] }))).status,
    404,
  );
  assert.equal((await preview(req({ ...input, selections: [] }))).status, 400);
  assert.equal((await preview(req(input, null, "https://foreign.example"))).status, 403);
  assert.equal(
    (
      await POST(
        req({
          operationId: a,
          expectedAccountId: a,
          command: {
            kind: "purchase",
            confirmed: false,
            lines: [],
            location: "fridge",
            expiresOn: null,
          },
        }),
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await POST(
        req({
          operationId: a,
          expectedAccountId: a,
          command: { kind: "remove", id: b, expectedRevision: "1" },
        }),
      )
    ).status,
    401,
  );
});
test("authenticated shopping uses verified owner and profile, forwards only allowed RPCs, never accepts guest inventory as account stock", async () => {
  const old = globalThis.fetch;
  const catalog = (await (await GET(new Request(`${base}?source=demo`))).json()).catalog;
  let writes = 0,
    allergies = ["milk"];
  globalThis.fetch = async (url, init) => {
    const path = String(url);
    if (path.endsWith("/auth/v1/user")) return Response.json({ id: a });
    if (path.endsWith("/actor_context")) return Response.json({ id: a, roles: [], aal: "aal1" });
    if (path.endsWith("/recipe_search_context"))
      return Response.json({
        accountId: a,
        items: [],
        allergies,
        excludedIngredients: [],
      });
    if (path.endsWith("/smart_shopping_catalog")) {
      assert.equal(new Headers(init.headers).has("authorization"), false);
      return Response.json(catalog);
    }
    assert.equal(new Headers(init.headers).get("authorization"), token);
    assert.equal(new Headers(init.headers).has("cookie"), false);
    if (path.endsWith("/smart_shopping_snapshot"))
      return Response.json({ accountId: a, items: [] });
    if (path.endsWith("/smart_shopping_mutate")) {
      writes++;
      return Response.json({ accountId: a, items: [] });
    }
    throw new Error("Unexpected request");
  };
  try {
    const bootstrap = await GET(
      new Request(`${base}?source=demo`, { headers: { Authorization: token } }),
    );
    assert.equal((await bootstrap.json()).accountId, a);
    assert.equal(
      (await preview(req({ ...input, expectedAccountId: a }, token))).status,
      400,
      "profile allergy cannot be bypassed",
    );
    allergies = [];
    const measured = await preview(
      req(
        {
          ...input,
          expectedAccountId: a,
          inventory: [
            {
              id: "forged",
              ingredientSlug: "fulgi-de-ovaz",
              quantity: "10000",
              unit: "kg",
              expiresOn: null,
            },
          ],
        },
        token,
      ),
    );
    assert.equal(measured.status, 200);
    assert.equal(
      (await measured.json()).items.find((i) => i.ingredient.slug === "fulgi-de-ovaz").quantity,
      "200",
      "account stock comes from PostgreSQL context, not submitted guest stock",
    );
    const mutation = {
      operationId: a,
      expectedAccountId: b,
      command: { kind: "remove", id: b, expectedRevision: "1" },
    };
    assert.equal((await POST(req(mutation, token))).status, 409);
    assert.equal(writes, 0);
    assert.equal((await POST(req({ ...mutation, expectedAccountId: a }, token))).status, 200);
    assert.equal(writes, 1);
  } finally {
    globalThis.fetch = old;
  }
});
