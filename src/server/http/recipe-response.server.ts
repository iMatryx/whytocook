import "server-only";
import { RecipeSearchError } from "../../features/recipes/domain/search-error.ts";
import { privateJson, accessErrorResponse } from "./access-response.server.ts";
export async function readRecipeBody(request: Request): Promise<unknown> {
  if (request.headers.get("content-type")?.split(";")[0]?.trim() !== "application/json")
    throw new RecipeSearchError("INVALID_REQUEST");
  const reader = request.body?.getReader();
  if (!reader) throw new RecipeSearchError("INVALID_REQUEST");
  let text = "",
    size = 0;
  const decoder = new TextDecoder();
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > 131072) {
        await reader.cancel();
        throw new RecipeSearchError("INVALID_REQUEST");
      }
      text += decoder.decode(part.value, { stream: true });
    }
    return JSON.parse(text + decoder.decode()) as unknown;
  } catch {
    throw new RecipeSearchError("INVALID_REQUEST");
  } finally {
    reader.releaseLock();
  }
}
export function recipeErrorResponse(error: unknown, id: string) {
  if (!(error instanceof RecipeSearchError)) return accessErrorResponse(error, id);
  const info = {
    NOT_FOUND: [404, "Rețeta nu a fost găsită sau nu mai este publicată."],
    CONFLICT: [409, "Rețeta sau acțiunea s-a schimbat. Reîncarcă pagina."],
    INVALID_REQUEST: [400, "Verifică filtrele, porțiile și inventarul."],
    UNAVAILABLE: [503, "Rețetele sau compatibilitatea nu sunt disponibile momentan."],
    CAPACITY: [503, "Catalogul depășește capacitatea curentă de căutare."],
    SESSION_CHANGED: [409, "Contul s-a schimbat. Reîncarcă inventarul și rețetele."],
  } as const;
  const [status, message] = info[error.code];
  return privateJson({ error: { code: error.code, message, requestId: id } }, id, status);
}
