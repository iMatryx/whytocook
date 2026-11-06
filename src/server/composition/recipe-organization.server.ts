import "server-only";
import { getSupabaseEnv } from "../../config/env/server.ts";
import {
  organizationRequestSchema,
  organizationSnapshotSchema,
} from "../../features/recipes/contracts/organization.schema.ts";
import { RecipeSearchError } from "../../features/recipes/domain/search-error.ts";
import { requestContext } from "../auth/session.server.ts";
import { sessionFromCookieHeader } from "../auth/session-config.server.ts";
import { createRecipeRpc } from "../supabase/recipe-rpc.server.ts";
import { AccessError } from "../http/access-error.server.ts";
export async function organizationForRequest(request: Request, value?: unknown) {
  const hasCredentials =
    !!request.headers.get("authorization") ||
    /(?:^|;\s*)(?:__Host-)?cookly-session=/.test(request.headers.get("cookie") ?? "");
  if (!hasCredentials && value === undefined)
    return { accountId: null, favorites: [], collections: [], cooked: [], titles: {} };
  const context = await requestContext(request);
  const input = value === undefined ? null : organizationRequestSchema.parse(value);
  if (input && input.expectedAccountId !== context.actor.id)
    throw new RecipeSearchError("SESSION_CHANGED");
  const token =
    request.headers.get("authorization")?.slice(7) ??
    sessionFromCookieHeader(request.headers.get("cookie"))?.accessToken;
  if (!token) throw new AccessError("AUTH_REQUIRED");
  const rpc = createRecipeRpc(getSupabaseEnv(), token);
  const snapshot = organizationSnapshotSchema.parse(
    await rpc.request(
      input ? "mutate_recipe_organization" : "get_recipe_organization",
      input ? { p_command: input.command } : {},
    ),
  );
  if (snapshot.accountId !== context.actor.id) throw new RecipeSearchError("UNAVAILABLE");
  return snapshot;
}
