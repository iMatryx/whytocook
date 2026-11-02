import type {
  CatalogPage,
  CatalogPosition,
  IngredientDetail,
  IngredientSearchInput,
} from "../contracts/ingredient.schema.ts";

export type CatalogBinding = {
  query: string;
  locale: IngredientSearchInput["locale"];
  categoryId: string | null;
  limit: number;
};
export type CatalogContinuation = { version: string; after: CatalogPosition };
export interface CatalogCursorCodec {
  encode(value: CatalogContinuation, binding: CatalogBinding): string;
  decode(value: string, binding: CatalogBinding): CatalogContinuation;
}
export interface IngredientCatalogRepository {
  search(binding: CatalogBinding, continuation: CatalogContinuation | null): Promise<CatalogPage>;
  detail(id: string, locale: IngredientSearchInput["locale"]): Promise<IngredientDetail>;
  categories(): Promise<{ id: string; slug: string; name: string }[]>;
}
