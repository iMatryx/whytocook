import { getServerEnv } from "@/config/env/server";
import { recipeDetailRequestSchema } from "@/features/recipes/contracts";
import { requireTrustedOrigin } from "@/server/auth/origin.server";
import { detailForRequest } from "@/server/composition/recipe-detail.server";
import { privateJson } from "@/server/http/access-response.server";
import { readRecipeBody, recipeErrorResponse } from "@/server/http/recipe-response.server";
export const dynamic = "force-dynamic";
export async function POST(request: Request): Promise<Response> {
  const id = crypto.randomUUID();
  try {
    requireTrustedOrigin(request.headers.get("origin"), getServerEnv().APP_BASE_URL);
    const input = recipeDetailRequestSchema.safeParse(await readRecipeBody(request));
    if (!input.success)
      return privateJson(
        {
          error: {
            code: "INVALID_REQUEST",
            message: "Verifică rețeta, porțiile și inventarul.",
            requestId: id,
          },
        },
        id,
        400,
      );
    return privateJson(await detailForRequest(request, input.data), id);
  } catch (error) {
    return recipeErrorResponse(error, id);
  }
}
