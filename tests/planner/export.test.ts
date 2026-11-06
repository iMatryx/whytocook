import assert from "node:assert/strict";
import { test } from "node:test";
import {
  mutateLocalPlanner,
  exportLocalPlanner,
  loadLocalPlanner,
  recoverPlannerExport,
  plannerJournalKey,
} from "../../src/components/planner/local-planner.ts";
import {
  readShopping,
  shoppingKey,
} from "../../src/features/shopping/presentation/shopping-storage.ts";
import type { ShoppingItem } from "../../src/features/shopping/contracts/index.ts";
const day = "2026-11-02";
function fixture() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      data.set(k, v);
    },
    removeItem: (k: string) => {
      data.delete(k);
    },
  };
}
const row = (): ShoppingItem => ({
  id: crypto.randomUUID(),
  revision: "1",
  ingredient: null,
  label: "Fixture",
  category: "Altele",
  quantity: "100",
  unitCode: "g",
  checked: false,
  price: null,
  transferred: false,
  uncertain: false,
});
test("planner export replaces unchanged own rows, preserves manual rows and detects user edits", () => {
  const s = fixture(),
    manual = row();
  s.setItem(
    shoppingKey,
    JSON.stringify({
      version: 1,
      revision: "1",
      items: [manual],
      importedLegacyIds: [],
      operations: [],
    }),
  );
  const w = mutateLocalPlanner(
      s,
      day,
      "demo",
      { kind: "configure", budget: null },
      "0",
      crypto.randomUUID(),
      [],
    ),
    first = row(),
    op = crypto.randomUUID();
  exportLocalPlanner(s, day, "demo", w.revision, op, [first]);
  exportLocalPlanner(s, day, "demo", w.revision, op, [first]);
  assert.equal(readShopping(s.getItem(shoppingKey)).items.length, 2);
  const second = row();
  exportLocalPlanner(s, day, "demo", w.revision, crypto.randomUUID(), [second]);
  const list = readShopping(s.getItem(shoppingKey));
  assert.deepEqual(
    list.items.map((i) => i.id),
    [manual.id, second.id],
  );
  list.items[1]!.checked = true;
  list.items[1]!.revision = "2";
  s.setItem(shoppingKey, JSON.stringify(list));
  const before = s.getItem(shoppingKey);
  assert.throws(
    () => exportLocalPlanner(s, day, "demo", w.revision, crypto.randomUUID(), []),
    /editate sau bifate/,
  );
  assert.equal(s.getItem(shoppingKey), before);
});
test("planner export journal recovers a two-key interruption without duplicating rows", () => {
  const s = fixture();
  const w = mutateLocalPlanner(
      s,
      day,
      "demo",
      { kind: "configure", budget: null },
      "0",
      crypto.randomUUID(),
      [],
    ),
    write = s.setItem;
  let fail = true;
  const store = {
    ...s,
    setItem: (k: string, v: string) => {
      if (fail && k === shoppingKey) throw new Error("Quota");
      write(k, v);
    },
  };
  assert.throws(() =>
    exportLocalPlanner(store, day, "demo", w.revision, crypto.randomUUID(), [row()]),
  );
  assert.ok(s.getItem(plannerJournalKey));
  fail = false;
  recoverPlannerExport(store);
  assert.equal(loadLocalPlanner(store, day, "demo").exportedRevision, w.revision);
  assert.equal(readShopping(s.getItem(shoppingKey)).items.length, 1);
  assert.equal(s.getItem(plannerJournalKey), null);
});
test("guest export rejects an inventory preview that differs from storage before writing", () => {
  const s = fixture();
  const week = mutateLocalPlanner(
    s,
    day,
    "demo",
    { kind: "configure", budget: null },
    "0",
    crypto.randomUUID(),
    [],
  );
  assert.throws(
    () =>
      exportLocalPlanner(
        s,
        day,
        "demo",
        week.revision,
        crypto.randomUUID(),
        [row()],
        [{ id: "old-lot", ingredientSlug: "rosii", quantity: "100", unit: "g", expiresOn: null }],
      ),
    /Inventarul s-a schimbat/,
  );
  assert.equal(s.getItem(shoppingKey), null);
  assert.equal(loadLocalPlanner(s, day, "demo").exportedRevision, null);
});
