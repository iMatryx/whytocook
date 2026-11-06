import { z } from "zod";
import { shoppingItemSchema, shoppingCommandSchema, positiveQuantity } from "../contracts/index.ts";
import type { ShoppingCommand } from "../contracts/index.ts";
import type { PantryIngredient } from "../../pantry/contracts/index.ts";
import { mergeShopping } from "../../../shared/domain/shopping.ts";
export const shoppingKey = "cookly-shopping-v1";
export const shoppingStateSchema = z
  .object({
    version: z.literal(1),
    revision: z.string().regex(/^[1-9]\d{0,18}$/),
    items: z.array(shoppingItemSchema).max(500),
    importedLegacyIds: z.array(z.string().max(150)).max(5000),
    operations: z
      .array(z.object({ id: z.uuid(), signature: z.string().max(100000) }).strict())
      .max(100),
  })
  .strict()
  .refine((v) => new Set(v.items.map((i) => i.id)).size === v.items.length);
export type ShoppingState = z.infer<typeof shoppingStateSchema>;
export function readShopping(raw: string | null): ShoppingState {
  if (raw !== null && raw.length > 1000000) throw new Error("Lista locală este prea mare.");
  return raw === null
    ? { version: 1, revision: "1", items: [], importedLegacyIds: [], operations: [] }
    : shoppingStateSchema.parse(JSON.parse(raw));
}
export function applyShopping(
  state: ShoppingState,
  value: ShoppingCommand,
  catalog: readonly PantryIngredient[],
  operationId: string,
): ShoppingState {
  const command = shoppingCommandSchema.parse(value),
    signature = JSON.stringify(command),
    replay = state.operations.find((o) => o.id === operationId);
  if (replay) {
    if (replay.signature !== signature) throw new Error("Operație reutilizată cu alte date.");
    return state;
  }
  let items = state.items.map((i) => ({ ...i }));
  if (command.kind === "append") {
    const incoming = command.items.map((i) => {
      const ingredient = i.ingredientId
        ? catalog.find((c) => c.id === i.ingredientId && c.active)
        : null;
      if (i.ingredientId && !ingredient) throw new Error("Ingredientul nu mai este disponibil.");
      if (i.unitCode && ingredient && !ingredient.allowedUnits.includes(i.unitCode))
        throw new Error("Unitate nepermisă.");
      const { ingredientId: _, ...fields } = i;
      void _;
      return { ...fields, ingredient: ingredient ?? null, revision: "1", transferred: false };
    });
    items = mergeShopping(items, incoming);
  } else if (command.kind === "purchase") {
    for (const line of command.lines) {
      const i = items.find((i) => i.id === line.id);
      const current = catalog.find((food) => food.slug === i?.ingredient?.slug && food.active);
      if (
        !i ||
        i.revision !== line.expectedRevision ||
        !i.checked ||
        i.uncertain ||
        i.transferred ||
        !current ||
        i.quantity === null ||
        !i.unitCode ||
        !current.allowedUnits.includes(i.unitCode)
      )
        throw new Error("Verifică rândurile bifate, cantitățile și reviziile înainte de transfer.");
      i.ingredient = current;
      i.transferred = true;
      i.revision = String(BigInt(i.revision) + 1n);
    }
  } else {
    const i = items.find((i) => i.id === command.id);
    if (!i || i.revision !== command.expectedRevision)
      throw new Error("Rândul s-a modificat. Reîncarcă lista.");
    if (command.kind === "remove") items = items.filter((i) => i.id !== command.id);
    else {
      if (i.transferred) throw new Error("Un rând transferat nu poate fi editat.");
      if (
        command.fields.unitCode &&
        i.ingredient &&
        !i.ingredient.allowedUnits.includes(command.fields.unitCode)
      )
        throw new Error("Unitate nepermisă.");
      Object.assign(i, command.fields, { revision: String(BigInt(i.revision) + 1n) });
    }
  }
  return shoppingStateSchema.parse({
    ...state,
    items,
    revision: String(BigInt(state.revision) + 1n),
    operations: [...state.operations, { id: operationId, signature }].slice(-100),
  });
}
export function adoptLegacy(
  state: ShoppingState,
  legacy: readonly {
    id: string;
    ingredientSlug: string;
    label: string;
    quantity: string;
    unitCode: string;
  }[],
  catalog: readonly PantryIngredient[],
) {
  const next = {
    ...state,
    items: [...state.items],
    importedLegacyIds: [...state.importedLegacyIds],
  };
  for (const old of legacy) {
    if (next.importedLegacyIds.includes(old.id)) continue;
    const ingredient = catalog.find((i) => i.slug === old.ingredientSlug) ?? null;
    const unit = old.unitCode;
    if (!["g", "kg", "ml", "l", "piece"].includes(unit))
      throw new Error("Lista Cooking conține o unitate nesuportată. Verifică datele existente.");
    const line = shoppingItemSchema.parse({
      id: crypto.randomUUID(),
      revision: "1",
      ingredient,
      label: old.label,
      category: ingredient?.categoryName ?? "Altele",
      quantity: positiveQuantity.parse(old.quantity),
      unitCode: unit,
      checked: false,
      price: null,
      transferred: false,
      uncertain: !ingredient,
    });
    next.items = mergeShopping(next.items, [line]);
    next.importedLegacyIds.push(old.id);
  }
  return shoppingStateSchema.parse({
    ...next,
    revision:
      next.importedLegacyIds.length === state.importedLegacyIds.length
        ? state.revision
        : String(BigInt(state.revision) + 1n),
  });
}
