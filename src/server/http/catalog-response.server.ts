import "server-only";
import { CatalogError } from "@/features/ingredients/domain/catalog-error";

export function catalogJson(value: unknown, requestId: string, status = 200) {
  return Response.json(value, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Request-Id": requestId,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
export function catalogErrorResponse(error: unknown, requestId: string) {
  const code = error instanceof CatalogError ? error.code : "UNAVAILABLE";
  const status = {
    INVALID_QUERY: 400,
    INVALID_CURSOR: 400,
    CATALOG_CHANGED: 409,
    NOT_FOUND: 404,
    UNAVAILABLE: 503,
  }[code];
  const message = {
    INVALID_QUERY: "Verifică termenul, limba și paginarea.",
    INVALID_CURSOR: "Pagina nu este validă. Reîncepe căutarea.",
    CATALOG_CHANGED: "Catalogul s-a modificat. Reîncepe căutarea.",
    NOT_FOUND: "Ingredientul nu este disponibil.",
    UNAVAILABLE: "Catalogul nu este disponibil momentan. Reîncearcă.",
  }[code];
  return catalogJson({ error: { code, message, requestId } }, requestId, status);
}
