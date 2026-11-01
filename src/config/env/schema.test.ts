import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseClientEnv, parseMaintenanceEnv, parseMutationEnv, parseServerEnv, parseSupabaseEnv } from "./schema.ts";

describe("foundation environment", () => {
  it("starts the shell without external credentials", () => {
    const config = parseServerEnv({});
    assert.equal(config.COOKLY_ENV, "development");
    assert.equal(config.APP_BASE_URL, "http://localhost:3000");
    assert.equal(config.LOG_LEVEL, "info");
    assert.deepEqual(parseClientEnv({ NEXT_PUBLIC_SUPABASE_URL: "", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "" }), {});
  });

  it("rejects an invalid environment and non-origin URLs", () => {
    assert.throws(() => parseServerEnv({ COOKLY_ENV: "wrong" }), /COOKLY_ENV/);
    for (const APP_BASE_URL of ["javascript:alert(1)", "https://user:password@example.com", "https://example.com/path", "http://example.com"]) {
      assert.throws(() => parseServerEnv({ COOKLY_ENV: "production", APP_BASE_URL }), /APP_BASE_URL/);
    }
  });

  it("requires an explicit HTTPS origin in production and preview", () => {
    assert.throws(() => parseServerEnv({ COOKLY_ENV: "production" }), /APP_BASE_URL/);
    assert.throws(() => parseServerEnv({ COOKLY_ENV: "preview", APP_BASE_URL: "http://localhost:3000" }), /APP_BASE_URL/);
    assert.equal(parseServerEnv({ COOKLY_ENV: "production", APP_BASE_URL: "https://cookly.example" }).APP_BASE_URL, "https://cookly.example");
    assert.throws(() => parseServerEnv({ NODE_ENV: "production" }), /APP_BASE_URL/);
    assert.throws(() => parseServerEnv({ NODE_ENV: "production", COOKLY_ENV: "development" }), /COOKLY_ENV/);
  });

  it("keeps server secrets out of the public environment", () => {
    assert.deepEqual(parseClientEnv({ SUPABASE_SECRET_KEY: "private-value", CSRF_SECRET: "secret-value" }), {});
  });

  it("requires both public Supabase values when either is configured", () => {
    assert.throws(() => parseClientEnv({ NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co" }), /NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
    assert.throws(() => parseSupabaseEnv({}), /NEXT_PUBLIC_SUPABASE_URL/);
    assert.equal(parseSupabaseEnv({ NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example" }).NEXT_PUBLIC_SUPABASE_URL, "https://example.supabase.co");
  });

  it("rejects privileged keys and unsafe Supabase URLs in public config", () => {
    assert.throws(() => parseClientEnv({ NEXT_PUBLIC_SUPABASE_URL: "http://example.com", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example" }), /NEXT_PUBLIC_SUPABASE_URL/);
    assert.throws(() => parseClientEnv({ NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_secret_do-not-print" }), /NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
  });

  it("validates maintenance separately and redacts secret values", () => {
    assert.throws(() => parseMaintenanceEnv({}), /SUPABASE_SECRET_KEY/);
    assert.throws(() => parseMaintenanceEnv({ SUPABASE_SECRET_KEY: "sb_secret_do-not-print", CSRF_SECRET: "tiny-secret", JOBS_SIGNING_SECRET: "tiny-job-secret" }), (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /CSRF_SECRET/);
      assert.doesNotMatch(error.message, /tiny-secret|sb_secret_do-not-print/);
      return true;
    });
  });

  it("requires distinct maintenance signing secrets of at least 32 bytes", () => {
    const secret = "a".repeat(32);
    assert.throws(() => parseMaintenanceEnv({ SUPABASE_SECRET_KEY: "sb_secret_example", CSRF_SECRET: secret, JOBS_SIGNING_SECRET: secret }), /JOBS_SIGNING_SECRET/);
    assert.equal(parseMaintenanceEnv({ SUPABASE_SECRET_KEY: "sb_secret_example", CSRF_SECRET: secret, JOBS_SIGNING_SECRET: "b".repeat(32) }).JOBS_SIGNING_SECRET.length, 32);
  });

  it("validates browser-mutation protection without maintenance credentials", () => {
    assert.deepEqual(parseMutationEnv({ CSRF_SECRET: "c".repeat(32) }), { CSRF_SECRET: "c".repeat(32) });
    assert.throws(() => parseMutationEnv({ CSRF_SECRET: "short" }), /CSRF_SECRET/);
  });
});
