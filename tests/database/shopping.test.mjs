import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

test("smart shopping preserves Cooking rows, isolates actors, validates exact merges and purchases atomically", async (t) => {
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
  const actor = async (id) => {
    await db.exec("RESET ROLE");
    await db.query("SELECT set_config('request.jwt.claims',$1,false)", [
      JSON.stringify({ sub: id, aal: "aal1" }),
    ]);
    await db.exec("SET ROLE authenticated");
  };
  const snapshot = () => one("SELECT api.smart_shopping_snapshot()");
  const mutate = (command, op = crypto.randomUUID()) =>
    one("SELECT api.smart_shopping_mutate($1,$2::jsonb)", [op, JSON.stringify(command)]);
  await db.exec("SET ROLE anon");
  const catalog = await one("SELECT api.smart_shopping_catalog()");
  assert.ok(catalog.length > 0 && catalog.length <= 1000);
  assert.ok(catalog.every((i) => i.active && Array.isArray(i.allowedUnits) && "categoryName" in i));
  await assert.rejects(snapshot(), (e) => e.code === "42501");
  await assert.rejects(mutate({ kind: "append", items: [] }), (e) => e.code === "42501");
  await actor(a);
  const ingredient = catalog.find((i) => i.slug === "rosii");
  const list = await one("SELECT api.save_shopping_list(NULL,NULL,'Cooking','active')");
  const legacy = await one(
    "SELECT api.save_shopping_item(NULL,NULL,$1,'Roșii',$2,'250',(SELECT id FROM app_private.units WHERE code='g'))",
    [list, ingredient.id],
  );
  assert.equal((await snapshot()).items[0].id, legacy);
  assert.equal((await snapshot()).items[0].category, ingredient.categoryName);
  const fields = {
    label: "Roșii",
    category: "Legume",
    quantity: "1",
    unitCode: "kg",
    checked: false,
    price: null,
    uncertain: false,
  };
  const input = (extra = {}) => ({
    id: crypto.randomUUID(),
    ingredientId: ingredient.id,
    ...fields,
    ...extra,
  });
  await mutate({ kind: "append", items: [input()] });
  let row = (await snapshot()).items[0];
  assert.equal((await snapshot()).items.length, 1);
  assert.equal(Number(row.quantity), 1250);
  assert.equal(row.unitCode, "g");
  assert.equal(row.ingredient.id, ingredient.id);
  await assert.rejects(
    mutate({ kind: "update", id: row.id, expectedRevision: "1", fields }),
    (e) => e.code === "40001",
  );
  const price = {
    amount: "25.50",
    currency: "MDL",
    basisQuantity: "1",
    basisUnit: "kg",
    observedOn: "2026-11-01",
  };
  await mutate({
    kind: "update",
    id: row.id,
    expectedRevision: row.revision,
    fields: { ...fields, quantity: "1250", unitCode: "g", price },
  });
  row = (await snapshot()).items[0];
  const before = await snapshot();
  await assert.rejects(
    mutate({
      kind: "append",
      items: [
        input({ ingredientId: null, label: "first" }),
        input({ price: { ...price, amount: "1.001" } }),
      ],
    }),
    (e) => e.code === "22023",
  );
  assert.deepEqual(await snapshot(), before, "invalid final append rolls back the batch");
  for (const bad of [
    { ...price, currency: "EUR" },
    { ...price, basisQuantity: "0" },
    { ...price, basisUnit: "piece", basisQuantity: "1.5" },
    { ...price, observedOn: "2026-02-30" },
    { ...price, ownerId: a },
  ])
    await assert.rejects(
      mutate({
        kind: "update",
        id: row.id,
        expectedRevision: row.revision,
        fields: { ...fields, price: bad },
      }),
    );
  const purchase = (lines) => ({
    kind: "purchase",
    confirmed: true,
    lines,
    location: "fridge",
    expiresOn: "2026-12-01",
  });
  const lot = crypto.randomUUID();
  await assert.rejects(
    mutate(purchase([{ id: row.id, expectedRevision: row.revision, pantryItemId: lot }])),
    (e) => e.code === "22023",
  );
  await actor(b);
  assert.deepEqual((await snapshot()).items, []);
  assert.equal(await one("SELECT count(*)::int FROM app_private.shopping_list_items"), 0);
  await assert.rejects(
    mutate({ kind: "remove", id: row.id, expectedRevision: row.revision }),
    (e) => e.code === "P0002",
  );
  await actor(a);
  await mutate({
    kind: "update",
    id: row.id,
    expectedRevision: row.revision,
    fields: { ...fields, quantity: "1250", unitCode: "g", checked: true, price },
  });
  row = (await snapshot()).items[0];
  const checkedId = crypto.randomUUID();
  await mutate({
    kind: "append",
    items: [input({ id: checkedId, quantity: "10", unitCode: "g", checked: true })],
  });
  assert.equal((await snapshot()).items.length, 2, "checked rows remain separate");
  const second = (await snapshot()).items.find((i) => i.id === checkedId);
  const secondLot = crypto.randomUUID();
  await assert.rejects(
    mutate(
      purchase([
        { id: row.id, expectedRevision: row.revision, pantryItemId: lot },
        { id: second.id, expectedRevision: "999", pantryItemId: secondLot },
      ]),
    ),
    (e) => e.code === "40001",
  );
  assert.equal(
    (await one("SELECT api.get_my_pantry()")).items.length,
    0,
    "failed second line leaves no partial pantry lot",
  );
  assert.equal((await snapshot()).items.filter((i) => i.transferred).length, 0);
  const command = purchase([
    { id: row.id, expectedRevision: row.revision, pantryItemId: lot },
    { id: second.id, expectedRevision: second.revision, pantryItemId: secondLot },
  ]);
  const op = crypto.randomUUID();
  await mutate(command, op);
  await mutate(command, op);
  assert.equal((await one("SELECT api.get_my_pantry()")).items.length, 2);
  assert.equal(
    Number((await one("SELECT api.get_my_pantry()")).items.find((i) => i.id === lot).quantity),
    1250,
  );
  assert.ok((await snapshot()).items.every((i) => i.transferred));
  await assert.rejects(mutate({ ...command, location: "pantry" }, op), (e) => e.code === "22023");
  row = (await snapshot()).items.find((i) => i.id === row.id);
  await assert.rejects(
    mutate(
      purchase([{ id: row.id, expectedRevision: row.revision, pantryItemId: crypto.randomUUID() }]),
    ),
    (e) => e.code === "22023",
  );
  await assert.rejects(
    mutate({ kind: "update", id: row.id, expectedRevision: row.revision, fields }),
    (e) => e.code === "42501",
  );
  await mutate({ kind: "remove", id: row.id, expectedRevision: row.revision });
  assert.equal((await snapshot()).items.length, 1);
  await db.exec("RESET ROLE");
  await db.query(
    "INSERT INTO app_private.units(code,name,dimension,to_base_factor) VALUES('cup_legacy','Legacy cup','volume',250)",
  );
  await db.query(
    "INSERT INTO app_private.shopping_list_items(owner_id,shopping_list_id,label,origin,quantity,unit_id) SELECT $1,$2,'Old unit','manual',1,id FROM app_private.units WHERE code NOT IN ('g','kg','ml','l','piece') LIMIT 1",
    [a, list],
  );
  await actor(a);
  const unknown = (await snapshot()).items.find((i) => i.label === "Old unit");
  assert.ok(unknown && unknown.quantity === null && unknown.unitCode === null && unknown.uncertain);
  // Exact conversion falls back to an allowed base unit, never rounded kilograms.
  const precise = input({ quantity: "0.001", unitCode: "kg" });
  await mutate({ kind: "append", items: [precise] });
  await mutate({ kind: "append", items: [input({ quantity: "0.000001", unitCode: "g" })] });
  const preciseRow = (await snapshot()).items.find((i) => i.id === precise.id);
  assert.equal(preciseRow.unitCode, "g");
  assert.equal(Number(preciseRow.quantity), 1.000001);
  const liquid = catalog.find((i) => i.allowedUnits.includes("ml") && i.allowedUnits.includes("l"));
  assert.ok(liquid);
  const liquidRow = input({ ingredientId: liquid.id, quantity: "0.5", unitCode: "l" });
  await mutate({ kind: "append", items: [liquidRow] });
  await mutate({
    kind: "append",
    items: [input({ ingredientId: liquid.id, quantity: "250", unitCode: "ml" })],
  });
  assert.equal(Number((await snapshot()).items.find((i) => i.id === liquidRow.id).quantity), 0.75);
  const pricedIngredient = catalog.find(
    (i) =>
      i.id !== ingredient.id &&
      i.id !== liquid.id &&
      i.allowedUnits.includes("g") &&
      i.allowedUnits.includes("kg"),
  );
  assert.ok(pricedIngredient);
  const pricedRow = input({ ingredientId: pricedIngredient.id, quantity: "500", unitCode: "g" });
  await mutate({ kind: "append", items: [pricedRow] });
  const enteredPrice = { ...price, amount: "20" };
  await mutate({
    kind: "append",
    items: [
      input({
        ingredientId: pricedIngredient.id,
        quantity: "500",
        unitCode: "g",
        price: enteredPrice,
      }),
    ],
  });
  let pricedMerged = (await snapshot()).items.find((i) => i.id === pricedRow.id);
  assert.equal(Number(pricedMerged.quantity), 1000);
  assert.deepEqual(
    pricedMerged.price,
    enteredPrice,
    "entered incoming rate applies to combined quantity",
  );
  const latestPrice = { ...price, amount: "22" };
  await mutate({
    kind: "append",
    items: [
      input({
        ingredientId: pricedIngredient.id,
        quantity: "100",
        unitCode: "g",
        price: latestPrice,
      }),
    ],
  });
  assert.deepEqual(
    (await snapshot()).items.find((i) => i.id === pricedRow.id).price,
    latestPrice,
    "latest explicitly entered rate replaces previous rate",
  );
  await mutate({
    kind: "append",
    items: [
      input({ ingredientId: pricedIngredient.id, quantity: "100", unitCode: "g", price: null }),
    ],
  });
  pricedMerged = (await snapshot()).items.find((i) => i.id === pricedRow.id);
  assert.equal(Number(pricedMerged.quantity), 1200);
  assert.deepEqual(pricedMerged.price, latestPrice, "null incoming price preserves existing rate");
  assert.equal(pricedMerged.checked, false);
  assert.equal(pricedMerged.transferred, false);
  const free = [
    input({ ingredientId: null, label: "Pâine", quantity: null, unitCode: null }),
    input({ ingredientId: null, label: "Pâine", quantity: null, unitCode: null }),
  ];
  await mutate({ kind: "append", items: free });
  assert.equal((await snapshot()).items.filter((i) => i.label === "Pâine").length, 2);
  await assert.rejects(
    mutate({ kind: "append", items: [input({ quantity: "0.1", unitCode: "piece" })] }),
    (e) => e.code === "22023",
  );
  const current = (await snapshot()).items.find((i) => i.id === precise.id);
  await assert.rejects(
    mutate({ kind: "append", items: [input({ quantity: "999999999999", unitCode: "kg" })] }),
    (e) => e.code === "22023",
  );
  assert.deepEqual(
    (await snapshot()).items.find((i) => i.id === precise.id),
    current,
  );
  await assert.rejects(
    mutate({ kind: "remove", id: free[0].id, expectedRevision: "1", ownerId: b }),
    (e) => e.code === "22023",
  );
  const future = input({
    ingredientId: null,
    label: "Viitor",
    quantity: null,
    unitCode: null,
    price: { ...price, observedOn: "2099-01-01" },
  });
  await mutate({ kind: "append", items: [future] });
  assert.deepEqual((await snapshot()).items.find((i) => i.id === future.id).price, future.price);
  await db.exec("RESET ROLE");
  assert.equal(
    await one(
      "SELECT bool_and(relrowsecurity AND relforcerowsecurity) FROM pg_class WHERE oid IN ('app_private.shopping_lists'::regclass,'app_private.shopping_list_items'::regclass,'app_private.smart_shopping_operations'::regclass)",
    ),
    true,
  );
  assert.equal(
    await one(
      `SELECT bool_and(p.prosecdef AND r.rolname='cookly_api' AND p.proconfig @> ARRAY['search_path=""']) FROM pg_proc p JOIN pg_roles r ON r.oid=p.proowner WHERE p.pronamespace='api'::regnamespace AND p.proname IN ('smart_shopping_catalog','smart_shopping_snapshot','smart_shopping_mutate')`,
    ),
    true,
  );
  await actor(a);
  await assert.rejects(
    one("SELECT * FROM app_private.smart_shopping_operations"),
    (e) => e.code === "42501",
  );
  await db.exec("RESET ROLE");
  await db.query(
    "INSERT INTO app_private.shopping_list_items(owner_id,shopping_list_id,label,origin) SELECT $1,$2,'capacity '||g,'manual' FROM generate_series(1,500-(SELECT count(*)::int FROM app_private.shopping_list_items WHERE owner_id=$1)) g",
    [a, list],
  );
  await actor(a);
  assert.equal((await snapshot()).items.length, 500);
  await assert.rejects(
    mutate({
      kind: "append",
      items: [input({ ingredientId: null, quantity: null, unitCode: null })],
    }),
    (e) => e.code === "54000",
  );
  assert.equal(
    (await snapshot()).items.length,
    500,
    "append beyond capacity rolls back the inserted row",
  );
  assert.equal(
    await one("SELECT count(*)::int FROM app_private.shopping_list_items WHERE owner_id=$1", [a]),
    500,
  );
  await db.exec("RESET ROLE");
  await db.query(
    "INSERT INTO app_private.shopping_list_items(owner_id,shopping_list_id,label,origin) VALUES($1,$2,'Existing overflow','manual')",
    [a, list],
  );
  await actor(a);
  await assert.rejects(snapshot(), (e) => e.code === "54000");
  await db.exec("RESET ROLE");
  await db.query(
    "INSERT INTO app_private.ingredients(slug,name) SELECT 'catalog-capacity-'||g,'Catalog capacity '||g FROM generate_series(1,1001-(SELECT count(*)::int FROM app_private.ingredients WHERE is_active)) g",
  );
  await db.exec("SET ROLE anon");
  await assert.rejects(one("SELECT api.smart_shopping_catalog()"), (e) => e.code === "54000");
});
