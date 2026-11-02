import assert from "node:assert/strict";
import { test } from "node:test";

import { createVerifiedRequest } from "../../src/server/auth/request-context.server.ts";
import { requireRole } from "../../src/server/auth/require-role.server.ts";
import { AccessError } from "../../src/server/http/access-error.server.ts";
import { accessErrorResponse } from "../../src/server/http/access-response.server.ts";
import { createSupabaseTransport } from "../../src/server/supabase/transport.server.ts";

const a = "00000000-0000-4000-8000-000000000001";
const b = "00000000-0000-4000-8000-000000000002";
const token = "example.payload.signature";
const config = {
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test_only",
};
function provider(context: unknown = { id: a, roles: [], aal: "aal1" }, user: unknown = { id: a }) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetcher: typeof fetch = async (url, init) => {
    calls.push({ url: String(url), ...(init ? { init } : {}) });
    if (String(url).endsWith("/auth/v1/user")) return Response.json(user);
    return Response.json(context);
  };
  return { fetcher, calls };
}

test("actor uses verified Auth identity and live DB roles, ignoring user metadata", async () => {
  const remote = provider(undefined, {
    id: a,
    user_metadata: { role: "admin" },
    app_metadata: { role: "admin" },
  });
  const context = await createVerifiedRequest(`Bearer ${token}`, config, remote.fetcher);
  assert.equal(context.actor.id, a);
  assert.deepEqual(context.actor.roles, []);
  assert.equal(remote.calls.length, 2);
  assert.equal(remote.calls[0]?.init?.cache, "no-store");
  assert.equal(new Headers(remote.calls[1]?.init?.headers).get("content-profile"), "api");
  assert.equal(JSON.stringify(context).includes(token), false);
  assert.throws(
    () => requireRole(context.actor, ["admin"]),
    (e) => e instanceof AccessError && e.status === 403,
  );
});
test("successful void RPCs accept HTTP 204 without reporting a failed save", async () => {
  const db = createSupabaseTransport(
    config,
    token,
    async () => new Response(null, { status: 204 }),
  );
  assert.equal(await db.request("/rest/v1/rpc/save_my_profile", {}), null);
});
test("missing or malformed bearer never contacts the provider", async () => {
  const remote = provider();
  for (const header of [
    null,
    "",
    `Basic ${token}`,
    "Bearer sb_secret_do_not_use",
    "Bearer onepart",
  ]) {
    await assert.rejects(
      createVerifiedRequest(header, config, remote.fetcher),
      (e) => e instanceof AccessError && e.status === 401,
    );
  }
  assert.equal(remote.calls.length, 0);
});
test("mismatched Auth/DB subject and malformed role contracts fail closed", async () => {
  for (const value of [
    { id: b, roles: ["admin"], aal: "aal2" },
    { id: a, roles: ["superadmin"], aal: "aal2" },
  ]) {
    await assert.rejects(
      createVerifiedRequest(`Bearer ${token}`, config, provider(value).fetcher),
      AccessError,
    );
  }
});
test("editor and admin require MFA; role removal takes effect on next request", async () => {
  const editor = await createVerifiedRequest(
    `Bearer ${token}`,
    config,
    provider({ id: a, roles: ["editor"], aal: "aal1" }).fetcher,
  );
  assert.throws(
    () => requireRole(editor.actor, ["editor", "admin"]),
    (e) => e instanceof AccessError && e.code === "MFA_REQUIRED",
  );
  const admin = await createVerifiedRequest(
    `Bearer ${token}`,
    config,
    provider({ id: a, roles: ["admin"], aal: "aal2" }).fetcher,
  );
  requireRole(admin.actor, ["editor", "admin"]);
  const revoked = await createVerifiedRequest(`Bearer ${token}`, config, provider().fetcher);
  assert.throws(() => requireRole(revoked.actor, ["admin"]), AccessError);
});
test("provider failures and raw messages do not leak into API errors", async () => {
  for (const status of [401, 403, 429, 500]) {
    const fetcher: typeof fetch = async () =>
      new Response("sensitive upstream diagnostic", { status });
    let captured: unknown;
    await assert.rejects(createVerifiedRequest(`Bearer ${token}`, config, fetcher), (error) => {
      captured = error;
      return error instanceof AccessError;
    });
    const response = accessErrorResponse(captured, "request-test");
    assert.equal(response.status, status === 401 ? 401 : status === 403 ? 403 : 503);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    const body = await response.text();
    assert.equal(body.includes("sensitive"), false);
    assert.equal(body.includes(token), false);
    assert.match(body, /request-test/);
  }
});
test("network errors, invalid JSON, excessive payloads and redirects fail closed", async () => {
  const replies: (typeof fetch)[] = [
    async () => {
      throw new Error("private network detail");
    },
    async () => new Response("not JSON"),
    async () => new Response("x".repeat(262145)),
    async () =>
      new Response(null, { status: 302, headers: { Location: "https://example.invalid" } }),
  ];
  for (const fetcher of replies) {
    await assert.rejects(
      createVerifiedRequest(`Bearer ${token}`, config, fetcher),
      (error) => error instanceof AccessError && error.status === 503,
    );
  }
});
test("secret keys cannot be substituted for the publishable key", async () => {
  const remote = provider();
  await assert.rejects(
    createVerifiedRequest(
      `Bearer ${token}`,
      { ...config, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_secret_test_canary_not_real" },
      remote.fetcher,
    ),
  );
  assert.equal(remote.calls.length, 0);
});
test("ownership lookup rejects a resource returned under another subject", async () => {
  const remote = provider();
  const fetcher: typeof fetch = async (url, init) =>
    String(url).includes("/my_pantry?")
      ? Response.json([{ id: ingredientId, owner_id: b }])
      : remote.fetcher(url, init);
  const ingredientId = "30000000-0000-4000-8000-000000000001";
  const context = await createVerifiedRequest(`Bearer ${token}`, config, fetcher);
  await assert.rejects(
    context.requireOwnedResource("pantry", ingredientId),
    (e) => e instanceof AccessError && e.status === 404,
  );
});
test("download paths must belong to actor and signing uses bounded lifetime", async () => {
  const remote = provider({ id: a, roles: ["editor"], aal: "aal2" });
  let signed = false;
  const fetcher: typeof fetch = async (url, init) => {
    if (String(url).includes("/storage/v1/object/sign/")) {
      signed = true;
      assert.deepEqual(JSON.parse(String(init?.body)), { expiresIn: 60 });
      return Response.json({
        signedURL: `/object/sign/recipe-media/${a}/70000000-0000-4000-8000-000000000001.jpg?token=example`,
      });
    }
    return remote.fetcher(url, init);
  };
  const context = await createVerifiedRequest(`Bearer ${token}`, config, fetcher);
  await assert.rejects(
    context.createPrivateDownload("recipe-media", `${b}/70000000-0000-4000-8000-000000000001.jpg`),
    AccessError,
  );
  await assert.rejects(
    context.createPrivateDownload("recipe-media", `${a}/../file.jpg`),
    AccessError,
  );
  assert.equal(signed, false);
  const result = await context.createPrivateDownload(
    "recipe-media",
    `${a}/70000000-0000-4000-8000-000000000001.jpg`,
  );
  assert.match(result, /^http:\/\/127\.0\.0\.1:54321\/storage\/v1\/object\/sign\//);
  assert.equal(signed, true);
});
