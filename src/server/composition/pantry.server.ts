import "server-only";
import { getSupabaseEnv } from "@/config/env/server";
import { createPantryService } from "@/features/pantry/application/pantry.service";
import { createPantryRepository } from "@/features/pantry/infrastructure/pantry.repository.server";
import { requestContext } from "@/server/auth/session.server";
import { sessionFromCookieHeader } from "@/server/auth/session-config.server";
import { createPantryRpc } from "@/server/supabase/pantry-rpc.server";
import { AccessError } from "@/server/http/access-error.server";
export async function pantryForRequest(request: Request) {
  const context = await requestContext(request);
  const authorization = request.headers.get("authorization");
  const token = authorization
    ? authorization.slice(7)
    : sessionFromCookieHeader(request.headers.get("cookie"))?.accessToken;
  if (!token) throw new AccessError("AUTH_REQUIRED");
  return createPantryService(
    createPantryRepository(context.actor.id, createPantryRpc(getSupabaseEnv(), token)),
    context.actor.id,
  );
}
