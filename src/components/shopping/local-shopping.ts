import { z } from "zod";
import { readGuest, guestStorageKey } from "../../features/pantry/presentation/guest-storage.ts";
import { applyGuestCommand } from "../../features/pantry/presentation/pantry-model.ts";
import { guestStateSchema, pantryIngredientSchema } from "../../features/pantry/contracts/index.ts";
import { readLocalActions } from "../../features/recipes/presentation/recipe-actions-storage.ts";
import {
  readShopping,
  applyShopping,
  adoptLegacy,
  shoppingKey,
} from "../../features/shopping/presentation/shopping-storage.ts";
import type { ShoppingCommand } from "../../features/shopping/contracts/index.ts";
import type { PantryIngredient } from "../../features/pantry/contracts/index.ts";
type Store = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};
export const transferJournalKey = "cookly-shopping-transfer-v1";
const journalSchema = z
  .object({
    version: z.literal(1),
    beforePantry: z.string().nullable(),
    beforeShopping: z.string().nullable(),
    afterPantry: z.string(),
    afterShopping: z.string(),
  })
  .strict();
export function recoverShoppingTransfer(store: Store) {
  const raw = store.getItem(transferJournalKey);
  if (raw === null) return;
  if (raw.length > 2500000) throw new Error("Jurnalul de transfer este prea mare.");
  const j = journalSchema.parse(JSON.parse(raw));
  guestStateSchema.parse(JSON.parse(j.afterPantry));
  readShopping(j.afterShopping);
  const p = store.getItem(guestStorageKey),
    s = store.getItem(shoppingKey);
  if (
    (p !== j.beforePantry && p !== j.afterPantry) ||
    (s !== j.beforeShopping && s !== j.afterShopping)
  )
    throw new Error(
      "Transferul local întâlnește modificări ulterioare. Verifică frigiderul înainte de reconciliere; datele nu au fost suprascrise.",
    );
  if (p !== j.afterPantry) store.setItem(guestStorageKey, j.afterPantry);
  if (s !== j.afterShopping) store.setItem(shoppingKey, j.afterShopping);
  store.removeItem(transferJournalKey);
}
export function loadLocalShopping(store: Store, catalog: readonly PantryIngredient[]) {
  recoverShoppingTransfer(store);
  const raw = store.getItem(shoppingKey),
    state = readShopping(raw);
  let next = adoptLegacy(state, readLocalActions(store).shopping, catalog);
  let changed = false;
  const items = next.items.map((item) => {
    if (!item.ingredient) return item;
    const ingredient = pantryIngredientSchema.parse(
      catalog.find((food) => food.slug === item.ingredient!.slug) ?? {
        ...item.ingredient,
        active: false,
        allowedUnits: [],
      },
    );
    if (JSON.stringify(ingredient) === JSON.stringify(item.ingredient)) return item;
    changed = true;
    return {
      ...item,
      ingredient,
      uncertain:
        item.uncertain ||
        !ingredient.active ||
        !!(item.unitCode && !ingredient.allowedUnits.includes(item.unitCode)),
      revision: String(BigInt(item.revision) + 1n),
    };
  });
  if (changed) next = { ...next, items, revision: String(BigInt(next.revision) + 1n) };
  if (next.revision !== state.revision) {
    if (store.getItem(shoppingKey) !== raw) throw new Error("Lista s-a schimbat.");
    store.setItem(shoppingKey, JSON.stringify(next));
  }
  return next.items;
}
export function mutateLocalShopping(
  store: Store,
  catalog: readonly PantryIngredient[],
  command: ShoppingCommand,
  operationId: string,
) {
  recoverShoppingTransfer(store);
  const beforeShopping = store.getItem(shoppingKey),
    state = readShopping(beforeShopping),
    next = applyShopping(state, command, catalog, operationId);
  if (next === state) return state.items;
  if (command.kind !== "purchase") {
    if (store.getItem(shoppingKey) !== beforeShopping) throw new Error("Lista s-a schimbat.");
    store.setItem(shoppingKey, JSON.stringify(next));
    return next.items;
  }
  const beforePantry = store.getItem(guestStorageKey);
  let pantry = readGuest(store);
  const now = new Date().toISOString();
  for (const line of command.lines) {
    const i = next.items.find((i) => i.id === line.id)!;
    pantry = applyGuestCommand(
      pantry,
      line.pantryItemId,
      {
        kind: "create",
        id: line.pantryItemId,
        ingredientId: i.ingredient!.id,
        quantity: i.quantity,
        unitCode: i.unitCode,
        location: command.location,
        expiresOn: command.expiresOn,
      },
      i.ingredient,
      now,
    );
  }
  const journal = {
    version: 1,
    beforeShopping,
    beforePantry,
    afterPantry: JSON.stringify(pantry),
    afterShopping: JSON.stringify(next),
  };
  if (
    store.getItem(shoppingKey) !== beforeShopping ||
    store.getItem(guestStorageKey) !== beforePantry
  )
    throw new Error("Datele locale s-au schimbat înainte de transfer.");
  store.setItem(transferJournalKey, JSON.stringify(journal));
  try {
    recoverShoppingTransfer(store);
  } catch (e) {
    throw new Error(
      `Transferul local nu este complet confirmat. Reîncarcă lista pentru recuperare și verifică frigiderul. ${e instanceof Error ? e.message : ""}`,
    );
  }
  return next.items;
}
