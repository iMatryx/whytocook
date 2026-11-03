import { pantryRequestSchema } from "../contracts/pantry.schema.ts";
import { PantryError } from "../domain/pantry-error.ts";
import type { PantryRepository } from "./pantry.port.ts";
export function createPantryService(repository: PantryRepository, accountId: string) {
  return {
    accountId,
    load: () => repository.load(),
    mutate: (value: unknown) => {
      const input = pantryRequestSchema.safeParse(value);
      if (!input.success) throw new PantryError("INVALID_INPUT");
      if (input.data.expectedAccountId !== accountId) throw new PantryError("SESSION_CHANGED");
      return repository.mutate(input.data.operationId, input.data.command);
    },
  };
}
