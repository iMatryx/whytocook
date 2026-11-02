import { ingredientSearchInputSchema } from "@/features/ingredients/contracts";
import { ingredientCatalog } from "@/server/composition/ingredients.server";
import { catalogJson, catalogErrorResponse } from "@/server/http/catalog-response.server";

export const dynamic = "force-dynamic";
export async function GET(request: Request): Promise<Response> {
  const requestId = crypto.randomUUID();
  try {
    const params = new URL(request.url).searchParams;
    const parsed = ingredientSearchInputSchema.safeParse(Object.fromEntries(params));
    if (!parsed.success || [...params.keys()].length !== new Set(params.keys()).size)
      return catalogJson(
        {
          error: {
            code: "INVALID_QUERY",
            message: "Verifică termenul, limba și paginarea.",
            requestId,
          },
        },
        requestId,
        400,
      );
    return catalogJson(await ingredientCatalog().search(parsed.data), requestId);
  } catch (error) {
    return catalogErrorResponse(error, requestId);
  }
}
