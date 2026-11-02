import "server-only";

import type { Actor, Role } from "../../shared/contracts/actor.schema.ts";
import { AccessError } from "../http/access-error.server.ts";

// actor must come from createVerifiedRequest, never request JSON/user_metadata.
export function requireRole(actor: Actor, allowed: readonly Role[]): void {
  if (!allowed.some((role) => actor.roles.includes(role))) throw new AccessError("FORBIDDEN");
  if (actor.aal !== "aal2") throw new AccessError("MFA_REQUIRED");
}
