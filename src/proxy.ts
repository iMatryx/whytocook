import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import {
  authConfiguration,
  sessionCookieName,
  sessionCookieOptions,
  sessionFromCookieHeader,
} from "./server/auth/session-config.server";
import { AuthFlowError, createAuthProvider } from "./server/auth/provider.server";
import { sealSession } from "./server/auth/session-crypto.server";
import { expiredSessionCookie } from "./server/auth/session-cookie.server";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next();
  if (
    request.headers.has("authorization") ||
    (request.method !== "GET" && request.method !== "HEAD")
  )
    return response;
  const raw = request.headers.get("cookie");
  if (!raw || !/(?:^|;\s*)(?:__Host-)?cookly-session=/.test(raw)) return response;
  try {
    const session = sessionFromCookieHeader(raw);
    if (session && session.expiresAt <= Math.floor(Date.now() / 1000) + 60) {
      const config = authConfiguration();
      const refreshed = await createAuthProvider(config).refresh(session);
      const name = sessionCookieName(config.origin);
      const sealed = sealSession(refreshed, config.secret, config.origin);
      request.cookies.set(name, sealed);
      response = NextResponse.next({ request: { headers: request.headers } });
      response.cookies.set(name, sealed, sessionCookieOptions(config.origin, refreshed.validUntil));
    }
    if (!session) {
      for (const name of ["cookly-session", "__Host-cookly-session"]) {
        request.cookies.delete(name);
      }
      response = NextResponse.next({ request: { headers: request.headers } });
      response.cookies.set(expiredSessionCookie("cookly-session"));
      response.cookies.set(expiredSessionCookie("__Host-cookly-session"));
    }
  } catch (error) {
    if (error instanceof AuthFlowError && error.code === "INVALID_CREDENTIALS") {
      for (const name of ["cookly-session", "__Host-cookly-session"]) {
        request.cookies.delete(name);
      }
      response = NextResponse.next({ request: { headers: request.headers } });
      response.cookies.set(expiredSessionCookie("cookly-session"));
      response.cookies.set(expiredSessionCookie("__Host-cookly-session"));
    } else {
      // Preserve refresh credentials during a provider outage; no stale private data.
      response = NextResponse.next();
    }
  }
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Vary", "Cookie");
  return response;
}
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
