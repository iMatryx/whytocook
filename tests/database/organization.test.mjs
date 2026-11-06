import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { organizationSnapshotSchema } from "../../src/features/recipes/contracts/organization.schema.ts";
test("organization isolates accounts, deduplicates collections and erases history without replay resurrection", async (t) => {
  const db = await PGlite.create();
  t.after(() => db.close());
  for (const file of ["bootstrap.sql", "access-bootstrap.sql"])
    await db.exec(await readFile(new URL(file, import.meta.url), "utf8"));
  const dir = new URL("../../supabase/migrations/", import.meta.url);
  let organizationMigration;
  for (const name of (await readdir(dir)).filter((n) => n.endsWith(".sql")).sort())
    if (name.endsWith("18_recipe_organization.sql"))
      organizationMigration = await readFile(new URL(name, dir), "utf8");
    else await db.transaction(async (tx) => tx.exec(await readFile(new URL(name, dir), "utf8")));
  const one = async (sql, args = []) => Object.values((await db.query(sql, args)).rows[0])[0];
  const a = "00000000-0000-4000-8000-000000000001",
    b = "00000000-0000-4000-8000-000000000002";
  await db.query("INSERT INTO auth.users(id) VALUES($1),($2)", [a, b]);
  const rid = await one(
    "INSERT INTO app_private.recipes(slug) VALUES('cooking-fixture') RETURNING id",
  );
  const vid = await one(
    "INSERT INTO app_private.recipe_versions(recipe_id,version_number,title,difficulty,active_minutes,total_minutes) VALUES($1,1,'Cooking fixture','easy',5,10) RETURNING id",
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
    "INSERT INTO app_private.recipe_steps(recipe_version_id,step_number,instruction,timer_seconds) VALUES($1,1,'Taie roșiile.',60)",
    [vid],
  );
  await db.query(
    "INSERT INTO app_private.recipe_photos(recipe_version_id,url,alt,credit,generated) VALUES($1,'/recipes/oatmeal-apple-demo.png','Fixture photo','Generated test fixture',true)",
    [vid],
  );
  await db.query("UPDATE app_private.recipe_versions SET status='published' WHERE id=$1", [vid]);
  await db.query(
    "UPDATE app_private.recipes SET status='published',current_version_id=$1 WHERE id=$2",
    [vid, rid],
  );
  await db.query("SELECT set_config('request.jwt.claims',$1,false)", [
    JSON.stringify({ sub: a, aal: "aal1" }),
  ]);
  await db.exec("SET ROLE authenticated");
  const backfillOp = crypto.randomUUID();
  await one("SELECT api.apply_recipe_action('cooking-fixture',1,$1,$2::jsonb)", [
    backfillOp,
    JSON.stringify({ kind: "cooked", servings: 3 }),
  ]);
  await db.exec("RESET ROLE");
  await db.transaction(async (tx) => tx.exec(organizationMigration));

  const actor = async (id) => {
    await db.exec("RESET ROLE");
    await db.query("SELECT set_config('request.jwt.claims',$1,false)", [
      JSON.stringify({ sub: id, aal: "aal1" }),
    ]);
    await db.exec("SET ROLE authenticated");
  };
  const snapshot = () => one("SELECT api.get_recipe_organization()");
  const mutate = (command) =>
    one("SELECT api.mutate_recipe_organization($1::jsonb)", [JSON.stringify(command)]);
  const id = crypto.randomUUID();
  await db.exec("SET ROLE anon");
  await assert.rejects(snapshot(), (e) => e.code === "42501");
  await actor(a);
  assert.equal(organizationSnapshotSchema.safeParse(await snapshot()).success, true);
  assert.equal((await snapshot()).cooked.length, 1, "existing Cooking operations are backfilled");
  await mutate({ kind: "clearHistory" });
  await mutate({ kind: "saveCollection", create: true, id, name: "  Fitness   rapid " });
  await mutate({ kind: "saveCollection", create: true, id, name: "Fitness rapid" });
  assert.equal((await snapshot()).collections.length, 1, "identical create retry is idempotent");
  await assert.rejects(
    mutate({
      kind: "saveCollection",
      create: true,
      id: crypto.randomUUID(),
      name: "Fitness\u00a0rapid",
    }),
    (e) => e.code === "22023",
  );
  await assert.rejects(
    mutate({
      kind: "saveCollection",
      create: true,
      id: crypto.randomUUID(),
      name: "fitness rapid",
    }),
    (e) => e.code === "22023",
  );
  const unicodeId = crypto.randomUUID();
  await mutate({ kind: "saveCollection", create: true, id: unicodeId, name: "Café" });
  await assert.rejects(
    mutate({ kind: "saveCollection", create: true, id: crypto.randomUUID(), name: "Cafe\u0301" }),
    (e) => e.code === "22023",
  );
  await mutate({ kind: "deleteCollection", id: unicodeId });
  await assert.rejects(
    mutate({ kind: "saveCollection", create: false, id: unicodeId, name: "Stale rename" }),
    (e) => e.code === "P0002",
  );
  const member = { kind: "membership", id, recipeKey: "published:cooking-fixture", enabled: true };
  await mutate(member);
  await mutate(member);
  assert.deepEqual((await snapshot()).collections[0].recipeKeys, [member.recipeKey]);
  await mutate({ kind: "favorite", recipeKey: member.recipeKey, enabled: true });
  await mutate({ kind: "favorite", recipeKey: member.recipeKey, enabled: true });
  assert.equal((await snapshot()).favorites.length, 1);
  await actor(b);
  assert.deepEqual((await snapshot()).collections, []);
  await assert.rejects(mutate(member), (e) => e.code === "P0002");
  await assert.rejects(
    mutate({ kind: "saveCollection", create: true, id, name: "Stolen" }),
    (e) => e.code === "P0002",
  );
  await assert.rejects(
    one("SELECT * FROM app_private.recipe_collections"),
    (e) => e.code === "42501",
  );
  await actor(a);
  const op = crypto.randomUUID(),
    cook = () =>
      one("SELECT api.apply_recipe_action('cooking-fixture',1,$1,$2::jsonb)", [
        op,
        JSON.stringify({ kind: "cooked", servings: 2 }),
      ]);
  await cook();
  await cook();
  assert.equal((await snapshot()).cooked.length, 1);
  await db.exec("RESET ROLE");
  await db.query(
    "INSERT INTO app_private.recipe_history SELECT $1, gen_random_uuid(), $2, clock_timestamp()-g*interval '1 day', 2 FROM generate_series(1,101) g",
    [a, rid],
  );
  await actor(a);
  assert.equal((await snapshot()).cooked.length, 100, "history display is bounded");
  await mutate({ kind: "clearHistory" });
  assert.deepEqual((await snapshot()).cooked, []);
  await db.exec("RESET ROLE");
  assert.equal(
    await one("SELECT count(*)::int FROM app_private.recipe_history WHERE owner_id=$1", [a]),
    0,
    "clear removes all rows, not only the displayed page",
  );
  await actor(a);
  assert.equal((await one("SELECT api.get_recipe_actions('cooking-fixture')")).lastCookedAt, null);
  await cook();
  assert.deepEqual((await snapshot()).cooked, []);
  assert.equal((await snapshot()).favorites.length, 1);
  await mutate({ kind: "favorite", recipeKey: member.recipeKey, enabled: false });
  assert.equal((await snapshot()).collections[0].recipeKeys.length, 1);
  await db.exec("RESET ROLE");
  await db.query("UPDATE app_private.recipes SET status='withdrawn' WHERE id=$1", [rid]);
  await actor(a);
  assert.deepEqual(
    (await snapshot()).collections[0].recipeKeys,
    [member.recipeKey],
    "withdrawn saved recipe remains removable",
  );
  assert.equal(
    (await snapshot()).titles[member.recipeKey],
    null,
    "withdrawn content is not exposed",
  );
  await mutate({ ...member, enabled: false });
  assert.deepEqual((await snapshot()).collections[0].recipeKeys, []);
  await mutate({ kind: "deleteCollection", id });
  assert.deepEqual((await snapshot()).collections, []);
  await assert.rejects(
    mutate({ kind: "favorite", recipeKey: "demo:cooking-fixture", enabled: true }),
    (e) => e.code === "22023",
  );
});
