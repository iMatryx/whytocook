import "server-only";
import { z } from "zod";
import { getSupabaseEnv } from "../../config/env/server.ts";
import { pantryItemSchema } from "../../features/pantry/contracts/pantry.schema.ts";
import type { RecipeSearchRequest } from "../../features/recipes/contracts/search.schema.ts";
import { RecipeSearchError } from "../../features/recipes/domain/search-error.ts";
import { requestContext } from "../auth/session.server.ts";
import { sessionFromCookieHeader } from "../auth/session-config.server.ts";
import { AccessError } from "../http/access-error.server.ts";
import { createRecipeRpc } from "../supabase/recipe-rpc.server.ts";
const schema = z.object({
  accountId: z.uuid(),
  items: z.array(pantryItemSchema).max(500),
  allergies: z.array(z.string()).max(30),
  excludedIngredients: z.array(z.string()).max(30),
});
export async function recipeRequestContext(
  request: Request,
  inventory: RecipeSearchRequest["inventory"],
  expectedAccountId: string | null,
) {
  const hasCredentials =
    !!request.headers.get("authorization") ||
    /(?:^|;\s*)(?:__Host-)?cookly-session=/.test(request.headers.get("cookie") ?? "");
  if (!hasCredentials && expectedAccountId === null)
    return {
      accountId: null,
      inventory,
      allergies: [] as string[],
      excludedIngredients: [] as string[],
      token: null,
    };
  const context = await requestContext(request),
    accountId = context.actor.id;
  if (accountId !== expectedAccountId) throw new RecipeSearchError("SESSION_CHANGED");
  const token =
    request.headers.get("authorization")?.slice(7) ??
    sessionFromCookieHeader(request.headers.get("cookie"))?.accessToken;
  if (!token) throw new AccessError("AUTH_REQUIRED");
  const own = schema.parse(
    await createRecipeRpc(getSupabaseEnv(), token).request("recipe_search_context"),
  );
  if (own.accountId !== accountId) throw new RecipeSearchError("UNAVAILABLE");
  return {
    accountId,
    inventory: own.items.map((i) => ({
      id: i.id,
      ingredientSlug: i.ingredient.slug,
      quantity: i.quantity,
      unit: i.unitCode,
      expiresOn: i.expiresOn,
    })),
    allergies: own.allergies,
    excludedIngredients: own.excludedIngredients,
    token,
  };
}
