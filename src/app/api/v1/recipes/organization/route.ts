import { getServerEnv } from "@/config/env/server";
import { organizationRequestSchema } from "@/features/recipes/contracts";
import { requireTrustedOrigin } from "@/server/auth/origin.server";
import { organizationForRequest } from "@/server/composition/recipe-organization.server";
import { privateJson } from "@/server/http/access-response.server";
import { readRecipeBody, organizationErrorResponse } from "@/server/http/recipe-response.server";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const id = crypto.randomUUID();
  try {
    return privateJson(await organizationForRequest(request), id);
  } catch (error) {
    return organizationErrorResponse(error, id);
  }
}
export async function POST(request: Request) {
  const id = crypto.randomUUID();
  try {
    requireTrustedOrigin(request.headers.get("origin"), getServerEnv().APP_BASE_URL);
    const input = organizationRequestSchema.safeParse(await readRecipeBody(request));
    if (!input.success)
      return privateJson(
        {
          error: {
            code: "INVALID_REQUEST",
            message: "Verifică numele colecției și rețeta.",
            requestId: id,
          },
        },
        id,
        400,
      );
    return privateJson(await organizationForRequest(request, input.data), id);
  } catch (error) {
    return organizationErrorResponse(error, id);
  }
}
