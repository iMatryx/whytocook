import assert from "node:assert/strict";
import { test } from "node:test";
import {
  readLocalActions,
  writeLocalAction,
  localRecipeActionsKey,
} from "../../src/features/recipes/presentation/recipe-actions-storage.ts";
import { writeLocalOrganization } from "../../src/features/recipes/presentation/organization-storage.ts";
const at = "2026-11-03T12:00:00Z";
const id = "00000000-0000-4000-8000-000000000001";
function fixture() {
  let raw: string | null = null;
  const storage = {
    getItem: () => raw,
    setItem: (_: string, value: string) => {
      raw = value;
    },
  };
  const run = (command: unknown) => writeLocalOrganization(storage, storage.getItem(), command);
  return { storage, run };
}
test("v1 guest actions migrate without losing favorites, shopping or cooked entries", () => {
  const { storage, run } = fixture();
  storage.setItem(
    localRecipeActionsKey,
    JSON.stringify({
      version: 1,
      revision: 2,
      favorites: ["demo:terci"],
      cooked: [{ recipeKey: "demo:terci", at, servings: 2 }],
      shopping: [
        {
          id: "shopping-1",
          recipeKey: "demo:terci",
          ingredientSlug: "mar",
          label: "Măr",
          quantity: "50",
          unitCode: "g",
        },
      ],
      operations: [],
    }),
  );
  const before = readLocalActions(storage);
  run({ kind: "saveCollection", create: true, id, name: "  Fitness   rapid " });
  const after = readLocalActions(storage);
  assert.deepEqual(after.cooked, before.cooked);
  assert.deepEqual(after.shopping, before.shopping);
  assert.deepEqual(after.favorites, ["demo:terci"]);
  assert.equal(after.collections[0]?.name, "Fitness rapid");
});
test("renames preserve collection membership and create retries cannot overwrite it", () => {
  const { storage, run } = fixture();
  const create = { kind: "saveCollection", create: true, id, name: "Fitness" };
  run(create);
  run({ kind: "membership", id, recipeKey: "demo:terci", enabled: true });
  run(create);
  run({ kind: "saveCollection", create: false, id, name: "Rapid" });
  const state = readLocalActions(storage);
  assert.deepEqual(state.collections, [{ id, name: "Rapid", recipeKeys: ["demo:terci"] }]);
  const before = storage.getItem();
  assert.throws(() => run(create), /deja folosit/);
  assert.equal(storage.getItem(), before);
});
test("collections prevent duplicate names and memberships and remain independent of favorites", () => {
  const { storage, run } = fixture();
  run({ kind: "saveCollection", create: true, id, name: "Fitness" });
  assert.throws(() =>
    run({ kind: "saveCollection", create: true, id: crypto.randomUUID(), name: " fitness " }),
  );
  run({ kind: "membership", id, recipeKey: "demo:terci", enabled: true });
  run({ kind: "membership", id, recipeKey: "demo:terci", enabled: true });
  run({ kind: "favorite", recipeKey: "demo:terci", enabled: false });
  assert.deepEqual(readLocalActions(storage).collections[0]?.recipeKeys, ["demo:terci"]);
  run({ kind: "deleteCollection", id });
  assert.equal(readLocalActions(storage).collections.length, 0);
});
test("clear history preserves favorites/shopping and replay cannot restore erased cooking", () => {
  const { storage, run } = fixture();
  writeLocalAction(storage, null, "demo:terci", "cook", { kind: "cooked", servings: 2 }, at);
  run({ kind: "favorite", recipeKey: "demo:terci", enabled: true });
  run({ kind: "clearHistory" });
  writeLocalAction(
    storage,
    storage.getItem(),
    "demo:terci",
    "cook",
    { kind: "cooked", servings: 2 },
    at,
  );
  assert.deepEqual(readLocalActions(storage).cooked, []);
  assert.deepEqual(readLocalActions(storage).favorites, ["demo:terci"]);
});
test("stale writes, corrupt storage, invalid names and invalid links never overwrite stored data", () => {
  const { storage, run } = fixture();
  assert.throws(() => run({ kind: "saveCollection", create: true, id, name: "  " }));
  assert.throws(() => run({ kind: "favorite", recipeKey: "javascript:alert(1)", enabled: true }));
  run({ kind: "saveCollection", create: true, id, name: "Rapid" });
  assert.throws(() => writeLocalOrganization(storage, null, { kind: "clearHistory" }));
  storage.setItem(localRecipeActionsKey, "broken");
  assert.throws(() => run({ kind: "clearHistory" }));
  assert.equal(storage.getItem(), "broken");
});
test("a stale rename cannot recreate a deleted collection", () => {
  const { storage, run } = fixture();
  run({ kind: "saveCollection", create: true, id, name: "Fitness" });
  run({ kind: "membership", id, recipeKey: "demo:terci", enabled: true });
  run({ kind: "deleteCollection", id });
  const before = storage.getItem();
  assert.throws(() => run({ kind: "saveCollection", create: false, id, name: "Renamed" }));
  assert.equal(storage.getItem(), before);
});
test("canonically equivalent Unicode collection names cannot create duplicates", () => {
  const { storage, run } = fixture();
  run({ kind: "saveCollection", create: true, id, name: "Café" });
  assert.throws(() =>
    run({ kind: "saveCollection", create: true, id: crypto.randomUUID(), name: "Cafe\u0301" }),
  );
  assert.equal(readLocalActions(storage).collections.length, 1);
});
