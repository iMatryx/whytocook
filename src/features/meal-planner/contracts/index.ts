import { z } from "zod";
import {
  searchRecipeSchema,
  fullNutritionSchema,
  sourceSchema,
  recipeInventorySchema,
} from "../../recipes/contracts/index.ts";
import { pantryIngredientSchema } from "../../../shared/contracts/food-inventory.ts";
import { shoppingItemSchema } from "../../../shared/contracts/shopping-item.ts";
export const plannerDay = z.iso.date().refine((v) => v >= "1900-01-01" && v <= "9999-12-25");
export const plannerRevision = z.string().regex(/^(0|[1-9]\d{0,18})$/);
export const plannerBudgetSchema = z
  .object({
    amount: z.string().regex(/^(0|[1-9]\d{0,5})(\.\d{1,2})?$/),
    currency: z.enum(["MDL", "RON"]),
  })
  .strict();
export const plannerPriceSchema = plannerBudgetSchema.extend({ observedOn: z.iso.date() }).strict();
export const plannerEntrySchema = z
  .object({
    id: z.uuid(),
    recipeKey: z
      .string()
      .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
      .max(100),
    recipeRevision: z.number().int().positive(),
    versionId: z.uuid().nullable(),
    plannedOn: z.iso.date(),
    slot: z.enum(["breakfast", "lunch", "dinner", "snack"]),
    servings: z.number().int().min(1).max(20),
    prepOn: z.iso.date().nullable(),
    costPerServing: plannerPriceSchema.nullable(),
  })
  .strict();
export const plannerWeekSchema = z
  .object({
    startsOn: plannerDay,
    revision: plannerRevision,
    budget: plannerBudgetSchema.nullable(),
    entries: z.array(plannerEntrySchema).max(56),
    exportedRevision: plannerRevision.nullable(),
  })
  .strict()
  .refine(
    (w) =>
      new Set(w.entries.map((e) => e.id)).size === w.entries.length &&
      w.entries.every((e) => {
        const d =
          (Date.parse(e.plannedOn + "T00:00:00Z") - Date.parse(w.startsOn + "T00:00:00Z")) /
          86400000;
        return (
          d >= 0 && d <= 6 && (!e.prepOn || (e.prepOn >= w.startsOn && e.prepOn <= e.plannedOn))
        );
      }),
  );
export const plannerCommandSchema = z.discriminatedUnion("kind", [
  z
    .object({ kind: z.literal("saveEntry"), create: z.boolean(), entry: plannerEntrySchema })
    .strict(),
  z.object({ kind: z.literal("removeEntry"), id: z.uuid() }).strict(),
  z.object({ kind: z.literal("configure"), budget: plannerBudgetSchema.nullable() }).strict(),
  z.object({ kind: z.literal("copyWeek"), targetStartsOn: plannerDay }).strict(),
]);
export const plannerRequestSchema = z
  .object({
    startsOn: plannerDay,
    expectedRevision: plannerRevision,
    expectedAccountId: z.uuid(),
    operationId: z.uuid(),
    command: plannerCommandSchema,
  })
  .strict();
export const plannerSnapshotSchema = z
  .object({ accountId: z.uuid(), week: plannerWeekSchema })
  .strict();
export const plannerMetadataSchema = z
  .object({
    key: z.string(),
    revision: z.number().int().positive(),
    versionId: z.uuid(),
    nutrition: fullNutritionSchema,
    budgetSource: sourceSchema.nullable(),
  })
  .strict();
export const plannerRecipeSchema = searchRecipeSchema
  .extend({
    versionId: z.uuid().nullable(),
    fullNutrition: fullNutritionSchema,
    budgetSource: sourceSchema.nullable(),
  })
  .strict();
export const plannerBootstrapSchema = z
  .object({
    accountId: z.uuid().nullable(),
    source: z.enum(["published", "demo"]),
    week: plannerWeekSchema,
    recipes: z.array(plannerRecipeSchema).max(1000),
    catalog: z.array(pantryIngredientSchema).max(1000),
    inventory: recipeInventorySchema,
    restrictions: z
      .object({ allergies: z.array(z.string()).max(30), excluded: z.array(z.string()).max(30) })
      .strict(),
  })
  .strict();
export const plannerAnalyzeRequestSchema = z
  .object({
    startsOn: plannerDay,
    expectedAccountId: z.uuid().nullable(),
    source: z.enum(["published", "demo"]),
    week: plannerWeekSchema,
    inventory: recipeInventorySchema,
    today: z.iso.date(),
  })
  .strict();
export const plannerExportRequestSchema = plannerAnalyzeRequestSchema
  .extend({
    operationId: z.uuid(),
    expectedRevision: plannerRevision,
    fingerprint: z.string().max(100000),
  })
  .strict();
export const plannerExportResultSchema = z
  .object({
    week: plannerWeekSchema,
    items: z.array(shoppingItemSchema).max(500),
    accountId: z.uuid(),
  })
  .strict();
export type PlannerEntry = z.infer<typeof plannerEntrySchema>;
export type PlannerWeek = z.infer<typeof plannerWeekSchema>;
export type PlannerCommand = z.infer<typeof plannerCommandSchema>;
export type PlannerRecipe = z.infer<typeof plannerRecipeSchema>;
export type PlannerBootstrap = z.infer<typeof plannerBootstrapSchema>;
const n = z
  .string()
  .regex(/^\d+(\.\d{1,6})?$/)
  .max(100);
export const plannerNutrientsSchema = z
  .object({ energyKcal: n, proteinG: n, carbohydrateG: n, fatG: n, fiberG: n, saltG: n })
  .strict();
export const plannerAnalysisSchema = z
  .object({
    days: z
      .array(
        z
          .object({
            date: z.iso.date(),
            nutrients: plannerNutrientsSchema,
            unknownMeals: z.number().int().min(0).max(56),
            entryCount: z.number().int().min(0).max(56),
          })
          .strict(),
      )
      .length(7),
    nutrients: plannerNutrientsSchema,
    unknownNutritionMeals: z.number().int().min(0).max(56),
    unavailable: z.array(z.uuid()).max(56),
    warnings: z.array(z.string()).max(200),
    complete: z.boolean(),
    resources: z
      .array(
        z
          .object({
            entryId: z.uuid(),
            ingredientSlug: z.string(),
            name: z.string(),
            required: n,
            allocated: n,
            shortage: n,
            unit: z.enum(["g", "ml", "piece"]),
            uncertain: z.boolean(),
            overlap: z.boolean(),
          })
          .strict(),
      )
      .max(3360),
    ingredients: z
      .array(
        z
          .object({
            ingredientSlug: z.string(),
            name: z.string(),
            required: n,
            allocated: n,
            shortage: n,
            unit: z.enum(["g", "ml", "piece"]),
            uncertain: z.boolean(),
          })
          .strict(),
      )
      .max(3000),
    shopping: z.array(shoppingItemSchema).max(1000),
    prepGroups: z
      .array(
        z
          .object({
            prepOn: z.iso.date(),
            recipeKey: z.string(),
            title: z.string(),
            servings: z.number().int().positive(),
            entryIds: z.array(z.uuid()).max(56),
          })
          .strict(),
      )
      .max(56),
    budget: z
      .object({
        subtotals: z.object({ MDL: n, RON: n }).strict(),
        unknownMeals: z.number().int().min(0).max(56),
        state: z.enum(["none", "within", "exceeded", "unverifiable"]),
        limit: plannerBudgetSchema.nullable(),
      })
      .strict(),
  })
  .strict();
export type PlannerAnalysis = z.infer<typeof plannerAnalysisSchema>;
export const plannerAnalysisEnvelopeSchema = z
  .object({
    accountId: z.uuid().nullable(),
    week: plannerWeekSchema,
    analysis: plannerAnalysisSchema,
  })
  .strict();
