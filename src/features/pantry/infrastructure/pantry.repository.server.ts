import "server-only";
import { z } from "zod";
import { pantryItemSchema } from "../contracts/pantry.schema.ts";
import type { PantryRepository } from "../application/pantry.port.ts";
import { PantryError } from "../domain/pantry-error.ts";
const snapshot = z
  .object({ ownerId: z.uuid(), items: z.array(pantryItemSchema).max(500) })
  .strict();
export function createPantryRepository(
  actorId: string,
  client: { request(path: string, body: unknown): Promise<unknown> },
): PantryRepository {
  async function call(path: string, body: unknown) {
    const parsed = snapshot.safeParse(await client.request(path, body));
    if (
      !parsed.success ||
      parsed.data.ownerId !== actorId ||
      new Set(parsed.data.items.map((item) => item.id)).size !== parsed.data.items.length
    )
      throw new PantryError("UNAVAILABLE");
    return parsed.data.items;
  }
  return {
    load: () => call("get_my_pantry", {}),
    mutate: (operationId, command) =>
      call("mutate_my_pantry", { p_operation_id: operationId, p_command: command }),
  };
}
