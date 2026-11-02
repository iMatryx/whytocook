import { z } from "zod";

export const catalogLocaleSchema = z.enum(["ro-RO", "ru-RU", "en-GB"]);
const searchable = /^[\p{L}\p{M}\p{N}\s'’\-]*$/u;
export const ingredientSearchInputSchema = z
  .object({
    query: z
      .string()
      .trim()
      .max(80)
      .default("")
      .refine(
        (value) =>
          value === "" ||
          (value.length >= 2 &&
            searchable.test(value) &&
            /[\p{L}\p{N}]/u.test(value) &&
            value.split(/[\s'’\-]+/u).filter(Boolean).length <= 8),
      ),
    locale: catalogLocaleSchema.default("ro-RO"),
    categoryId: z.uuid().optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    cursor: z
      .string()
      .max(1024)
      .regex(/^[A-Za-z0-9_-]+$/)
      .optional(),
  })
  .strict();
export type IngredientSearchInput = z.infer<typeof ingredientSearchInputSchema>;
const category = z.object({ id: z.uuid(), slug: z.string(), name: z.string() });
const unit = z.object({
  id: z.uuid(),
  code: z.string(),
  name: z.string(),
  dimension: z.enum(["mass", "volume", "count"]),
  isDefault: z.boolean(),
});
const decimal = z.string().regex(/^\d+(?:\.\d+)?$/);
export const ingredientSummarySchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  canonicalName: z.string().min(1),
  name: z.string().min(1),
  matchedTerm: z.string().nullable(),
  category: category.nullable(),
  kind: z.enum(["generic", "specific"]),
  broader: z
    .object({ id: z.uuid(), name: z.string(), relation: z.enum(["part_of", "variant_of"]) })
    .nullable(),
});
export type IngredientSummary = z.infer<typeof ingredientSummarySchema>;
export const catalogPositionSchema = z
  .object({ rank: z.number().int().min(0).max(6), name: z.string().min(1).max(240), id: z.uuid() })
  .strict();
export type CatalogPosition = z.infer<typeof catalogPositionSchema>;
export const catalogPageSchema = z.object({
  items: z.array(ingredientSummarySchema).max(50),
  version: z.string().regex(/^[1-9]\d*$/),
  next: catalogPositionSchema.nullable(),
});
export type CatalogPage = z.infer<typeof catalogPageSchema>;
export const ingredientSearchResultSchema = z.object({
  items: z.array(ingredientSummarySchema).max(50),
  catalogVersion: z.string().regex(/^[1-9]\d*$/),
  nextCursor: z.string().nullable(),
});
export type IngredientSearchResult = z.infer<typeof ingredientSearchResultSchema>;
export const categoryListSchema = z.array(category).max(200);
export const ingredientDetailSchema = ingredientSummarySchema
  .extend({
    aliases: z
      .array(z.object({ locale: catalogLocaleSchema, label: z.string(), preferred: z.boolean() }))
      .max(200),
    units: z.array(unit).max(50),
    nutrition: z.object({
      status: z.enum(["unavailable", "partial", "available"]),
      basis: z.literal("100g"),
      energyKcal: decimal.nullable(),
      proteinG: decimal.nullable(),
      carbohydrateG: decimal.nullable(),
      fatG: decimal.nullable(),
      fiberG: decimal.nullable(),
      saltG: decimal.nullable(),
      source: z
        .object({
          name: z.string(),
          url: z
            .url()
            .refine((value) => ["https:", "http:"].includes(new URL(value).protocol))
            .nullable(),
          recordKey: z.string(),
          revision: z.number().int().positive(),
          observedOn: z.string(),
          verifiedAt: z.string(),
          foodDescription: z.string(),
        })
        .nullable(),
    }),
  })
  .superRefine((value, context) => {
    const data = value.nutrition;
    const known = [
      data.energyKcal,
      data.proteinG,
      data.carbohydrateG,
      data.fatG,
      data.fiberG,
      data.saltG,
    ].filter((value) => value !== null).length;
    if (
      (data.status === "unavailable" && (known !== 0 || data.source !== null)) ||
      (data.status === "partial" && (known === 0 || known === 6 || data.source === null)) ||
      (data.status === "available" && (known !== 6 || data.source === null))
    )
      context.addIssue({
        code: "custom",
        path: ["nutrition"],
        message: "Inconsistent nutrition coverage",
      });
  });
export type IngredientDetail = z.infer<typeof ingredientDetailSchema>;
