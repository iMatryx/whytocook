import "server-only";

import { parseSupabaseEnv } from "../../config/env/schema.ts";
import { AccessError } from "../http/access-error.server.ts";

export type SupabaseConfig = ReturnType<typeof parseSupabaseEnv>;

export function createSupabaseTransport(
  source: SupabaseConfig,
  token: string,
  fetcher: typeof fetch,
) {
  const config = parseSupabaseEnv(source);
  const base = config.NEXT_PUBLIC_SUPABASE_URL;

  async function request(path: string, body?: unknown): Promise<unknown> {
    try {
      const response = await fetcher(new URL(path, base), {
        method: body === undefined ? "GET" : "POST",
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(5000),
        headers: {
          apikey: config.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          "Content-Type": "application/json",
          "Accept-Profile": "api",
          "Content-Profile": "api",
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      if (!response.ok) {
        await response.body?.cancel();
        if (response.status === 401) throw new AccessError("AUTH_REQUIRED");
        if (response.status === 403) throw new AccessError("FORBIDDEN");
        if (response.status === 404) throw new AccessError("RESOURCE_NOT_FOUND");
        throw new AccessError("ACCESS_UNAVAILABLE");
      }
      if (response.status === 204 || response.status === 205) return null;
      if (!response.body) throw new AccessError("ACCESS_UNAVAILABLE");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let size = 0;
      let text = "";
      try {
        for (;;) {
          const chunk = await reader.read();
          if (chunk.done) break;
          size += chunk.value.byteLength;
          if (size > 262144) {
            await reader.cancel();
            throw new AccessError("ACCESS_UNAVAILABLE");
          }
          text += decoder.decode(chunk.value, { stream: true });
        }
        text += decoder.decode();
      } finally {
        reader.releaseLock();
      }
      return JSON.parse(text) as unknown;
    } catch (error) {
      if (error instanceof AccessError) throw error;
      throw new AccessError("ACCESS_UNAVAILABLE");
    }
  }
  return { request, base };
}
