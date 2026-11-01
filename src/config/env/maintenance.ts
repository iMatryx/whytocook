import "server-only";

import { parseMaintenanceEnv } from "./schema";

export function getMaintenanceEnv() {
  return parseMaintenanceEnv(process.env);
}
