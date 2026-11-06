import { z } from "zod";
import { getServerEnv } from "@/config/env/server";
import { shoppingMutationSchema } from "@/features/shopping/contracts";
import { shoppingBootstrap, shoppingMutation } from "@/server/composition/shopping.server";
import { privateJson } from "@/server/http/access-response.server";
import { readRecipeBody, shoppingErrorResponse } from "@/server/http/recipe-response.server";
import { requireTrustedOrigin } from "@/server/auth/origin.server";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const id = crypto.randomUUID();
  try {
    const source = z
      .enum(["published", "demo"])
      .safeParse(new URL(request.url).searchParams.get("source") ?? "published");
    if (!source.success)
      return privateJson(
        {
          error: {
            code: "INVALID_REQUEST",
            message: "Alege sursa published sau demo.",
            requestId: id,
          },
        },
        id,
        400,
      );
    return privateJson(await shoppingBootstrap(request, source.data), id);
  } catch (e) {
    return shoppingErrorResponse(e, id);
  }
}
export async function POST(request: Request) {
  const id = crypto.randomUUID();
  try {
    requireTrustedOrigin(request.headers.get("origin"), getServerEnv().APP_BASE_URL);
    const input = shoppingMutationSchema.safeParse(await readRecipeBody(request));
    if (!input.success)
      return privateJson(
        {
          error: {
            code: "INVALID_REQUEST",
            message: "Verifică lista, cantitățile și confirmarea.",
            requestId: id,
          },
        },
        id,
        400,
      );
    return privateJson(await shoppingMutation(request, input.data), id);
  } catch (e) {
    return shoppingErrorResponse(e, id);
  }
}
