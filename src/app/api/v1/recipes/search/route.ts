import { getServerEnv } from "@/config/env/server";
import { recipeSearchRequestSchema } from "@/features/recipes/contracts";
import { requireTrustedOrigin } from "@/server/auth/origin.server";
import { searchRecipesForRequest } from "@/server/composition/recipes.server";
import { privateJson } from "@/server/http/access-response.server";
import { readRecipeBody, recipeErrorResponse } from "@/server/http/recipe-response.server";
export const dynamic = "force-dynamic";
export async function POST(request: Request): Promise<Response> {
  const id = crypto.randomUUID();
  try {
    requireTrustedOrigin(request.headers.get("origin"), getServerEnv().APP_BASE_URL);
    const parsed = recipeSearchRequestSchema.safeParse(await readRecipeBody(request));
    if (!parsed.success)
      return privateJson(
        {
          error: {
            code: "INVALID_REQUEST",
            message: "Verifică filtrele și inventarul.",
            requestId: id,
          },
        },
        id,
        400,
      );
    return privateJson(await searchRecipesForRequest(request, parsed.data), id);
  } catch (error) {
    return recipeErrorResponse(error, id);
  }
}
