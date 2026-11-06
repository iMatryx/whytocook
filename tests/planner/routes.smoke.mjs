import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";
process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_planner_test_only";
process.env.APP_BASE_URL = "https://cookly.example";
process.env.COOKLY_ENV = "production";
const require = createRequire(import.meta.url);
const { GET, POST } = require("../../.next/server/app/api/v1/planner/route.js").routeModule
  .userland;
const analyze = require("../../.next/server/app/api/v1/planner/analyze/route.js").routeModule
  .userland.POST;
const exportWeek = require("../../.next/server/app/api/v1/planner/export/route.js").routeModule
  .userland.POST;
const a = "00000000-0000-4000-8000-000000000001",
  b = "00000000-0000-4000-8000-000000000002";
const base = "https://cookly.example/api/v1/planner",
  startsOn = "2026-11-02",
  token = "Bearer example.payload.signature";
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
const emptyWeek = { startsOn, revision: "0", budget: null, entries: [], exportedRevision: null };
const entry = (r, patch = {}) => ({
  id: crypto.randomUUID(),
  recipeKey: r.key,
  recipeRevision: r.revision,
  versionId: r.versionId,
  plannedOn: "2026-11-05",
  slot: "breakfast",
  servings: 4,
  prepOn: null,
  costPerServing: null,
  ...patch,
});
const input = (week, patch = {}) => ({
  startsOn,
  source: "demo",
  expectedAccountId: null,
  week,
  inventory: [],
  today: "2026-11-05",
  ...patch,
});
test("compiled guest planner provides real recipes and aggregates portions across seven days without writes", async () => {
  const response = await GET(new Request(`${base}?source=demo&startsOn=${startsOn}`));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  const boot = await response.json();
  assert.equal(boot.recipes.length, 72);
  assert.deepEqual(boot.week, emptyWeek);
  const r = boot.recipes.find((r) => r.key === "terci-de-ovaz-cu-mere");
  const week = {
    ...emptyWeek,
    revision: "1",
    entries: [entry(r), entry(r, { plannedOn: "2026-11-06" })],
  };
  const result = await analyze(
    req(
      input(week, {
        inventory: [
          {
            id: "lot",
            ingredientSlug: "fulgi-de-ovaz",
            quantity: "0.3",
            unit: "kg",
            expiresOn: null,
          },
        ],
      }),
    ),
  );
  assert.equal(result.status, 200);
  const { analysis } = await result.json();
  assert.equal(analysis.days.length, 7);
  assert.equal(
    analysis.shopping.find((i) => i.ingredient.slug === "fulgi-de-ovaz").quantity,
    "100",
  );
  assert.ok(analysis.resources.some((i) => i.ingredientSlug === "fulgi-de-ovaz" && i.overlap));
  assert.equal(analysis.unknownNutritionMeals, 2);
  assert.equal(analysis.complete, true);
  assert.equal((await GET(new Request(`${base}?source=demo&startsOn=2026-02-30`))).status, 400);
  assert.equal((await GET(new Request(`${base}?source=bad&startsOn=${startsOn}`))).status, 400);
  assert.equal((await analyze(req(input(week), null, "https://foreign.example"))).status, 403);
  assert.equal(
    (await analyze(req(input({ ...week, entries: [entry(r, { servings: 0 })] })))).status,
    400,
  );
  assert.equal((await analyze(req(input(week, { startsOn: "2026-11-09" })))).status, 400);
  const unavailable = await analyze(
    req(input({ ...week, entries: [entry(r, { recipeRevision: 999 })] })),
  );
  assert.equal((await unavailable.json()).analysis.complete, false);
  assert.equal(
    (
      await exportWeek(
        req({ ...input(week), operationId: a, expectedRevision: "1", fingerprint: "[]" }),
      )
    ).status,
    409,
  );
});
test("account planner rejects switched owners and demo, uses authoritative plan, stock and exclusions, validates export preview", async () => {
  const demo = await (await GET(new Request(`${base}?source=demo&startsOn=${startsOn}`))).json();
  const r = { ...demo.recipes.find((r) => r.key === "terci-de-ovaz-cu-mere"), id: a, versionId: b };
  const { versionId, fullNutrition, budgetSource, ...searchRecipe } = r;
  let week = { ...emptyWeek, revision: "1", entries: [entry(r)] },
    excluded = [],
    writes = 0,
    metadataRevision = r.revision;
  const old = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const path = String(url);
    if (path.endsWith("/auth/v1/user")) return Response.json({ id: a });
    if (path.endsWith("/actor_context")) return Response.json({ id: a, roles: [], aal: "aal1" });
    assert.equal(new Headers(init.headers).has("cookie"), false);
    if (path.endsWith("/recipe_search_context"))
      return Response.json({
        accountId: a,
        items: [],
        allergies: [],
        excludedIngredients: excluded,
      });
    if (path.endsWith("/recipe_search_snapshot"))
      return Response.json({
        recipes: [searchRecipe],
        catalog: {
          ingredients: demo.catalog.map((i) => ({
            slug: i.slug,
            name: i.name,
            units: i.allowedUnits,
            active: i.active,
            aliases: [],
            allergenHints: [],
          })),
        },
      });
    if (path.endsWith("/smart_shopping_catalog")) return Response.json(demo.catalog);
    if (path.endsWith("/meal_planner_metadata")) {
      assert.equal(new Headers(init.headers).has("authorization"), false);
      return Response.json([
        {
          key: r.key,
          revision: metadataRevision,
          versionId,
          nutrition: fullNutrition,
          budgetSource,
        },
      ]);
    }
    assert.equal(new Headers(init.headers).get("authorization"), token);
    if (path.endsWith("/meal_planner_snapshot")) return Response.json({ accountId: a, week });
    if (path.endsWith("/meal_planner_mutate")) {
      writes++;
      return Response.json({ accountId: a, week });
    }
    if (path.endsWith("/meal_planner_export")) {
      writes++;
      return Response.json({
        accountId: a,
        week: { ...week, exportedRevision: week.revision },
        items: [],
      });
    }
    throw new Error(`Unexpected RPC ${path}`);
  };
  try {
    assert.equal(
      (
        await GET(
          new Request(`${base}?source=demo&startsOn=${startsOn}`, {
            headers: { Authorization: token },
          }),
        )
      ).status,
      400,
    );
    const forged = input(
      { ...week, entries: [] },
      {
        source: "published",
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
    );
    const measured = await analyze(req(forged, token));
    assert.equal(measured.status, 200);
    const measuredBody = await measured.json();
    assert.equal(
      measuredBody.analysis.shopping.find((i) => i.ingredient.slug === "fulgi-de-ovaz").quantity,
      "200",
    );
    assert.equal(measuredBody.week.entries.length, 1, "submitted account plan is ignored");
    assert.equal((await analyze(req({ ...forged, expectedAccountId: b }, token))).status, 409);
    excluded = ["fulgi-de-ovaz"];
    assert.equal((await (await analyze(req(forged, token))).json()).analysis.complete, false);
    excluded = [];
    metadataRevision++;
    assert.equal(
      (await analyze(req(forged, token))).status,
      409,
      "separate publication snapshots cannot mix revisions",
    );
    metadataRevision--;
    const mutation = {
      startsOn,
      expectedRevision: "1",
      expectedAccountId: b,
      operationId: a,
      command: { kind: "configure", budget: null },
    };
    assert.equal((await POST(req(mutation, token))).status, 409);
    assert.equal(writes, 0);
    assert.equal((await POST(req({ ...mutation, expectedAccountId: a }, token))).status, 200);
    const exportInput = { ...forged, operationId: b, expectedRevision: "1", fingerprint: "wrong" };
    assert.equal((await exportWeek(req(exportInput, token))).status, 409);
    assert.equal(writes, 1);
    const fingerprint = JSON.stringify(
      measuredBody.analysis.shopping
        .map((i) => [i.ingredient.slug, i.quantity, i.unitCode, i.uncertain])
        .sort((x, y) => JSON.stringify(x).localeCompare(JSON.stringify(y))),
    );
    const accepted = await exportWeek(req({ ...exportInput, fingerprint }, token));
    assert.equal(accepted.status, 200);
    assert.equal(writes, 2);
    week = { ...week, revision: "2" };
    assert.equal((await analyze(req(forged, token))).status, 409);
  } finally {
    globalThis.fetch = old;
  }
});
