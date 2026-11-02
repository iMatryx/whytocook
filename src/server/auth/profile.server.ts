import "server-only";

import { getSupabaseEnv } from "../../config/env/server";
import {
  profileDataSchema,
  profileInputSchema,
  profileOptionsSchema,
} from "../../features/auth/contracts/profile.schema";
import type { ProfileInput } from "../../features/auth/contracts/profile.schema";
import { AccessError } from "../http/access-error.server";
import { createSupabaseTransport } from "../supabase/transport.server";
import { verifiedSession } from "./session.server";

export async function loadMyProfile(context: Awaited<ReturnType<typeof verifiedSession>>) {
  const { session, actor } = context;
  const db = createSupabaseTransport(getSupabaseEnv(), session.accessToken, fetch);
  const [rawProfile, rawOptions] = await Promise.all([
    db.request("/rest/v1/rpc/get_my_profile", {}),
    db.request("/rest/v1/rpc/profile_options", {}),
  ]);
  const profile = profileDataSchema.safeParse(rawProfile);
  const options = profileOptionsSchema.safeParse(rawOptions);
  if (!profile.success || !options.success || profile.data.id !== actor.id)
    throw new AccessError("ACCESS_UNAVAILABLE");
  return { profile: profile.data, options: options.data };
}
export async function saveMyProfile(value: ProfileInput) {
  const input = profileInputSchema.parse(value);
  const { session } = await verifiedSession(true);
  await createSupabaseTransport(getSupabaseEnv(), session.accessToken, fetch).request(
    "/rest/v1/rpc/save_my_profile",
    {
      p_display_name: input.displayName,
      p_locale: input.locale,
      p_time_zone: input.timeZone,
      p_household_size: input.householdSize,
      p_meal_budget: input.mealBudget || null,
      p_currency: input.currency,
      p_diet_ids: input.dietIds,
      p_allergen_ids: input.allergenIds,
      p_equipment_ids: input.equipmentIds,
    },
  );
}
