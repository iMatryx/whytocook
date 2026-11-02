import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { test } from "node:test";

import { PGlite } from "@electric-sql/pglite";

// No connection string: this runner cannot contact a real database.
const migrationDir = new URL("../../supabase/migrations/", import.meta.url);
const owner = "00000000-0000-4000-8000-000000000001";
const other = "00000000-0000-4000-8000-000000000002";
const ingredient = "10000000-0000-4000-8000-000000000002";
const published = "21000000-0000-4000-8000-000000000001";
const draft = "21000000-0000-4000-8000-000000000002";
const recipe = "20000000-0000-4000-8000-000000000001";
const plan = "40000000-0000-4000-8000-000000000001";
const entry = "41000000-0000-4000-8000-000000000001";
const list = "50000000-0000-4000-8000-000000000001";
const item = "51000000-0000-4000-8000-000000000001";
const pantry = "30000000-0000-4000-8000-000000000001";

test("Cookly PostgreSQL schema", async (suite) => {
  const db = await PGlite.create();
  suite.after(() => db.close());
  await db.exec(await readFile(new URL("bootstrap.sql", import.meta.url), "utf8"));
  for (const file of (await readdir(migrationDir))
    .filter((file) => file.startsWith("20261101") && file.endsWith(".sql"))
    .sort()) {
    const sql = await readFile(new URL(file, migrationDir), "utf8");
    await db.transaction((tx) => tx.exec(sql));
  }

  const fixture = await readFile(new URL("fixtures.sql", import.meta.url), "utf8");
  async function scenario(name, run) {
    await suite.test(name, async () => {
      await db.exec("BEGIN");
      try {
        await db.exec(fixture);
        await run();
      } finally {
        await db.exec("ROLLBACK");
      }
    });
  }
  async function scalar(sql, args = []) {
    const result = await db.query(sql, args);
    return Object.values(result.rows[0])[0];
  }
  async function rejects(sql, code, args = []) {
    await db.exec("SAVEPOINT expected_failure");
    try {
      await assert.rejects(db.query(sql, args), (error) => error.code === code);
    } finally {
      await db.exec("ROLLBACK TO SAVEPOINT expected_failure; RELEASE SAVEPOINT expected_failure");
    }
  }

  await scenario("all tables use forced deny-all RLS and no client grants", async () => {
    assert.equal(
      await scalar("SELECT count(*)::int FROM pg_tables WHERE schemaname = 'app_private'"),
      35,
    );
    assert.equal(
      await scalar(`SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='app_private' AND c.relkind='r' AND (NOT c.relrowsecurity OR NOT c.relforcerowsecurity)`),
      0,
    );
    assert.equal(
      await scalar("SELECT count(*)::int FROM pg_policies WHERE schemaname='app_private'"),
      0,
    );
    for (const role of ["anon", "authenticated", "service_role"]) {
      assert.equal(
        await scalar("SELECT has_schema_privilege($1, 'app_private', 'USAGE')", [role]),
        false,
      );
      assert.equal(
        await scalar(
          "SELECT has_table_privilege($1, 'app_private.profiles', 'SELECT,INSERT,UPDATE,DELETE')",
          [role],
        ),
        false,
      );
      assert.equal(
        await scalar(
          "SELECT has_function_privilege($1, 'app_private.normalize_label(text)', 'EXECUTE')",
          [role],
        ),
        false,
      );
    }
    // Even accidental SELECT/USAGE grants cannot expose rows to non-bypass roles.
    await db.exec(
      "GRANT USAGE ON SCHEMA app_private TO authenticated; GRANT SELECT ON app_private.profiles TO authenticated; SET LOCAL ROLE authenticated",
    );
    assert.equal(await scalar("SELECT count(*)::int FROM app_private.profiles"), 0);
    await rejects("INSERT INTO app_private.profiles(id) VALUES (gen_random_uuid())", "42501");
    await db.exec("RESET ROLE");
  });
  await scenario(
    "unknown inventory is distinct from zero and multiple lots are allowed",
    async () => {
      await db.query(
        "INSERT INTO app_private.pantry_items(owner_id, ingredient_id) VALUES ($1,$2),($1,$2)",
        [owner, ingredient],
      );
      await db.query("UPDATE app_private.pantry_items SET quantity=0 WHERE id=$1", [pantry]);
      assert.equal(
        await scalar("SELECT count(*)::int FROM app_private.pantry_items WHERE owner_id=$1", [
          owner,
        ]),
        3,
      );
      await rejects("UPDATE app_private.pantry_items SET quantity=NULL WHERE id=$1", "23514", [
        pantry,
      ]);
      for (const value of ["-1", "NaN"]) {
        await rejects("UPDATE app_private.pantry_items SET quantity=$1 WHERE id=$2", "23514", [
          value,
          pantry,
        ]);
      }
      await rejects("UPDATE app_private.pantry_items SET quantity=$1 WHERE id=$2", "22003", [
        "Infinity",
        pantry,
      ]);
    },
  );
  await scenario("aliases normalize whitespace/case and are locale unique", async () => {
    await db.query(
      "INSERT INTO app_private.ingredient_aliases(ingredient_id, locale, alias) VALUES ($1,'ro-RO','  Test   Alias  ')",
      [ingredient],
    );
    await rejects(
      "INSERT INTO app_private.ingredient_aliases(ingredient_id, locale, alias) VALUES ($1,'ro-RO','test alias')",
      "23505",
      [ingredient],
    );
    await db.query(
      "INSERT INTO app_private.ingredient_aliases(ingredient_id, locale, alias) VALUES ($1,'en-GB','test alias')",
      [ingredient],
    );
  });
  await scenario(
    "composite foreign keys reject cross-owner plan, list and source links",
    async () => {
      await rejects(
        `INSERT INTO app_private.meal_plan_entries(owner_id,meal_plan_id,recipe_version_id,planned_on,meal_slot,servings)
      VALUES ($1,$2,$3,'2026-11-02','lunch',2)`,
        "23503",
        [other, plan, published],
      );
      await rejects(
        "INSERT INTO app_private.shopping_list_items(owner_id,shopping_list_id,label,origin) VALUES ($1,$2,'Test','manual')",
        "23503",
        [other, list],
      );
      await db.query(
        "INSERT INTO app_private.shopping_list_items(id,owner_id,shopping_list_id,label,origin) VALUES ('51000000-0000-4000-8000-000000000002',$1,'50000000-0000-4000-8000-000000000002','Test','manual')",
        [other],
      );
      await rejects(
        `INSERT INTO app_private.shopping_list_item_sources(shopping_list_item_id,meal_plan_entry_id,owner_id)
      VALUES ('51000000-0000-4000-8000-000000000002',$1,$2)`,
        "23503",
        [entry, other],
      );
    },
  );
  await scenario("publication requires portions, required ingredients and steps", async () => {
    await rejects(
      "UPDATE app_private.recipe_versions SET status='published' WHERE id=$1",
      "23514",
      [draft],
    );
    await rejects(
      "INSERT INTO app_private.recipe_servings(recipe_version_id,base_servings) VALUES ($1,21)",
      "23514",
      [draft],
    );
    await db.query(
      "INSERT INTO app_private.recipe_servings(recipe_version_id,base_servings) VALUES ($1,2)",
      [draft],
    );
    await db.query(
      "INSERT INTO app_private.recipe_steps(recipe_version_id,step_number,instruction) VALUES ($1,1,'Test')",
      [draft],
    );
    await rejects(
      "UPDATE app_private.recipe_versions SET status='published' WHERE id=$1",
      "23514",
      [draft],
    );
    await db.query(
      `INSERT INTO app_private.recipe_ingredients(recipe_version_id,ingredient_id,quantity,unit_id,position,is_optional)
      SELECT $1,$2,10,id,1,true FROM app_private.units WHERE code='g'`,
      [draft, ingredient],
    );
    await rejects(
      "UPDATE app_private.recipe_versions SET status='published' WHERE id=$1",
      "23514",
      [draft],
    );
    await db.query(
      "UPDATE app_private.recipe_ingredients SET is_optional=false WHERE recipe_version_id=$1",
      [draft],
    );
    await db.query("UPDATE app_private.recipe_versions SET status='published' WHERE id=$1", [
      draft,
    ]);
    assert.equal(
      await scalar("SELECT published_at IS NOT NULL FROM app_private.recipe_versions WHERE id=$1", [
        draft,
      ]),
      true,
    );
  });
  await scenario("published parent and all four child collections are immutable", async () => {
    await rejects("UPDATE app_private.recipe_versions SET title='Changed' WHERE id=$1", "23514", [
      published,
    ]);
    await rejects("DELETE FROM app_private.recipe_versions WHERE id=$1", "23514", [published]);
    for (const table of ["recipe_servings", "recipe_ingredients", "recipe_steps"]) {
      await rejects(`DELETE FROM app_private.${table} WHERE recipe_version_id=$1`, "23514", [
        published,
      ]);
    }
    await rejects(
      "UPDATE app_private.recipe_steps SET instruction='Changed' WHERE recipe_version_id=$1",
      "23514",
      [published],
    );
    await rejects(
      "INSERT INTO app_private.recipe_tags(recipe_version_id,tag_id) VALUES ($1,'10000000-0000-4000-8000-000000000004')",
      "23514",
      [published],
    );
    await rejects("DELETE FROM app_private.recipes WHERE id=$1", "23514", [recipe]);
  });
  await scenario("current pointer cannot reference a draft or another recipe", async () => {
    await rejects("UPDATE app_private.recipes SET current_version_id=$1 WHERE id=$2", "23514", [
      draft,
      recipe,
    ]);
    await rejects(
      "UPDATE app_private.recipes SET current_version_id=$1,status='published' WHERE id='20000000-0000-4000-8000-000000000002'",
      "23514",
      [published],
    );
  });
  await scenario("plans enforce date range, published versions and integer portions", async () => {
    await rejects(
      "UPDATE app_private.meal_plan_entries SET planned_on='2026-11-09' WHERE id=$1",
      "23514",
      [entry],
    );
    await rejects("UPDATE app_private.meal_plans SET starts_on='2026-11-03' WHERE id=$1", "23514", [
      plan,
    ]);
    await rejects(
      "UPDATE app_private.meal_plan_entries SET recipe_version_id=$1 WHERE id=$2",
      "23514",
      [draft, entry],
    );
    await rejects("UPDATE app_private.meal_plan_entries SET servings=0 WHERE id=$1", "23514", [
      entry,
    ]);
    await db.query(
      `INSERT INTO app_private.meal_plan_entries(owner_id,meal_plan_id,recipe_version_id,planned_on,meal_slot,servings)
      VALUES ($1,$2,$3,'2026-11-02','dinner',1)`,
      [owner, plan, published],
    );
    await db.query("UPDATE app_private.recipes SET status='withdrawn' WHERE id=$1", [recipe]);
    assert.equal(await scalar("SELECT count(*)::int FROM app_private.meal_plan_entries"), 2);
    await rejects(
      `INSERT INTO app_private.meal_plan_entries(owner_id,meal_plan_id,recipe_version_id,planned_on,meal_slot,servings)
      VALUES ($1,$2,$3,'2026-11-02','dinner',1)`,
      "23514",
      [owner, plan, published],
    );
  });
  await scenario(
    "one active shopping list and one derived group including unknown units",
    async () => {
      await rejects("INSERT INTO app_private.shopping_lists(owner_id) VALUES ($1)", "23505", [
        owner,
      ]);
      await db.query(
        "INSERT INTO app_private.shopping_lists(owner_id,status) VALUES ($1,'archived')",
        [owner],
      );
      await rejects(
        `INSERT INTO app_private.shopping_list_items(owner_id,shopping_list_id,ingredient_id,label,origin)
      VALUES ($1,$2,$3,'Duplicate','derived')`,
        "23505",
        [owner, list, ingredient],
      );
      await rejects(
        "UPDATE app_private.shopping_list_items SET purchased_quantity=1 WHERE id=$1",
        "23514",
        [item],
      );
      await db.query("UPDATE app_private.shopping_list_items SET checked_at=now() WHERE id=$1", [
        item,
      ]);
      assert.equal(
        await scalar("SELECT quantity::text FROM app_private.pantry_items WHERE id=$1", [pantry]),
        "50.000000",
      );
    },
  );
  await scenario("revisions increment and owner/identity cannot be reassigned", async () => {
    await db.query(
      "UPDATE app_private.pantry_items SET location='fridge',revision=900 WHERE id=$1",
      [pantry],
    );
    assert.equal(
      String(await scalar("SELECT revision FROM app_private.pantry_items WHERE id=$1", [pantry])),
      "2",
    );
    await rejects("UPDATE app_private.pantry_items SET owner_id=$1 WHERE id=$2", "23514", [
      other,
      pantry,
    ]);
  });
  await scenario("nutrition keeps unknown values and validates reference basis", async () => {
    await db.query(
      `INSERT INTO app_private.nutrition_data(ingredient_id,source_id,source_record_key,source_revision,observed_on,energy_kcal)
      VALUES ($1,'10000000-0000-4000-8000-000000000005','test',1,'2026-11-01',100)`,
      [ingredient],
    );
    assert.equal(await scalar("SELECT protein_g FROM app_private.nutrition_data"), null);
    await rejects("UPDATE app_private.nutrition_data SET protein_g=101", "23514");
    await rejects("UPDATE app_private.nutrition_data SET energy_kcal=NULL", "23514");
  });
  await scenario("AI idempotency and state/cost checks reject inconsistent records", async () => {
    const sql = `INSERT INTO app_private.ai_requests(owner_id,idempotency_key,input_fingerprint,prompt_version)
      VALUES ($1,'60000000-0000-4000-8000-000000000001',repeat('a',64),'test-v1')`;
    await db.query(sql, [owner]);
    await rejects(sql, "23505", [owner]);
    await db.query(sql, [other]);
    await rejects("UPDATE app_private.ai_requests SET status='succeeded'", "23514");
    await rejects("UPDATE app_private.ai_requests SET estimated_cost=1", "23514");
  });
  await scenario(
    "catalog deletes restrict referenced data; optional category is nullable",
    async () => {
      await rejects("DELETE FROM app_private.ingredients WHERE id=$1", "23503", [ingredient]);
      await rejects("DELETE FROM app_private.units WHERE code='g'", "23503");
      await db.exec("DELETE FROM app_private.ingredient_categories");
      assert.equal(
        await scalar("SELECT category_id FROM app_private.ingredients WHERE id=$1", [ingredient]),
        null,
      );
      await db.exec("DELETE FROM app_private.recipes WHERE slug='test-draft'");
      assert.equal(
        await scalar("SELECT count(*)::int FROM app_private.recipe_versions WHERE id=$1", [draft]),
        0,
      );
    },
  );
  await scenario(
    "account deletion erases private data but preserves anonymous recipe and audit",
    async () => {
      await db.query("INSERT INTO app_private.favorites(owner_id,recipe_id) VALUES ($1,$2)", [
        owner,
        recipe,
      ]);
      await rejects(
        "INSERT INTO app_private.favorites(owner_id,recipe_id) VALUES ($1,$2)",
        "23505",
        [owner, recipe],
      );
      await db.query(
        `INSERT INTO app_private.audit_logs(actor_profile_id,action,resource_type,request_id,outcome)
      VALUES ($1,'profile.deleted','profile',gen_random_uuid(),'success')`,
        [owner],
      );
      await db.query("DELETE FROM auth.users WHERE id=$1", [owner]);
      for (const table of [
        "profiles",
        "account_states",
        "user_preferences",
        "pantry_items",
        "meal_plans",
        "meal_plan_entries",
        "shopping_lists",
        "shopping_list_items",
        "shopping_list_item_sources",
        "favorites",
      ]) {
        const column =
          table === "profiles"
            ? "id"
            : ["account_states", "user_preferences"].includes(table)
              ? "profile_id"
              : "owner_id";
        assert.equal(
          await scalar(`SELECT count(*)::int FROM app_private.${table} WHERE ${column}=$1`, [
            owner,
          ]),
          0,
        );
      }
      assert.equal(
        await scalar("SELECT author_profile_id FROM app_private.recipes WHERE id=$1", [recipe]),
        null,
      );
      assert.equal(await scalar("SELECT actor_profile_id FROM app_private.audit_logs"), null);
      assert.equal(
        await scalar("SELECT count(*)::int FROM app_private.profiles WHERE id=$1", [other]),
        1,
      );
    },
  );
});
