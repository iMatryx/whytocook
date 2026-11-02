import "server-only";

import { z } from "zod";

import { actorSchema } from "../../shared/contracts/actor.schema.ts";
import { AccessError } from "../http/access-error.server.ts";
import { createSupabaseTransport } from "../supabase/transport.server.ts";
import type { SupabaseConfig } from "../supabase/transport.server.ts";
import { requireRole } from "./require-role.server.ts";

const resourceViews = {
  pantry: "my_pantry",
  meal_plan: "my_meal_plans",
  meal_entry: "my_meal_entries",
  shopping_list: "my_shopping_lists",
  shopping_item: "my_shopping_items",
} as const;
type OwnedResource = keyof typeof resourceViews;
const rowSchema = z.array(z.object({ id: z.uuid(), owner_id: z.uuid() })).max(1);
const storagePath =
  /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\.(jpg|jpeg|png|webp|json|zip)$/;

export async function createVerifiedRequest(
  authorization: string | null,
  config: SupabaseConfig,
  fetcher: typeof fetch = fetch,
) {
  if (
    !authorization ||
    authorization.length > 8200 ||
    !/^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(authorization)
  ) {
    throw new AccessError("AUTH_REQUIRED");
  }
  const transport = createSupabaseTransport(config, authorization.slice(7), fetcher);
  // The Auth service verifies the access token; local JWT decoding is not identity.
  const user = z.object({ id: z.uuid() }).safeParse(await transport.request("/auth/v1/user"));
  if (!user.success) throw new AccessError("ACCESS_UNAVAILABLE");
  const context = actorSchema.safeParse(await transport.request("/rest/v1/rpc/actor_context", {}));
  if (!context.success || context.data.id !== user.data.id)
    throw new AccessError("ACCESS_UNAVAILABLE");
  const actor = context.data;

  async function requireOwnedResource(kind: OwnedResource, resourceId: string): Promise<void> {
    const parsedId = z.uuid().safeParse(resourceId);
    if (!parsedId.success || !Object.hasOwn(resourceViews, kind))
      throw new AccessError("INVALID_RESOURCE");
    const query = new URLSearchParams({
      id: `eq.${parsedId.data}`,
      select: "id,owner_id",
      limit: "1",
    });
    const result = rowSchema.safeParse(
      await transport.request(`/rest/v1/${resourceViews[kind]}?${query}`),
    );
    if (!result.success) throw new AccessError("ACCESS_UNAVAILABLE");
    const row = result.data[0];
    if (!row || row.id !== parsedId.data || row.owner_id !== actor.id)
      throw new AccessError("RESOURCE_NOT_FOUND");
  }

  async function createPrivateDownload(
    bucket: "recipe-media" | "account-exports",
    path: string,
  ): Promise<string> {
    if (!storagePath.test(path) || path.split("/")[0] !== actor.id)
      throw new AccessError("INVALID_RESOURCE");
    if (bucket === "recipe-media") {
      requireRole(actor, ["editor", "admin"]);
      if (!/\.(jpg|jpeg|png|webp)$/.test(path)) throw new AccessError("INVALID_RESOURCE");
    } else if (bucket !== "account-exports" || !/\.(json|zip)$/.test(path)) {
      throw new AccessError("INVALID_RESOURCE");
    }
    const data = z
      .object({ signedURL: z.string().max(8192) })
      .safeParse(
        await transport.request(`/storage/v1/object/sign/${bucket}/${path}`, { expiresIn: 60 }),
      );
    if (!data.success) throw new AccessError("ACCESS_UNAVAILABLE");
    const expectedPath = `/storage/v1/object/sign/${bucket}/${path}`;
    const result = new URL(`/storage/v1${data.data.signedURL}`, transport.base);
    if (
      result.origin !== new URL(transport.base).origin ||
      result.pathname !== expectedPath ||
      !result.searchParams.has("token") ||
      result.hash
    ) {
      throw new AccessError("ACCESS_UNAVAILABLE");
    }
    return result.href;
  }
  return { actor, requireOwnedResource, createPrivateDownload };
}
