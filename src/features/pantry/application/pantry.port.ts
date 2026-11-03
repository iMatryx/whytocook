import type { PantryItem, PantryCommand } from "../contracts/pantry.schema.ts";
export type PantryRepository = {
  load(): Promise<PantryItem[]>;
  mutate(operationId: string, command: PantryCommand): Promise<PantryItem[]>;
};
