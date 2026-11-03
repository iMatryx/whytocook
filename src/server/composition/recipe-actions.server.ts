import "server-only";
import { getSupabaseEnv } from "../../config/env/server.ts";
import {
  recipeActionRequestSchema,
  recipeActionStateSchema,
} from "../../features/recipes/contracts/detail.schema.ts";
import { recipeRequestContext } from "./recipe-context.server.ts";
import { createRecipeRpc } from "../supabase/recipe-rpc.server.ts";
export async function recipeActionForRequest(request: Request, value: unknown) {
  const input = recipeActionRequestSchema.parse(value),
    context = await recipeRequestContext(request, [], input.expectedAccountId);
  const state = recipeActionStateSchema.parse(
    await createRecipeRpc(getSupabaseEnv(), context.token ?? undefined).request(
      "apply_recipe_action",
      {
        p_slug: input.slug,
        p_revision: input.revision,
        p_operation_id: input.operationId,
        p_command: input.command,
      },
    ),
  );
  return { ...state, accountId: context.accountId };
}
