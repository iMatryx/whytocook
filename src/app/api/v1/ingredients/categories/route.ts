import { ingredientCatalog } from "@/server/composition/ingredients.server";
import { catalogJson, catalogErrorResponse } from "@/server/http/catalog-response.server";
export const dynamic = "force-dynamic";
export async function GET(): Promise<Response> {
  const id = crypto.randomUUID();
  try {
    return catalogJson(await ingredientCatalog().categories(), id);
  } catch (error) {
    return catalogErrorResponse(error, id);
  }
}
