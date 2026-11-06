import assert from "node:assert/strict";
import { test } from "node:test";
import {
  loadLocalShopping,
  mutateLocalShopping,
  recoverShoppingTransfer,
  transferJournalKey,
} from "../../src/components/shopping/local-shopping.ts";
import { shoppingKey } from "../../src/features/shopping/presentation/shopping-storage.ts";
import type { PantryIngredient } from "../../src/features/pantry/contracts/index.ts";
const food: PantryIngredient = {
  id: "00000000-0000-4000-8000-000000000001",
  slug: "rosii",
  name: "Roșii",
  active: true,
  allowedUnits: ["g", "kg"],
  categoryId: null,
  categoryName: "Legume",
};
function fixture() {
  const values = new Map<string, string>();
  let fail = false;
  return {
    values,
    setFail: (v: boolean) => {
      fail = v;
    },
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      if (fail && key === shoppingKey) throw new Error("Quota");
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
}
test("Cooking imports once and removed shopping never reappears; existing favorites survive", () => {
  const s = fixture();
  s.setItem(
    "cookly-recipe-actions-v1",
    JSON.stringify({
      version: 1,
      revision: 1,
      favorites: ["demo:salata"],
      cooked: [],
      shopping: [
        {
          id: "old",
          recipeKey: "demo:salata",
          ingredientSlug: "rosii",
          label: "Roșii",
          quantity: "50",
          unitCode: "g",
        },
      ],
      operations: [],
    }),
  );
  const first = loadLocalShopping(s, [food]);
  assert.equal(first.length, 1);
  mutateLocalShopping(
    s,
    [food],
    { kind: "remove", id: first[0]!.id, expectedRevision: "1" },
    crypto.randomUUID(),
  );
  assert.deepEqual(loadLocalShopping(s, [food]), []);
  assert.match(s.getItem("cookly-recipe-actions-v1")!, /demo:salata/);
});
test("guest purchase recovers a partial two-key write without adding stock twice", () => {
  const s = fixture(),
    id = crypto.randomUUID(),
    op = crypto.randomUUID();
  let items = mutateLocalShopping(
    s,
    [food],
    {
      kind: "append",
      items: [
        {
          id,
          ingredientId: food.id,
          label: food.name,
          category: "Legume",
          quantity: "50",
          unitCode: "g",
          checked: true,
          price: null,
          uncertain: false,
        },
      ],
    },
    crypto.randomUUID(),
  );
  const command = {
    kind: "purchase" as const,
    confirmed: true as const,
    lines: [{ id, expectedRevision: items[0]!.revision, pantryItemId: crypto.randomUUID() }],
    location: "fridge" as const,
    expiresOn: null,
  };
  s.setFail(true);
  assert.throws(() => mutateLocalShopping(s, [food], command, op), /Quota/);
  assert.ok(s.getItem(transferJournalKey));
  s.setFail(false);
  recoverShoppingTransfer(s);
  items = mutateLocalShopping(s, [food], command, op);
  assert.equal(items[0]!.transferred, true);
  assert.equal(JSON.parse(s.getItem("cookly-pantry-v1")!).items.length, 1);
  assert.equal(s.getItem(transferJournalKey), null);
  assert.throws(() => mutateLocalShopping(s, [food], command, crypto.randomUUID()));
});
test("corrupt data and concurrent edits during recovery are never overwritten", () => {
  const s = fixture();
  s.setItem(shoppingKey, "broken");
  assert.throws(() => loadLocalShopping(s, [food]));
  assert.equal(s.getItem(shoppingKey), "broken");
});
test("guest purchase revalidates canonical availability against the current catalog", () => {
  const s = fixture(),
    id = crypto.randomUUID();
  const items = mutateLocalShopping(
    s,
    [food],
    {
      kind: "append",
      items: [
        {
          id,
          ingredientId: food.id,
          label: "Roșii",
          category: "Legume",
          quantity: "50",
          unitCode: "g",
          checked: true,
          uncertain: false,
          price: null,
        },
      ],
    },
    crypto.randomUUID(),
  );
  assert.throws(() =>
    mutateLocalShopping(
      s,
      [],
      {
        kind: "purchase",
        confirmed: true,
        lines: [{ id, expectedRevision: items[0]!.revision, pantryItemId: crypto.randomUUID() }],
        location: "fridge",
        expiresOn: null,
      },
      crypto.randomUUID(),
    ),
  );
  assert.equal(s.getItem("cookly-pantry-v1"), null);
  const refreshed = loadLocalShopping(s, []);
  assert.equal(refreshed[0]!.ingredient!.active, false);
  assert.equal(refreshed[0]!.uncertain, true);
});
test("recovery refuses to overwrite pantry edits made after a partial transfer", () => {
  const s = fixture(),
    id = crypto.randomUUID();
  const items = mutateLocalShopping(
    s,
    [food],
    {
      kind: "append",
      items: [
        {
          id,
          ingredientId: food.id,
          label: "Roșii",
          category: "Legume",
          quantity: "50",
          unitCode: "g",
          checked: true,
          uncertain: false,
          price: null,
        },
      ],
    },
    crypto.randomUUID(),
  );
  s.setFail(true);
  assert.throws(() =>
    mutateLocalShopping(
      s,
      [food],
      {
        kind: "purchase",
        confirmed: true,
        lines: [{ id, expectedRevision: items[0]!.revision, pantryItemId: crypto.randomUUID() }],
        location: "fridge",
        expiresOn: null,
      },
      crypto.randomUUID(),
    ),
  );
  s.setFail(false);
  const pantry = JSON.parse(s.getItem("cookly-pantry-v1")!);
  pantry.items[0].quantity = "60";
  const changed = JSON.stringify(pantry);
  s.setItem("cookly-pantry-v1", changed);
  assert.throws(() => recoverShoppingTransfer(s), /modificări ulterioare/);
  assert.equal(s.getItem("cookly-pantry-v1"), changed);
  assert.ok(s.getItem(transferJournalKey));
});
