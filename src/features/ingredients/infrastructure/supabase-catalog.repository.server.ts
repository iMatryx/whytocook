import "server-only";
import {
  catalogPageSchema,
  ingredientDetailSchema,
  categoryListSchema,
} from "../contracts/ingredient.schema.ts";
import { CatalogError } from "../domain/catalog-error.ts";
import type { IngredientCatalogRepository } from "../application/catalog.port.ts";
import { CatalogRpcError } from "../../../server/supabase/public-catalog.server.ts";

export function createSupabaseCatalogRepository(client: {
  request(path: string, body: unknown): Promise<unknown>;
}): IngredientCatalogRepository {
  async function call(path: string, body: unknown) {
    try {
      return await client.request(`/rest/v1/rpc/${path}`, body);
    } catch (error) {
      if (error instanceof CatalogRpcError) {
        if (error.databaseCode === "40001") throw new CatalogError("CATALOG_CHANGED");
        if (error.databaseCode === "P0002") throw new CatalogError("NOT_FOUND");
        if (error.databaseCode === "22023") throw new CatalogError("INVALID_QUERY");
      }
      throw new CatalogError("UNAVAILABLE");
    }
  }
  return {
    async search(binding, continuation) {
      const result = catalogPageSchema.safeParse(
        await call("search_ingredients", {
          p_query: binding.query,
          p_locale: binding.locale,
          p_category_id: binding.categoryId,
          p_limit: binding.limit,
          p_version: continuation?.version ?? null,
          p_after_rank: continuation?.after.rank ?? null,
          p_after_name: continuation?.after.name ?? null,
          p_after_id: continuation?.after.id ?? null,
        }),
      );
      if (!result.success) throw new CatalogError("UNAVAILABLE");
      return result.data;
    },
    async detail(id, locale) {
      const result = ingredientDetailSchema.safeParse(
        await call("get_ingredient", { p_id: id, p_locale: locale }),
      );
      if (!result.success) throw new CatalogError("UNAVAILABLE");
      return result.data;
    },
    async categories() {
      const result = categoryListSchema.safeParse(await call("list_ingredient_categories", {}));
      if (!result.success) throw new CatalogError("UNAVAILABLE");
      return result.data;
    },
  };
}
