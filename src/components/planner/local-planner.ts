import { z } from "zod";
import {
  plannerKey,
  readPlanner,
  applyPlanner,
  copyPlanner,
  plannerReplay,
  plannerSignature,
  recordPlanner,
  plannerStateSchema,
} from "../../features/meal-planner/presentation/planner-storage.ts";
import type { PlannerCommand, PlannerRecipe } from "../../features/meal-planner/contracts/index.ts";
import type { ShoppingItem } from "../../features/shopping/contracts/index.ts";
import type { RecipeSearchRequest } from "../../features/recipes/contracts/index.ts";
import { readGuest } from "../../features/pantry/presentation/guest-storage.ts";
import {
  readShopping,
  shoppingStateSchema,
  shoppingKey,
} from "../../features/shopping/presentation/shopping-storage.ts";
type Store = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};
export const plannerJournalKey = "cookly-planner-shopping-v1";
const journalSchema = z
  .object({
    key: z.string().regex(/^cookly-meal-plan-v1:(demo|published):\d{4}-\d{2}-\d{2}$/),
    beforePlanner: z.string().nullable(),
    beforeShopping: z.string().nullable(),
    afterPlanner: z.string(),
    afterShopping: z.string(),
  })
  .strict();
export function recoverPlannerExport(store: Store) {
  const raw = store.getItem(plannerJournalKey);
  if (raw === null) return;
  if (raw.length > 3500000) throw new Error("Jurnalul plannerului este prea mare.");
  const j = journalSchema.parse(JSON.parse(raw));
  readPlanner(j.afterPlanner, j.key.slice(-10));
  readShopping(j.afterShopping);
  const p = store.getItem(j.key),
    s = store.getItem(shoppingKey);
  if (
    (p !== j.beforePlanner && p !== j.afterPlanner) ||
    (s !== j.beforeShopping && s !== j.afterShopping)
  )
    throw new Error(
      "Exportul întâlnește modificări ulterioare. Verifică lista; datele nu sunt suprascrise.",
    );
  if (p !== j.afterPlanner) store.setItem(j.key, j.afterPlanner);
  if (s !== j.afterShopping) store.setItem(shoppingKey, j.afterShopping);
  store.removeItem(plannerJournalKey);
}
export function loadLocalPlanner(store: Store, startsOn: string, source: "demo" | "published") {
  recoverPlannerExport(store);
  return readPlanner(store.getItem(plannerKey(startsOn, source)), startsOn).week;
}
export function mutateLocalPlanner(
  store: Store,
  startsOn: string,
  source: "demo" | "published",
  command: PlannerCommand,
  expected: string,
  id: string,
  recipes: readonly PlannerRecipe[],
) {
  recoverPlannerExport(store);
  const key = plannerKey(startsOn, source),
    raw = store.getItem(key),
    state = readPlanner(raw, startsOn);
  if (command.kind === "copyWeek") {
    const targetKey = plannerKey(command.targetStartsOn, source),
      targetRaw = store.getItem(targetKey),
      target = readPlanner(targetRaw, command.targetStartsOn),
      signature = plannerSignature(startsOn, expected, command);
    if (plannerReplay(target, id, signature)) return target.week;
    if (targetRaw !== null) throw new Error("Săptămâna țintă există deja. Alege alta.");
    const next = copyPlanner(state, command.targetStartsOn, expected, id, recipes);
    if (store.getItem(key) !== raw || store.getItem(targetKey) !== targetRaw)
      throw new Error("Planul s-a schimbat înainte de copiere.");
    store.setItem(targetKey, JSON.stringify(next));
    return next.week;
  }
  const next = applyPlanner(state, command, expected, id, recipes);
  if (next !== state) {
    if (store.getItem(key) !== raw) throw new Error("Planul s-a schimbat.");
    store.setItem(key, JSON.stringify(next));
  }
  return next.week;
}
export function exportLocalPlanner(
  store: Store,
  startsOn: string,
  source: "demo" | "published",
  expected: string,
  id: string,
  items: ShoppingItem[],
  expectedInventory: RecipeSearchRequest["inventory"] = [],
) {
  recoverPlannerExport(store);
  const key = plannerKey(startsOn, source),
    beforePlanner = store.getItem(key),
    state = readPlanner(beforePlanner, startsOn),
    signature = plannerSignature(startsOn, expected, { kind: "export", items });
  if (plannerReplay(state, id, signature)) return state.week;
  const fingerprint = (lots: RecipeSearchRequest["inventory"]) =>
    JSON.stringify(
      lots
        .map((i) => [i.id, i.ingredientSlug, i.quantity, i.unit, i.expiresOn])
        .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
    );
  const inventory = readGuest(store).items.map((i) => ({
    id: i.id,
    ingredientSlug: i.ingredient.slug,
    quantity: i.quantity,
    unit: i.unitCode,
    expiresOn: i.expiresOn,
  }));
  if (fingerprint(inventory) !== fingerprint(expectedInventory))
    throw new Error("Inventarul s-a schimbat. Recalculează și confirmă din nou necesarul.");
  if (state.week.revision !== expected) throw new Error("Planul s-a modificat înainte de export.");
  if (items.length > 100) throw new Error("Exportul poate conține maximum 100 ingrediente.");
  const beforeShopping = store.getItem(shoppingKey),
    shopping = readShopping(beforeShopping),
    remove = new Set<string>();
  for (const link of state.exportLinks) {
    const row = shopping.items.find((i) => i.id === link.id);
    if (!row || row.transferred) continue;
    if (row.checked || row.revision !== link.revision)
      throw new Error(
        "Rândurile exportate au fost editate sau bifate. Revizuiește lista înainte de înlocuire.",
      );
    remove.add(row.id);
  }
  const nextShopping = shoppingStateSchema.parse({
    ...shopping,
    revision: String(BigInt(shopping.revision) + 1n),
    items: [...shopping.items.filter((i) => !remove.has(i.id)), ...items],
  });
  const nextPlanner = recordPlanner(
    plannerStateSchema.parse({
      ...state,
      week: { ...state.week, exportedRevision: state.week.revision },
      exportLinks: items.map((i) => ({ id: i.id, revision: i.revision })),
    }),
    id,
    signature,
  );
  if (store.getItem(key) !== beforePlanner || store.getItem(shoppingKey) !== beforeShopping)
    throw new Error("Datele s-au schimbat înainte de export.");
  store.setItem(
    plannerJournalKey,
    JSON.stringify({
      key,
      beforePlanner,
      beforeShopping,
      afterPlanner: JSON.stringify(nextPlanner),
      afterShopping: JSON.stringify(nextShopping),
    }),
  );
  try {
    recoverPlannerExport(store);
  } catch {
    throw new Error(
      "Exportul local cere recuperare. Reîncarcă plannerul și verifică lista înainte de reîncercare.",
    );
  }
  return nextPlanner.week;
}
