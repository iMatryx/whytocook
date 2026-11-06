import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { fullNutritionSchema } from "../../src/features/recipes/contracts/detail.schema.ts";
import {
  plannerMetadataSchema,
  plannerSnapshotSchema,
  plannerExportResultSchema,
} from "../../src/features/meal-planner/contracts/index.ts";

test("meal planner pins recipes, isolates accounts, replays revisions and replaces only its untouched shopping rows", async (t) => {
  const db = await PGlite.create();
  t.after(() => db.close());
  for (const file of ["bootstrap.sql", "access-bootstrap.sql"])
    await db.exec(await readFile(new URL(file, import.meta.url), "utf8"));
  const dir = new URL("../../supabase/migrations/", import.meta.url);
  for (const name of (await readdir(dir)).filter((n) => n.endsWith(".sql")).sort())
    await db.transaction(async (tx) => tx.exec(await readFile(new URL(name, dir), "utf8")));
  const one = async (sql, args = []) => Object.values((await db.query(sql, args)).rows[0])[0];
  const a = crypto.randomUUID(),
    b = crypto.randomUUID();
  await db.query("INSERT INTO auth.users(id) VALUES($1),($2)", [a, b]);
  // Publish one seed so metadata must read the stored evidence, not invent a default.
  const seed = await one(
    "SELECT payload FROM app_private.recipe_seed_records ORDER BY external_key LIMIT 1",
  );
  const source = {
    name: "Test evidence",
    url: "https://example.com/evidence",
    recordId: "test-1",
    license: "CC0",
    observedOn: "2026-11-01",
  };
  seed.key = "planner-fixture";
  seed.dataClass = "verified";
  seed.verification = {
    ...seed.verification,
    status: "verified",
    reviewedBy: "Test reviewer",
    reviewedAt: "2026-11-01T00:00:00Z",
    evidenceUrl: source.url,
  };
  seed.allergens = { ...seed.allergens, status: "verified", source };
  seed.nutrition = {
    ...seed.nutrition,
    status: "verified",
    perServing: {
      energyKcal: "200",
      proteinG: "10",
      carbohydrateG: "20",
      fatG: "5",
      fiberG: "4",
      saltG: "0.5",
    },
    source,
  };
  seed.budget = {
    ...seed.budget,
    status: "verified",
    perServing: "12.50",
    currency: "MDL",
    source,
  };
  await one("SELECT app_private.import_recipe_bundle($1::jsonb)", [
    JSON.stringify({
      schemaVersion: 1,
      namespace: "planner-tests",
      locale: "ro-RO",
      recipes: [seed],
    }),
  ]);
  const version = await one(
    "SELECT id FROM app_private.recipe_versions WHERE recipe_id=(SELECT id FROM app_private.recipes WHERE slug='planner-fixture')",
  );
  await db.query("UPDATE app_private.recipe_versions SET status='published' WHERE id=$1", [
    version,
  ]);
  await db.query(
    "UPDATE app_private.recipes SET status='published',current_version_id=$1 WHERE slug='planner-fixture'",
    [version],
  );
  const ingredient = (
    await db.query(
      "SELECT i.id,u.code FROM app_private.recipe_ingredients ri JOIN app_private.ingredients i ON i.id=ri.ingredient_id JOIN app_private.units u ON u.id=ri.unit_id WHERE ri.recipe_version_id=$1 AND u.code IN ('g','kg','ml','l','piece') LIMIT 1",
      [version],
    )
  ).rows[0];
  const actor = async (id) => {
    await db.exec("RESET ROLE");
    await db.query("SELECT set_config('request.jwt.claims',$1,false)", [
      JSON.stringify({ sub: id, aal: "aal1" }),
    ]);
    await db.exec("SET ROLE authenticated");
  };
  const start = "2026-11-02";
  const snapshot = (day = start) => one("SELECT api.meal_planner_snapshot($1::date)", [day]);
  const mutate = (command, revision, op = crypto.randomUUID(), day = start) =>
    one("SELECT api.meal_planner_mutate($1::date,$2,$3,$4::jsonb)", [
      day,
      revision,
      op,
      JSON.stringify(command),
    ]);
  const exportWeek = (items, revision, op = crypto.randomUUID()) =>
    one("SELECT api.meal_planner_export($1::date,$2,$3,$4::jsonb)", [
      start,
      revision,
      op,
      JSON.stringify(items),
    ]);
  await db.exec("SET ROLE anon");
  const metadata = await one("SELECT api.meal_planner_metadata()");
  const meta = metadata.find((m) => m.key === "planner-fixture");
  assert.equal(plannerMetadataSchema.safeParse(meta).success, true);
  assert.equal(meta.versionId, version);
  assert.equal(
    meta.revision,
    1,
    "metadata identifies the same publication revision as its version and evidence",
  );
  assert.equal(fullNutritionSchema.safeParse(meta.nutrition).success, true);
  assert.equal(meta.nutrition.perServing.energyKcal, "200");
  assert.deepEqual(meta.budgetSource, source);
  await assert.rejects(snapshot(), (e) => e.code === "42501");
  await assert.rejects(mutate({ kind: "configure", budget: null }, "0"), (e) => e.code === "42501");
  await assert.rejects(exportWeek([], "0"), (e) => e.code === "42501");
  await actor(a);
  assert.deepEqual((await snapshot()).week, {
    startsOn: start,
    revision: "0",
    budget: null,
    entries: [],
    exportedRevision: null,
  });
  assert.equal(
    await one("SELECT count(*)::int FROM app_private.meal_plans"),
    0,
    "GET never creates a plan",
  );
  for (const day of ["1899-12-31", "9999-12-26", "infinity"])
    await assert.rejects(snapshot(day), (e) => e.code === "22023");
  for (const budget of [
    { amount: "1.001", currency: "MDL" },
    { amount: "5", currency: "EUR" },
    { amount: "5", currency: "RON", ownerId: b },
  ])
    await assert.rejects(mutate({ kind: "configure", budget }, "0"), (e) => e.code === "22023");
  assert.equal(
    (await snapshot()).week.revision,
    "0",
    "invalid configuration doesn't create a plan",
  );
  let state = await mutate({ kind: "configure", budget: { amount: "100", currency: "MDL" } }, "0");
  let entry = {
    id: crypto.randomUUID(),
    recipeKey: "planner-fixture",
    recipeRevision: 1,
    versionId: version,
    plannedOn: "2026-11-04",
    slot: "lunch",
    servings: 2,
    prepOn: "2026-11-03",
    costPerServing: { amount: "12.50", currency: "MDL", observedOn: "2026-11-01" },
  };
  const op = crypto.randomUUID(),
    save = { kind: "saveEntry", create: true, entry };
  state = await mutate(save, state.week.revision, op);
  const createdRevision = state.week.revision;
  assert.deepEqual(state.week.entries, [entry]);
  assert.deepEqual(
    await mutate(save, "1", op),
    state,
    "identical request replay ignores now-stale revision",
  );
  await assert.rejects(
    mutate({ ...save, entry: { ...entry, servings: 3 } }, "1", op),
    (e) => e.code === "22023",
  );
  await assert.rejects(mutate({ kind: "configure", budget: null }, "0"), (e) => e.code === "40001");
  for (const patch of [
    { id: entry.id.replaceAll("-", "") },
    { versionId: version.replaceAll("-", "") },
    { slot: "brunch" },
    { plannedOn: "2026-11-09" },
    { prepOn: "2026-11-01" },
    { prepOn: "2026-11-05" },
    { versionId: null },
    { recipeKey: "wrong" },
    { recipeRevision: 2 },
    { costPerServing: { ...entry.costPerServing, amount: "1.001" } },
    { costPerServing: { ...entry.costPerServing, currency: "EUR" } },
    { costPerServing: { ...entry.costPerServing, observedOn: "2026-02-30" } },
  ]) {
    await assert.rejects(
      mutate(
        { kind: "saveEntry", create: false, entry: { ...entry, ...patch } },
        state.week.revision,
      ),
    );
    assert.deepEqual(await snapshot(), state, "invalid mutation is atomic");
  }
  entry = { ...entry, plannedOn: "2026-11-05", slot: "snack", servings: 4 };
  state = await mutate({ kind: "saveEntry", create: false, entry }, state.week.revision);
  assert.ok(BigInt(state.week.revision) > BigInt(createdRevision));
  assert.deepEqual(state.week.entries, [entry]);
  assert.equal(plannerSnapshotSchema.safeParse(state).success, true);
  const second = { ...entry, id: crypto.randomUUID() };
  state = await mutate({ kind: "saveEntry", create: true, entry: second }, state.week.revision);
  assert.equal(state.week.entries.length, 2, "a day-slot may hold more than one recipe");
  const copy = await mutate(
    { kind: "copyWeek", targetStartsOn: "2026-11-09" },
    state.week.revision,
  );
  assert.equal(copy.week.startsOn, "2026-11-09");
  assert.equal(copy.week.entries[0].plannedOn, "2026-11-12");
  assert.equal(copy.week.entries[0].prepOn, "2026-11-10");
  assert.equal(copy.week.entries[0].costPerServing.observedOn, "2026-11-01");
  assert.ok(copy.week.entries.every((e) => !state.week.entries.some((s) => s.id === e.id)));
  assert.deepEqual(await snapshot(), state, "copy leaves source unchanged");
  await assert.rejects(
    mutate({ kind: "copyWeek", targetStartsOn: "2026-11-09" }, state.week.revision),
    (e) => e.code === "40001",
  );
  await actor(b);
  assert.equal((await snapshot()).accountId, b);
  assert.equal((await snapshot()).week.revision, "0");
  await assert.rejects(mutate({ kind: "removeEntry", id: entry.id }, "0"));
  assert.equal(await one("SELECT count(*)::int FROM app_private.meal_plan_entries"), 0);
  await actor(a);
  const pantry = await one("SELECT api.get_my_pantry()");
  const history = await one("SELECT api.get_recipe_actions('planner-fixture')");
  const list = await one("SELECT api.save_shopping_list(NULL,NULL,'My list','active')");
  const manual = await one(
    "SELECT api.save_shopping_item(NULL,NULL,$1,'Unrelated manual',$2,'2',(SELECT id FROM app_private.units WHERE code=$3))",
    [list, ingredient.id, ingredient.code],
  );
  const line = {
    id: crypto.randomUUID(),
    ingredientId: ingredient.id,
    label: "Plan ingredient",
    category: "Plan",
    quantity: "5",
    unitCode: ingredient.code,
    checked: false,
    price: null,
    uncertain: false,
  };
  for (const bad of [
    { ...line, ingredientId: null },
    { ...line, ingredientId: crypto.randomUUID() },
    { ...line, checked: true },
    { ...line, price: { amount: "2", currency: "MDL" } },
    { ...line, unitCode: "cup" },
    { ...line, quantity: "0" },
  ]) {
    await assert.rejects(exportWeek([bad], state.week.revision));
    assert.equal(
      (await one("SELECT api.smart_shopping_snapshot()")).items.length,
      1,
      "bad export leaves manual rows intact",
    );
  }
  const exportOp = crypto.randomUUID();
  let exported = await exportWeek([line], state.week.revision, exportOp);
  assert.equal(exported.items.length, 2);
  assert.equal(plannerExportResultSchema.safeParse(exported).success, true);
  assert.equal(
    exported.week.revision,
    state.week.revision,
    "export marker doesn't alter plan revision",
  );
  assert.equal(exported.week.exportedRevision, state.week.revision);
  assert.deepEqual(await exportWeek([line], state.week.revision, exportOp), exported);
  exported = await exportWeek(
    [{ ...line, id: crypto.randomUUID(), quantity: "7" }],
    state.week.revision,
  );
  assert.equal(exported.items.length, 2, "replacement doesn't append duplicates");
  assert.equal(Number(exported.items.find((i) => i.id === manual).quantity), 2);
  exported = await exportWeek([], state.week.revision);
  assert.deepEqual(
    exported.items.map((i) => i.id),
    [manual],
    "empty export clears only generated rows",
  );
  exported = await exportWeek([{ ...line, id: crypto.randomUUID() }], state.week.revision);
  let generated = exported.items.find((i) => i.id !== manual);
  await one("SELECT api.set_shopping_progress($1,$2,'0',true)", [generated.id, generated.revision]);
  const checked = await one("SELECT api.smart_shopping_snapshot()");
  await assert.rejects(exportWeek([], state.week.revision), (e) => e.code === "40001");
  assert.deepEqual((await one("SELECT api.smart_shopping_snapshot()")).items, checked.items);
  generated = checked.items.find((i) => i.id === generated.id);
  await one("SELECT api.set_shopping_progress($1,$2,'0',false)", [
    generated.id,
    generated.revision,
  ]);
  await assert.rejects(
    exportWeek([], state.week.revision),
    (e) => e.code === "40001",
    "even unchecked again, edited rows require reconciliation",
  );
  // Transferred rows are preserved and detached from subsequent exports.
  await db.exec("RESET ROLE");
  await db.query("UPDATE app_private.shopping_list_items SET transferred=true WHERE id=$1", [
    generated.id,
  ]);
  await actor(a);
  exported = await exportWeek([], state.week.revision);
  assert.equal(exported.items.length, 2);
  assert.equal(exported.items.find((i) => i.id === generated.id).transferred, true);
  // Archived generated rows remain historical; the next export starts an independent active list.
  exported = await exportWeek([{ ...line, id: crypto.randomUUID() }], state.week.revision);
  const archivedGenerated = exported.items.find((i) => i.id !== manual && i.id !== generated.id);
  const listRevision = await one(
    "SELECT revision::text FROM app_private.shopping_lists WHERE id=$1",
    [list],
  );
  await one("SELECT api.save_shopping_list($1,$2,'Archived','archived')", [list, listRevision]);
  exported = await exportWeek([{ ...line, id: crypto.randomUUID() }], state.week.revision);
  assert.equal(exported.items.length, 1);
  assert.equal(
    await one("SELECT count(*)::int FROM app_private.shopping_list_items WHERE id=$1", [
      archivedGenerated.id,
    ]),
    1,
  );
  // Parent and shopping limits roll back the complete transaction, including the marker/operation ledger.
  let crowded = await mutate(
    { kind: "configure", budget: null },
    "0",
    crypto.randomUUID(),
    "2026-11-23",
  );
  for (let i = 0; i < 56; i++)
    crowded = await mutate(
      {
        kind: "saveEntry",
        create: true,
        entry: {
          ...entry,
          id: crypto.randomUUID(),
          plannedOn: "2026-11-23",
          prepOn: null,
          slot: ["breakfast", "lunch", "dinner", "snack"][i % 4],
        },
      },
      crowded.week.revision,
      crypto.randomUUID(),
      "2026-11-23",
    );
  await assert.rejects(
    mutate(
      {
        kind: "saveEntry",
        create: true,
        entry: { ...entry, id: crypto.randomUUID(), plannedOn: "2026-11-23", prepOn: null },
      },
      crowded.week.revision,
      crypto.randomUUID(),
      "2026-11-23",
    ),
    (e) => e.code === "54000",
  );
  assert.deepEqual(await snapshot("2026-11-23"), crowded);
  await db.exec("RESET ROLE");
  await db.query(
    "INSERT INTO app_private.shopping_list_items(owner_id,shopping_list_id,label,origin) SELECT $1,l.id,'capacity '||g,'manual' FROM app_private.shopping_lists l,generate_series(1,499) g WHERE l.owner_id=$1 AND l.status='active'",
    [a],
  );
  await actor(a);
  const shoppingFull = await one("SELECT api.smart_shopping_snapshot()");
  const overflowOp = crypto.randomUUID();
  const overflowItems = [
    { ...line, id: crypto.randomUUID() },
    { ...line, id: crypto.randomUUID() },
  ];
  await assert.rejects(
    exportWeek(overflowItems, state.week.revision, overflowOp),
    (e) => e.code === "54000",
  );
  assert.deepEqual((await one("SELECT api.smart_shopping_snapshot()")).items, shoppingFull.items);
  const beforeRevision = state.week.revision;
  state = await mutate({ kind: "removeEntry", id: second.id }, beforeRevision);
  assert.ok(BigInt(state.week.revision) > BigInt(beforeRevision));
  assert.equal(
    state.week.exportedRevision,
    beforeRevision,
    "edits leave the old shopping marker stale",
  );
  assert.deepEqual(await one("SELECT api.get_my_pantry()"), pantry);
  assert.deepEqual(await one("SELECT api.get_recipe_actions('planner-fixture')"), history);
  await db.exec("RESET ROLE");
  await db.query("UPDATE app_private.recipes SET status='withdrawn' WHERE slug='planner-fixture'");
  await actor(a);
  assert.deepEqual(
    (await snapshot()).week.entries,
    [entry],
    "withdrawn pin remains visible by stored identifiers",
  );
  assert.deepEqual(await one("SELECT api.meal_planner_metadata()"), []);
  await assert.rejects(
    mutate({ kind: "copyWeek", targetStartsOn: "2026-11-16" }, state.week.revision),
    (e) => e.code === "P0002",
  );
  assert.equal((await snapshot("2026-11-16")).week.revision, "0");
  await assert.rejects(
    mutate({ kind: "saveEntry", create: false, entry }, state.week.revision),
    (e) => e.code === "P0002",
  );
  await db.exec("RESET ROLE");
  assert.equal(
    await one(
      "SELECT bool_and(relrowsecurity AND relforcerowsecurity) FROM pg_class WHERE oid IN ('app_private.meal_planner_operations'::regclass,'app_private.meal_planner_export_state'::regclass,'app_private.meal_planner_export_items'::regclass)",
    ),
    true,
  );
  assert.equal(
    await one(
      `SELECT bool_and(p.prosecdef AND r.rolname='cookly_api' AND p.proconfig @> ARRAY['search_path=""']) FROM pg_proc p JOIN pg_roles r ON r.oid=p.proowner WHERE p.pronamespace='api'::regnamespace AND p.proname LIKE 'meal_planner_%'`,
    ),
    true,
  );
});

test("planner migration backfills legacy withdrawn pins, preserves derived guards, and rejects metadata overflow", async (t) => {
  const db = await PGlite.create();
  t.after(() => db.close());
  for (const file of ["bootstrap.sql", "access-bootstrap.sql"])
    await db.exec(await readFile(new URL(file, import.meta.url), "utf8"));
  const dir = new URL("../../supabase/migrations/", import.meta.url);
  for (const name of (await readdir(dir))
    .filter((n) => n.endsWith(".sql") && n < "20261105000020")
    .sort())
    await db.transaction(async (tx) => tx.exec(await readFile(new URL(name, dir), "utf8")));
  const one = async (sql, args = []) => Object.values((await db.query(sql, args)).rows[0])[0];
  const actor = crypto.randomUUID();
  await db.query("INSERT INTO auth.users(id) VALUES($1)", [actor]);
  const rid = await one(
    "INSERT INTO app_private.recipes(slug) VALUES('legacy-planner') RETURNING id",
  );
  const vid = await one(
    "INSERT INTO app_private.recipe_versions(recipe_id,version_number,title,difficulty,active_minutes,total_minutes) VALUES($1,1,'Legacy planner','easy',1,2) RETURNING id",
    [rid],
  );
  await db.query(
    "INSERT INTO app_private.recipe_servings(recipe_version_id,base_servings) VALUES($1,2)",
    [vid],
  );
  await db.query(
    "INSERT INTO app_private.recipe_ingredients(recipe_version_id,ingredient_id,quantity,unit_id,position) SELECT $1,i.id,50,u.id,1 FROM app_private.ingredients i,app_private.units u WHERE i.slug='rosii' AND u.code='g'",
    [vid],
  );
  await db.query(
    "INSERT INTO app_private.recipe_steps(recipe_version_id,step_number,instruction) VALUES($1,1,'Prepare')",
    [vid],
  );
  await db.query("UPDATE app_private.recipe_versions SET status='published' WHERE id=$1", [vid]);
  await db.query(
    "UPDATE app_private.recipes SET status='published',current_version_id=$1 WHERE id=$2",
    [vid, rid],
  );
  const plan = await one(
    "INSERT INTO app_private.meal_plans(owner_id,starts_on) VALUES($1,'2026-11-02') RETURNING id",
    [actor],
  );
  const entry = await one(
    "INSERT INTO app_private.meal_plan_entries(owner_id,meal_plan_id,recipe_version_id,planned_on,meal_slot,servings) VALUES($1,$2,$3,'2026-11-02','breakfast',2) RETURNING id",
    [actor, plan, vid],
  );
  const list = await one(
    "INSERT INTO app_private.shopping_lists(owner_id) VALUES($1) RETURNING id",
    [actor],
  );
  const derived = await one(
    "INSERT INTO app_private.shopping_list_items(owner_id,shopping_list_id,label,ingredient_id,origin,quantity,unit_id) SELECT $1,$2,'Derived',i.id,'derived',50,u.id FROM app_private.ingredients i,app_private.units u WHERE i.slug='rosii' AND u.code='g' RETURNING id",
    [actor, list],
  );
  await db.query(
    "INSERT INTO app_private.shopping_list_item_sources(owner_id,shopping_list_item_id,meal_plan_entry_id,contributed_quantity,unit_id) SELECT $1,$2,$3,50,id FROM app_private.units WHERE code='g'",
    [actor, derived, entry],
  );
  await db.query("UPDATE app_private.recipes SET status='withdrawn' WHERE id=$1", [rid]);
  await db.transaction(async (tx) =>
    tx.exec(await readFile(new URL("20261105000020_meal_planner.sql", dir), "utf8")),
  );
  await db.query("SELECT set_config('request.jwt.claims',$1,false)", [
    JSON.stringify({ sub: actor, aal: "aal1" }),
  ]);
  await db.exec("SET ROLE authenticated");
  const snapshot = () => one("SELECT api.meal_planner_snapshot('2026-11-02')");
  const before = await snapshot();
  assert.equal(before.week.entries[0].recipeKey, "legacy-planner");
  assert.equal(before.week.entries[0].recipeRevision, 1);
  assert.equal(before.week.entries[0].versionId, vid);
  assert.equal(before.week.entries[0].prepOn, null);
  assert.equal(
    await one("SELECT count(*)::int FROM app_private.recipe_versions WHERE id=$1", [vid]),
    0,
    "old-version RLS is unchanged",
  );
  await db.exec("RESET ROLE");
  await db.query("UPDATE app_private.recipes SET status='published' WHERE id=$1", [rid]);
  await db.exec("SET ROLE authenticated");
  const mutate = (command) =>
    one("SELECT api.meal_planner_mutate('2026-11-02',$1,$2,$3::jsonb)", [
      before.week.revision,
      crypto.randomUUID(),
      JSON.stringify(command),
    ]);
  await assert.rejects(mutate({ kind: "removeEntry", id: entry }), (e) => e.code === "23514");
  await assert.rejects(
    mutate({ kind: "saveEntry", create: false, entry: { ...before.week.entries[0], servings: 3 } }),
    (e) => e.code === "23514",
  );
  assert.deepEqual(await snapshot(), before);
  const metadata = await one("SELECT api.meal_planner_metadata()");
  assert.equal(metadata[0].nutrition.status, "unavailable");
  assert.equal(fullNutritionSchema.safeParse(metadata[0].nutrition).success, true);
  await db.exec("RESET ROLE");
  await db.exec(`
    INSERT INTO app_private.recipes(slug) SELECT 'planner-capacity-'||g FROM generate_series(1,1000) g;
    INSERT INTO app_private.recipe_versions(recipe_id,version_number,title,difficulty,active_minutes,total_minutes) SELECT id,1,'Capacity','easy',1,2 FROM app_private.recipes WHERE slug LIKE 'planner-capacity-%';
    INSERT INTO app_private.recipe_servings(recipe_version_id,base_servings) SELECT v.id,2 FROM app_private.recipe_versions v JOIN app_private.recipes r ON r.id=v.recipe_id WHERE r.slug LIKE 'planner-capacity-%';
    INSERT INTO app_private.recipe_ingredients(recipe_version_id,ingredient_id,quantity,unit_id,position) SELECT v.id,i.id,1,u.id,1 FROM app_private.recipe_versions v JOIN app_private.recipes r ON r.id=v.recipe_id,app_private.ingredients i,app_private.units u WHERE r.slug LIKE 'planner-capacity-%' AND i.slug='rosii' AND u.code='g';
    INSERT INTO app_private.recipe_steps(recipe_version_id,step_number,instruction) SELECT v.id,1,'Prepare' FROM app_private.recipe_versions v JOIN app_private.recipes r ON r.id=v.recipe_id WHERE r.slug LIKE 'planner-capacity-%';
    UPDATE app_private.recipe_versions SET status='published' WHERE recipe_id IN (SELECT id FROM app_private.recipes WHERE slug LIKE 'planner-capacity-%');
    UPDATE app_private.recipes r SET status='published',current_version_id=v.id FROM app_private.recipe_versions v WHERE v.recipe_id=r.id AND r.slug LIKE 'planner-capacity-%';
  `);
  await db.exec("SET ROLE anon");
  await assert.rejects(one("SELECT api.meal_planner_metadata()"), (e) => e.code === "54000");
});
