import "server-only";
import { parseSupabaseEnv } from "../../config/env/schema.ts";
import { PantryError } from "../../features/pantry/domain/pantry-error.ts";
import { AccessError } from "../http/access-error.server.ts";
import type { SupabaseConfig } from "./transport.server.ts";
export function createPantryRpc(
  source: SupabaseConfig,
  token: string,
  fetcher: typeof fetch = fetch,
) {
  const config = parseSupabaseEnv(source);
  return {
    async request(path: string, body: unknown): Promise<unknown> {
      if (!["get_my_pantry", "mutate_my_pantry"].includes(path))
        throw new PantryError("UNAVAILABLE");
      try {
        const response = await fetcher(
          new URL(`/rest/v1/rpc/${path}`, config.NEXT_PUBLIC_SUPABASE_URL),
          {
            method: "POST",
            credentials: "omit",
            cache: "no-store",
            redirect: "error",
            signal: AbortSignal.timeout(5000),
            headers: {
              apikey: config.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
              "Content-Profile": "api",
              "Accept-Profile": "api",
            },
            body: JSON.stringify(body),
          },
        );
        if (response.status === 401) {
          await response.body?.cancel();
          throw new AccessError("AUTH_REQUIRED");
        }
        if (response.status === 403) {
          await response.body?.cancel();
          throw new AccessError("FORBIDDEN");
        }
        const reader = response.body?.getReader();
        if (!reader) throw new PantryError("UNAVAILABLE");
        let text = "",
          size = 0;
        const decoder = new TextDecoder();
        try {
          for (;;) {
            const part = await reader.read();
            if (part.done) break;
            size += part.value.byteLength;
            if (size > 524288) {
              await reader.cancel();
              throw new PantryError("UNAVAILABLE");
            }
            text += decoder.decode(part.value, { stream: true });
          }
          text += decoder.decode();
        } finally {
          reader.releaseLock();
        }
        const data: unknown = JSON.parse(text);
        if (!response.ok) {
          const code =
            typeof data === "object" && data !== null && "code" in data ? data.code : null;
          if (code === "40001" || code === "23505") throw new PantryError("CONFLICT");
          if (code === "P0002") throw new PantryError("NOT_FOUND");
          if (code === "P0001") throw new PantryError("INSUFFICIENT_STOCK");
          if (code === "54000") throw new PantryError("CAPACITY");
          if (typeof code === "string" && /^(22|23)/.test(code))
            throw new PantryError("INVALID_INPUT");
          throw new PantryError("UNAVAILABLE");
        }
        return data;
      } catch (error) {
        if (error instanceof PantryError || error instanceof AccessError) throw error;
        throw new PantryError("UNAVAILABLE");
      }
    },
  };
}
