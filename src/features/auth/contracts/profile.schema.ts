import { z } from "zod";

export const profileInputSchema = z.object({
  displayName: z.string().trim().min(1).max(80),
  locale: z.enum(["ro-RO", "en-GB"]),
  timeZone: z
    .string()
    .min(1)
    .max(100)
    .refine((value) => {
      try {
        new Intl.DateTimeFormat("ro", { timeZone: value });
        return true;
      } catch {
        return false;
      }
    }),
  householdSize: z.coerce.number().int().min(1).max(20),
  mealBudget: z
    .string()
    .trim()
    .regex(/^(?:|(?:0|[1-9]\d{0,5})(?:\.\d{1,2})?)$/)
    .refine((value) => value === "" || Number(value) > 0),
  currency: z.enum(["MDL", "RON", "EUR", "USD"]),
  dietIds: z
    .array(z.uuid())
    .max(20)
    .refine((values) => new Set(values).size === values.length),
  allergenIds: z
    .array(z.uuid())
    .max(30)
    .refine((values) => new Set(values).size === values.length),
  equipmentIds: z
    .array(z.uuid())
    .max(30)
    .refine((values) => new Set(values).size === values.length),
});
export type ProfileInput = z.infer<typeof profileInputSchema>;
const option = z.object({ id: z.uuid(), name: z.string() });
export const profileDataSchema = z.object({
  id: z.uuid(),
  display_name: z.string().nullable(),
  locale: z.enum(["ro-RO", "en-GB"]),
  time_zone: z.string(),
  household_size: z.number().int(),
  meal_budget: z.string().nullable(),
  currency: z.enum(["MDL", "RON", "EUR", "USD"]),
  diet_ids: z.array(z.uuid()),
  allergen_ids: z.array(z.uuid()),
  equipment_ids: z.array(z.uuid()),
});
export const profileOptionsSchema = z.object({
  diets: z.array(option),
  allergens: z.array(option),
  equipment: z.array(option),
});
export type ProfileData = z.infer<typeof profileDataSchema>;
export type ProfileOptions = z.infer<typeof profileOptionsSchema>;
