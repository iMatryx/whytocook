import { z } from "zod";

export const unitCodeSchema = z.enum(["g", "kg", "ml", "l", "piece"]);
export const quantitySchema = z
  .string()
  .trim()
  .transform((value) => value.replace(",", "."))
  .pipe(z.string().regex(/^(?:0|[1-9]\d{0,11})(?:\.\d{1,6})?$/));
export const revisionSchema = z.string().regex(/^[1-9]\d{0,18}$/);
const day = z.iso.date().refine((value) => value >= "1900-01-01");
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
export type PantryIngredient = z.infer<typeof pantryIngredientSchema>;
export const pantryItemSchema = z
  .object({
    id: z.uuid(),
    ingredient: pantryIngredientSchema,
    quantity: quantitySchema.nullable(),
    unitCode: z.string().max(32).nullable(),
    location: z.enum(["pantry", "fridge", "freezer"]),
    expiresOn: day.nullable(),
    revision: revisionSchema,
    createdAt: z.iso.datetime({ offset: true }),
    updatedAt: z.iso.datetime({ offset: true }),
  })
  .strict()
  .refine((value) => (value.quantity === null) === (value.unitCode === null));
export type PantryItem = z.infer<typeof pantryItemSchema>;
const fields = {
  ingredientId: z.uuid(),
  quantity: quantitySchema.nullable(),
  unitCode: unitCodeSchema.nullable(),
  location: z.enum(["pantry", "fridge", "freezer"]),
  expiresOn: day.nullable(),
};
const pair = (value: { quantity: string | null; unitCode: string | null }) =>
  (value.quantity === null) === (value.unitCode === null) &&
  (value.unitCode !== "piece" ||
    value.quantity === null ||
    !value.quantity.includes(".") ||
    /^\d+\.0+$/.test(value.quantity));
const create = z
  .object({ kind: z.literal("create"), id: z.uuid(), ...fields })
  .strict()
  .refine(pair);
const update = z
  .object({ kind: z.literal("update"), id: z.uuid(), expectedRevision: revisionSchema, ...fields })
  .strict()
  .refine(pair);
export const consumptionLineSchema = z
  .object({
    itemId: z.uuid(),
    expectedRevision: revisionSchema,
    quantity: quantitySchema.refine((value) => !/^0(?:\.0+)?$/.test(value)),
    unitCode: unitCodeSchema,
  })
  .strict()
  .refine((value) => pair(value));
export type ConsumptionLine = z.infer<typeof consumptionLineSchema>;
const consume = z
  .object({
    kind: z.literal("consume"),
    confirmed: z.literal(true),
    lines: z.array(consumptionLineSchema).min(1).max(50),
  })
  .strict()
  .refine((value) => new Set(value.lines.map((line) => line.itemId)).size === value.lines.length);
export const pantryCommandSchema = z.union([
  create,
  update,
  z.object({ kind: z.literal("delete"), id: z.uuid(), expectedRevision: revisionSchema }).strict(),
  consume,
]);
export type PantryCommand = z.infer<typeof pantryCommandSchema>;
export const pantryRequestSchema = z
  .object({ operationId: z.uuid(), expectedAccountId: z.uuid(), command: pantryCommandSchema })
  .strict();
export const pantryResponseSchema = z
  .object({
    mode: z.literal("account"),
    accountId: z.uuid(),
    items: z.array(pantryItemSchema).max(500),
  })
  .strict();
export const guestStateSchema = z
  .object({
    version: z.literal(1),
    revision: revisionSchema,
    items: z.array(pantryItemSchema).max(500),
    operations: z.array(z.object({ id: z.uuid(), command: pantryCommandSchema }).strict()).max(100),
  })
  .strict()
  .refine((value) => new Set(value.items.map((item) => item.id)).size === value.items.length);
export type GuestState = z.infer<typeof guestStateSchema>;
