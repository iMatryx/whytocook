import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

// Built handler invocation with a stubbed upstream, not a live HTTP or DB test.
process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_catalog_smoke_only";
const require = createRequire(import.meta.url);
const search = require("../../.next/server/app/api/v1/ingredients/route.js").routeModule.userland
  .GET;
const detail = require("../../.next/server/app/api/v1/ingredients/[ingredientId]/route.js")
  .routeModule.userland.GET;
const categories = require("../../.next/server/app/api/v1/ingredients/categories/route.js")
  .routeModule.userland.GET;
const id = "10000000-0000-4000-8000-000000000002";
const ingredient = {
  id,
  slug: "rosii",
  name: "Roșii",
  canonicalName: "Roșii",
  matchedTerm: "tomatoes",
  kind: "specific",
  category: null,
  broader: null,
};
const request = (query = "query=tomatoes&limit=1") =>
  new Request(`http://localhost/api/v1/ingredients?${query}`, {
    headers: { Cookie: "private-user-cookie", Authorization: "Bearer private-user-token" },
  });
const context = (ingredientId = id) => ({ params: Promise.resolve({ ingredientId }) });

test("built public catalog routes validate, paginate and redact failures without forwarding identity", async () => {
  const previousFetch = globalThis.fetch;
  let calls = 0;
  let failure = null;
  let continuing = false;
  globalThis.fetch = async (url, init) => {
    calls++;
    assert.equal(init.credentials, "omit");
    assert.equal(init.cache, "no-store");
    const headers = new Headers(init.headers);
    assert.equal(headers.has("cookie"), false);
    assert.equal(headers.has("authorization"), false);
    assert.equal(headers.get("apikey"), process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
    assert.equal(headers.get("content-profile"), "api");
    if (failure)
      return Response.json({ code: failure, message: "private SQL diagnostic" }, { status: 400 });
    if (String(url).endsWith("list_ingredient_categories")) return Response.json([]);
    if (String(url).endsWith("get_ingredient"))
      return Response.json({
        ...ingredient,
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
      });
    const body = JSON.parse(init.body);
    if (continuing) {
      assert.equal(body.p_version, "2");
      assert.equal(body.p_after_id, id);
    }
    return Response.json({
      items: [ingredient],
      version: "2",
      next: continuing ? null : { rank: 1, name: "rosii", id },
    });
  };
  try {
    for (const query of [
      "query=x",
      "limit=51",
      "query=aa&query=bb",
      "unknown=true",
      "query=aa&locale=xx",
    ])
      assert.equal((await search(request(query))).status, 400);
    assert.equal(calls, 0);
    const response = await search(request());
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.ok(response.headers.get("x-request-id"));
    const page = await response.json();
    assert.deepEqual(page.items, [ingredient]);
    assert.ok(page.nextCursor);
    const incompatible = await search(request(`query=orez&limit=1&cursor=${page.nextCursor}`));
    assert.equal(incompatible.status, 400);
    assert.equal((await incompatible.json()).error.code, "INVALID_CURSOR");
    continuing = true;
    const next = await search(request(`query=tomatoes&limit=1&cursor=${page.nextCursor}`));
    assert.equal(next.status, 200);
    assert.equal((await next.json()).nextCursor, null);
    assert.equal((await categories()).status, 200);
    assert.equal((await detail(request("locale=en-GB"), context())).status, 200);
    assert.equal((await detail(request(""), context("invalid"))).status, 400);
    failure = "40001";
    const stale = await search(request());
    assert.equal(stale.status, 409);
    assert.equal((await stale.json()).error.code, "CATALOG_CHANGED");
    failure = "P0002";
    assert.equal((await detail(request(""), context())).status, 404);
    failure = "XX000";
    const failed = await search(request());
    assert.equal(failed.status, 503);
    assert.equal((await failed.text()).includes("private SQL"), false);
  } finally {
    globalThis.fetch = previousFetch;
  }
});
