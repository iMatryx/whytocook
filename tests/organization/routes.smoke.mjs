import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";
process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_organization_test_only";
process.env.APP_BASE_URL = "https://cookly.example";
process.env.COOKLY_ENV = "production";
const require = createRequire(import.meta.url);
const { GET, POST } = require("../../.next/server/app/api/v1/recipes/organization/route.js")
  .routeModule.userland;
const a = "00000000-0000-4000-8000-000000000001",
  b = "00000000-0000-4000-8000-000000000002";
const token = "Bearer example.payload.signature";
const endpoint = "https://cookly.example/api/v1/recipes/organization";
const request = (body, auth = token, origin = "https://cookly.example") =>
  new Request(endpoint, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      ...(auth ? { Authorization: auth } : {}),
      Origin: origin,
      "Content-Type": "application/json",
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
const snapshot = {
  accountId: a,
  favorites: ["published:salata"],
  collections: [],
  cooked: [],
  titles: { "published:salata": "Salată" },
};
test("compiled organization API keeps guests local and enforces origin, schema, content type and size", async () => {
  const previous = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("Guest must not contact provider");
  };
  try {
    const guest = await GET(request(undefined, null));
    assert.equal(guest.status, 200);
    assert.equal(guest.headers.get("cache-control"), "private, no-store");
    assert.match(guest.headers.get("vary"), /Cookie/);
    assert.deepEqual(await guest.json(), {
      accountId: null,
      favorites: [],
      collections: [],
      cooked: [],
      titles: {},
    });
    assert.equal((await POST(request({}, null, "https://foreign.example"))).status, 403);
    assert.equal(
      (
        await POST(
          request({ expectedAccountId: a, ownerId: b, command: { kind: "clearHistory" } }, null),
        )
      ).status,
      400,
    );
    assert.equal(
      (await POST(request({ expectedAccountId: a, command: { kind: "clearHistory" } }, null)))
        .status,
      401,
    );
    assert.equal(
      (
        await POST(
          new Request(endpoint, {
            method: "POST",
            headers: { Origin: "https://cookly.example", "Content-Type": "text/plain" },
            body: "{}",
          }),
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await POST(
          new Request(endpoint, {
            method: "POST",
            headers: { Origin: "https://cookly.example", "Content-Type": "application/json" },
            body: " ".repeat(131073),
          }),
        )
      ).status,
      400,
    );
  } finally {
    globalThis.fetch = previous;
  }
});
test("compiled organization API derives owner, blocks changed/expired sessions and redacts RPC errors", async () => {
  const previous = globalThis.fetch;
  let writes = 0,
    result = snapshot,
    failure = null;
  globalThis.fetch = async (url, init) => {
    if (String(url).endsWith("/auth/v1/user")) return Response.json({ id: a });
    if (String(url).endsWith("/actor_context"))
      return Response.json({ id: a, roles: [], aal: "aal1" });
    assert.equal(new Headers(init.headers).get("authorization"), token);
    assert.equal(new Headers(init.headers).has("cookie"), false);
    if (String(url).endsWith("/get_recipe_organization")) return Response.json(result);
    if (String(url).endsWith("/mutate_recipe_organization")) {
      writes++;
      assert.deepEqual(JSON.parse(init.body), {
        p_command: { kind: "saveCollection", id: a, name: "Fitness", create: true },
      });
      return failure
        ? Response.json({ code: failure, message: "private SQL diagnostic" }, { status: 400 })
        : Response.json(result);
    }
    throw new Error("Unexpected request");
  };
  const input = {
    expectedAccountId: a,
    command: { kind: "saveCollection", id: a, name: " Fitness ", create: true },
  };
  try {
    assert.equal((await GET(request(undefined))).status, 200);
    assert.equal((await POST(request({ ...input, expectedAccountId: b }))).status, 409);
    assert.equal(writes, 0);
    assert.equal((await POST(request(input))).status, 200);
    failure = "P0002";
    const missing = await POST(request(input));
    assert.equal(missing.status, 404);
    assert.match((await missing.json()).error.message, /Colecția/);
    failure = "22023";
    const duplicate = await POST(request(input));
    assert.equal(duplicate.status, 400);
    assert.match((await duplicate.json()).error.message, /numele unic/);
    result = { ...snapshot, accountId: b };
    assert.equal((await GET(request(undefined))).status, 503);
    globalThis.fetch = async () => Response.json({ message: "expired token" }, { status: 401 });
    const expired = await GET(request(undefined));
    assert.equal(expired.status, 401);
    assert.notEqual(
      (await expired.json()).accountId,
      null,
      "invalid authentication never becomes guest mode",
    );
  } finally {
    globalThis.fetch = previous;
  }
});
