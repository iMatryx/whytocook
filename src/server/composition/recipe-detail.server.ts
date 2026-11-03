import "server-only";
import demo from "../../../data/recipes/demonstration.v1.json";
import { getSupabaseEnv } from "../../config/env/server.ts";
import { recipeBundleSchema } from "../../features/recipes/contracts/recipe-bundle.schema.ts";
import { recipeFiltersSchema } from "../../features/recipes/contracts/search.schema.ts";
import {
  detailMetadataSchema,
  recipeActionStateSchema,
  recipeDetailResponseSchema,
} from "../../features/recipes/contracts/detail.schema.ts";
import type { RecipeDetailRequest } from "../../features/recipes/contracts/detail.schema.ts";
import { scaleIngredient } from "../../features/recipes/application/detail-model.ts";
import { findSimilarRecipes } from "../../features/recipes/application/detail-model.ts";
import { RecipeSearchError } from "../../features/recipes/domain/search-error.ts";
import { recipeRequestContext } from "./recipe-context.server.ts";
import { loadRecipeSearchSnapshot, recipeSearchService } from "./recipes.server.ts";
import { createRecipeRpc } from "../supabase/recipe-rpc.server.ts";
const demoBundle = recipeBundleSchema.parse(demo);
export async function detailForRequest(request: Request, input: RecipeDetailRequest) {
  const context = await recipeRequestContext(request, input.inventory, input.expectedAccountId);
  const snapshot = await loadRecipeSearchSnapshot(input.source),
    recipe = snapshot.recipes.find((r) => r.key === input.slug);
  if (!recipe) throw new RecipeSearchError("NOT_FOUND");
  const servings = input.servings ?? recipe.servings;
  const allergies = [...new Set([...input.allergy, ...context.allergies])],
    excluded = [...new Set([...input.exclude, ...context.excludedIngredients])];
  const filters = recipeFiltersSchema.parse({
    source: input.source,
    servings,
    allergy: allergies,
    exclude: excluded,
  });
  const targetSnapshot = { ...snapshot, recipes: [recipe] };
  const scored = await recipeSearchService(targetSnapshot, context.inventory, input.today).search(
    filters,
  );
  const blocked = scored.total === 0;
  let metadata;
  if (input.source === "demo") {
    const original = demoBundle.recipes.find((r) => r.key === input.slug);
    if (!original) throw new RecipeSearchError("NOT_FOUND");
    metadata = detailMetadataSchema.parse({
      recipeId: null,
      revision: original.revision,
      photo:
        input.slug === "terci-de-ovaz-cu-mere"
          ? {
              url: "/recipes/oatmeal-apple-demo.png",
              alt: "Bol cu terci de ovăz, mere și scorțișoară",
              credit:
                "Imagine demonstrativă generată cu AI pentru Cookly; nu reprezintă o rețetă testată.",
              generated: true,
            }
          : null,
      stepTimers: original.steps.map((s) => s.timerSeconds),
      nutrition: {
        status: original.nutrition.status,
        perServing: original.nutrition.perServing,
        source: original.nutrition.source,
      },
    });
  } else
    metadata = detailMetadataSchema.parse(
      await createRecipeRpc(getSupabaseEnv()).request("recipe_detail_metadata", {
        p_slug: input.slug,
      }),
    );
  if (
    metadata.revision !== recipe.revision ||
    metadata.recipeId !== recipe.id ||
    metadata.stepTimers.length !== recipe.steps.length
  )
    throw new RecipeSearchError("CONFLICT");
  const hints = new Map(snapshot.catalog.ingredients.map((i) => [i.slug, i.allergenHints]));
  const eligible = snapshot.recipes.filter(
    (r) =>
      !r.ingredients.some((i) =>
        (hints.get(i.ingredientSlug) ?? []).some((a) => allergies.includes(a)),
      ),
  );
  const similar = findSimilarRecipes(recipe, eligible, allergies, excluded);
  const actions =
    context.token && input.source === "published"
      ? recipeActionStateSchema.parse(
          await createRecipeRpc(getSupabaseEnv(), context.token).request("get_recipe_actions", {
            p_slug: input.slug,
          }),
        )
      : null;
  return recipeDetailResponseSchema.parse({
    source: input.source,
    accountId: context.accountId,
    recipe,
    servings,
    metadata,
    similar,
    actions,
    blocked,
    blockReason: blocked
      ? "Rețeta nu respectă restricțiile de ingrediente sau alergeni. Nu activăm modul Cooking sau cumpărăturile pentru această selecție."
      : null,
    compatibility: scored.items[0]?.compatibility ?? null,
    scaledIngredients: recipe.ingredients.map((i) => {
      try {
        return {
          ingredientSlug: i.ingredientSlug,
          ...scaleIngredient(i.quantity, i.unit, recipe.servings, servings),
        };
      } catch {
        return {
          ingredientSlug: i.ingredientSlug,
          quantity: null,
          unitCode: i.unit,
          rounded: false,
        };
      }
    }),
  });
}
