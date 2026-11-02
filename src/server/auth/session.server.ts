import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { getServerEnv, getSupabaseEnv } from "../../config/env/server";
import type { AuthSession } from "../../features/auth/contracts/auth.schema";
import { safeNext } from "../../features/auth/contracts/auth.schema";
import type { Role } from "../../shared/contracts/actor.schema";
import { AccessError } from "../http/access-error.server";
import { createAuthProvider } from "./provider.server";
import {
  authConfiguration,
  sessionCookieName,
  sessionCookieOptions,
  sessionFromCookieHeader,
} from "./session-config.server";
import { createVerifiedRequest } from "./request-context.server";
import { requireRole } from "./require-role.server";
import { openSession, sealSession } from "./session-crypto.server";
import { expiredSessionCookie } from "./session-cookie.server";
import { requireTrustedOrigin } from "./origin.server";

export async function currentSession(): Promise<AuthSession | null> {
  const store = await cookies();
  if (!store.has("cookly-session") && !store.has("__Host-cookly-session")) return null;
  const config = authConfiguration();
  return openSession(
    store.get(sessionCookieName(config.origin))?.value,
    config.secret,
    config.origin,
  );
}
export async function currentRecoverySession(): Promise<AuthSession | null> {
  const session = await currentSession();
  return session?.recoveryUntil && session.recoveryUntil > Math.floor(Date.now() / 1000)
    ? session
    : null;
}
export async function writeSession(session: AuthSession): Promise<void> {
  const config = authConfiguration();
  (await cookies()).set(
    sessionCookieName(config.origin),
    sealSession(session, config.secret, config.origin),
    sessionCookieOptions(config.origin, session.validUntil),
  );
}
export async function clearSession(): Promise<void> {
  const store = await cookies();
  for (const name of ["cookly-session", "__Host-cookly-session"]) {
    store.set(expiredSessionCookie(name));
  }
}
export async function assertActionOrigin(): Promise<void> {
  requireTrustedOrigin((await headers()).get("origin"), getServerEnv().APP_BASE_URL);
}
export async function verifiedSession(refresh = false) {
  let session = await currentSession();
  if (!session) throw new AccessError("AUTH_REQUIRED");
  if (refresh && session.expiresAt <= Math.floor(Date.now() / 1000) + 60) {
    session = await authProvider().refresh(session);
    await writeSession(session);
  }
  const context = await createVerifiedRequest(`Bearer ${session.accessToken}`, getSupabaseEnv());
  if (context.actor.id !== session.userId) throw new AccessError("AUTH_REQUIRED");
  return { session, actor: context.actor };
}
export async function requirePageActor(next: string, roles?: readonly Role[]) {
  let context;
  try {
    context = await verifiedSession();
  } catch (error) {
    if (error instanceof AccessError && (error.status === 401 || error.status === 403))
      redirect(`/login?next=${encodeURIComponent(safeNext(next))}`);
    throw error;
  }
  if (roles) {
    try {
      requireRole(context.actor, roles);
    } catch (error) {
      if (error instanceof AccessError && error.code === "MFA_REQUIRED")
        redirect(`/auth/mfa?next=${encodeURIComponent(safeNext(next))}`);
      redirect("/profile?notice=access-denied");
    }
  }
  return context;
}
export async function requestContext(request: Request) {
  const authorization = request.headers.get("authorization");
  if (authorization) return createVerifiedRequest(authorization, getSupabaseEnv());
  const session = sessionFromCookieHeader(request.headers.get("cookie"));
  if (!session) throw new AccessError("AUTH_REQUIRED");
  const context = await createVerifiedRequest(`Bearer ${session.accessToken}`, getSupabaseEnv());
  if (context.actor.id !== session.userId) throw new AccessError("AUTH_REQUIRED");
  return context;
}
export function authProvider() {
  return createAuthProvider(getSupabaseEnv());
}
