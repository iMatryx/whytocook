import assert from "node:assert/strict";
import { test } from "node:test";
import { createAuthProvider, AuthFlowError } from "../../src/server/auth/provider.server.ts";

const config = {
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test_only",
};
const id = "00000000-0000-4000-8000-000000000001";
const response = {
  access_token: "header.payload.signature-test",
  refresh_token: "refresh-test-token",
  expires_in: 3600,
  user: { id },
};
test("password grant and refresh use Supabase Auth and preserve identity", async () => {
  const calls: { url: string; body: unknown }[] = [];
  const fetcher: typeof fetch = async (url, init) => {
    calls.push({ url: String(url), body: JSON.parse(String(init?.body)) as unknown });
    return Response.json(response);
  };
  const auth = createAuthProvider(config, fetcher);
  const login = await auth.signIn("test@example.com", "password-test-only");
  assert.equal(login.userId, id);
  assert.equal(calls[0]?.url.endsWith("/auth/v1/token?grant_type=password"), true);
  const refreshed = await auth.refresh(login);
  assert.equal(refreshed.validUntil, login.validUntil);
  assert.equal(refreshed.userId, login.userId);
  const wrong = createAuthProvider(config, async () =>
    Response.json({ ...response, user: { id: "00000000-0000-4000-8000-000000000002" } }),
  );
  await assert.rejects(wrong.refresh(login), AuthFlowError);
});
test("signup/recovery are enumeration-safe and never expose provider diagnostics", async () => {
  const auth = createAuthProvider(config, async () =>
    Response.json({ error_code: "user_already_exists", msg: "private details" }, { status: 400 }),
  );
  await auth.signUp("test@example.com", "password-test-only");
  const failed = createAuthProvider(config, async () =>
    Response.json({ msg: "private detail" }, { status: 500 }),
  );
  await assert.rejects(
    failed.recover("test@example.com"),
    (error) => error instanceof AuthFlowError && !error.message.includes("private detail"),
  );
});
test("recovery token verification grants a short-lived reset context", async () => {
  const auth = createAuthProvider(config, async () => Response.json(response));
  const reset = await auth.verify("x".repeat(64), "recovery");
  assert.ok(reset.recoveryUntil);
  assert.ok((reset.recoveryUntil ?? 0) <= Math.floor(Date.now() / 1000) + 600);
  const confirm = await auth.verify("x".repeat(64), "email");
  assert.equal(confirm.recoveryUntil, undefined);
});
test("logout refreshes an expired access token before revoking its session", async () => {
  let revoked = false;
  const fresh = { ...response, access_token: "fresh.header.signature-example" };
  const auth = createAuthProvider(config, async (url, init) => {
    if (String(url).includes("grant_type=refresh_token")) return Response.json(fresh);
    assert.equal(new Headers(init?.headers).get("authorization"), `Bearer ${fresh.access_token}`);
    revoked = true;
    return new Response(null, { status: 204 });
  });
  await auth.signOut({
    accessToken: response.access_token,
    refreshToken: response.refresh_token,
    userId: id,
    expiresAt: 1,
    validUntil: Math.floor(Date.now() / 1000) + 86400,
  });
  assert.equal(revoked, true);
});
test("abandoned Cookly MFA enrollment can restart without a factor name conflict", async () => {
  const oldId = "10000000-0000-4000-8000-000000000001";
  let removed = false;
  const auth = createAuthProvider(config, async (url, init) => {
    if (String(url).endsWith("/user"))
      return Response.json({
        id,
        factors: [
          { id: oldId, status: "unverified", factor_type: "totp", friendly_name: "Cookly" },
        ],
      });
    if (init?.method === "DELETE") {
      assert.equal(String(url).endsWith(`/factors/${oldId}`), true);
      removed = true;
      return new Response(null, { status: 204 });
    }
    assert.equal(removed, true);
    return Response.json({ id, totp: { secret: "EXAMPLE-FAKE-TEST-ONLY" } });
  });
  assert.equal((await auth.enrollTotp(response.access_token)).id, id);
});
test("MFA verification preserves the recovery deadline for the password reset", async () => {
  const auth = createAuthProvider(config, async (url) =>
    String(url).endsWith("/challenge") ? Response.json({ id }) : Response.json(response),
  );
  const before = {
    accessToken: response.access_token,
    refreshToken: response.refresh_token,
    userId: id,
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
    validUntil: Math.floor(Date.now() / 1000) + 86400,
    recoveryUntil: Math.floor(Date.now() / 1000) + 300,
  };
  assert.equal((await auth.verifyTotp(before, id, "123456")).recoveryUntil, before.recoveryUntil);
});
