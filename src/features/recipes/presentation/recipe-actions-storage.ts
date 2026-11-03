import { z } from "zod";
import { recipeActionCommandSchema } from "../contracts/detail.schema.ts";
export const localRecipeActionsKey = "cookly-recipe-actions-v1";
const stateSchema = z
  .object({
    version: z.literal(1),
    revision: z.number().int().min(0),
    favorites: z.array(z.string().max(220)).max(500),
    cooked: z
      .array(
        z
          .object({
            recipeKey: z.string(),
            at: z.iso.datetime({ offset: true }),
            servings: z.number().int().min(1).max(20),
          })
          .strict(),
      )
      .max(100),
    shopping: z
      .array(
        z
          .object({
            id: z.string(),
            recipeKey: z.string(),
            ingredientSlug: z.string(),
            label: z.string(),
            quantity: z.string(),
            unitCode: z.string(),
          })
          .strict(),
      )
      .max(500),
    operations: z.array(z.object({ id: z.string(), signature: z.string() }).strict()).max(100),
  })
  .strict();
export type LocalRecipeActions = z.infer<typeof stateSchema>;
type StoragePort = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};
export function readLocalActions(storage: Pick<StoragePort, "getItem">): LocalRecipeActions {
  const raw = storage.getItem(localRecipeActionsKey);
  return raw === null
    ? { version: 1, revision: 0, favorites: [], cooked: [], shopping: [], operations: [] }
    : stateSchema.parse(JSON.parse(raw));
}
export function writeLocalAction(
  storage: StoragePort,
  expectedRaw: string | null,
  recipeKey: string,
  operationId: string,
  value: unknown,
  now: string,
): LocalRecipeActions {
  const raw = storage.getItem(localRecipeActionsKey);
  if (raw !== expectedRaw)
    throw new Error(
      "Acțiunile locale s-au schimbat. Reîncarcă pagina înainte de a încerca din nou.",
    );
  const state = readLocalActions(storage),
    command = recipeActionCommandSchema.parse(value),
    signature = JSON.stringify([recipeKey, command]);
  const operation = state.operations.find((o) => o.id === operationId);
  if (operation) {
    if (operation.signature !== signature) throw new Error("Operation conflict");
    return state;
  }
  const next: LocalRecipeActions = {
    ...state,
    revision: state.revision + 1,
    operations: [...state.operations, { id: operationId, signature }].slice(-100),
  };
  if (command.kind === "favorite")
    next.favorites = command.enabled
      ? [...new Set([...state.favorites, recipeKey])]
      : state.favorites.filter((k) => k !== recipeKey);
  if (command.kind === "cooked")
    next.cooked = [...state.cooked, { recipeKey, at: now, servings: command.servings }].slice(-100);
  if (command.kind === "shopping")
    next.shopping = [
      ...state.shopping,
      ...command.items.map((i, index) => ({ ...i, id: `${operationId}:${index}`, recipeKey })),
    ];
  const checked = stateSchema.parse(next);
  storage.setItem(localRecipeActionsKey, JSON.stringify(checked));
  return checked;
}
