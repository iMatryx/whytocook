import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";
import { sealSession } from "../../src/server/auth/session-crypto.server.ts";

// Invoke the built route handlers in process. This is not an HTTP/server test.
process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_cookly_smoke_only";
process.env.COOKLY_ENV = "production";
process.env.APP_BASE_URL = "https://cookly.example";
process.env.CSRF_SECRET = "s".repeat(64); // Synthetic test key, never deployed.
const require = createRequire(import.meta.url);
const context = require("../../.next/server/app/api/v1/auth/context/route.js").routeModule.userland
  .GET;
const admin = require("../../.next/server/app/api/v1/admin/access/route.js").routeModule.userland
  .GET;
const id = "00000000-0000-4000-8000-000000000001";
const request = (authenticated = true) =>
  new Request("http://localhost/api/v1/auth/context", {
    headers: authenticated ? { Authorization: "Bearer example.payload.signature" } : {},
  });

test("built access routes enforce identity, role and MFA without caching", async () => {
  const previousFetch = globalThis.fetch;
  let roles = [];
  let aal = "aal1";
  let fail = false;
  globalThis.fetch = async (url) => {
    if (fail) throw new Error("private upstream diagnostic");
    return Response.json(
      String(url).endsWith("/auth/v1/user")
        ? { id, user_metadata: { role: "admin" } }
        : { id, roles, aal },
    );
  };
  try {
    assert.equal((await context(request(false))).status, 401);
    const response = await context(request());
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).actor.roles, []);
    assert.equal(response.headers.get("Cache-Control"), "private, no-store");
    assert.equal(response.headers.get("Vary"), "Authorization, Cookie");
    assert.equal((await admin(request())).status, 403);
    roles = ["editor"];
    const mfa = await admin(request());
    assert.equal((await mfa.json()).error.code, "MFA_REQUIRED");
    aal = "aal2";
    assert.equal((await admin(request())).status, 200);
    const now = Math.floor(Date.now() / 1000);
    const sealed = sealSession(
      {
        accessToken: "example.payload.signature",
        refreshToken: "example-refresh-test",
        userId: id,
        expiresAt: now + 3600,
        validUntil: now + 86400,
      },
      process.env.CSRF_SECRET,
      process.env.APP_BASE_URL,
    );
    const cookieRequest = new Request("https://cookly.example/api/v1/auth/context", {
      headers: { Cookie: `__Host-cookly-session=${sealed}` },
    });
    const cookieResponse = await context(cookieRequest);
    assert.equal(cookieResponse.status, 200);
    assert.equal((await cookieResponse.json()).actor.id, id);
    const invalidCookie = new Request("https://cookly.example/api/v1/auth/context", {
      headers: { Cookie: "__Host-cookly-session=invalid" },
    });
    assert.equal((await context(invalidCookie)).status, 401);
    fail = true;
    const failed = await context(request());
    assert.equal(failed.status, 503);
    assert.equal((await failed.text()).includes("upstream diagnostic"), false);
  } finally {
    globalThis.fetch = previousFetch;
  }
});
