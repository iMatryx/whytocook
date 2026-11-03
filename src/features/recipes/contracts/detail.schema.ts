import { z } from "zod";
import {
  recipeInventorySchema,
  searchRecipeSchema,
  recipeCompatibilitySchema,
  recipeFiltersSchema,
} from "./search.schema.ts";
import { sourceSchema } from "./recipe-bundle.schema.ts";
const slug = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(100);
const decimal = z.string().regex(/^(?:0|[1-9]\d{0,11})(?:\.\d{1,6})?$/);
export const detailQuerySchema = z
  .object({
    source: z.enum(["published", "demo"]).default("published"),
    servings: z.number().int().min(1).max(20).nullable().default(null),
    allergy: recipeFiltersSchema.shape.allergy,
    exclude: recipeFiltersSchema.shape.exclude,
  })
  .strict();
export const recipeDetailRequestSchema = detailQuerySchema
  .extend({
    slug,
    inventory: recipeInventorySchema,
    today: z.iso.date(),
    expectedAccountId: z.uuid().nullable(),
  })
  .strict();
export type RecipeDetailRequest = z.infer<typeof recipeDetailRequestSchema>;
const safePhoto = z
  .string()
  .max(2048)
  .refine(
    (v) =>
      /^\/recipes\/[a-z0-9-]+\.(?:png|webp|jpe?g)$/.test(v) ||
      (v.startsWith("https://") && URL.canParse(v)),
  );
export const photoSchema = z
  .object({
    url: safePhoto,
    alt: z.string().min(1).max(300),
    credit: z.string().min(1).max(500),
    generated: z.boolean(),
  })
  .strict();
export const fullNutritionSchema = z
  .object({
    status: z.enum(["unavailable", "verified"]),
    perServing: z
      .object({
        energyKcal: decimal,
        proteinG: decimal,
        carbohydrateG: decimal,
        fatG: decimal,
        fiberG: decimal,
        saltG: decimal,
      })
      .strict()
      .nullable(),
    source: sourceSchema.nullable(),
  })
  .strict()
  .refine((v) =>
    v.status === "verified"
      ? v.perServing !== null && v.source !== null
      : v.perServing === null && v.source === null,
  );
export const detailMetadataSchema = z
  .object({
    recipeId: z.uuid().nullable(),
    revision: z.number().int().positive(),
    photo: photoSchema.nullable(),
    stepTimers: z.array(z.number().int().min(1).max(604800).nullable()).max(30),
    nutrition: fullNutritionSchema,
  })
  .strict();
export const recipeActionStateSchema = z
  .object({
    favorite: z.boolean(),
    lastCookedAt: z.iso.datetime({ offset: true }).nullable(),
    addedCount: z.number().int().nonnegative(),
  })
  .strict();
const shoppingItem = z
  .object({
    ingredientSlug: slug,
    label: z.string().trim().min(1).max(120),
    quantity: decimal.refine((v) => !/^0(?:\.0+)?$/.test(v)),
    unitCode: z.enum(["g", "kg", "ml", "l", "piece"]),
  })
  .strict()
  .refine((v) => v.unitCode !== "piece" || /^\d+(?:\.0+)?$/.test(v.quantity));
export const recipeActionCommandSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("favorite"), enabled: z.boolean() }).strict(),
  z
    .object({
      kind: z.literal("shopping"),
      items: z
        .array(shoppingItem)
        .min(1)
        .max(50)
        .refine(
          (v) => new Set(v.map((i) => `${i.ingredientSlug}:${i.unitCode}`)).size === v.length,
        ),
    })
    .strict(),
  z.object({ kind: z.literal("cooked"), servings: z.number().int().min(1).max(20) }).strict(),
]);
export type RecipeActionCommand = z.infer<typeof recipeActionCommandSchema>;
export const recipeActionRequestSchema = z
  .object({
    slug,
    revision: z.number().int().positive(),
    operationId: z.uuid(),
    expectedAccountId: z.uuid(),
    command: recipeActionCommandSchema,
  })
  .strict();
export const recipeDetailResponseSchema = z
  .object({
    source: z.enum(["published", "demo"]),
    accountId: z.uuid().nullable(),
    recipe: searchRecipeSchema,
    servings: z.number().int().min(1).max(20),
    compatibility: recipeCompatibilitySchema.nullable(),
    metadata: detailMetadataSchema,
    scaledIngredients: z.array(
      z
        .object({
          ingredientSlug: slug,
          quantity: z.string().nullable(),
          unitCode: z.string(),
          rounded: z.boolean(),
        })
        .strict(),
    ),
    similar: z.array(searchRecipeSchema).max(4),
    blocked: z.boolean(),
    blockReason: z.string().nullable(),
    actions: recipeActionStateSchema.nullable(),
  })
  .strict();
export type RecipeDetailResponse = z.infer<typeof recipeDetailResponseSchema>;
export type RecipeActionState = z.infer<typeof recipeActionStateSchema>;
export const cookingSessionSchema = z
  .object({
    version: z.literal(1),
    step: z.number().int().min(0).max(29),
    timers: z
      .array(
        z
          .object({
            durationMs: z.number().int().min(1000).max(604800000),
            remainingMs: z.number().int().min(0).max(604800000),
            deadlineMs: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).nullable(),
          })
          .strict()
          .refine((v) => v.remainingMs <= v.durationMs),
      )
      .max(30),
  })
  .strict();
export type CookingSession = z.infer<typeof cookingSessionSchema>;
