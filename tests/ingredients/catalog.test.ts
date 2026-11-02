import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { createIngredientCatalog } from "../../src/features/ingredients/application/catalog.service.ts";
import { createCatalogCursorCodec } from "../../src/features/ingredients/infrastructure/cursor-codec.server.ts";
import { createSupabaseCatalogRepository } from "../../src/features/ingredients/infrastructure/supabase-catalog.repository.server.ts";
import { CatalogError } from "../../src/features/ingredients/domain/catalog-error.ts";
import {
  createPublicCatalogTransport,
  CatalogRpcError,
} from "../../src/server/supabase/public-catalog.server.ts";

const id = "10000000-0000-4000-8000-000000000002";
const binding = { query: "rosii", locale: "ro-RO" as const, categoryId: null, limit: 20 };
test("cursor is bound to all filters and rejects malformed encodings", () => {
  const codec = createCatalogCursorCodec();
  const continuation = { version: "12", after: { rank: 1, name: "rosii", id } };
  const encoded = codec.encode(continuation, binding);
  assert.deepEqual(codec.decode(encoded, binding), continuation);
  for (const changed of [
    { query: "pui" },
    { locale: "ru-RU" as const },
    { categoryId: id },
    { limit: 21 },
  ]) {
    assert.throws(() => codec.decode(encoded, { ...binding, ...changed }), CatalogError);
  }
  for (const value of ["bad", encoded + "=", "a".repeat(1025)])
    assert.throws(() => codec.decode(value, binding), CatalogError);
});
test("service normalizes filters and never mixes catalog revisions", async () => {
  const codec = createCatalogCursorCodec();
  let calls = 0;
  const repository = {
    async search(input: typeof binding) {
      calls++;
      assert.equal(input.query, "rosii");
      return { version: calls === 1 ? "1" : "2", items: [], next: { rank: 0, name: "rosii", id } };
    },
    async detail() {
      throw new Error("unused");
    },
    async categories() {
      return [];
    },
  };
  const catalog = createIngredientCatalog(repository, codec);
  const first = await catalog.search({ query: "ROȘII", locale: "ro-RO", limit: 20 });
  assert.ok(first.nextCursor);
  await assert.rejects(
    catalog.search({ query: "rosii", locale: "ro-RO", limit: 20, cursor: first.nextCursor }),
    (error) => error instanceof CatalogError && error.code === "CATALOG_CHANGED",
  );
  assert.equal(calls, 2);
});
test("anonymous transport omits Authorization/cookies and repository redacts SQL errors", async () => {
  let requested = false;
  const transport = createPublicCatalogTransport(
    {
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test_only",
    },
    async (_url, init) => {
      requested = true;
      const headers = new Headers(init?.headers);
      assert.equal(headers.has("authorization"), false);
      assert.equal(headers.has("cookie"), false);
      assert.equal(init?.credentials, "omit");
      return Response.json({ code: "40001", message: "internal SQL diagnostic" }, { status: 500 });
    },
  );
  const repository = createSupabaseCatalogRepository(transport);
  await assert.rejects(
    repository.search(binding, null),
    (error) =>
      error instanceof CatalogError &&
      error.code === "CATALOG_CHANGED" &&
      !error.message.includes("SQL"),
  );
  assert.equal(requested, true);
  const broken = createSupabaseCatalogRepository({
    async request() {
      return { items: "not an array" };
    },
  });
  await assert.rejects(broken.search(binding, null), CatalogError);
  await assert.rejects(transport.request("/rest/v1/rpc/arbitrary_sql", {}), CatalogRpcError);
});
test("editorial seed preserves separate specific IDs and has no invented nutrient/conversion data", async () => {
  const raw = await readFile(
    new URL("../../docs/data/ingredients-v1.json", import.meta.url),
    "utf8",
  );
  const foods = JSON.parse(raw) as {
    slug: string;
    parent: string | null;
    aliases: Record<string, string[]>;
    units: string[];
  }[];
  assert.equal(foods.length, 32);
  assert.equal(new Set(foods.map((food) => food.slug)).size, 32);
  assert.equal(foods.find((food) => food.slug === "piept-de-pui")?.parent, "carne-de-pui");
  for (const food of foods) {
    for (const locale of ["ro-RO", "ru-RU", "en-GB"]) assert.ok(food.aliases[locale]?.length);
    assert.equal("nutrition" in food, false);
    assert.equal("conversionFactor" in food, false);
  }
  const migration = await readFile(
    new URL("../../supabase/migrations/20261102000010_ingredient_seed.sql", import.meta.url),
    "utf8",
  );
  assert.deepEqual(JSON.parse(migration.split("$catalog$")[1] ?? ""), foods);
});
