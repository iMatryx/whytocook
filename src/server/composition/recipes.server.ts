import "server-only";
import { getSupabaseEnv } from "../../config/env/server.ts";
import { createRecipeSearch } from "../../features/recipes/application/search-catalog.ts";
import { recipeSnapshotSchema } from "../../features/recipes/contracts/search.schema.ts";
import type {
  RecipeSearchRequest,
  RecipeCompatibility,
  RecipeSnapshot,
} from "../../features/recipes/contracts/search.schema.ts";
import { RecipeSearchError } from "../../features/recipes/domain/search-error.ts";
import { createMatchingEngine } from "../../features/matching/application/matching.service.ts";
import { matchingRecipeSchema } from "../../features/matching/contracts/index.ts";
import { createRecipeRpc } from "../supabase/recipe-rpc.server.ts";
import { demoRecipeSnapshot } from "./recipe-demo.server.ts";
import { recipeRequestContext } from "./recipe-context.server.ts";
export async function loadRecipeSearchSnapshot(
  source: "published" | "demo",
): Promise<RecipeSnapshot> {
  return source === "demo"
    ? demoRecipeSnapshot()
    : recipeSnapshotSchema.parse(
        await createRecipeRpc(getSupabaseEnv()).request("recipe_search_snapshot"),
      );
}
export async function searchRecipesForRequest(request: Request, input: RecipeSearchRequest) {
  const context = await recipeRequestContext(request, input.inventory, input.expectedAccountId);
  const filters = {
    ...input.filters,
    allergy: [
      ...new Set([...input.filters.allergy, ...context.allergies]),
    ] as typeof input.filters.allergy,
    exclude: [...new Set([...input.filters.exclude, ...context.excludedIngredients])],
  };
  const snapshot = await loadRecipeSearchSnapshot(filters.source);
  return {
    ...(await recipeSearchService(snapshot, context.inventory, input.today).search(filters)),
    accountId: context.accountId,
  };
}
export function recipeSearchService(
  snapshot: RecipeSnapshot,
  inventory: RecipeSearchRequest["inventory"],
  today: string,
) {
  const catalogBySlug = new Map(snapshot.catalog.ingredients.map((i) => [i.slug, i]));
  return createRecipeSearch(snapshot, async (candidates, query) => {
    const recipes = candidates.flatMap((r) => {
      // Legacy published recipes may repeat an ingredient or use unsupported units.
      // Keep them searchable, but never fabricate a compatibility score.
      if (
        new Set(r.ingredients.map((i) => i.ingredientSlug)).size !== r.ingredients.length ||
        r.ingredients.some((line) => {
          const ingredient = catalogBySlug.get(line.ingredientSlug);
          return !ingredient?.active || !ingredient.units.includes(line.unit);
        })
      )
        return [];
      const parsed = matchingRecipeSchema.safeParse({
        key: r.key,
        revision: r.revision,
        title: r.title,
        dataClass: r.dataClass === "verified" ? "verified" : "demonstration",
        baseServings: r.servings,
        totalMinutes: r.totalMinutes,
        tags: r.tags,
        allergens: r.allergens,
        ingredients: r.ingredients.map((i) => ({
          ingredientSlug: i.ingredientSlug,
          quantity: i.quantity,
          unit: i.unit,
          optional: i.optional,
        })),
      });
      return parsed.success ? [parsed.data] : [];
    });
    const usableCatalog = {
      ingredients: snapshot.catalog.ingredients
        .map((i) => ({
          ...i,
          aliases: [], // Inventory already uses canonical slugs; search aliases stay in the public text index.
          units: i.units.filter((u) => ["g", "kg", "ml", "l", "piece"].includes(u)),
        }))
        .filter((i) => i.units.length),
    };
    const result = createMatchingEngine({ catalog: usableCatalog, recipes }).match({
      inventory: inventory.map(({ ingredientSlug, ...i }) => ({
        ...i,
        ingredient: { slug: ingredientSlug },
      })),
      today,
      ...(query.servings === null ? {} : { servings: query.servings }),
      allergies: query.allergy,
      preferences: { maxTotalMinutes: query.minutes, preferredTags: query.diet },
    });
    if (result.status === "error") throw new RecipeSearchError("UNAVAILABLE");
    return new Map<string, RecipeCompatibility>(
      Object.values(result.groups)
        .flat()
        .map((m) => [
          m.recipeKey,
          {
            score: m.score.total,
            category: m.category,
            explanations: Object.values(m.score.components).map(
              (c) => `${c.points}/${c.weight}: ${c.explanation}`,
            ),
            ingredients: m.ingredients.map((i) => ({
              ingredientSlug: i.ingredientSlug,
              status: i.status,
              required: i.required,
              available: i.available,
              shortage: i.shortage,
              unit: i.unit,
              optional: i.role === "optional",
              uncertain: i.quantityUncertain,
            })),
          },
        ]),
    );
  });
}
