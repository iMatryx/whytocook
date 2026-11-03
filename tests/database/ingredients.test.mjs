import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { ingredientSearchKey } from "../../src/features/ingredients/domain/search-key.ts";

test("ingredient catalog on PostgreSQL", async (suite) => {
  const db = await PGlite.create();
  suite.after(() => db.close());
  for (const file of ["bootstrap.sql", "access-bootstrap.sql"])
    await db.exec(await readFile(new URL(file, import.meta.url), "utf8"));
  const directory = new URL("../../supabase/migrations/", import.meta.url);
  for (const file of (await readdir(directory)).filter((file) => file.endsWith(".sql")).sort()) {
    const sql = await readFile(new URL(file, directory), "utf8");
    await db.transaction((tx) => tx.exec(sql));
  }
  async function one(sql, args = []) {
    return Object.values((await db.query(sql, args)).rows[0])[0];
  }
  async function search(query, locale = "ro-RO", limit = 20, version = null, after = null) {
    return one("SELECT api.search_ingredients($1,$2,NULL,$3,$4,$5,$6,$7)", [
      query,
      locale,
      limit,
      version,
      after?.rank ?? null,
      after?.name ?? null,
      after?.id ?? null,
    ]);
  }
  await suite.test("SQL and JS normalize Romanian/Russian without merging short-i", async () => {
    for (const query of ["ROŞII", "Ros\u0326ii", "Făină", "ЗЕЛЁНЫЙ", "й", "и"]) {
      assert.equal(
        await one("SELECT app_private.ingredient_search_key($1)", [query]),
        ingredientSearchKey(query),
      );
    }
  });
  await suite.test("anonymous synonyms, token prefixes and exact identity separation", async () => {
    await db.exec("SET ROLE anon");
    for (const query of ["rosii", "roșii", "tomatoes", "помидоры"]) {
      assert.equal((await search(query)).items[0].slug, "rosii");
    }
    assert.equal((await search("piept pui")).items[0].slug, "piept-de-pui");
    assert.equal((await search("груд", "ru-RU")).items[0].slug, "piept-de-pui");
    const results = (await search("pui")).items;
    assert.equal(results.length, 2);
    assert.notEqual(results[0].id, results[1].id);
    const detail = await one("SELECT api.get_ingredient($1,'ro-RO')", [
      results.find((item) => item.slug === "piept-de-pui").id,
    ]);
    assert.equal(detail.nutrition.status, "unavailable");
    assert.equal(detail.nutrition.energyKcal, null);
    await assert.rejects(
      db.exec("UPDATE app_private.ingredients SET is_active=false"),
      (error) => error.code === "42501",
    );
    await db.exec("RESET ROLE");
  });
  await suite.test("pagination is stable, exhaustive and invalidates on edits", async () => {
    await db.exec("SET ROLE anon");
    let page = await search("", "en-GB", 7);
    const seen = new Set(page.items.map((item) => item.id));
    const version = page.version;
    while (page.next) {
      page = await search("", "en-GB", 7, version, page.next);
      for (const item of page.items) {
        assert.equal(seen.has(item.id), false);
        seen.add(item.id);
      }
    }
    assert.equal(seen.size, 56); // 32 original + 24 explicit recipe references.
    await db.exec("RESET ROLE");
    await db.exec("UPDATE app_private.ingredients SET is_active=false WHERE slug='rosii'");
    await db.exec("SET ROLE anon");
    await assert.rejects(
      search("", "en-GB", 7, version, { rank: 0, name: "carne de pui", id: [...seen][0] }),
      (error) => error.code === "40001",
    );
    assert.equal((await search("tomatoes")).items.length, 0);
    await db.exec("RESET ROLE");
    await db.exec("UPDATE app_private.ingredients SET is_active=true WHERE slug='rosii'");
  });
  await suite.test(
    "only reviewed exact-ingredient nutrition with licensed source is exposed",
    async () => {
      const ingredient = await one(
        "SELECT id FROM app_private.ingredients WHERE slug='piept-de-pui'",
      );
      const source = await one(
        "INSERT INTO app_private.data_sources(code,name,reference_url,license) VALUES ('synthetic-nutrition-test','Synthetic fixture','https://example.com/test','Test only') RETURNING id",
      );
      await db.query(
        "INSERT INTO app_private.nutrition_data(ingredient_id,source_id,source_record_key,source_revision,observed_on,energy_kcal) VALUES ($1,$2,'synthetic',1,'2026-01-01',123)",
        [ingredient, source],
      );
      assert.equal(
        (await one("SELECT api.get_ingredient($1)", [ingredient])).nutrition.status,
        "unavailable",
      );
      await db.query(
        "UPDATE app_private.nutrition_data SET verification_status='verified',verified_at=now(),source_food_description='Synthetic test food, not production data' WHERE ingredient_id=$1",
        [ingredient],
      );
      const detail = await one("SELECT api.get_ingredient($1)", [ingredient]);
      assert.equal(detail.nutrition.status, "partial");
      assert.equal(detail.nutrition.proteinG, null);
      const parent = await one("SELECT id FROM app_private.ingredients WHERE slug='carne-de-pui'");
      assert.equal(
        (await one("SELECT api.get_ingredient($1)", [parent])).nutrition.status,
        "unavailable",
      );
    },
  );
  await suite.test("TRUNCATE maintenance also invalidates public cursors", async () => {
    const version = await one("SELECT revision::text FROM app_private.ingredient_catalog_state");
    await db.exec("TRUNCATE app_private.ingredient_aliases");
    assert.ok(
      BigInt(await one("SELECT revision::text FROM app_private.ingredient_catalog_state")) >
        BigInt(version),
    );
  });
});
