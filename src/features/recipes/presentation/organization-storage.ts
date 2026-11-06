import { organizationCommandSchema } from "../contracts/organization.schema.ts";
import {
  readLocalActions,
  localRecipeActionsKey,
  localRecipeActionsSchema,
} from "./recipe-actions-storage.ts";
export function writeLocalOrganization(
  storage: {
    getItem: (key: string) => string | null;
    setItem: (key: string, value: string) => void;
  },
  expectedRaw: string | null,
  value: unknown,
) {
  if (storage.getItem(localRecipeActionsKey) !== expectedRaw)
    throw new Error("Datele locale s-au schimbat. Reîncarcă lista.");
  const command = organizationCommandSchema.parse(value),
    state = readLocalActions(storage);
  if (command.kind === "favorite")
    state.favorites = command.enabled
      ? [...new Set([...state.favorites, command.recipeKey])]
      : state.favorites.filter((k) => k !== command.recipeKey);
  if (command.kind === "clearHistory") state.cooked = [];
  if (command.kind === "deleteCollection")
    state.collections = state.collections.filter((c) => c.id !== command.id);
  if (command.kind === "saveCollection") {
    if (
      state.collections.some(
        (c) => c.id !== command.id && c.name.toLowerCase() === command.name.toLowerCase(),
      )
    )
      throw new Error("Există deja o colecție cu acest nume.");
    const existing = state.collections.find((c) => c.id === command.id);
    if (command.create) {
      if (existing && existing.name !== command.name)
        throw new Error("Identificatorul colecției este deja folosit.");
      if (!existing) state.collections.push({ id: command.id, name: command.name, recipeKeys: [] });
    } else {
      if (!existing) throw new Error("Colecția nu mai există. Reîncarcă lista.");
      existing.name = command.name;
    }
  }
  if (command.kind === "membership") {
    const collection = state.collections.find((c) => c.id === command.id);
    if (!collection) throw new Error("Colecția nu mai există.");
    collection.recipeKeys = command.enabled
      ? [...new Set([...collection.recipeKeys, command.recipeKey])]
      : collection.recipeKeys.filter((k) => k !== command.recipeKey);
  }
  const next = localRecipeActionsSchema.parse({ ...state, revision: state.revision + 1 });
  storage.setItem(localRecipeActionsKey, JSON.stringify(next));
  return next;
}
