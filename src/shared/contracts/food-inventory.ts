import { z } from "zod";
export const unitCodeSchema = z.enum(["g", "kg", "ml", "l", "piece"]);
export const quantitySchema = z
  .string()
  .trim()
  .transform((value) => value.replace(",", "."))
  .pipe(z.string().regex(/^(?:0|[1-9]\d{0,11})(?:\.\d{1,6})?$/));
export const pantryIngredientSchema = z
  .object({
    id: z.uuid(),
    name: z.string().min(1).max(120),
    slug: z.string(),
    categoryId: z.uuid().nullable(),
    categoryName: z.string().nullable(),
    active: z.boolean(),
    allowedUnits: z.array(unitCodeSchema).max(5),
  })
  .strict();
