import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import demo from "../../../data/recipes/demonstration.v1.json";
import { getSupabaseEnv } from "../../config/env/server.ts";
import {
  plannerBootstrapSchema,
  plannerMetadataSchema,
  plannerRecipeSchema,
  plannerRequestSchema,
  plannerSnapshotSchema,
  plannerAnalyzeRequestSchema,
  plannerExportRequestSchema,
  plannerExportResultSchema,
  plannerAnalysisSchema,
} from "../../features/meal-planner/contracts/index.ts";
import { RecipeSearchError } from "../../features/recipes/domain/search-error.ts";
import {
  analyzePlannerWeek,
  plannerShoppingFingerprint,
} from "../../shared/domain/meal-planner.ts";
import { createRecipeRpc } from "../supabase/recipe-rpc.server.ts";
import { shoppingSession, shoppingCatalogFor } from "./shopping.server.ts";
import { recipeRequestContext } from "./recipe-context.server.ts";
import { loadRecipeSearchSnapshot } from "./recipes.server.ts";
import type { PlannerBootstrap } from "../../features/meal-planner/contracts/index.ts";
export async function plannerBootstrap(
  request: Request,
  startsOn: string,
  source: "demo" | "published",
): Promise<PlannerBootstrap> {
  const own = await shoppingSession(request);
  if (own.token && source === "demo") throw new RecipeSearchError("INVALID_REQUEST");
  const context = await recipeRequestContext(request, [], own.accountId),
    snapshot = await loadRecipeSearchSnapshot(source),
    catalog = await shoppingCatalogFor(source, own.token);
  const metadata =
    source === "published"
      ? z
          .array(plannerMetadataSchema)
          .max(1000)
          .parse(await createRecipeRpc(getSupabaseEnv()).request("meal_planner_metadata"))
      : [];
  const recipes = snapshot.recipes
    .filter(
      (r) =>
        !r.ingredients.some(
          (i) =>
            context.excludedIngredients.includes(i.ingredientSlug) ||
            (
              snapshot.catalog.ingredients.find((c) => c.slug === i.ingredientSlug)
                ?.allergenHints ?? []
            ).some((a) => context.allergies.includes(a)),
        ) &&
        (!context.allergies.length ||
          (r.allergens.status === "verified" &&
            !context.allergies.some(
              (a) => r.allergens.contains.includes(a) || r.allergens.mayContain.includes(a),
            ))),
    )
    .map((r) => {
      if (source === "demo") {
        const original = demo.recipes.find((i) => i.key === r.key)!;
        return plannerRecipeSchema.parse({
          ...r,
          versionId: null,
          fullNutrition: {
            status: original.nutrition.status,
            perServing: original.nutrition.perServing,
            source: original.nutrition.source,
          },
          budgetSource: original.budget.source,
        });
      }
      const m = metadata.find((m) => m.key === r.key);
      if (!m || m.revision !== r.revision) throw new RecipeSearchError("CONFLICT");
      return plannerRecipeSchema.parse({
        ...r,
        versionId: m.versionId,
        fullNutrition: m.nutrition,
        budgetSource: m.budgetSource,
      });
    });
  const saved = own.token
    ? plannerSnapshotSchema.parse(
        await createRecipeRpc(getSupabaseEnv(), own.token).request("meal_planner_snapshot", {
          p_starts_on: startsOn,
        }),
      )
    : null;
  if (saved && (saved.accountId !== own.accountId || saved.week.startsOn !== startsOn))
    throw new RecipeSearchError("SESSION_CHANGED");
  const week = saved?.week ?? {
    startsOn,
    revision: "0",
    budget: null,
    entries: [],
    exportedRevision: null,
  };
  return plannerBootstrapSchema.parse({
    accountId: own.accountId,
    week,
    source,
    recipes,
    catalog,
    inventory: context.inventory,
    restrictions: { allergies: context.allergies, excluded: context.excludedIngredients },
  });
}
export async function plannerMutation(request: Request, value: unknown) {
  const input = plannerRequestSchema.parse(value),
    own = await shoppingSession(request);
  if (!own.token || own.accountId !== input.expectedAccountId)
    throw new RecipeSearchError("SESSION_CHANGED");
  if (input.command.kind === "saveEntry" || input.command.kind === "copyWeek") {
    const data = await plannerBootstrap(request, input.startsOn, "published");
    const entries = input.command.kind === "saveEntry" ? [input.command.entry] : data.week.entries;
    if (
      entries.some(
        (e) =>
          !data.recipes.some(
            (r) =>
              r.key === e.recipeKey &&
              r.versionId === e.versionId &&
              r.revision === e.recipeRevision,
          ),
      )
    )
      throw new RecipeSearchError("NOT_FOUND");
  }
  const result = plannerSnapshotSchema.parse(
    await createRecipeRpc(getSupabaseEnv(), own.token).request("meal_planner_mutate", {
      p_starts_on: input.startsOn,
      p_expected_revision: input.expectedRevision,
      p_operation_id: input.operationId,
      p_command: input.command,
    }),
  );
  if (result.accountId !== own.accountId) throw new RecipeSearchError("SESSION_CHANGED");
  return result;
}
export async function plannerAnalysis(request: Request, value: unknown) {
  const input = plannerAnalyzeRequestSchema.parse(value);
  if (input.week.startsOn !== input.startsOn) throw new RecipeSearchError("INVALID_REQUEST");
  const data = await plannerBootstrap(request, input.startsOn, input.source);
  if (data.accountId !== input.expectedAccountId) throw new RecipeSearchError("SESSION_CHANGED");
  const week = data.accountId ? data.week : input.week;
  if (data.accountId && week.revision !== input.week.revision)
    throw new RecipeSearchError("CONFLICT");
  const inventory = data.accountId ? data.inventory : input.inventory;
  try {
    return {
      accountId: data.accountId,
      week,
      analysis: plannerAnalysisSchema.parse(
        analyzePlannerWeek(
          week,
          data.recipes,
          data.catalog,
          inventory,
          input.today,
          data.restrictions,
        ),
      ),
    };
  } catch {
    throw new RecipeSearchError("INVALID_REQUEST");
  }
}
export async function plannerExport(request: Request, value: unknown) {
  const input = plannerExportRequestSchema.parse(value),
    own = await shoppingSession(request);
  if (!own.token || own.accountId !== input.expectedAccountId)
    throw new RecipeSearchError("SESSION_CHANGED");
  const { operationId: _, expectedRevision: __, fingerprint: ___, ...body } = input;
  void _;
  void __;
  void ___;
  const result = await plannerAnalysis(request, body);
  if (
    !result.analysis.complete ||
    result.analysis.shopping.length > 100 ||
    result.week.revision !== input.expectedRevision
  )
    throw new RecipeSearchError("CONFLICT");
  if (plannerShoppingFingerprint(result.analysis.shopping) !== input.fingerprint)
    throw new RecipeSearchError("CONFLICT");
  const items = result.analysis.shopping.map((i) => {
    const h = createHash("sha256")
      .update(`${input.operationId}:${i.ingredient!.slug}:${i.unitCode}`)
      .digest("hex");
    return {
      id: `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`,
      ingredientId: i.ingredient!.id,
      label: i.label,
      category: i.category,
      quantity: i.quantity,
      unitCode: i.unitCode,
      checked: false,
      price: null,
      uncertain: i.uncertain,
    };
  });
  const saved = plannerExportResultSchema.parse(
    await createRecipeRpc(getSupabaseEnv(), own.token).request("meal_planner_export", {
      p_starts_on: input.startsOn,
      p_expected_revision: input.expectedRevision,
      p_operation_id: input.operationId,
      p_items: items,
    }),
  );
  if (saved.accountId !== own.accountId) throw new RecipeSearchError("SESSION_CHANGED");
  return saved;
}
