import "server-only";
import { z } from "zod";

import { parseSupabaseEnv } from "../../config/env/schema.ts";
import { authSessionSchema } from "../../features/auth/contracts/auth.schema.ts";
import type { AuthSession } from "../../features/auth/contracts/auth.schema.ts";
import type { SupabaseConfig } from "../supabase/transport.server.ts";

const messages = {
  INVALID_CREDENTIALS: "Datele nu sunt valide sau contul nu este confirmat.",
  INVALID_LINK: "Linkul nu este valid sau a expirat. Solicită un link nou.",
  AUTH_UNAVAILABLE: "Serviciul de autentificare nu este disponibil. Reîncearcă.",
  RATE_LIMITED: "Prea multe încercări. Așteaptă puțin și reîncearcă.",
} as const;
export class AuthFlowError extends Error {
  readonly code: keyof typeof messages;
  constructor(code: keyof typeof messages) {
    super(messages[code]);
    this.name = "AuthFlowError";
    this.code = code;
  }
}
const tokenResponse = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  expires_in: z.number().int().min(1).max(86400),
  user: z.object({ id: z.uuid() }),
});
function sessionFrom(value: unknown, previous?: AuthSession, recovery = false): AuthSession {
  const result = tokenResponse.safeParse(value);
  if (!result.success || (previous && previous.userId !== result.data.user.id))
    throw new AuthFlowError("AUTH_UNAVAILABLE");
  const now = Math.floor(Date.now() / 1000);
  return authSessionSchema.parse({
    accessToken: result.data.access_token,
    refreshToken: result.data.refresh_token,
    userId: result.data.user.id,
    expiresAt: now + result.data.expires_in,
    validUntil: previous?.validUntil ?? now + 7 * 86400,
    ...(recovery
      ? { recoveryUntil: now + 600 }
      : previous?.recoveryUntil
        ? { recoveryUntil: previous.recoveryUntil }
        : {}),
  });
}

export function createAuthProvider(source: SupabaseConfig, fetcher: typeof fetch = fetch) {
  const config = parseSupabaseEnv(source);
  async function request(
    path: string,
    body: unknown,
    token?: string,
    method = "POST",
    enumerationSafe = false,
  ): Promise<unknown> {
    try {
      const response = await fetcher(new URL(`/auth/v1${path}`, config.NEXT_PUBLIC_SUPABASE_URL), {
        method,
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(5000),
        headers: {
          apikey: config.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      let text = "";
      let bytes = 0;
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (reader) {
        try {
          for (;;) {
            const part = await reader.read();
            if (part.done) break;
            bytes += part.value.byteLength;
            if (bytes > 262144) {
              await reader.cancel();
              throw new AuthFlowError("AUTH_UNAVAILABLE");
            }
            text += decoder.decode(part.value, { stream: true });
          }
          text += decoder.decode();
        } finally {
          reader.releaseLock();
        }
      }
      const value: unknown = text ? JSON.parse(text) : null;
      if (!response.ok) {
        const failure = z
          .object({ error_code: z.string().optional(), code: z.string().optional() })
          .safeParse(value);
        const code = failure.success ? (failure.data.error_code ?? failure.data.code) : undefined;
        if (
          enumerationSafe &&
          (code === "user_already_exists" || code === "user_not_found" || code === "email_exists")
        )
          return null;
        if (response.status === 429) throw new AuthFlowError("RATE_LIMITED");
        throw new AuthFlowError(
          response.status >= 500
            ? "AUTH_UNAVAILABLE"
            : path === "/verify"
              ? "INVALID_LINK"
              : "INVALID_CREDENTIALS",
        );
      }
      return value;
    } catch (error) {
      if (error instanceof AuthFlowError) throw error;
      throw new AuthFlowError("AUTH_UNAVAILABLE");
    }
  }
  async function allFactors(token: string) {
    const result = z
      .object({
        id: z.uuid(),
        factors: z
          .array(
            z.object({
              id: z.uuid(),
              status: z.string(),
              factor_type: z.string(),
              friendly_name: z.string().nullish(),
            }),
          )
          .optional(),
      })
      .safeParse(await request("/user", undefined, token, "GET"));
    if (!result.success) throw new AuthFlowError("AUTH_UNAVAILABLE");
    return result.data.factors ?? [];
  }
  return {
    async signIn(email: string, password: string) {
      return sessionFrom(await request("/token?grant_type=password", { email, password }));
    },
    async signUp(email: string, password: string) {
      await request("/signup", { email, password }, undefined, "POST", true);
    },
    async recover(email: string) {
      await request("/recover", { email }, undefined, "POST", true);
    },
    async resend(email: string) {
      await request("/resend", { email, type: "signup" }, undefined, "POST", true);
    },
    async verify(tokenHash: string, type: "email" | "recovery") {
      return sessionFrom(
        await request("/verify", { token_hash: tokenHash, type }),
        undefined,
        type === "recovery",
      );
    },
    async refresh(previous: AuthSession) {
      return sessionFrom(
        await request("/token?grant_type=refresh_token", { refresh_token: previous.refreshToken }),
        previous,
      );
    },
    async logout(token: string, scope: "local" | "global" = "local") {
      await request(`/logout?scope=${scope}`, undefined, token);
    },
    async signOut(previous: AuthSession) {
      const session =
        previous.expiresAt <= Math.floor(Date.now() / 1000) + 60
          ? sessionFrom(
              await request("/token?grant_type=refresh_token", {
                refresh_token: previous.refreshToken,
              }),
              previous,
            )
          : previous;
      await request("/logout?scope=local", undefined, session.accessToken);
    },
    async updatePassword(token: string, password: string) {
      await request("/user", { password }, token, "PUT");
    },
    async factors(token: string) {
      return (await allFactors(token)).filter(
        (factor) => factor.status === "verified" && factor.factor_type === "totp",
      );
    },
    async enrollTotp(token: string) {
      for (const factor of await allFactors(token)) {
        if (
          factor.factor_type === "totp" &&
          factor.status === "unverified" &&
          factor.friendly_name === "Cookly"
        )
          await request(`/factors/${factor.id}`, undefined, token, "DELETE");
      }
      const result = z
        .object({ id: z.uuid(), totp: z.object({ secret: z.string().min(10).max(256) }) })
        .safeParse(
          await request("/factors", { factor_type: "totp", friendly_name: "Cookly" }, token),
        );
      if (!result.success) throw new AuthFlowError("AUTH_UNAVAILABLE");
      return result.data;
    },
    async verifyTotp(previous: AuthSession, factorId: string, code: string) {
      if (!z.uuid().safeParse(factorId).success || !/^\d{6}$/.test(code))
        throw new AuthFlowError("INVALID_CREDENTIALS");
      const challenge = z
        .object({ id: z.uuid() })
        .safeParse(await request(`/factors/${factorId}/challenge`, {}, previous.accessToken));
      if (!challenge.success) throw new AuthFlowError("AUTH_UNAVAILABLE");
      return sessionFrom(
        await request(
          `/factors/${factorId}/verify`,
          { challenge_id: challenge.data.id, code },
          previous.accessToken,
        ),
        previous,
      );
    },
  };
}
