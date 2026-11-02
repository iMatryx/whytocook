import "server-only";
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

import { authSessionSchema } from "../../features/auth/contracts/auth.schema.ts";
import type { AuthSession } from "../../features/auth/contracts/auth.schema.ts";

const lifetime = 7 * 86400;
function key(secret: string, origin: string): Buffer {
  if (Buffer.byteLength(secret) < 32) throw new Error("Auth session configuration unavailable");
  return Buffer.from(hkdfSync("sha256", secret, origin, "cookly-session-v1", 32));
}
export function sealSession(
  value: AuthSession,
  secret: string,
  origin: string,
  now = Math.floor(Date.now() / 1000),
): string {
  const session = authSessionSchema.parse(value);
  if (session.validUntil <= now || session.validUntil > now + lifetime)
    throw new Error("Invalid session lifetime");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(secret, origin), iv);
  cipher.setAAD(Buffer.from(`cookly-session-v1|${origin}`));
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(session), "utf8"),
    cipher.final(),
  ]);
  const result = [
    "v1",
    iv.toString("base64url"),
    ciphertext.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
  ].join(".");
  if (result.length > 3800) throw new Error("Session exceeds cookie limit");
  return result;
}
export function openSession(
  value: string | undefined,
  secret: string,
  origin: string,
  now = Math.floor(Date.now() / 1000),
): AuthSession | null {
  if (!value || value.length > 3800) return null;
  try {
    const [version, ivText, dataText, tagText, ...extra] = value.split(".");
    if (version !== "v1" || !ivText || !dataText || !tagText || extra.length) return null;
    const pieces = [ivText, dataText, tagText].map((part) => Buffer.from(part, "base64url"));
    if (
      pieces.some(
        (part, index) => part.toString("base64url") !== [ivText, dataText, tagText][index],
      )
    )
      return null;
    const [iv, data, tag] = pieces;
    if (!iv || !data || !tag || iv.length !== 12 || tag.length !== 16) return null;
    const decipher = createDecipheriv("aes-256-gcm", key(secret, origin), iv);
    decipher.setAAD(Buffer.from(`cookly-session-v1|${origin}`));
    decipher.setAuthTag(tag);
    const parsed = authSessionSchema.safeParse(
      JSON.parse(
        Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8"),
      ) as unknown,
    );
    if (!parsed.success || parsed.data.validUntil <= now || parsed.data.validUntil > now + lifetime)
      return null;
    return parsed.data;
  } catch {
    return null;
  }
}
