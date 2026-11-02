import assert from "node:assert/strict";
import { test } from "node:test";
import { sealSession, openSession } from "../../src/server/auth/session-crypto.server.ts";
import { safeNext, signUpSchema } from "../../src/features/auth/contracts/auth.schema.ts";
import { profileInputSchema } from "../../src/features/auth/contracts/profile.schema.ts";
import { expiredSessionCookie } from "../../src/server/auth/session-cookie.server.ts";
import { createRequire } from "node:module";
import { requireTrustedOrigin } from "../../src/server/auth/origin.server.ts";

const secret = "a".repeat(64); // Synthetic test input, not a deployed secret.
const origin = "https://cookly.example";
const now = 1800000000;
const session = {
  accessToken: "test-token-not-a-real-jwt",
  refreshToken: "test-refresh-token",
  userId: "00000000-0000-4000-8000-000000000001",
  expiresAt: now + 60,
  validUntil: now + 86400,
};
test("session envelope is confidential, authenticated, expiring and origin-bound", () => {
  const sealed = sealSession(session, secret, origin, now);
  assert.equal(sealed.includes(session.accessToken), false);
  assert.deepEqual(openSession(sealed, secret, origin, now), session);
  assert.equal(openSession(sealed, secret, "https://another.example", now), null);
  assert.equal(openSession(sealed, "b".repeat(64), origin, now), null);
  assert.equal(openSession(sealed, secret, origin, now + 86401), null);
  const parts = sealed.split(".");
  parts[2] = `${parts[2]?.[0] === "a" ? "b" : "a"}${parts[2]?.slice(1)}`;
  assert.equal(openSession(parts.join("."), secret, origin, now), null);
  assert.equal(openSession("x".repeat(5000), secret, origin, now), null);
});
test("redirects stay on explicitly supported Cookly routes", () => {
  for (const value of [
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "/login",
    "/profile\n",
  ]) {
    assert.equal(safeNext(value), "/profile");
  }
  assert.equal(safeNext("/my-fridge"), "/my-fridge");
  assert.equal(safeNext("/auth/reset-password"), "/auth/reset-password");
});
test("production session cleanup preserves mandatory __Host Secure attributes", () => {
  const { NextResponse } = createRequire(import.meta.url)("next/server");
  const response = NextResponse.next();
  response.cookies.set(expiredSessionCookie("__Host-cookly-session"));
  const cookie = response.headers.get("set-cookie");
  assert.match(cookie, /Secure/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Path=\//);
  assert.match(cookie, /Max-Age=0/);
});
test("cookie-backed actions reject missing, foreign and lookalike origins", () => {
  requireTrustedOrigin("https://cookly.example", origin);
  for (const value of [
    null,
    "https://evil.example",
    "https://cookly.example.evil.example",
    "http://cookly.example",
    "https://cookly.example/path",
  ]) {
    assert.throws(() => requireTrustedOrigin(value, origin));
  }
});
test("password confirmation and profile limits are validated before provider/DB", () => {
  assert.equal(
    signUpSchema.safeParse({
      email: "test@example.com",
      password: "123456789012",
      confirmPassword: "different",
    }).success,
    false,
  );
  const profile = {
    displayName: "Test",
    locale: "ro-RO",
    timeZone: "Europe/Chisinau",
    householdSize: 2,
    mealBudget: "250.50",
    currency: "MDL",
    dietIds: [],
    allergenIds: [],
    equipmentIds: [],
  };
  assert.equal(profileInputSchema.safeParse(profile).success, true);
  for (const change of [
    { householdSize: 0 },
    { mealBudget: "NaN" },
    { mealBudget: "-5" },
    { mealBudget: "0" },
    { timeZone: "not/a-zone" },
    { currency: "XX" },
  ]) {
    assert.equal(profileInputSchema.safeParse({ ...profile, ...change }).success, false);
  }
});
