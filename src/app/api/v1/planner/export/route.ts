import { getServerEnv } from "@/config/env/server";
import { plannerExportRequestSchema } from "@/features/meal-planner/contracts";
import { plannerExport } from "@/server/composition/planner.server";
import { privateJson } from "@/server/http/access-response.server";
import { readRecipeBody, plannerErrorResponse } from "@/server/http/recipe-response.server";
import { requireTrustedOrigin } from "@/server/auth/origin.server";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const id = crypto.randomUUID();
  try {
    requireTrustedOrigin(request.headers.get("origin"), getServerEnv().APP_BASE_URL);
    const input = plannerExportRequestSchema.safeParse(await readRecipeBody(request));
    if (!input.success)
      return privateJson(
        {
          error: {
            code: "INVALID_REQUEST",
            message: "Revizuiește lista și planul înainte de export.",
            requestId: id,
          },
        },
        id,
        400,
      );
    return privateJson(await plannerExport(request, input.data), id);
  } catch (e) {
    return plannerErrorResponse(e, id);
  }
}
