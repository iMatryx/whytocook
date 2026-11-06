import { getServerEnv } from "@/config/env/server";
import { shoppingPreviewRequestSchema } from "@/features/shopping/contracts";
import { shoppingPreview } from "@/server/composition/shopping.server";
import { privateJson } from "@/server/http/access-response.server";
import { readRecipeBody, shoppingErrorResponse } from "@/server/http/recipe-response.server";
import { requireTrustedOrigin } from "@/server/auth/origin.server";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const id = crypto.randomUUID();
  try {
    requireTrustedOrigin(request.headers.get("origin"), getServerEnv().APP_BASE_URL);
    const input = shoppingPreviewRequestSchema.safeParse(await readRecipeBody(request));
    if (!input.success)
      return privateJson(
        {
          error: {
            code: "INVALID_REQUEST",
            message: "Alege rețete, porții și un inventar valid.",
            requestId: id,
          },
        },
        id,
        400,
      );
    return privateJson(await shoppingPreview(request, input.data), id);
  } catch (e) {
    return shoppingErrorResponse(e, id);
  }
}
