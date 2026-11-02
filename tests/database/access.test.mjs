import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

const a = "00000000-0000-4000-8000-000000000001";
const b = "00000000-0000-4000-8000-000000000002";
const ingredient = "10000000-0000-4000-8000-000000000002";
const recipe = "20000000-0000-4000-8000-000000000001";
const draft = "20000000-0000-4000-8000-000000000002";
const pantry = "30000000-0000-4000-8000-000000000001";
const plan = "40000000-0000-4000-8000-000000000001";
const list = "50000000-0000-4000-8000-000000000001";

test("Supabase access isolation on PostgreSQL", async (suite) => {
  const db = await PGlite.create();
  suite.after(() => db.close());
  for (const file of ["bootstrap.sql", "access-bootstrap.sql"]) {
    await db.exec(await readFile(new URL(file, import.meta.url), "utf8"));
  }
  const directory = new URL("../../supabase/migrations/", import.meta.url);
  for (const name of (await readdir(directory)).filter((name) => name.endsWith(".sql")).sort()) {
    const sql = await readFile(new URL(name, directory), "utf8");
    await db.transaction((tx) => tx.exec(sql));
  }
  const fixture = await readFile(new URL("fixtures.sql", import.meta.url), "utf8");
  async function actor(id, aal = "aal1") {
    await db.exec("RESET ROLE");
    await db.query("SELECT set_config('request.jwt.claims',$1,true)", [
      JSON.stringify(
        id
          ? { sub: id, role: "authenticated", aal, user_metadata: { role: "admin" } }
          : { role: "anon" },
      ),
    ]);
    await db.exec(id ? "SET LOCAL ROLE authenticated" : "SET LOCAL ROLE anon");
  }
  async function one(sql, args = []) {
    return Object.values((await db.query(sql, args)).rows[0])[0];
  }
  async function denied(sql, code = "42501", args = []) {
    await db.exec("SAVEPOINT denied");
    try {
      await assert.rejects(db.query(sql, args), (error) => error.code === code);
    } finally {
      await db.exec("ROLLBACK TO denied; RELEASE denied");
    }
  }
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

  await scenario(
    "anonymous reads only published current content and no personal data",
    async () => {
      await actor(null);
      assert.equal(await one("SELECT count(*)::int FROM api.recipes"), 1);
      assert.equal(await one("SELECT count(*)::int FROM api.recipes WHERE id=$1", [draft]), 0);
      assert.equal(await one("SELECT count(*)::int FROM api.recipe_steps"), 1);
      await denied("SELECT * FROM api.my_pantry");
      await denied("SELECT api.actor_context()");
      await denied("SELECT * FROM app_private.user_roles");
    },
  );
  await scenario("A and B cannot read or update each other's profile/inventory", async () => {
    await actor(b);
    assert.equal(await one("SELECT count(*)::int FROM api.my_pantry"), 0);
    assert.equal(await one("SELECT count(*)::int FROM api.my_profile WHERE id=$1", [a]), 0);
    await denied("SELECT api.delete_pantry_item($1,1)", "P0002", [pantry]);
    await actor(a);
    assert.equal(await one("SELECT count(*)::int FROM api.my_pantry"), 1);
    await db.query("SELECT api.update_my_profile('A','ro-RO','Europe/Chisinau')");
    assert.equal(await one("SELECT display_name FROM api.my_profile"), "A");
    await denied("UPDATE app_private.profiles SET display_name='Bypass'");
    await denied("UPDATE api.my_profile SET display_name='Bypass'");
  });
  await scenario("extended profile is atomic, private and cannot promote its owner", async () => {
    await actor(a);
    const options = await one("SELECT api.profile_options()");
    await db.query(
      "SELECT api.save_my_profile('Household A','ro-RO','Europe/Chisinau',3,'250.50','MDL',$1,$2,$3)",
      [[options.diets[0].id], [options.allergens[0].id], [options.equipment[0].id]],
    );
    const own = await one("SELECT api.get_my_profile()");
    assert.equal(own.id, a);
    assert.equal(own.household_size, 3);
    assert.equal(Number(own.meal_budget), 250.5);
    assert.equal(own.allergen_ids.length, 1);
    assert.deepEqual((await one("SELECT api.actor_context()")).roles, []);
    await denied(
      "SELECT api.save_my_profile('Invalid','ro-RO','Europe/Chisinau',21,'250.50','MDL','{}','{}','{}')",
      "23514",
    );
    assert.equal((await one("SELECT api.get_my_profile()")).display_name, "Household A");
    await actor(b);
    const other = await one("SELECT api.get_my_profile()");
    assert.equal(other.id, b);
    assert.deepEqual(other.allergen_ids, []);
    assert.equal(
      await one("SELECT count(*)::int FROM app_private.user_equipment WHERE profile_id=$1", [a]),
      0,
    );
    await denied(
      "UPDATE app_private.user_preferences SET meal_budget=1 WHERE profile_id=$1",
      "42501",
      [a],
    );
  });
  await scenario("own inventory can be created, changed with revision and deleted", async () => {
    await actor(a);
    const id = await one("SELECT api.save_pantry_item(NULL,NULL,$1,NULL,NULL,'fridge',NULL)", [
      ingredient,
    ]);
    await db.query("SELECT api.save_pantry_item($1,1,$2,NULL,NULL,'freezer',NULL)", [
      id,
      ingredient,
    ]);
    await denied("SELECT api.save_pantry_item($1,1,$2,NULL,NULL,'fridge',NULL)", "40001", [
      id,
      ingredient,
    ]);
    await db.query("SELECT api.delete_pantry_item($1,2)", [id]);
  });
  await scenario("plans and lists cannot attach children across accounts", async () => {
    await actor(b);
    await denied("SELECT api.save_meal_plan($1,1,'2026-11-02')", "P0002", [plan]);
    await denied(
      "SELECT api.save_meal_entry(NULL,NULL,$1,'21000000-0000-4000-8000-000000000001','2026-11-02','lunch',2)",
      "P0002",
      [plan],
    );
    await denied("SELECT api.save_shopping_item(NULL,NULL,$1,'Test',NULL,NULL,NULL)", "P0002", [
      list,
    ]);
    await actor(a);
    assert.equal(await one("SELECT count(*)::int FROM api.my_meal_plans"), 1);
    assert.equal(await one("SELECT count(*)::int FROM api.my_shopping_items"), 1);
  });
  await scenario("linked meal changes cannot leave generated shopping totals stale", async () => {
    await actor(a);
    const entry = "41000000-0000-4000-8000-000000000001";
    await denied("SELECT api.delete_meal_entry($1,1)", "23514", [entry]);
    const revision = await one("SELECT revision::text FROM api.my_meal_plans WHERE id=$1", [plan]);
    await denied("SELECT api.delete_meal_plan($1,$2)", "23514", [plan, revision]);
    await denied(
      "SELECT api.save_meal_entry($1,1,$2,'21000000-0000-4000-8000-000000000001','2026-11-02','dinner',3)",
      "23514",
      [entry, plan],
    );
  });
  await scenario(
    "metadata roles, self-promotion, direct mutation and unaudited grants are denied",
    async () => {
      await actor(a, "aal2");
      const context = await one("SELECT api.actor_context()");
      assert.deepEqual(context.roles, []);
      await denied(
        "INSERT INTO app_private.user_roles(profile_id,role) VALUES ($1,'admin')",
        "42501",
        [a],
      );
      await denied("SELECT api.withdraw_recipe($1)", "42501", [recipe]);
      await denied("UPDATE app_private.recipes SET status='withdrawn'");
      await denied("DELETE FROM app_private.audit_logs");
    },
  );
  await scenario("editor needs MFA, can withdraw recipes and cannot inspect B's data", async () => {
    await db.query("INSERT INTO app_private.user_roles(profile_id,role) VALUES ($1,'editor')", [a]);
    await actor(a);
    await denied("SELECT api.withdraw_recipe($1)", "42501", [recipe]);
    await actor(a, "aal2");
    await db.query("SELECT api.withdraw_recipe($1)", [recipe]);
    assert.equal(await one("SELECT count(*)::int FROM api.recipes"), 0);
    assert.equal(await one("SELECT count(*)::int FROM api.my_profile WHERE id=$1", [b]), 0);
    await actor(null);
    assert.equal(await one("SELECT count(*)::int FROM api.recipe_steps"), 0);
  });
  await scenario(
    "editor can save, read revisions, update and publish a draft using api only",
    async () => {
      await db.query("INSERT INTO app_private.user_roles(profile_id,role) VALUES ($1,'editor')", [
        a,
      ]);
      await actor(a, "aal2");
      const unit = await one("SELECT id FROM api.units WHERE code='g'");
      const ingredients = JSON.stringify([
        { ingredient_id: ingredient, quantity: "10", unit_id: unit },
      ]);
      const save = `SELECT api.save_recipe_draft($1,'editor-created',$2,$3,'Editorial test',NULL,'easy',1,2,2,$4,$5,'{}'::uuid[])`;
      const version = await one(save, [
        null,
        null,
        null,
        ingredients,
        JSON.stringify(["Test instruction"]),
      ]);
      const before = (
        await db.query(
          "SELECT recipe_id,updated_at::text AS revision FROM api.editor_recipe_versions WHERE id=$1",
          [version],
        )
      ).rows[0];
      await db.query(save, [
        before.recipe_id,
        version,
        before.revision,
        ingredients,
        JSON.stringify(["Updated instruction"]),
      ]);
      const revision = await one(
        "SELECT updated_at::text FROM api.editor_recipe_versions WHERE id=$1",
        [version],
      );
      await db.query("SELECT api.publish_recipe($1,$2,$3)", [before.recipe_id, version, revision]);
      assert.equal(
        await one("SELECT count(*)::int FROM api.recipes WHERE id=$1", [before.recipe_id]),
        1,
      );
      await actor(b);
      assert.equal(await one("SELECT count(*)::int FROM api.editor_recipe_versions"), 0);
      await denied(save, "42501", [null, null, null, ingredients, JSON.stringify(["Test"])]);
    },
  );
  await scenario(
    "own plans, entries, lists and items support create/update/delete with revisions",
    async () => {
      await actor(b);
      const newPlan = await one("SELECT api.save_meal_plan(NULL,NULL,'2026-11-16')");
      const newEntry = await one(
        "SELECT api.save_meal_entry(NULL,NULL,$1,'21000000-0000-4000-8000-000000000001','2026-11-16','lunch',2)",
        [newPlan],
      );
      await db.query(
        "SELECT api.save_meal_entry($1,1,$2,'21000000-0000-4000-8000-000000000001','2026-11-17','lunch',3)",
        [newEntry, newPlan],
      );
      await db.query("SELECT api.delete_meal_entry($1,2)", [newEntry]);
      const planRevision = await one("SELECT revision::text FROM api.my_meal_plans WHERE id=$1", [
        newPlan,
      ]);
      await db.query("SELECT api.delete_meal_plan($1,$2)", [newPlan, planRevision]);
      const newList = await one("SELECT api.save_shopping_list(NULL,NULL,'History','archived')");
      const newItem = await one(
        "SELECT api.save_shopping_item(NULL,NULL,$1,'Manual',NULL,NULL,NULL)",
        [newList],
      );
      await db.query("SELECT api.set_shopping_progress($1,1,'0',true)", [newItem]);
      await db.query("SELECT api.delete_shopping_item($1,2)", [newItem]);
      await db.query("SELECT api.delete_shopping_list($1,1)", [newList]);
    },
  );
  await scenario(
    "provisioning creates an active ordinary account without privileged roles",
    async () => {
      const id = "00000000-0000-4000-8000-000000000003";
      await db.query("INSERT INTO auth.users(id) VALUES ($1)", [id]);
      assert.equal(
        await one("SELECT status FROM app_private.account_states WHERE profile_id=$1", [id]),
        "active",
      );
      assert.equal(
        await one("SELECT count(*)::int FROM app_private.user_preferences WHERE profile_id=$1", [
          id,
        ]),
        1,
      );
      await actor(id, "aal2");
      assert.deepEqual((await one("SELECT api.actor_context()")).roles, []);
      await denied("SELECT app_private.provision_profile()");
    },
  );
  await scenario(
    "disabled accounts lose private access and editorial capabilities immediately",
    async () => {
      await db.query("INSERT INTO app_private.user_roles(profile_id,role) VALUES ($1,'admin')", [
        a,
      ]);
      await db.query(
        "UPDATE app_private.account_states SET status='disabled' WHERE profile_id=$1",
        [a],
      );
      await actor(a, "aal2");
      assert.equal(await one("SELECT count(*)::int FROM api.my_pantry"), 0);
      await denied("SELECT api.actor_context()");
      await denied("SELECT api.withdraw_recipe($1)", "42501", [recipe]);
    },
  );
  await scenario(
    "private storage isolates owners, blocks exports upload and requires editor MFA",
    async () => {
      const name = `${a}/70000000-0000-4000-8000-000000000001.jpg`;
      await db.query("INSERT INTO app_private.user_roles(profile_id,role) VALUES ($1,'editor')", [
        a,
      ]);
      await actor(a);
      await denied(
        "INSERT INTO storage.objects(bucket_id,name,owner_id) VALUES ('recipe-media',$1,$2)",
        "42501",
        [name, a],
      );
      await actor(a, "aal2");
      await db.query(
        "INSERT INTO storage.objects(bucket_id,name,owner_id) VALUES ('recipe-media',$1,$2)",
        [name, a],
      );
      await denied(
        "INSERT INTO storage.objects(bucket_id,name,owner_id) VALUES ('account-exports',$1,$2)",
        "42501",
        [`${a}/export.json`, a],
      );
      await actor(b, "aal2");
      assert.equal(await one("SELECT count(*)::int FROM storage.objects"), 0);
      await actor(null);
      assert.equal(await one("SELECT count(*)::int FROM storage.objects"), 0);
    },
  );
  await scenario("executor roles cannot bypass RLS or inherit table ownership", async () => {
    await db.exec("RESET ROLE");
    assert.equal(
      await one(
        "SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='app_private' AND c.relkind='r' AND (NOT c.relrowsecurity OR NOT c.relforcerowsecurity)",
      ),
      0,
    );
    for (const role of ["anon", "authenticated"]) {
      assert.equal(
        await one(
          "SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('app_private','api') AND c.relkind IN ('r','v') AND has_table_privilege($1,c.oid,'INSERT,UPDATE,DELETE')",
          [role],
        ),
        0,
      );
    }
    assert.equal(
      await one(
        "SELECT count(*)::int FROM pg_roles WHERE rolname IN ('cookly_api','cookly_authz','cookly_provisioner') AND (rolsuper OR rolbypassrls OR rolcanlogin)",
      ),
      0,
    );
    assert.equal(
      await one(
        "SELECT count(*)::int FROM pg_tables WHERE schemaname='app_private' AND tableowner IN ('cookly_api','cookly_authz','cookly_provisioner')",
      ),
      0,
    );
    assert.equal(await one("SELECT pg_has_role('authenticated','cookly_api','MEMBER')"), false);
  });
  await scenario(
    "exports are private, owner-only, and media paths reject impersonation/traversal",
    async () => {
      const name = `${a}/70000000-0000-4000-8000-000000000001.json`;
      await db.query(
        "INSERT INTO storage.objects(bucket_id,name,owner_id) VALUES ('account-exports',$1,$2)",
        [name, a],
      );
      assert.equal(await one("SELECT count(*)::int FROM storage.buckets WHERE public"), 0);
      await actor(a);
      assert.equal(await one("SELECT count(*)::int FROM storage.objects"), 1);
      await actor(b);
      assert.equal(await one("SELECT count(*)::int FROM storage.objects"), 0);
      await db.exec("RESET ROLE");
      await db.query("INSERT INTO app_private.user_roles(profile_id,role) VALUES ($1,'admin')", [
        b,
      ]);
      await actor(b, "aal2");
      await denied(
        "INSERT INTO storage.objects(bucket_id,name,owner_id) VALUES ('recipe-media',$1,$2)",
        "42501",
        [`${a}/70000000-0000-4000-8000-000000000001.jpg`, b],
      );
      await denied(
        "INSERT INTO storage.objects(bucket_id,name,owner_id) VALUES ('recipe-media',$1,$2)",
        "42501",
        [`${b}/../file.jpg`, b],
      );
    },
  );
});
