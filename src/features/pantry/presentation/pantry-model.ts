import { pantryCommandSchema, guestStateSchema } from "../contracts/pantry.schema.ts";
import type {
  PantryCommand,
  PantryItem,
  PantryIngredient,
  ConsumptionLine,
  GuestState,
} from "../contracts/pantry.schema.ts";
import { convertQuantity, quantityMicros, quantityText } from "../../../shared/domain/quantity.ts";
import { expiryStatus } from "../../../shared/domain/expiry.ts";

export function previewConsumption(
  items: readonly PantryItem[],
  lines: readonly ConsumptionLine[],
) {
  if (
    !lines.length ||
    lines.length > 50 ||
    new Set(lines.map((line) => line.itemId)).size !== lines.length
  )
    throw new Error("Alege fiecare lot o singură dată.");
  return lines.map((line) => {
    const item = items.find((item) => item.id === line.itemId);
    if (!item) throw new Error("Lotul nu mai există. Reîncarcă inventarul.");
    if (item.revision !== line.expectedRevision)
      throw new Error("Inventarul s-a modificat. Reîncarcă și verifică din nou cantitățile.");
    if (item.quantity === null || item.unitCode === null)
      throw new Error("Completează cantitatea lotului înainte de consum.");
    const used = convertQuantity(line.quantity, line.unitCode, item.unitCode);
    if (quantityMicros(used) === 0n) throw new Error("Introdu o cantitate mai mare decât zero.");
    const remaining = quantityMicros(item.quantity) - quantityMicros(used);
    if (remaining < 0n) throw new Error(`Cantitate insuficientă pentru ${item.ingredient.name}.`);
    return {
      itemId: item.id,
      name: item.ingredient.name,
      used,
      remaining: quantityText(remaining),
      unitCode: item.unitCode,
    };
  });
}
export function applyGuestCommand(
  state: GuestState,
  operationId: string,
  value: PantryCommand,
  ingredient: PantryIngredient | null,
  now: string,
): GuestState {
  const command = pantryCommandSchema.parse(value);
  const replay = state.operations.find((operation) => operation.id === operationId);
  if (replay) {
    if (JSON.stringify(replay.command) !== JSON.stringify(command))
      throw new Error("Identificator de operație reutilizat.");
    return state;
  }
  let items = [...state.items];
  if (command.kind === "consume") {
    const changes = previewConsumption(items, command.lines);
    items = items.map((item) => {
      const change = changes.find((change) => change.itemId === item.id);
      return change
        ? {
            ...item,
            quantity: change.remaining,
            revision: String(BigInt(item.revision) + 1n),
            updatedAt: now,
          }
        : item;
    });
  } else if (command.kind === "delete") {
    const old = items.find((item) => item.id === command.id);
    if (!old || old.revision !== command.expectedRevision)
      throw new Error("Lotul s-a modificat. Reîncarcă inventarul.");
    items = items.filter((item) => item.id !== command.id);
  } else {
    if (!ingredient || ingredient.id !== command.ingredientId)
      throw new Error("Selectează un ingredient din catalog.");
    const old = items.find((item) => item.id === command.id);
    if (
      command.kind === "create"
        ? !!old || items.length >= 500
        : !old || old.revision !== command.expectedRevision
    )
      throw new Error("Lotul s-a modificat sau inventarul este plin. Reîncarcă inventarul.");
    if (!ingredient.active && (!old || old.ingredient.id !== ingredient.id))
      throw new Error("Ingredientul nu mai este disponibil.");
    if (
      command.unitCode &&
      !ingredient.allowedUnits.includes(command.unitCode) &&
      !(old?.ingredient.id === ingredient.id && old.unitCode === command.unitCode)
    )
      throw new Error("Unitatea nu este permisă pentru acest ingredient.");
    const quantity =
      command.quantity !== null
        ? convertQuantity(command.quantity, command.unitCode!, command.unitCode!)
        : null;
    const saved = {
      id: command.id,
      ingredient,
      quantity,
      unitCode: command.unitCode,
      location: command.location,
      expiresOn: command.expiresOn,
      revision: old ? String(BigInt(old.revision) + 1n) : "1",
      createdAt: old?.createdAt ?? now,
      updatedAt: now,
    };
    items = old ? items.map((item) => (item.id === old.id ? saved : item)) : [...items, saved];
  }
  return guestStateSchema.parse({
    version: 1,
    revision: String(BigInt(state.revision) + 1n),
    items,
    operations: [...state.operations, { id: operationId, command }].slice(-100),
  });
}
export type PantryFilters = {
  query: string;
  categoryId: string;
  location: string;
  expiry: string;
  sort: "expiry" | "name" | "newest";
};
function key(value: string) {
  return value
    .normalize("NFC")
    .toLocaleLowerCase("ro")
    .replace(/[ăâ]/g, "a")
    .replace(/î/g, "i")
    .replace(/[șş]/g, "s")
    .replace(/[țţ]/g, "t");
}
export function filterPantry(items: readonly PantryItem[], filters: PantryFilters, today: string) {
  return items
    .filter(
      (item) =>
        (!filters.query || key(item.ingredient.name).includes(key(filters.query.trim()))) &&
        (!filters.categoryId || item.ingredient.categoryId === filters.categoryId) &&
        (!filters.location || item.location === filters.location) &&
        (!filters.expiry ||
          (filters.expiry === "soon"
            ? ["today", "soon"].includes(expiryStatus(item.expiresOn, today))
            : filters.expiry === "empty"
              ? item.quantity !== null && quantityMicros(item.quantity) === 0n
              : expiryStatus(item.expiresOn, today) === filters.expiry)),
    )
    .sort((a, b) => {
      const order =
        filters.sort === "expiry"
          ? (a.expiresOn ?? "9999-12-31").localeCompare(b.expiresOn ?? "9999-12-31")
          : filters.sort === "newest"
            ? b.createdAt.localeCompare(a.createdAt)
            : a.ingredient.name.localeCompare(b.ingredient.name, "ro");
      return order || a.id.localeCompare(b.id);
    });
}
