import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { recipeSnapshotSchema } from "../../src/features/recipes/contracts/search.schema.ts";
test("recipe search exposes only current published versions and isolates private context", async (t) => {
  const db = await PGlite.create();
  t.after(() => db.close());
  for (const file of ["bootstrap.sql", "access-bootstrap.sql"])
    await db.exec(await readFile(new URL(file, import.meta.url), "utf8"));
  const directory = new URL("../../supabase/migrations/", import.meta.url);
  for (const name of (await readdir(directory)).filter((n) => n.endsWith(".sql")).sort())
    await db.transaction(async (tx) => tx.exec(await readFile(new URL(name, directory), "utf8")));
  const one = async (sql, args = []) => Object.values((await db.query(sql, args)).rows[0])[0];
  const a = "00000000-0000-4000-8000-000000000001",
    b = "00000000-0000-4000-8000-000000000002";
  await db.query("INSERT INTO auth.users(id) VALUES($1),($2)", [a, b]);
  await db.exec("SET ROLE anon");
  const empty = await one("SELECT api.recipe_search_snapshot()");
  assert.equal(recipeSnapshotSchema.safeParse(empty).success, true);
  assert.equal(empty.recipes.length, 0, "72 demo drafts remain private");
  await assert.rejects(one("SELECT api.recipe_search_context()"), (e) => e.code === "42501");
  await db.exec("RESET ROLE");
  const rid = await one(
    "INSERT INTO app_private.recipes(slug) VALUES('public-search-fixture') RETURNING id",
  );
  const vid = await one(
    "INSERT INTO app_private.recipe_versions(recipe_id,version_number,title,difficulty,active_minutes,total_minutes) VALUES($1,1,'Salată publică','easy',5,10) RETURNING id",
    [rid],
  );
  await db.query(
    "INSERT INTO app_private.recipe_servings(recipe_version_id,base_servings) VALUES($1,2)",
    [vid],
  );
  await db.query(
    "INSERT INTO app_private.recipe_ingredients(recipe_version_id,ingredient_id,quantity,unit_id,position) SELECT $1,i.id,100,u.id,1 FROM app_private.ingredients i,app_private.units u WHERE i.slug='rosii' AND u.code='g'",
    [vid],
  );
  await db.query(
    "INSERT INTO app_private.recipe_steps(recipe_version_id,step_number,instruction) VALUES($1,1,'Taie roșiile.')",
    [vid],
  );
  await db.query("UPDATE app_private.recipe_versions SET status='published' WHERE id=$1", [vid]);
  await db.query(
    "UPDATE app_private.recipes SET status='published',current_version_id=$1 WHERE id=$2",
    [vid, rid],
  );
  await db.exec("SET ROLE anon");
  const snapshot = await one("SELECT api.recipe_search_snapshot()");
  assert.equal(recipeSnapshotSchema.safeParse(snapshot).success, true);
  assert.equal(snapshot.recipes.length, 1);
  assert.equal(snapshot.recipes[0].key, "public-search-fixture");
  assert.equal(snapshot.recipes[0].nutrition, null);
  assert.equal(snapshot.recipes[0].budget, null);
  assert.equal(snapshot.recipes[0].allergens.status, "unverified");
  assert.equal(snapshot.recipes[0].ingredients[0].ingredientSlug, "rosii");
  await db.exec("RESET ROLE");
  await db.query(
    "INSERT INTO app_private.user_allergen_exclusions(profile_id,allergen_id) SELECT $1,id FROM app_private.allergens WHERE code='milk'",
    [a],
  );
  for (const accountId of [a, b]) {
    await db.query("SELECT set_config('request.jwt.claims',$1,false)", [
      JSON.stringify({ sub: accountId, aal: "aal1" }),
    ]);
    await db.exec("SET ROLE authenticated");
    const context = await one("SELECT api.recipe_search_context()");
    assert.equal(context.accountId, accountId);
    assert.deepEqual(context.allergies, accountId === a ? ["milk"] : []);
    assert.deepEqual(context.items, []);
    await db.exec("RESET ROLE");
  }
});
