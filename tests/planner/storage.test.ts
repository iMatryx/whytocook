import assert from "node:assert/strict";
import { test } from "node:test";
import {
  emptyPlanner,
  applyPlanner,
  copyPlanner,
  readPlanner,
} from "../../src/features/meal-planner/presentation/planner-storage.ts";
import type { PlannerRecipe } from "../../src/features/meal-planner/contracts/index.ts";
const recipe = { key: "salata", versionId: null, revision: 1 } as PlannerRecipe;
const entry = {
  id: crypto.randomUUID(),
  recipeKey: "salata",
  recipeRevision: 1,
  versionId: null,
  plannedOn: "2026-11-05",
  slot: "lunch" as const,
  servings: 2,
  prepOn: "2026-11-04",
  costPerServing: { amount: "10", currency: "MDL" as const, observedOn: "2026-11-05" },
};
test("planner add, move, portions, replay and stale edits preserve unrelated entries", () => {
  const initial = emptyPlanner("2026-11-02"),
    op = crypto.randomUUID(),
    command = { kind: "saveEntry" as const, create: true, entry };
  const added = applyPlanner(initial, command, "0", op, [recipe]);
  assert.equal(added.week.entries.length, 1);
  assert.deepEqual(applyPlanner(added, command, "0", op, [recipe]), added);
  assert.throws(() =>
    applyPlanner(added, { kind: "removeEntry", id: entry.id }, "0", crypto.randomUUID(), [recipe]),
  );
  const changed = applyPlanner(
    added,
    {
      kind: "saveEntry",
      create: false,
      entry: { ...entry, plannedOn: "2026-11-08", slot: "dinner", servings: 3 },
    },
    added.week.revision,
    crypto.randomUUID(),
    [recipe],
  );
  assert.equal(changed.week.entries[0]!.servings, 3);
  assert.equal(initial.week.entries.length, 0);
});
test("copy shifts calendar dates with new IDs while retaining quote dates and budget", () => {
  const configured = applyPlanner(
    emptyPlanner("2026-11-02"),
    { kind: "configure", budget: { amount: "100", currency: "MDL" } },
    "0",
    crypto.randomUUID(),
    [recipe],
  );
  const state = applyPlanner(
    configured,
    { kind: "saveEntry", create: true, entry },
    configured.week.revision,
    crypto.randomUUID(),
    [recipe],
  );
  const copy = copyPlanner(state, "2026-11-09", state.week.revision, crypto.randomUUID(), [recipe]);
  assert.equal(copy.week.entries[0]!.plannedOn, "2026-11-12");
  assert.equal(copy.week.entries[0]!.prepOn, "2026-11-11");
  assert.notEqual(copy.week.entries[0]!.id, entry.id);
  assert.equal(copy.week.entries[0]!.costPerServing?.observedOn, "2026-11-05");
  assert.equal(copy.week.budget?.amount, "100");
  assert.equal(state.week.entries[0]!.plannedOn, "2026-11-05");
});
test("invalid dates/prep, withdrawn pins and corrupt storage cannot create a valid local week", () => {
  const state = emptyPlanner("2026-11-02");
  assert.throws(() =>
    applyPlanner(
      state,
      { kind: "saveEntry", create: true, entry: { ...entry, prepOn: "2026-11-06" } },
      "0",
      crypto.randomUUID(),
      [recipe],
    ),
  );
  assert.throws(() =>
    applyPlanner(state, { kind: "saveEntry", create: true, entry }, "0", crypto.randomUUID(), []),
  );
  assert.throws(() => readPlanner("broken", "2026-11-02"));
});
