import "server-only";
import { PantryError } from "@/features/pantry/domain/pantry-error";
import { accessErrorResponse, privateJson } from "./access-response.server";
const errors = {
  SESSION_CHANGED: {
    status: 409,
    message: "Contul s-a schimbat. Reîncarcă inventarul înainte de a salva.",
  },
  INVALID_INPUT: { status: 400, message: "Verifică ingredientul, cantitatea, unitatea și data." },
  NOT_FOUND: { status: 404, message: "Lotul nu mai este disponibil. Reîncarcă inventarul." },
  CONFLICT: {
    status: 409,
    message: "Inventarul s-a modificat. Reîncarcă și verifică din nou cantitățile.",
  },
  INSUFFICIENT_STOCK: { status: 409, message: "Cantitatea disponibilă nu este suficientă." },
  CAPACITY: { status: 409, message: "Inventarul permite maximum 500 de loturi." },
  UNAVAILABLE: { status: 503, message: "Inventarul nu este disponibil momentan. Reîncearcă." },
} as const;
export function pantryErrorResponse(error: unknown, id: string) {
  if (!(error instanceof PantryError)) return accessErrorResponse(error, id);
  const info = errors[error.code];
  return privateJson(
    { error: { code: error.code, message: info.message, requestId: id } },
    id,
    info.status,
  );
}
export async function readPantryBody(request: Request): Promise<unknown> {
  if (request.headers.get("content-type")?.split(";")[0]?.trim() !== "application/json")
    throw new PantryError("INVALID_INPUT");
  const reader = request.body?.getReader();
  if (!reader) throw new PantryError("INVALID_INPUT");
  const decoder = new TextDecoder();
  let size = 0,
    text = "";
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > 32768) {
        await reader.cancel();
        throw new PantryError("INVALID_INPUT");
      }
      text += decoder.decode(part.value, { stream: true });
    }
    return JSON.parse(text + decoder.decode()) as unknown;
  } catch (error) {
    if (error instanceof PantryError) throw error;
    throw new PantryError("INVALID_INPUT");
  } finally {
    reader.releaseLock();
  }
}
