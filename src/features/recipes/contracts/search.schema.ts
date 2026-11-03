import { z } from "zod";
const slug = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(100);
const decimal = z.string().regex(/^(?:0|[1-9]\d{0,11})(?:\.\d{1,6})?$/);
const amount = z.string().regex(/^(?:0|[1-9]\d{0,5})(?:\.\d{1,2})?$/);
const list = z
  .array(slug)
  .max(30)
  .transform((v) => [...new Set(v)].sort())
  .default([]);
export const recipeFiltersSchema = z
  .object({
    q: z.string().trim().max(120).default(""),
    ingredient: list,
    minutes: z.number().int().min(1).max(10080).nullable().default(null),
    difficulty: z
      .array(z.enum(["easy", "medium", "hard"]))
      .max(3)
      .transform((v) => [...new Set(v)].sort())
      .default([]),
    meal: z
      .array(z.enum(["breakfast", "lunch", "dinner", "dessert"]))
      .max(4)
      .transform((v) => [...new Set(v)].sort())
      .default([]),
    cuisine: list,
    diet: list,
    equipment: z
      .array(
        z
          .string()
          .regex(/^[a-z_]+$/)
          .max(32),
      )
      .max(30)
      .transform((v) => [...new Set(v)].sort())
      .default([]),
    exclude: list,
    allergy: z
      .array(
        z.enum([
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
        ]),
      )
      .max(14)
      .transform((v) => [...new Set(v)].sort())
      .default([]),
    budget: amount.nullable().default(null),
    currency: z.enum(["MDL", "RON"]).default("MDL"),
    calories: amount.nullable().default(null),
    protein: amount.nullable().default(null),
    servings: z.number().int().min(1).max(20).nullable().default(null),
    compatibility: z
      .enum(["any", "ready_to_cook", "almost_ready", "missing_ingredients"])
      .default("any"),
    sort: z
      .enum(["relevance", "compatibility", "time", "budget", "calories", "protein", "name"])
      .default("compatibility"),
    page: z.number().int().min(1).max(100000).default(1),
    size: z.union([z.literal(6), z.literal(12), z.literal(24)]).default(12),
    source: z.enum(["published", "demo"]).default("published"),
  })
  .strict();
export type RecipeFilters = z.infer<typeof recipeFiltersSchema>;
export const searchRecipeSchema = z
  .object({
    id: z.uuid().nullable(),
    key: slug,
    revision: z.number().int().positive(),
    dataClass: z.enum(["verified", "demonstration", "unreviewed"]),
    title: z.string().min(1).max(200),
    summary: z.string().max(4000),
    servings: z.number().int().min(1).max(20),
    totalMinutes: z.number().int().min(1).max(10080),
    difficulty: z.enum(["easy", "medium", "hard"]),
    mealTypes: z.array(z.string()).max(4),
    cuisines: z.array(slug).max(30),
    diets: z.array(slug).max(30),
    equipment: z.array(z.string()).max(20),
    tags: z.array(slug).max(30),
    ingredients: z
      .array(
        z
          .object({
            ingredientSlug: slug,
            name: z.string(),
            quantity: decimal,
            unit: z.string().min(1).max(32),
            optional: z.boolean(),
            preparation: z.string().max(500),
          })
          .strict(),
      )
      .min(1)
      .max(60),
    steps: z.array(z.string().max(8000)).min(1).max(30),
    allergens: z
      .object({
        status: z.enum(["verified", "unverified"]),
        contains: z.array(z.string()).max(30),
        mayContain: z.array(z.string()).max(30),
      })
      .strict(),
    nutrition: z.object({ calories: decimal, protein: decimal }).strict().nullable(),
    budget: z
      .object({ amount: decimal, currency: z.enum(["MDL", "RON"]) })
      .strict()
      .nullable(),
  })
  .strict();
export type SearchRecipe = z.infer<typeof searchRecipeSchema>;
export const recipeSnapshotSchema = z
  .object({
    recipes: z.array(searchRecipeSchema).max(1000),
    catalog: z
      .object({
        ingredients: z
          .array(
            z
              .object({
                slug,
                name: z.string(),
                units: z.array(z.string()).max(50),
                aliases: z
                  .array(
                    z
                      .object({ locale: z.enum(["ro-RO", "ru-RU", "en-GB"]), label: z.string() })
                      .strict(),
                  )
                  .max(200),
                active: z.boolean(),
                allergenHints: z.array(z.string()).max(30),
              })
              .strict(),
          )
          .max(10000),
      })
      .strict(),
  })
  .strict();
export type RecipeSnapshot = z.infer<typeof recipeSnapshotSchema>;
export const recipeInventorySchema = z
  .array(
    z
      .object({
        id: z.string().min(1).max(100),
        ingredientSlug: slug,
        quantity: decimal.nullable(),
        unit: z.string().min(1).max(32).nullable(),
        expiresOn: z.iso.date().nullable(),
      })
      .strict()
      .refine((v) => (v.quantity === null) === (v.unit === null)),
  )
  .max(500)
  .refine((v) => new Set(v.map((lot) => lot.id)).size === v.length);
export const recipeSearchRequestSchema = z
  .object({
    filters: recipeFiltersSchema,
    inventory: recipeInventorySchema,
    today: z.iso.date(),
    expectedAccountId: z.uuid().nullable(),
  })
  .strict();
export type RecipeSearchRequest = z.infer<typeof recipeSearchRequestSchema>;
export const recipeCompatibilitySchema = z
  .object({
    score: z.number().min(0).max(100),
    category: z.enum(["ready_to_cook", "almost_ready", "missing_ingredients"]),
    explanations: z.array(z.string()),
    ingredients: z.array(
      z
        .object({
          ingredientSlug: slug,
          status: z.string(),
          required: z.string(),
          available: z.string(),
          shortage: z.string(),
          unit: z.string(),
          optional: z.boolean(),
          uncertain: z.boolean(),
        })
        .strict(),
    ),
  })
  .strict();
export type RecipeCompatibility = z.infer<typeof recipeCompatibilitySchema>;
const option = z.object({ value: z.string(), label: z.string() }).strict();
export const recipeSearchResponseSchema = z
  .object({
    source: z.enum(["published", "demo"]),
    accountId: z.uuid().nullable(),
    items: z
      .array(
        z
          .object({
            recipe: searchRecipeSchema,
            compatibility: recipeCompatibilitySchema.nullable(),
          })
          .strict(),
      )
      .max(24),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    pages: z.number().int().nonnegative(),
    size: z.number().int(),
    excludedCount: z.number().int().nonnegative(),
    facets: z
      .object({
        ingredients: z.array(option),
        cuisines: z.array(option),
        diets: z.array(option),
        equipment: z.array(option),
      })
      .strict(),
    unknown: z.object({ budget: z.number().int(), nutrition: z.number().int() }).strict(),
  })
  .strict();
export type RecipeSearchResponse = z.infer<typeof recipeSearchResponseSchema>;
