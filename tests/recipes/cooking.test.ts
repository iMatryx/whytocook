import assert from "node:assert/strict";
import { test } from "node:test";
import {
  scaleIngredient,
  findSimilarRecipes,
} from "../../src/features/recipes/application/detail-model.ts";
import {
  startTimer,
  pauseTimer,
  remainingMilliseconds,
  resetTimer,
  formatTimer,
} from "../../src/shared/presentation/cooking-timer.ts";
import { createScreenAwake } from "../../src/shared/presentation/screen-awake.ts";
import {
  readLocalActions,
  writeLocalAction,
} from "../../src/features/recipes/presentation/recipe-actions-storage.ts";
import type { SearchRecipe } from "../../src/features/recipes/contracts/search.schema.ts";
import {
  parseDetailQuery,
  recipeDetailHref,
} from "../../src/features/recipes/contracts/detail-query.ts";
import { cookingSessionSchema } from "../../src/features/recipes/contracts/detail.schema.ts";

test("detail links preserve source, portions and explicit safety restrictions; corrupt timer sessions fail validation", () => {
  const href = recipeDetailHref("terci-de-ovaz-cu-mere", {
    source: "demo",
    servings: 3,
    allergy: ["milk", "eggs"],
    exclude: ["mar"],
  });
  const parsed = parseDetailQuery(new URL(href, "https://cookly.example").searchParams);
  assert.equal(parsed.success, true);
  if (parsed.success)
    assert.deepEqual(parsed.data, {
      source: "demo",
      servings: 3,
      allergy: ["eggs", "milk"],
      exclude: ["mar"],
    });
  assert.equal(parseDetailQuery(new URLSearchParams("servings=1&servings=2")).success, false);
  assert.equal(parseDetailQuery(new URLSearchParams("source=unknown")).success, false);
  assert.equal(
    cookingSessionSchema.safeParse({
      version: 1,
      step: 0,
      timers: [{ durationMs: 1000, remainingMs: 2000, deadlineMs: null }],
    }).success,
    false,
  );
  assert.equal(cookingSessionSchema.safeParse({ version: 1, step: -1, timers: [] }).success, false);
});

test("portion display uses exact base units, conservative pieces and matching-compatible rounding", () => {
  assert.deepEqual(scaleIngredient("0.125", "kg", 2, 4), {
    quantity: "250",
    unitCode: "g",
    rounded: false,
  });
  assert.deepEqual(scaleIngredient("0.4", "l", 2, 3), {
    quantity: "600",
    unitCode: "ml",
    rounded: false,
  });
  assert.deepEqual(scaleIngredient("1", "piece", 3, 1), {
    quantity: "1",
    unitCode: "piece",
    rounded: true,
  });
  assert.deepEqual(scaleIngredient("1", "g", 3, 1), {
    quantity: "0.333334",
    unitCode: "g",
    rounded: true,
  });
  assert.deepEqual(scaleIngredient("0.000001", "kg", 3, 1), {
    quantity: "0.000334",
    unitCode: "g",
    rounded: true,
  });
  assert.equal(scaleIngredient("999999999999", "kg", 1, 20).quantity, "19999999999980000");
  for (const args of [
    ["1", "cup", 2, 2],
    ["0.5", "piece", 2, 2],
    ["1", "g", 0, 2],
    ["1e3", "g", 2, 2],
  ] as const)
    assert.throws(() => scaleIngredient(args[0], args[1], args[2], args[3]));
});
test("timers use deadlines, survive a background gap and pause without double-start or drift", () => {
  const initial = { durationMs: 60000, remainingMs: 60000, deadlineMs: null };
  const running = startTimer(initial, 1000);
  assert.equal(remainingMilliseconds(running, 31000), 30000);
  assert.equal(remainingMilliseconds(running, -1000), 60000);
  assert.deepEqual(startTimer(running, 10000), running);
  const paused = pauseTimer(running, 31000);
  assert.equal(remainingMilliseconds(paused, 900000), 30000);
  assert.equal(remainingMilliseconds(startTimer(paused, 900000), 940000), 0);
  assert.deepEqual(resetTimer(running), initial);
  assert.equal(formatTimer(61000), "01:01");
  assert.equal(formatTimer(3600000), "1:00:00");
});
test("wake lock repeated enable and late release do not leak leases or overwrite active state", async () => {
  let requests = 0;
  let completeRelease: () => void = () => {};
  const states: string[] = [];
  const controller = createScreenAwake({
    supported: true,
    isVisible: () => true,
    request: async () => {
      requests++;
      return {
        release: () =>
          new Promise<void>((resolve) => {
            completeRelease = resolve;
          }),
        addEventListener: () => {},
      };
    },
    onState: (state) => states.push(state),
  });
  await controller.enable();
  await controller.enable();
  assert.equal(requests, 1);
  const disabling = controller.disable();
  await controller.enable();
  completeRelease();
  await disabling;
  assert.equal(states.at(-1), "active");
  controller.dispose();
});
test("wake lock releases a request that resolves after disposal and never claims a denied lock", async () => {
  let resolve: (value: {
    release: () => Promise<void>;
    addEventListener: () => void;
  }) => void = () => {};
  let releases = 0;
  const states: string[] = [];
  const controller = createScreenAwake({
    supported: true,
    isVisible: () => true,
    request: () =>
      new Promise((r) => {
        resolve = r;
      }),
    onState: (state) => states.push(state),
  });
  const pending = controller.enable();
  controller.dispose();
  resolve({
    release: async () => {
      releases++;
    },
    addEventListener: () => {},
  });
  await pending;
  assert.equal(releases, 1);
  assert.equal(states.includes("active"), false);
  const denied = createScreenAwake({
    supported: true,
    isVisible: () => true,
    request: async () => {
      throw new Error("Denied");
    },
    onState: (state) => states.push(state),
  });
  await denied.enable();
  assert.equal(states.at(-1), "denied");
  denied.dispose();
});
test("wake lock reacquires on visibility only while enabled and releases on exit", async () => {
  let visible = true,
    requests = 0,
    releases = 0;
  const states: string[] = [];
  const controller = createScreenAwake({
    supported: true,
    isVisible: () => visible,
    request: async () => {
      requests++;
      return {
        release: async () => {
          releases++;
        },
        addEventListener: () => {},
      };
    },
    onState: (s) => states.push(s),
  });
  await controller.enable();
  assert.equal(states.at(-1), "active");
  visible = false;
  await controller.visibilityChanged();
  assert.equal(releases, 1);
  visible = true;
  await controller.visibilityChanged();
  assert.equal(requests, 2);
  await controller.disable();
  await controller.visibilityChanged();
  assert.equal(requests, 2);
  assert.equal(releases, 2);
});
test("local recipe actions persist, replay safely and never write to pantry storage", () => {
  let value: string | null = null;
  const keys: string[] = [];
  const storage = {
    getItem: () => value,
    setItem: (key: string, next: string) => {
      keys.push(key);
      value = next;
    },
  };
  const favorite = { kind: "favorite", enabled: true } as const;
  const a = writeLocalAction(storage, null, "demo:terci", "op-1", favorite, "2026-11-03T12:00:00Z");
  assert.equal(a.favorites.includes("demo:terci"), true);
  const raw = value;
  const replay = writeLocalAction(
    storage,
    raw,
    "demo:terci",
    "op-1",
    favorite,
    "2026-11-03T12:01:00Z",
  );
  assert.equal(replay.revision, a.revision);
  assert.throws(() =>
    writeLocalAction(storage, null, "demo:terci", "op-2", favorite, "2026-11-03T12:00:00Z"),
  );
  assert.throws(() =>
    writeLocalAction(
      storage,
      value,
      "demo:terci",
      "op-1",
      { kind: "favorite", enabled: false },
      "2026-11-03T12:00:00Z",
    ),
  );
  const shopping = {
    kind: "shopping",
    items: [{ ingredientSlug: "rosii", label: "Roșii", quantity: "50", unitCode: "g" }],
  } as const;
  const bought = writeLocalAction(
    storage,
    value,
    "demo:terci",
    "op-2",
    shopping,
    "2026-11-03T12:00:00Z",
  );
  assert.equal(bought.shopping[0]!.quantity, "50");
  assert.ok(keys.every((key) => key === "cookly-recipe-actions-v1"));
  value = "broken data";
  assert.throws(() => readLocalActions(storage));
  assert.equal(value, "broken data");
});
test("similar recipes use meaningful ingredient overlap and exclude allergens, traces and current recipe", () => {
  const base = {
    key: "target",
    ingredients: [{ ingredientSlug: "mar" }, { ingredientSlug: "apa-potabila" }],
    diets: [],
    allergens: { status: "verified", contains: [], mayContain: [] },
    totalMinutes: 10,
  } as unknown as SearchRecipe;
  const candidates = [
    base,
    { ...base, key: "shared" },
    {
      ...base,
      key: "water-only",
      ingredients: [{ ingredientSlug: "apa-potabila" }],
    } as SearchRecipe,
    {
      ...base,
      key: "allergen",
      allergens: { status: "verified" as const, contains: [], mayContain: ["milk"] },
    },
    {
      ...base,
      key: "unreviewed",
      allergens: { status: "unverified" as const, contains: [], mayContain: [] },
    },
  ];
  assert.deepEqual(
    findSimilarRecipes(base, candidates, ["milk"], []).map((r) => r.key),
    ["shared"],
  );
});
