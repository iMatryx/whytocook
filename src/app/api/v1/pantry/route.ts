import { getServerEnv } from "@/config/env/server";
import { pantryRequestSchema } from "@/features/pantry/contracts";
import { requireTrustedOrigin } from "@/server/auth/origin.server";
import { pantryForRequest } from "@/server/composition/pantry.server";
import { privateJson } from "@/server/http/access-response.server";
import { pantryErrorResponse, readPantryBody } from "@/server/http/pantry-response.server";
export const dynamic = "force-dynamic";
export async function GET(request: Request): Promise<Response> {
  const id = crypto.randomUUID();
  try {
    const pantry = await pantryForRequest(request);
    return privateJson(
      { mode: "account", accountId: pantry.accountId, items: await pantry.load() },
      id,
    );
  } catch (error) {
    return pantryErrorResponse(error, id);
  }
}
export async function POST(request: Request): Promise<Response> {
  const id = crypto.randomUUID();
  try {
    requireTrustedOrigin(request.headers.get("origin"), getServerEnv().APP_BASE_URL);
    const input = pantryRequestSchema.safeParse(await readPantryBody(request));
    if (!input.success)
      return privateJson(
        { error: { code: "INVALID_INPUT", message: "Verifică datele introduse.", requestId: id } },
        id,
        400,
      );
    const pantry = await pantryForRequest(request);
    return privateJson(
      { mode: "account", accountId: pantry.accountId, items: await pantry.mutate(input.data) },
      id,
    );
  } catch (error) {
    return pantryErrorResponse(error, id);
  }
}
