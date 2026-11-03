import { z } from "zod";

const slug = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(100);
const decimal = z.string().regex(/^(?:0|[1-9]\d{0,11})(?:\.\d{1,6})?$/);
const unit = z.enum(["g", "kg", "ml", "l", "piece"]);
const locale = z.enum(["ro-RO", "ru-RU", "en-GB"]);
export const allergenCodeSchema = z.enum([
  "gluten",
  "crustaceans",
  "eggs",
  "fish",
  "peanuts",
  "soy",
  "milk",
  "tree_nuts",
  "celery",
  "mustard",
  "sesame",
  "sulphites",
  "lupin",
  "molluscs",
]);
const allergens = z
  .array(allergenCodeSchema)
  .max(14)
  .refine((a) => new Set(a).size === a.length);
const wholePieces = (v: { quantity: string | null; unit: string | null }) =>
  v.unit !== "piece" || v.quantity === null || /^\d+(?:\.0+)?$/.test(v.quantity);
export const matchingRecipeSchema = z
  .object({
    key: slug,
    revision: z.number().int().min(1).max(100000),
    title: z.string().trim().min(1).max(200),
    dataClass: z.enum(["demonstration", "verified"]),
    baseServings: z.number().int().min(1).max(20),
    ingredients: z
      .array(
        z
          .object({
            ingredientSlug: slug,
            quantity: decimal.refine((v) => !/^0(?:\.0+)?$/.test(v)),
            unit,
            optional: z.boolean(),
          })
          .strict()
          .refine(wholePieces),
      )
      .min(1)
      .max(60),
    totalMinutes: z.number().int().min(1).max(10080),
    tags: z.array(slug).max(30),
    allergens: z
      .object({
        status: z.enum(["unverified", "verified"]),
        contains: allergens,
        mayContain: allergens,
      })
      .strict(),
  })
  .strict();
export const matchingConfigurationSchema = z
  .object({
    catalog: z
      .object({
        ingredients: z
          .array(
            z
              .object({
                slug,
                name: z.string().trim().min(1).max(200),
                units: z.array(unit).min(1).max(5),
                aliases: z
                  .array(z.object({ locale, label: z.string().min(1).max(200) }).strict())
                  .max(200),
                active: z.boolean().default(true),
                allergenHints: allergens.default([]),
              })
              .strict(),
          )
          .max(10000),
      })
      .strict(),
    recipes: z.array(matchingRecipeSchema).max(1000),
  })
  .strict();
export const matchingRequestSchema = z
  .object({
    inventory: z
      .array(
        z
          .object({
            id: z.string().min(1).max(100),
            ingredient: z.union([
              z.object({ slug }).strict(),
              z.object({ alias: z.string().min(1).max(200), locale }).strict(),
            ]),
            quantity: decimal.nullable(),
            unit: z.string().min(1).max(32).nullable(),
            expiresOn: z.iso.date().nullable(),
          })
          .strict()
          .refine((v) => (v.quantity === null) === (v.unit === null))
          .refine(wholePieces),
      )
      .max(500)
      .refine((lots) => new Set(lots.map((v) => v.id)).size === lots.length),
    today: z.iso.date().refine((v) => v >= "1900-01-01"),
    servings: z.number().int().min(1).max(20).optional(),
    allergies: allergens.default([]),
    preferences: z
      .object({
        maxTotalMinutes: z.number().int().min(1).max(10080).nullable().default(null),
        preferredTags: z
          .array(slug)
          .max(30)
          .refine((v) => new Set(v).size === v.length)
          .default([]),
      })
      .strict()
      .default({ maxTotalMinutes: null, preferredTags: [] }),
  })
  .strict();

const outputQuantity = z.string().regex(/^\d+(?:\.\d{1,6})?$/);
const component = z
  .object({
    score: z.number().min(0).max(100),
    weight: z.number().int().min(0).max(100),
    points: z.number().min(0).max(100),
    explanation: z.string(),
  })
  .strict();
export const matchingItemSchema = z
  .object({
    recipeKey: slug,
    revision: z.number().int().positive(),
    title: z.string(),
    dataClass: z.enum(["demonstration", "verified"]),
    servings: z.number().int().positive(),
    category: z.enum(["ready_to_cook", "almost_ready", "missing_ingredients"]),
    ingredients: z.array(
      z
        .object({
          ingredientSlug: slug,
          role: z.enum(["required", "optional"]),
          status: z.enum(["sufficient", "insufficient", "missing", "unknown_quantity"]),
          unit: z.enum(["g", "ml", "piece"]),
          required: outputQuantity,
          available: outputQuantity,
          shortage: outputQuantity,
          quantityUncertain: z.boolean(),
          rounding: z.enum(["whole_piece", "up_to_micro_unit"]).nullable(),
          issues: z.array(z.string()),
        })
        .strict(),
    ),
    requiredSummary: z
      .object({
        total: z.number().int().nonnegative(),
        sufficient: z.number().int().nonnegative(),
        insufficient: z.number().int().nonnegative(),
        missing: z.number().int().nonnegative(),
        unknown: z.number().int().nonnegative(),
      })
      .strict(),
    score: z
      .object({
        total: z.number().min(0).max(100),
        components: z
          .object({
            compatibility: component,
            quantities: component,
            time: component,
            preferences: component,
          })
          .strict(),
      })
      .strict(),
    warnings: z.array(z.string()),
  })
  .strict();
const issue = z.object({ path: z.string(), message: z.string() }).strict();
export const matchingResultSchema = z
  .object({
    algorithmVersion: z.literal("cookly-matching-v1"),
    status: z.enum(["ready", "empty", "error"]),
    groups: z
      .object({
        ready_to_cook: z.array(matchingItemSchema),
        almost_ready: z.array(matchingItemSchema),
        missing_ingredients: z.array(matchingItemSchema),
      })
      .strict(),
    excluded: z.array(
      z
        .object({
          recipeKey: slug,
          reasons: z.array(
            z
              .object({
                code: z.enum(["ALLERGEN_PRESENT", "ALLERGEN_MAY_CONTAIN", "ALLERGENS_UNVERIFIED"]),
                allergen: allergenCodeSchema.nullable(),
              })
              .strict(),
          ),
        })
        .strict(),
    ),
    diagnostics: z.array(
      z
        .object({
          code: z.string(),
          lotId: z.string().nullable(),
          path: z.string(),
          message: z.string(),
        })
        .strict(),
    ),
    summary: z
      .object({
        evaluated: z.number().int().nonnegative(),
        matched: z.number().int().nonnegative(),
        excluded: z.number().int().nonnegative(),
        inventoryLots: z.number().int().nonnegative(),
        usableLots: z.number().int().nonnegative(),
      })
      .strict(),
    error: z
      .object({
        code: z.enum(["INVALID_CONFIGURATION", "INVALID_REQUEST"]),
        issues: z.array(issue),
      })
      .strict()
      .nullable(),
  })
  .strict();
export type MatchingConfiguration = z.infer<typeof matchingConfigurationSchema>;
export type MatchingRecipe = z.infer<typeof matchingRecipeSchema>;
export type MatchingRequest = z.infer<typeof matchingRequestSchema>;
export type MatchingItem = z.infer<typeof matchingItemSchema>;
export type MatchingResult = z.infer<typeof matchingResultSchema>;
export type AllergenCode = z.infer<typeof allergenCodeSchema>;
