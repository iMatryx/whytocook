import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

test("My Fridge commands enforce ownership, safe units, atomic confirmation and replay", async (suite) => {
  const db = await PGlite.create();
  suite.after(() => db.close());
  for (const file of ["bootstrap.sql", "access-bootstrap.sql"])
    await db.exec(await readFile(new URL(file, import.meta.url), "utf8"));
  const directory = new URL("../../supabase/migrations/", import.meta.url);
  for (const name of (await readdir(directory)).filter((name) => name.endsWith(".sql")).sort())
    await db.transaction(async (tx) => tx.exec(await readFile(new URL(name, directory), "utf8")));
  const a = "00000000-0000-4000-8000-000000000001",
    b = "00000000-0000-4000-8000-000000000002",
    id = "30000000-0000-4000-8000-000000000001",
    second = "30000000-0000-4000-8000-000000000002";
  await db.query("INSERT INTO auth.users(id) VALUES($1),($2)", [a, b]);
  async function actor(id, role = "authenticated") {
    await db.exec("RESET ROLE");
    await db.query("SELECT set_config('request.jwt.claims',$1,false)", [
      JSON.stringify({ sub: id, aal: "aal1" }),
    ]);
    await db.exec(`SET ROLE ${role}`);
  }
  async function snapshot() {
    return (await db.query("SELECT api.get_my_pantry() AS data")).rows[0].data;
  }
  async function command(value, operationId = crypto.randomUUID()) {
    return (
      await db.query("SELECT api.mutate_my_pantry($1,$2::jsonb) AS data", [
        operationId,
        JSON.stringify(value),
      ])
    ).rows[0].data;
  }
  await actor(null, "anon");
  await assert.rejects(snapshot(), (e) => e.code === "42501");
  await actor(a);
  assert.equal((await snapshot()).items.length, 0);
  const ingredient = (await db.query("SELECT id FROM api.ingredients WHERE slug='rosii'")).rows[0]
    .id;
  const create = {
    kind: "create",
    id,
    ingredientId: ingredient,
    quantity: "1",
    unitCode: "kg",
    location: "fridge",
    expiresOn: "2026-11-04",
  };
  const createOp = crypto.randomUUID();
  await command(create, createOp);
  await command(create, createOp);
  assert.equal((await snapshot()).items.length, 1);
  await assert.rejects(command({ ...create, quantity: "2" }, createOp), (e) => e.code === "22023");
  await suite.test("other account cannot inspect, edit, delete or consume a lot", async () => {
    await actor(b);
    assert.equal((await snapshot()).items.length, 0);
    await assert.rejects(
      command({ kind: "delete", id, expectedRevision: "1" }),
      (e) => e.code === "P0002",
    );
    await assert.rejects(
      command({ ...create, kind: "update", expectedRevision: "1" }),
      (e) => e.code === "P0002",
    );
    await assert.rejects(
      command({
        kind: "consume",
        confirmed: true,
        lines: [{ itemId: id, expectedRevision: "1", quantity: "1", unitCode: "g" }],
      }),
      (e) => e.code === "P0002",
    );
    assert.equal((await db.query("SELECT count(*)::int AS n FROM api.my_pantry")).rows[0].n, 0);
    await actor(a);
  });
  await suite.test(
    "safe conversion and explicit confirmation; failed batches roll back fully",
    async () => {
      await command({ ...create, id: second, quantity: null, unitCode: null, expiresOn: null });
      const lines = [{ itemId: id, expectedRevision: "1", quantity: "250", unitCode: "g" }];
      await assert.rejects(
        command({ kind: "consume", lines, confirmed: false }),
        (e) => e.code === "22023",
      );
      await assert.rejects(
        command({
          kind: "consume",
          confirmed: true,
          lines: [
            ...lines,
            { itemId: second, expectedRevision: "1", quantity: "1", unitCode: "g" },
          ],
        }),
        (e) => e.code === "22023",
      );
      assert.equal((await snapshot()).items.find((item) => item.id === id).quantity, "1.000000");
      const operation = crypto.randomUUID();
      await command({ kind: "consume", confirmed: true, lines }, operation);
      await command({ kind: "consume", confirmed: true, lines }, operation);
      let item = (await snapshot()).items.find((item) => item.id === id);
      assert.equal(item.quantity, "0.750000");
      assert.equal(item.revision, "2");
      await assert.rejects(
        command({ kind: "consume", confirmed: true, lines }),
        (e) => e.code === "40001",
      );
      await assert.rejects(
        command({
          kind: "consume",
          confirmed: true,
          lines: [{ ...lines[0], expectedRevision: "2", quantity: "751" }],
        }),
        (e) => e.code === "P0001",
      );
      await assert.rejects(
        command({
          kind: "consume",
          confirmed: true,
          lines: [{ ...lines[0], expectedRevision: "2", unitCode: "ml" }],
        }),
        (e) => e.code === "22023",
      );
    },
  );
  await suite.test(
    "CRUD validates catalog units, dates, fractions and stale revisions",
    async () => {
      for (const patch of [
        { unitCode: "ml" },
        { quantity: "NaN" },
        { quantity: "0.5", unitCode: "piece" },
        { expiresOn: "2026-02-30" },
        { quantity: null },
      ])
        await assert.rejects(command({ ...create, id: crypto.randomUUID(), ...patch }), (e) =>
          e.code.startsWith("22"),
        );
      await command({
        ...create,
        kind: "update",
        expectedRevision: "2",
        quantity: "500",
        unitCode: "g",
        location: "freezer",
        expiresOn: null,
      });
      await assert.rejects(
        command({ ...create, kind: "update", expectedRevision: "2" }),
        (e) => e.code === "40001",
      );
      const item = (await snapshot()).items.find((item) => item.id === id);
      assert.equal(item.location, "freezer");
      assert.equal(item.quantity, "500.000000");
      await db.exec("RESET ROLE");
      await db.query("UPDATE app_private.ingredients SET is_active=false WHERE id=$1", [
        ingredient,
      ]);
      await actor(a);
      await command({
        ...create,
        kind: "update",
        expectedRevision: "3",
        quantity: "500",
        unitCode: "g",
        location: "pantry",
      });
      assert.equal((await snapshot()).items.find((item) => item.id === id).quantity, "500.000000");
      await command({ kind: "delete", id, expectedRevision: "4" });
      assert.equal((await snapshot()).items.length, 1);
      await db.exec("RESET ROLE");
      await db.query(
        "UPDATE app_private.account_states SET status='disabled' WHERE profile_id=$1",
        [a],
      );
      await actor(a);
      await assert.rejects(snapshot(), (e) => e.code === "42501");
    },
  );
});
