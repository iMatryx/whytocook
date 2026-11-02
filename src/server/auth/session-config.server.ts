import "server-only";
import { getMutationEnv, getServerEnv, getSupabaseEnv } from "../../config/env/server";
import type { AuthSession } from "../../features/auth/contracts/auth.schema";
import { openSession } from "./session-crypto.server";

export function authConfiguration() {
  return {
    ...getSupabaseEnv(),
    origin: getServerEnv().APP_BASE_URL,
    secret: getMutationEnv().CSRF_SECRET,
  };
}
export function sessionCookieName(origin: string) {
  return origin.startsWith("https://") ? "__Host-cookly-session" : "cookly-session";
}
export function sessionCookieOptions(origin: string, validUntil: number) {
  return {
    httpOnly: true,
    secure: origin.startsWith("https://"),
    sameSite: "lax" as const,
    path: "/",
    maxAge: Math.max(0, validUntil - Math.floor(Date.now() / 1000)),
  };
}
export function sessionFromCookieHeader(header: string | null): AuthSession | null {
  if (!header || !/(?:^|;\s*)(?:__Host-)?cookly-session=/.test(header)) return null;
  const config = authConfiguration();
  const name = sessionCookieName(config.origin);
  const values = header
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.startsWith(`${name}=`));
  if (values.length !== 1) return null;
  return openSession(values[0]?.slice(name.length + 1), config.secret, config.origin);
}
