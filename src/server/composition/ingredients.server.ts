import "server-only";
import { getSupabaseEnv } from "@/config/env/server";
import { createIngredientCatalog } from "@/features/ingredients/application/catalog.service";
import { createCatalogCursorCodec } from "@/features/ingredients/infrastructure/cursor-codec.server";
import { createSupabaseCatalogRepository } from "@/features/ingredients/infrastructure/supabase-catalog.repository.server";
import { createPublicCatalogTransport } from "@/server/supabase/public-catalog.server";

export function ingredientCatalog() {
  return createIngredientCatalog(
    createSupabaseCatalogRepository({
      request: (path, body) => createPublicCatalogTransport(getSupabaseEnv()).request(path, body),
    }),
    createCatalogCursorCodec(),
  );
}
