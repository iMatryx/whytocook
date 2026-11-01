import "server-only";

import { parseMutationEnv, parseServerEnv, parseSupabaseEnv } from "./schema";

export function getServerEnv() {
  return parseServerEnv(process.env);
}

export function getSupabaseEnv() {
  return parseSupabaseEnv(process.env);
}

export function getMutationEnv() {
  return parseMutationEnv(process.env);
}
