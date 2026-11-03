import assert from "node:assert/strict";
import { test } from "node:test";
import { convertQuantity } from "../../src/shared/domain/quantity.ts";
import { expiryStatus } from "../../src/shared/domain/expiry.ts";
import { pantryCommandSchema } from "../../src/features/pantry/contracts/pantry.schema.ts";
import {
  applyGuestCommand,
  previewConsumption,
  filterPantry,
} from "../../src/features/pantry/presentation/pantry-model.ts";
import {
  readGuest,
  writeGuestCommand,
} from "../../src/features/pantry/presentation/guest-storage.ts";

const id = "10000000-0000-4000-8000-000000000002";
const second = "10000000-0000-4000-8000-000000000003";
const ingredient = {
  id,
  name: "Roșii",
  slug: "rosii",
  categoryId: second,
  categoryName: "Legume",
  active: true,
  allowedUnits: ["g", "kg", "piece"] as ("g" | "kg" | "piece")[],
};
const row = {
  id,
  ingredient,
  quantity: "1",
  unitCode: "kg",
  location: "fridge" as const,
  expiresOn: "2026-11-04",
  revision: "1",
  createdAt: "2026-11-01T00:00:00.000Z",
  updatedAt: "2026-11-01T00:00:00.000Z",
};
const state = { version: 1 as const, revision: "1", items: [row], operations: [] };
const op = "20000000-0000-4000-8000-000000000002";
test("unit conversion is exact and refuses cross-dimension, fractions of a piece and rounding", () => {
  assert.equal(convertQuantity("0.125", "kg", "g"), "125");
  assert.equal(convertQuantity("125", "g", "kg"), "0.125");
  assert.equal(convertQuantity("0.1", "l", "ml"), "100");
  assert.equal(convertQuantity("0", "g", "kg"), "0");
  for (const [q, from, to] of [
    ["1", "g", "ml"],
    ["1", "piece", "g"],
    ["0.5", "piece", "piece"],
    ["0.000001", "g", "kg"],
    ["1e3", "g", "kg"],
    ["-1", "g", "g"],
  ])
    assert.throws(() => convertQuantity(q!, from!, to!));
});
test("expiry is a calendar day comparison across DST, including today and unknown", () => {
  assert.equal(expiryStatus(null, "2026-11-02"), "unknown");
  assert.equal(expiryStatus("2026-11-01", "2026-11-02"), "expired");
  assert.equal(expiryStatus("2026-11-02", "2026-11-02"), "today");
  assert.equal(expiryStatus("2026-03-31", "2026-03-28"), "soon");
  assert.equal(expiryStatus("2026-11-06", "2026-11-02"), "fresh");
});
test("commands validate dates, unknown pairs, decimal bounds and explicit consumption confirmation", () => {
  const command = {
    kind: "create",
    id,
    ingredientId: id,
    quantity: null,
    unitCode: null,
    location: "pantry",
    expiresOn: null,
  };
  assert.ok(pantryCommandSchema.safeParse(command).success);
  for (const patch of [
    { quantity: "1" },
    { expiresOn: "2026-02-30" },
    { quantity: "1e3", unitCode: "g" },
    { quantity: "0.5", unitCode: "piece" },
    { ownerId: second },
    { quantity: "1000000000000", unitCode: "g" },
  ])
    assert.equal(pantryCommandSchema.safeParse({ ...command, ...patch }).success, false);
  assert.equal(
    pantryCommandSchema.safeParse({
      kind: "consume",
      lines: [{ itemId: id, expectedRevision: "1", quantity: "100", unitCode: "g" }],
      confirmed: false,
    }).success,
    false,
  );
});
test("preview never mutates data; confirmed consumption is atomic and rejects stale/duplicate/unknown lots", () => {
  const lines = [{ itemId: id, expectedRevision: "1", quantity: "250", unitCode: "g" as const }];
  assert.equal(previewConsumption(state.items, lines)[0]?.remaining, "0.75");
  assert.equal(state.items[0]?.quantity, "1");
  const next = applyGuestCommand(
    state,
    op,
    { kind: "consume", lines, confirmed: true },
    null,
    "2026-11-02T00:00:00.000Z",
  );
  assert.equal(next.items[0]?.quantity, "0.75");
  assert.equal(next.items[0]?.revision, "2");
  assert.equal(
    applyGuestCommand(
      next,
      op,
      { kind: "consume", lines, confirmed: true },
      null,
      "2026-11-02T00:00:00.000Z",
    ),
    next,
  );
  for (const invalid of [
    [...lines, ...lines],
    [{ ...lines[0]!, quantity: "1001" }],
    [{ ...lines[0]!, expectedRevision: "2" }],
    [...lines, { ...lines[0]!, itemId: second }],
  ])
    assert.throws(() => previewConsumption(state.items, invalid));
  assert.throws(() => previewConsumption([{ ...row, quantity: null, unitCode: null }], lines));
});
test("guest CRUD preserves separate lots and revision conflicts never overwrite", () => {
  const create = {
    kind: "create" as const,
    id: second,
    ingredientId: id,
    quantity: "100",
    unitCode: "g" as const,
    location: "freezer" as const,
    expiresOn: null,
  };
  const next = applyGuestCommand(state, op, create, ingredient, "2026-11-02T00:00:00.000Z");
  assert.equal(next.items.length, 2);
  assert.throws(() =>
    applyGuestCommand(
      next,
      "30000000-0000-4000-8000-000000000002",
      { kind: "delete", id, expectedRevision: "99" },
      null,
      "2026-11-02T00:00:00.000Z",
    ),
  );
  assert.equal(next.items[0]?.quantity, "1");
});
test("an existing withdrawn ingredient keeps its measured unit when only lot metadata changes", () => {
  const withdrawn = { ...ingredient, active: false, allowedUnits: [] };
  const existing = { ...state, items: [{ ...row, ingredient: withdrawn }] };
  const next = applyGuestCommand(
    existing,
    op,
    {
      kind: "update",
      id,
      expectedRevision: "1",
      ingredientId: id,
      quantity: "1",
      unitCode: "kg",
      location: "freezer",
      expiresOn: null,
    },
    withdrawn,
    "2026-11-02T00:00:00.000Z",
  );
  assert.equal(next.items[0]?.quantity, "1");
  assert.equal(next.items[0]?.location, "freezer");
});
test("filters handle Romanian accents, category/location/expiry, stable expiry sort and zero", () => {
  const rows = [{ ...row, id: second, expiresOn: null, quantity: "0" }, row];
  assert.equal(
    filterPantry(
      rows,
      { query: "rosii", categoryId: second, location: "fridge", expiry: "soon", sort: "expiry" },
      "2026-11-02",
    ).length,
    1,
  );
  assert.deepEqual(
    filterPantry(
      rows,
      { query: "", categoryId: "", location: "", expiry: "", sort: "expiry" },
      "2026-11-02",
    ).map((x) => x.id),
    [id, second],
  );
});
test("guest storage rejects corrupt data and cross-tab stale writes without destroying the stored state", () => {
  let value: string | null = JSON.stringify(state);
  const store = {
    getItem: () => value,
    setItem: (_key: string, text: string) => {
      value = text;
    },
  };
  assert.equal(readGuest(store).items.length, 1);
  const original = value!;
  const next = writeGuestCommand(
    store,
    original,
    op,
    { kind: "delete", id, expectedRevision: "1" },
    null,
  );
  assert.equal(next.items.length, 0);
  assert.throws(() =>
    writeGuestCommand(store, original, op, { kind: "delete", id, expectedRevision: "1" }, null),
  );
  const saved = value;
  value = "bad json";
  assert.throws(() => readGuest(store));
  assert.equal(value, "bad json");
  value = saved;
  const unavailable = {
    getItem: () => null,
    setItem: () => {
      throw new Error("quota");
    },
  };
  assert.throws(() =>
    writeGuestCommand(
      unavailable,
      null,
      op,
      {
        kind: "create",
        id,
        ingredientId: id,
        quantity: "1",
        unitCode: "g",
        location: "fridge",
        expiresOn: null,
      },
      ingredient,
    ),
  );
});
