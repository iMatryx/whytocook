import { getServerEnv } from "@/config/env/server";
import { recipeActionRequestSchema } from "@/features/recipes/contracts";
import { requireTrustedOrigin } from "@/server/auth/origin.server";
import { recipeActionForRequest } from "@/server/composition/recipe-actions.server";
import { privateJson } from "@/server/http/access-response.server";
import { readRecipeBody, recipeErrorResponse } from "@/server/http/recipe-response.server";
export const dynamic = "force-dynamic";
export async function POST(request: Request): Promise<Response> {
  const id = crypto.randomUUID();
  try {
    requireTrustedOrigin(request.headers.get("origin"), getServerEnv().APP_BASE_URL);
    const input = recipeActionRequestSchema.safeParse(await readRecipeBody(request));
    if (!input.success)
      return privateJson(
        {
          error: {
            code: "INVALID_REQUEST",
            message: "Verifică acțiunea și cantitățile.",
            requestId: id,
          },
        },
        id,
        400,
      );
    return privateJson(await recipeActionForRequest(request, input.data), id);
  } catch (error) {
    return recipeErrorResponse(error, id);
  }
}
