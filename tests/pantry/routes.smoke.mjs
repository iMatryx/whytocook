import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";
// Built handlers with an upstream stub; no live Supabase or HTTP listener.
process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_pantry_test_only";
process.env.APP_BASE_URL = "https://cookly.example";
process.env.COOKLY_ENV = "production";
const require = createRequire(import.meta.url);
const { GET, POST } = require("../../.next/server/app/api/v1/pantry/route.js").routeModule.userland;
const actor = "00000000-0000-4000-8000-000000000001";
const other = "00000000-0000-4000-8000-000000000002";
const id = "10000000-0000-4000-8000-000000000002";
const command = {
  kind: "create",
  id,
  ingredientId: id,
  quantity: "1",
  unitCode: "g",
  location: "fridge",
  expiresOn: null,
};
const input = { operationId: crypto.randomUUID(), expectedAccountId: actor, command };
const request = (body = input, origin = "https://cookly.example") =>
  new Request("https://cookly.example/api/v1/pantry", {
    method: "POST",
    headers: {
      Authorization: "Bearer example.payload.signature",
      Origin: origin,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
test("built pantry API enforces identity, origin, payload, ownership and safe errors", async () => {
  const previousFetch = globalThis.fetch;
  let code = null,
    owner = actor,
    calls = 0;
  globalThis.fetch = async (url, init) => {
    calls++;
    const path = String(url);
    if (path.endsWith("/auth/v1/user")) return Response.json({ id: actor });
    if (path.endsWith("/actor_context"))
      return Response.json({ id: actor, roles: [], aal: "aal1" });
    assert.equal(
      new Headers(init.headers).get("authorization"),
      "Bearer example.payload.signature",
    );
    assert.equal(new Headers(init.headers).has("cookie"), false);
    assert.equal(init.cache, "no-store");
    if (code) return Response.json({ code, message: "private SQL diagnostic" }, { status: 400 });
    return Response.json({ ownerId: owner, items: [] });
  };
  try {
    assert.equal((await GET(new Request("https://cookly.example/api/v1/pantry"))).status, 401);
    assert.equal(calls, 0);
    assert.equal((await POST(request(input, "https://attacker.example"))).status, 403);
    assert.equal(calls, 0);
    assert.equal((await POST(request({ ...input, ownerId: other }))).status, 400);
    assert.equal(calls, 0);
    assert.equal(
      (
        await POST(
          request({
            ...input,
            command: {
              kind: "consume",
              confirmed: false,
              lines: [{ itemId: id, expectedRevision: "1", quantity: "1", unitCode: "g" }],
            },
          }),
        )
      ).status,
      400,
    );
    const huge = new Request("https://cookly.example/api/v1/pantry", {
      method: "POST",
      headers: { Origin: "https://cookly.example", "Content-Type": "application/json" },
      body: " ".repeat(32769),
    });
    assert.equal((await POST(huge)).status, 400);
    const response = await GET(
      new Request("https://cookly.example/api/v1/pantry", {
        headers: { Authorization: "Bearer example.payload.signature" },
      }),
    );
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.ok(response.headers.get("x-request-id"));
    assert.deepEqual(await response.json(), { mode: "account", accountId: actor, items: [] });
    assert.equal((await POST(request())).status, 200);
    const changed = await POST(request({ ...input, expectedAccountId: other }));
    assert.equal(changed.status, 409);
    assert.equal((await changed.json()).error.code, "SESSION_CHANGED");
    owner = other;
    assert.equal((await POST(request())).status, 503);
    owner = actor;
    for (const [error, status] of [
      ["40001", 409],
      ["P0002", 404],
      ["P0001", 409],
      ["22023", 400],
      ["XX000", 503],
    ]) {
      code = error;
      const failed = await POST(request());
      assert.equal(failed.status, status);
      assert.equal((await failed.text()).includes("private SQL"), false);
    }
  } finally {
    globalThis.fetch = previousFetch;
  }
});
