import { z } from "zod";
import { getServerEnv } from "@/config/env/server";
import { plannerDay, plannerRequestSchema } from "@/features/meal-planner/contracts";
import { plannerBootstrap, plannerMutation } from "@/server/composition/planner.server";
import { privateJson } from "@/server/http/access-response.server";
import { readRecipeBody, plannerErrorResponse } from "@/server/http/recipe-response.server";
import { requireTrustedOrigin } from "@/server/auth/origin.server";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const id = crypto.randomUUID();
  try {
    const params = new URL(request.url).searchParams,
      starts = plannerDay.safeParse(params.get("startsOn")),
      source = z.enum(["demo", "published"]).safeParse(params.get("source") ?? "published");
    if (!starts.success || !source.success)
      return privateJson(
        {
          error: {
            code: "INVALID_REQUEST",
            message: "Alege data și sursa planului.",
            requestId: id,
          },
        },
        id,
        400,
      );
    return privateJson(await plannerBootstrap(request, starts.data, source.data), id);
  } catch (e) {
    return plannerErrorResponse(e, id);
  }
}
export async function POST(request: Request) {
  const id = crypto.randomUUID();
  try {
    requireTrustedOrigin(request.headers.get("origin"), getServerEnv().APP_BASE_URL);
    const input = plannerRequestSchema.safeParse(await readRecipeBody(request));
    if (!input.success)
      return privateJson(
        {
          error: {
            code: "INVALID_REQUEST",
            message: "Verifică masa, porțiile, bugetul și datele.",
            requestId: id,
          },
        },
        id,
        400,
      );
    return privateJson(await plannerMutation(request, input.data), id);
  } catch (e) {
    return plannerErrorResponse(e, id);
  }
}
