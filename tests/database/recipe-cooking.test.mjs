import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { detailMetadataSchema } from "../../src/features/recipes/contracts/detail.schema.ts";
test("recipe actions isolate accounts, replay atomically and never consume pantry", async (t) => {
  const db = await PGlite.create();
  t.after(() => db.close());
  for (const file of ["bootstrap.sql", "access-bootstrap.sql"])
    await db.exec(await readFile(new URL(file, import.meta.url), "utf8"));
  const dir = new URL("../../supabase/migrations/", import.meta.url);
  for (const name of (await readdir(dir)).filter((n) => n.endsWith(".sql")).sort())
    await db.transaction(async (tx) => tx.exec(await readFile(new URL(name, dir), "utf8")));
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
  await db.exec("SET ROLE anon");
  const metadata = await one("SELECT api.recipe_detail_metadata('cooking-fixture')");
  assert.equal(detailMetadataSchema.safeParse(metadata).success, true);
  assert.deepEqual(metadata.stepTimers, [60]);
  assert.equal(metadata.nutrition.status, "unavailable");
  await assert.rejects(
    one("SELECT api.recipe_detail_metadata('terci-de-ovaz-cu-mere')"),
    (e) => e.code === "P0002",
  );
  await assert.rejects(
    one("SELECT api.get_recipe_actions('cooking-fixture')"),
    (e) => e.code === "42501",
  );
  await db.exec("RESET ROLE");
  const actor = async (id) => {
    await db.exec("RESET ROLE");
    await db.query("SELECT set_config('request.jwt.claims',$1,false)", [
      JSON.stringify({ sub: id, aal: "aal1" }),
    ]);
    await db.exec("SET ROLE authenticated");
  };
  const action = (command, op = crypto.randomUUID(), revision = 1) =>
    one("SELECT api.apply_recipe_action('cooking-fixture',$1,$2,$3::jsonb)", [
      revision,
      op,
      JSON.stringify(command),
    ]);
  await actor(a);
  assert.equal((await action({ kind: "favorite", enabled: true })).favorite, true);
  await actor(b);
  assert.equal((await one("SELECT api.get_recipe_actions('cooking-fixture')")).favorite, false);
  await actor(a);
  const shopping = {
      kind: "shopping",
      items: [{ ingredientSlug: "rosii", label: "Roșii", quantity: "50", unitCode: "g" }],
    },
    op = crypto.randomUUID();
  assert.equal((await action(shopping, op)).addedCount, 1);
  assert.equal((await action(shopping, op)).addedCount, 1);
  assert.equal(await one("SELECT count(*)::int FROM api.my_shopping_items"), 1);
  await assert.rejects(
    action({ ...shopping, items: [{ ...shopping.items[0], quantity: "51" }] }, op),
    (e) => e.code === "22023",
  );
  await assert.rejects(
    action({
      ...shopping,
      items: [
        ...shopping.items,
        { ingredientSlug: "mar", label: "Măr", quantity: "1", unitCode: "g" },
      ],
    }),
    (e) => e.code === "22023",
  );
  assert.equal(
    await one("SELECT count(*)::int FROM api.my_shopping_items"),
    1,
    "bad batch rolls back entirely",
  );
  const cooked = await action({ kind: "cooked", servings: 2 });
  assert.ok(cooked.lastCookedAt);
  assert.equal(
    await one("SELECT count(*)::int FROM api.my_pantry"),
    0,
    "actions never create or consume stock",
  );
  await assert.rejects(
    action({ kind: "favorite", enabled: false }, crypto.randomUUID(), 99),
    (e) => e.code === "40001",
  );
  await assert.rejects(action({ kind: "cooked", servings: "2" }), (e) => e.code === "22023");
  await actor(b);
  assert.equal(await one("SELECT count(*)::int FROM api.my_shopping_items"), 0);
  assert.equal((await one("SELECT api.get_recipe_actions('cooking-fixture')")).lastCookedAt, null);
});
