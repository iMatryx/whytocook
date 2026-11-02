import { z } from "zod";
import { catalogLocaleSchema } from "@/features/ingredients/contracts";
import { ingredientCatalog } from "@/server/composition/ingredients.server";
import { catalogJson, catalogErrorResponse } from "@/server/http/catalog-response.server";
export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ ingredientId: string }> },
): Promise<Response> {
  const id = crypto.randomUUID();
  try {
    const url = new URL(request.url);
    const input = z
      .object({ ingredientId: z.uuid(), locale: catalogLocaleSchema.default("ro-RO") })
      .strict()
      .safeParse({ ...(await params), ...Object.fromEntries(url.searchParams) });
    if (
      !input.success ||
      [...url.searchParams.keys()].some((key) => key !== "locale") ||
      url.searchParams.getAll("locale").length > 1
    )
      return catalogJson(
        {
          error: {
            code: "INVALID_QUERY",
            message: "Identificator sau limbă invalidă.",
            requestId: id,
          },
        },
        id,
        400,
      );
    return catalogJson(
      await ingredientCatalog().detail(input.data.ingredientId, input.data.locale),
      id,
    );
  } catch (error) {
    return catalogErrorResponse(error, id);
  }
}
