import assert from "node:assert/strict";
import { test } from "node:test";
import { createPantryService } from "../../src/features/pantry/application/pantry.service.ts";
import { PantryError } from "../../src/features/pantry/domain/pantry-error.ts";
const a = "00000000-0000-4000-8000-000000000001",
  b = "00000000-0000-4000-8000-000000000002";
const command = {
  kind: "create" as const,
  id: "10000000-0000-4000-8000-000000000002",
  ingredientId: "10000000-0000-4000-8000-000000000002",
  quantity: "1",
  unitCode: "g" as const,
  location: "fridge" as const,
  expiresOn: null,
};
test("a stale create form cannot write into the account that replaced its loaded session", async () => {
  let writes = 0;
  const service = createPantryService(
    {
      load: async () => [],
      mutate: async () => {
        writes++;
        return [];
      },
    },
    b,
  );
  await assert.rejects(
    async () => service.mutate({ operationId: crypto.randomUUID(), expectedAccountId: a, command }),
    (error) => error instanceof PantryError && error.code === "SESSION_CHANGED",
  );
  assert.equal(writes, 0);
  await service.mutate({ operationId: crypto.randomUUID(), expectedAccountId: b, command });
  assert.equal(writes, 1);
});
