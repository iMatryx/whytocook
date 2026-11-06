import { z } from "zod";
import { quantitySchema, unitCodeSchema, pantryIngredientSchema } from "./food-inventory.ts";
export const positiveQuantity = quantitySchema.refine((v) => !/^0(?:\.0+)?$/.test(v));
export const priceSchema = z
  .object({
    amount: z.string().regex(/^(?:0|[1-9]\d{0,5})(?:\.\d{1,2})?$/),
    currency: z.enum(["MDL", "RON"]),
    basisQuantity: positiveQuantity,
    basisUnit: unitCodeSchema,
    observedOn: z.iso.date(),
  })
  .strict()
  .refine((v) => v.basisUnit !== "piece" || /^\d+(?:\.0+)?$/.test(v.basisQuantity));
const pair = (v: { quantity: string | null; unitCode: string | null }) =>
  (v.quantity === null) === (v.unitCode === null) &&
  (v.unitCode !== "piece" || /^\d+(?:\.0+)?$/.test(v.quantity ?? ""));
export const itemFieldsSchema = z
  .object({
    label: z.string().trim().min(1).max(120),
    category: z.string().trim().min(1).max(80),
    quantity: positiveQuantity.nullable(),
    unitCode: unitCodeSchema.nullable(),
    checked: z.boolean(),
    price: priceSchema.nullable(),
    uncertain: z.boolean(),
  })
  .strict()
  .refine(pair);
export const shoppingItemSchema = itemFieldsSchema.safeExtend({
  id: z.uuid(),
  revision: z.string().regex(/^[1-9]\d{0,18}$/),
  ingredient: pantryIngredientSchema.nullable(),
  transferred: z.boolean(),
});
