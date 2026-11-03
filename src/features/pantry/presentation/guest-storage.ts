import { guestStateSchema } from "../contracts/pantry.schema.ts";
import type { PantryCommand, PantryIngredient, GuestState } from "../contracts/pantry.schema.ts";
import { applyGuestCommand } from "./pantry-model.ts";
export const guestStorageKey = "cookly-pantry-v1";
type StoragePort = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};
export function emptyGuest(): GuestState {
  return { version: 1, revision: "1", items: [], operations: [] };
}
export function readGuest(store: Pick<StoragePort, "getItem">): GuestState {
  const raw = store.getItem(guestStorageKey);
  if (raw === null) return emptyGuest();
  if (raw.length > 1_000_000) throw new Error("Datele locale sunt prea mari.");
  try {
    return guestStateSchema.parse(JSON.parse(raw));
  } catch {
    throw new Error("Datele locale nu pot fi citite. Nu au fost șterse sau înlocuite.");
  }
}
export function writeGuestCommand(
  store: StoragePort,
  expectedRaw: string | null,
  operationId: string,
  command: PantryCommand,
  ingredient: PantryIngredient | null,
): GuestState {
  if (store.getItem(guestStorageKey) !== expectedRaw)
    throw new Error("Inventarul local s-a modificat în altă filă. Reîncarcă înainte să salvezi.");
  const state = readGuest(store);
  const next = applyGuestCommand(state, operationId, command, ingredient, new Date().toISOString());
  try {
    store.setItem(guestStorageKey, JSON.stringify(next));
  } catch {
    throw new Error("Browserul nu a putut salva inventarul. Datele anterioare sunt păstrate.");
  }
  return next;
}
