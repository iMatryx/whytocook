import "server-only";

import { AccessError } from "./access-error.server.ts";

export function privateJson(value: unknown, requestId: string, status = 200): Response {
  return Response.json(value, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      Pragma: "no-cache",
      Vary: "Authorization, Cookie",
      "X-Request-Id": requestId,
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export function accessErrorResponse(error: unknown, requestId: string): Response {
  const safe = error instanceof AccessError ? error : new AccessError("ACCESS_UNAVAILABLE");
  return privateJson(
    { error: { code: safe.code, message: safe.message, requestId } },
    requestId,
    safe.status,
  );
}
