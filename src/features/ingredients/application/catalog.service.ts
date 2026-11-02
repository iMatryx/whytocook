import { ingredientSearchInputSchema } from "../contracts/ingredient.schema.ts";
import type {
  IngredientSearchInput,
  IngredientSearchResult,
} from "../contracts/ingredient.schema.ts";
import { ingredientSearchKey } from "../domain/search-key.ts";
import { CatalogError } from "../domain/catalog-error.ts";
import type { CatalogCursorCodec, IngredientCatalogRepository } from "./catalog.port.ts";

export function createIngredientCatalog(
  repository: IngredientCatalogRepository,
  codec: CatalogCursorCodec,
) {
  return {
    async search(value: IngredientSearchInput): Promise<IngredientSearchResult> {
      const parsed = ingredientSearchInputSchema.safeParse(value);
      if (!parsed.success) throw new CatalogError("INVALID_QUERY");
      const input = parsed.data;
      const query = ingredientSearchKey(input.query);
      if (input.query !== "" && query.length < 2) throw new CatalogError("INVALID_QUERY");
      const binding = {
        query,
        locale: input.locale,
        categoryId: input.categoryId?.toLowerCase() ?? null,
        limit: input.limit,
      };
      const continuation = input.cursor ? codec.decode(input.cursor, binding) : null;
      const page = await repository.search(binding, continuation);
      if (continuation && page.version !== continuation.version)
        throw new CatalogError("CATALOG_CHANGED");
      return {
        items: page.items,
        catalogVersion: page.version,
        nextCursor: page.next
          ? codec.encode({ version: page.version, after: page.next }, binding)
          : null,
      };
    },
    detail: repository.detail.bind(repository),
    categories: repository.categories.bind(repository),
  };
}
