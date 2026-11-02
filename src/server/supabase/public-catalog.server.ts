import "server-only";
import { parseSupabaseEnv } from "../../config/env/schema.ts";
import type { SupabaseConfig } from "./transport.server.ts";

export class CatalogRpcError extends Error {
  readonly databaseCode: string | null;
  constructor(code: string | null) {
    super("Catalog provider unavailable");
    this.name = "CatalogRpcError";
    this.databaseCode = code;
  }
}
export function createPublicCatalogTransport(
  source: SupabaseConfig,
  fetcher: typeof fetch = fetch,
) {
  const config = parseSupabaseEnv(source);
  return {
    async request(path: string, body: unknown): Promise<unknown> {
      if (
        ![
          "/rest/v1/rpc/search_ingredients",
          "/rest/v1/rpc/get_ingredient",
          "/rest/v1/rpc/list_ingredient_categories",
        ].includes(path)
      )
        throw new CatalogRpcError(null);
      try {
        const response = await fetcher(new URL(path, config.NEXT_PUBLIC_SUPABASE_URL), {
          method: "POST",
          cache: "no-store",
          credentials: "omit",
          redirect: "error",
          signal: AbortSignal.timeout(5000),
          headers: {
            apikey: config.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
            "Content-Type": "application/json",
            "Accept-Profile": "api",
            "Content-Profile": "api",
          },
          body: JSON.stringify(body),
        });
        const reader = response.body?.getReader();
        if (!reader) throw new CatalogRpcError(null);
        let text = "";
        let size = 0;
        const decoder = new TextDecoder();
        try {
          for (;;) {
            const part = await reader.read();
            if (part.done) break;
            size += part.value.byteLength;
            if (size > 262144) {
              await reader.cancel();
              throw new CatalogRpcError(null);
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
            typeof data === "object" &&
            data !== null &&
            "code" in data &&
            typeof data.code === "string" &&
            /^[A-Z0-9]{5}$/.test(data.code)
              ? data.code
              : null;
          throw new CatalogRpcError(code);
        }
        return data;
      } catch (error) {
        if (error instanceof CatalogRpcError) throw error;
        throw new CatalogRpcError(null);
      }
    },
  };
}
