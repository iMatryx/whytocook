import "server-only";
import { AccessError } from "../http/access-error.server.ts";

export function requireTrustedOrigin(actual: string | null, expected: string): void {
  if (actual !== new URL(expected).origin) throw new AccessError("FORBIDDEN");
}
