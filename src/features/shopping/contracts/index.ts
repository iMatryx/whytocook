import { z } from "zod";
import { recipeInventorySchema } from "../../recipes/contracts/index.ts";
import { pantryIngredientSchema } from "../../../shared/contracts/food-inventory.ts";
import {
  positiveQuantity,
  priceSchema,
  itemFieldsSchema,
  shoppingItemSchema,
} from "../../../shared/contracts/shopping-item.ts";
export { positiveQuantity, priceSchema, itemFieldsSchema, shoppingItemSchema };
export const shoppingInputSchema = itemFieldsSchema.safeExtend({
  id: z.uuid(),
  ingredientId: z.uuid().nullable(),
});
export const shoppingCommandSchema = z.discriminatedUnion("kind", [
  z
    .object({ kind: z.literal("append"), items: z.array(shoppingInputSchema).min(1).max(100) })
    .strict()
    .refine((v) => new Set(v.items.map((i) => i.id)).size === v.items.length),
  z
    .object({
      kind: z.literal("update"),
      id: z.uuid(),
      expectedRevision: z.string().regex(/^[1-9]\d{0,18}$/),
      fields: itemFieldsSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("remove"),
      id: z.uuid(),
      expectedRevision: z.string().regex(/^[1-9]\d{0,18}$/),
    })
    .strict(),
  z
    .object({
      kind: z.literal("purchase"),
      confirmed: z.literal(true),
      lines: z
        .array(
          z
            .object({
              id: z.uuid(),
              expectedRevision: z.string().regex(/^[1-9]\d{0,18}$/),
              pantryItemId: z.uuid(),
            })
            .strict(),
        )
        .min(1)
        .max(50),
      location: z.enum(["pantry", "fridge", "freezer"]),
      expiresOn: z.iso.date().nullable(),
    })
    .strict()
    .refine(
      (v) =>
        new Set(v.lines.map((l) => l.id)).size === v.lines.length &&
        new Set(v.lines.map((l) => l.pantryItemId)).size === v.lines.length,
    ),
]);
export const shoppingSnapshotSchema = z
  .object({ accountId: z.uuid().nullable(), items: z.array(shoppingItemSchema).max(500) })
  .strict();
export const shoppingMutationSchema = z
  .object({ expectedAccountId: z.uuid(), operationId: z.uuid(), command: shoppingCommandSchema })
  .strict();
export const recipeSelectionSchema = z
  .object({
    slug: z
      .string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .max(100),
    servings: z.number().int().min(1).max(20),
  })
  .strict();
export type ShoppingItem = z.infer<typeof shoppingItemSchema>;
export type ShoppingInput = z.infer<typeof shoppingInputSchema>;
export type ShoppingCommand = z.infer<typeof shoppingCommandSchema>;
export type ShoppingSnapshot = z.infer<typeof shoppingSnapshotSchema>;
export type ShoppingPrice = z.infer<typeof priceSchema>;
export type RecipeSelection = z.infer<typeof recipeSelectionSchema>;
export const shoppingBootstrapSchema = shoppingSnapshotSchema
  .extend({
    catalog: z.array(pantryIngredientSchema).max(1000),
    recipes: z
      .array(z.object({ slug: z.string(), title: z.string(), servings: z.number().int() }).strict())
      .max(1000),
    source: z.enum(["published", "demo"]),
  })
  .strict();
export type ShoppingBootstrap = z.infer<typeof shoppingBootstrapSchema>;
export const shoppingPreviewSchema = z
  .object({
    items: z.array(shoppingItemSchema).max(100),
    explanations: z.array(z.string()).max(200),
  })
  .strict();
export const shoppingPreviewRequestSchema = z
  .object({
    source: z.enum(["published", "demo"]),
    selections: z
      .array(recipeSelectionSchema)
      .min(1)
      .max(20)
      .refine((v) => new Set(v.map((s) => s.slug)).size === v.length),
    inventory: recipeInventorySchema,
    today: z.iso.date(),
    expectedAccountId: z.uuid().nullable(),
    includeOptional: z.boolean(),
  })
  .strict();
