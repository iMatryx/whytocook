import "server-only";
import { parseSupabaseEnv } from "../../config/env/schema.ts";
import type { SupabaseConfig } from "./transport.server.ts";
import { RecipeSearchError } from "../../features/recipes/domain/search-error.ts";
import { AccessError } from "../http/access-error.server.ts";
export function createRecipeRpc(
  source: SupabaseConfig,
  token?: string,
  fetcher: typeof fetch = fetch,
) {
  const config = parseSupabaseEnv(source);
  return {
    async request(
      path:
        | "recipe_search_snapshot"
        | "recipe_search_context"
        | "recipe_detail_metadata"
        | "get_recipe_actions"
        | "apply_recipe_action"
        | "get_recipe_organization"
        | "mutate_recipe_organization"
        | "smart_shopping_catalog"
        | "smart_shopping_snapshot"
        | "smart_shopping_mutate"
        | "meal_planner_metadata"
        | "meal_planner_snapshot"
        | "meal_planner_mutate"
        | "meal_planner_export",
      body: unknown = {},
    ): Promise<unknown> {
      if (
        ![
          "recipe_search_snapshot",
          "recipe_search_context",
          "recipe_detail_metadata",
          "get_recipe_actions",
          "apply_recipe_action",
          "get_recipe_organization",
          "mutate_recipe_organization",
          "smart_shopping_catalog",
          "smart_shopping_snapshot",
          "smart_shopping_mutate",
          "meal_planner_metadata",
          "meal_planner_snapshot",
          "meal_planner_mutate",
          "meal_planner_export",
        ].includes(path)
      )
        throw new RecipeSearchError("UNAVAILABLE");
      const privateCall = [
        "recipe_search_context",
        "get_recipe_actions",
        "apply_recipe_action",
        "get_recipe_organization",
        "mutate_recipe_organization",
        "smart_shopping_snapshot",
        "smart_shopping_mutate",
        "meal_planner_snapshot",
        "meal_planner_mutate",
        "meal_planner_export",
      ].includes(path);
      if (privateCall && !token) throw new AccessError("AUTH_REQUIRED");
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
              "Content-Type": "application/json",
              "Accept-Profile": "api",
              "Content-Profile": "api",
              ...(privateCall && token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify(body),
          },
        );
        if (response.status === 401 || response.status === 403) {
          await response.body?.cancel();
          throw new AccessError(response.status === 401 ? "AUTH_REQUIRED" : "FORBIDDEN");
        }
        const reader = response.body?.getReader();
        if (!reader) throw new RecipeSearchError("UNAVAILABLE");
        let text = "",
          size = 0;
        const decoder = new TextDecoder();
        try {
          for (;;) {
            const part = await reader.read();
            if (part.done) break;
            size += part.value.byteLength;
            if (size > 4 * 1024 * 1024) {
              await reader.cancel();
              throw new RecipeSearchError("CAPACITY");
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
          if (code === "P0002") throw new RecipeSearchError("NOT_FOUND");
          if (code === "40001") throw new RecipeSearchError("CONFLICT");
          if (code === "22023") throw new RecipeSearchError("INVALID_REQUEST");
          if (typeof data === "object" && data !== null && "code" in data && data.code === "54000")
            throw new RecipeSearchError("CAPACITY");
          throw new RecipeSearchError("UNAVAILABLE");
        }
        return data;
      } catch (error) {
        if (error instanceof AccessError || error instanceof RecipeSearchError) throw error;
        throw new RecipeSearchError("UNAVAILABLE");
      }
    },
  };
}
