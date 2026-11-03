import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { validateRecipeBundle } from "../../src/features/recipes/application/validate-bundle.ts";
import { readRecipeCatalog } from "../../scripts/recipes/catalog.ts";
import { recipeSql } from "../../scripts/recipes/io.ts";

test("initial recipe collection is complete, reproducible and isolated", async (suite) => {
  const db = await PGlite.create();
  suite.after(() => db.close());
  for (const file of ["bootstrap.sql", "access-bootstrap.sql"])
    await db.exec(await readFile(new URL(file, import.meta.url), "utf8"));
  const directory = new URL("../../supabase/migrations/", import.meta.url);
  for (const name of (await readdir(directory)).filter((x) => x.endsWith(".sql")).sort())
    await db.transaction((tx) =>
      readFile(new URL(name, directory), "utf8").then((sql) => tx.exec(sql)),
    );
  const bundle = JSON.parse(
    await readFile(new URL("../../data/recipes/demonstration.v1.json", import.meta.url), "utf8"),
  );
  const { catalog } = await readRecipeCatalog();
  async function one(sql, args = []) {
    return Object.values((await db.query(sql, args)).rows[0])[0];
  }
  async function ingest(value) {
    return one("SELECT app_private.import_recipe_bundle($1::jsonb)", [JSON.stringify(value)]);
  }
  await suite.test(
    "72 drafts have canonical quantities, portions, steps, equipment and verification metadata",
    async () => {
      assert.equal(await one("SELECT count(*)::int FROM app_private.recipe_seed_records"), 72);
      assert.equal(
        await one(
          "SELECT count(*)::int FROM app_private.recipe_versions WHERE data_class='demonstration' AND status='draft'",
        ),
        72,
      );
      assert.equal(
        await one(
          "SELECT count(*)::int FROM app_private.recipe_versions v WHERE NOT EXISTS(SELECT 1 FROM app_private.recipe_servings s WHERE s.recipe_version_id=v.id) OR NOT EXISTS(SELECT 1 FROM app_private.recipe_steps s WHERE s.recipe_version_id=v.id) OR NOT EXISTS(SELECT 1 FROM app_private.recipe_equipment e WHERE e.recipe_version_id=v.id)",
        ),
        0,
      );
      const exported = await one(
        "SELECT app_private.export_recipe_bundle('cookly-initial-recipes')",
      );
      assert.equal(validateRecipeBundle(exported, catalog).valid, true);
      assert.deepEqual(
        exported.recipes,
        [...bundle.recipes].sort((a, b) => a.key.localeCompare(b.key, "en")),
      );
      assert.deepEqual(
        await one("SELECT app_private.export_recipe_bundle('cookly-initial-recipes','verified')"),
        { schemaVersion: 1, namespace: "cookly-initial-recipes", locale: "ro-RO", recipes: [] },
      );
    },
  );
  await suite.test(
    "anonymous callers cannot read drafts, metadata or use maintenance import/export",
    async () => {
      await db.exec("SET ROLE anon");
      assert.equal(await one("SELECT count(*)::int FROM api.recipes"), 0);
      for (const table of ["recipe_seed_records", "recipe_equipment", "recipe_allergens"])
        await assert.rejects(
          db.query(`SELECT * FROM app_private.${table}`),
          (e) => e.code === "42501",
        );
      await assert.rejects(ingest(bundle), (e) => e.code === "42501");
      await assert.rejects(
        one("SELECT app_private.export_recipe_bundle('cookly-initial-recipes')"),
        (e) => e.code === "42501",
      );
      await db.exec("RESET ROLE");
    },
  );
  await suite.test(
    "replay is a no-op, same revision conflicts, new revision appends without overwriting",
    async () => {
      assert.deepEqual(await ingest(bundle), { imported: 0, skipped: 72 });
      const first = bundle.recipes[0];
      await assert.rejects(
        ingest({ ...bundle, recipes: [{ ...first, title: "Changed same revision" }] }),
        (e) => e.code === "23505",
      );
      assert.deepEqual(
        await ingest({ ...bundle, recipes: [{ ...first, revision: 2, title: "Revizie de test" }] }),
        { imported: 1, skipped: 0 },
      );
      assert.equal(
        await one(
          "SELECT count(*)::int FROM app_private.recipe_versions WHERE recipe_id=(SELECT recipe_id FROM app_private.recipe_seed_records WHERE namespace=$1 AND external_key=$2 LIMIT 1)",
          [bundle.namespace, first.key],
        ),
        2,
      );
      assert.equal(
        await one(
          "SELECT payload->>'title' FROM app_private.recipe_seed_records WHERE external_key=$1 AND import_revision=1",
          [first.key],
        ),
        first.title,
      );
    },
  );
  await suite.test(
    "SQL export survives CLI validation without changing an imported revision",
    async () => {
      const recipe = {
        ...bundle.recipes[0],
        key: "whitespace-roundtrip-fixture",
        title: `  ${bundle.recipes[0].title}  `,
        summary: `  ${bundle.recipes[0].summary}  `,
      };
      const input = { ...bundle, namespace: "whitespace-roundtrip", recipes: [recipe] };
      await db.exec("BEGIN");
      try {
        await ingest(input);
        const exported = await one(
          "SELECT app_private.export_recipe_bundle('whitespace-roundtrip')",
        );
        const checked = validateRecipeBundle(exported, catalog);
        assert.equal(checked.valid, true);
        assert.ok(checked.bundle);
        assert.equal(checked.bundle.recipes[0].title, recipe.title);
        assert.deepEqual(await ingest(checked.bundle), { imported: 0, skipped: 1 });
      } finally {
        await db.exec("ROLLBACK");
      }
    },
  );
  await suite.test("bad references or incomplete claims roll back an entire batch", async () => {
    const before = await one("SELECT count(*)::int FROM app_private.recipes");
    const first = { ...bundle.recipes[0], key: "atomic-valid-fixture" },
      bad = {
        ...bundle.recipes[1],
        key: "zz-invalid-fixture",
        ingredients: [
          { ...bundle.recipes[1].ingredients[0], ingredientSlug: "nonexistent-ingredient" },
        ],
      };
    await assert.rejects(ingest({ ...bundle, recipes: [first, bad] }), (e) => e.code === "22023");
    assert.equal(await one("SELECT count(*)::int FROM app_private.recipes"), before);
    await assert.rejects(
      ingest({ ...bundle, recipes: [{ ...first, dataClass: "verified" }] }),
      (e) => e.code === "22023",
    );
    await assert.rejects(
      ingest({
        ...bundle,
        recipes: [{ ...first, ingredients: [{ ...first.ingredients[0], quantity: "0.0000001" }] }],
      }),
      (e) => e.code === "22023",
    );
    const malformed = structuredClone(first);
    delete malformed.regions;
    delete malformed.mealTypes;
    delete malformed.ingredients[0].state;
    delete malformed.nutrition.basis;
    await assert.rejects(ingest({ ...bundle, recipes: [malformed] }), (e) => e.code === "22023");
    for (const invalid of [
      { ...bundle, schemaVersion: "1" },
      { ...bundle, namespace: "a".repeat(101) },
      { ...bundle, extra: "unknown" },
    ])
      await assert.rejects(ingest(invalid), (e) => e.code === "22023");
    for (const patch of [
      (r) => (r.regions = ["XX"]),
      (r) => (r.regions = ["MD", "MD"]),
      (r) => (r.activeMinutes = "10"),
      (r) => (r.steps[0].timerSeconds = -1),
      (r) => (r.ingredients[0].state = "unknown"),
      (r) => (r.provenance.extra = "unknown"),
      (r) => (r.budget.currency = "XXX"),
      (r) => (r.title = "\t\n\u00a0"),
      (r) =>
        (r.provenance = {
          kind: "external",
          name: "Invalid IPv4 fixture",
          url: "https://999.999.999.999/",
          license: "Fixture only",
        }),
      (r) =>
        (r.provenance = {
          kind: "external",
          name: "Invalid port fixture",
          url: "https://example.com:bad",
          license: "Fixture only",
        }),
      (r) =>
        (r.provenance = {
          kind: "external",
          name: "Port overflow fixture",
          url: "https://example.com:65536",
          license: "Fixture only",
        }),
    ]) {
      const bad = structuredClone(first);
      patch(bad);
      await assert.rejects(ingest({ ...bundle, recipes: [bad] }), (e) => e.code === "22023");
    }
  });
  await suite.test(
    "demo cannot publish and imported draft content cannot silently drift",
    async () => {
      const version = await one(
        "SELECT recipe_version_id FROM app_private.recipe_seed_records ORDER BY external_key LIMIT 1",
      );
      await assert.rejects(
        db.query("UPDATE app_private.recipe_versions SET status='published' WHERE id=$1", [
          version,
        ]),
        (e) => e.code === "23514",
      );
      await assert.rejects(
        db.query(
          "UPDATE app_private.recipe_steps SET instruction='Changed' WHERE recipe_version_id=$1",
          [version],
        ),
        (e) => e.code === "23514",
      );
      await assert.rejects(
        db.query("DELETE FROM app_private.recipe_equipment WHERE recipe_version_id=$1", [version]),
        (e) => e.code === "23514",
      );
      assert.equal(await one("SELECT count(*)::int FROM app_private.nutrition_data"), 0);
    },
  );
  await suite.test("imported children cannot be moved into a manual draft", async () => {
    const importedVersion = await one(
      "SELECT recipe_version_id FROM app_private.recipe_seed_records ORDER BY external_key LIMIT 1",
    );
    await db.exec("BEGIN");
    try {
      const manualRecipe = await one(
        "INSERT INTO app_private.recipes(slug) VALUES('manual-move-fixture') RETURNING id",
      );
      const manualVersion = await one(
        "INSERT INTO app_private.recipe_versions(recipe_id,version_number,title,difficulty,active_minutes,total_minutes) VALUES($1,1,'Manual fixture','easy',1,2) RETURNING id",
        [manualRecipe],
      );
      for (const table of [
        "recipe_servings",
        "recipe_ingredients",
        "recipe_steps",
        "recipe_tags",
        "recipe_equipment",
        "recipe_allergens",
      ]) {
        await db.exec("SAVEPOINT move_child");
        try {
          await assert.rejects(
            db.query(
              `UPDATE app_private.${table} SET recipe_version_id=$1 WHERE recipe_version_id=$2`,
              [manualVersion, importedVersion],
            ),
            (error) => error.code === "23514",
          );
        } finally {
          await db.exec("ROLLBACK TO SAVEPOINT move_child");
        }
      }
    } finally {
      await db.exec("ROLLBACK");
    }
  });
  await suite.test(
    "synthetic verified evidence follows the reviewed publication branch and enforces protein threshold",
    async () => {
      const source = {
        name: "Synthetic fixture only",
        url: "https://example.com/test-fixture",
        recordId: "test-only",
        license: "Test fixture only",
        observedOn: "2026-11-03",
      };
      const r = {
        ...bundle.recipes[0],
        key: "zz-verified-test-fixture",
        dataClass: "verified",
        proteinClaim: "verified",
        collections: ["vegetarian", "high-protein"],
        allergens: { ...bundle.recipes[0].allergens, status: "verified", source },
        verification: {
          status: "verified",
          reviewedBy: "Synthetic test fixture",
          reviewedAt: "2026-11-03T00:00:00Z",
          evidenceUrl: source.url,
          notes: "Not a real verification",
        },
        nutrition: {
          status: "verified",
          basis: "per-serving",
          source,
          notes: "Synthetic values, not production data",
          perServing: {
            energyKcal: "300",
            proteinG: "10",
            carbohydrateG: "30",
            fatG: "10",
            fiberG: "2",
            saltG: "1",
          },
        },
      };
      await assert.rejects(ingest({ ...bundle, recipes: [r] }), (e) => e.code === "22023");
      r.nutrition.perServing.proteinG = "100";
      await assert.rejects(ingest({ ...bundle, recipes: [r] }), (e) => e.code === "22023");
      await db.exec("BEGIN");
      try {
        r.nutrition.perServing.proteinG = "15";
        await ingest({ ...bundle, recipes: [r] });
        const v = await one(
          "SELECT recipe_version_id FROM app_private.recipe_seed_records WHERE external_key='zz-verified-test-fixture'",
        );
        await db.query("UPDATE app_private.recipe_versions SET status='published' WHERE id=$1", [
          v,
        ]);
        await db.query(
          "UPDATE app_private.recipes SET status='published',current_version_id=$1 WHERE id=(SELECT recipe_id FROM app_private.recipe_versions WHERE id=$1)",
          [v],
        );
        await db.exec("SET ROLE anon");
        assert.equal(await one("SELECT count(*)::int FROM api.recipes"), 1);
        await db.exec("RESET ROLE");
      } finally {
        await db.exec("ROLLBACK");
      }
    },
  );
  await suite.test(
    "generated SQL imports quote and dollar-like text as inert JSON data",
    async () => {
      const payload = {
        ...bundle,
        namespace: "quoted-fixture",
        recipes: [
          {
            ...bundle.recipes[0],
            key: "quoted-fixture",
            summary: "Bunica's $$ note; DROP TABLE recipes; --",
          },
        ],
      };
      await db.exec("BEGIN");
      try {
        await db.exec(recipeSql(payload, true));
        assert.equal(
          await one(
            "SELECT payload->>'summary' FROM app_private.recipe_seed_records WHERE namespace='quoted-fixture'",
          ),
          "Bunica's $$ note; DROP TABLE recipes; --",
        );
        assert.ok((await one("SELECT count(*)::int FROM app_private.recipes")) >= 72);
      } finally {
        await db.exec("ROLLBACK");
      }
    },
  );
});
