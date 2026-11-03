import type { PantryItem } from "../../pantry/contracts/index.ts";
import type { RecipeSeed } from "../../recipes/contracts/index.ts";
import { matchingRecipeSchema } from "../contracts/index.ts";
import type { MatchingRecipe, MatchingRequest } from "../contracts/index.ts";

export function inventoryForMatching(items: readonly PantryItem[]): MatchingRequest["inventory"] {
  return items.map((item) => ({
    id: item.id,
    ingredient: { slug: item.ingredient.slug },
    quantity: item.quantity,
    unit: item.unitCode,
    expiresOn: item.expiresOn,
  }));
}
// Only project existing metadata; never infer review status from a tag or title.
// Invalid projections throw; callers must handle source-load errors.
export function recipesForMatching(recipes: readonly RecipeSeed[]): MatchingRecipe[] {
  for (const recipe of recipes) {
    if (recipe.ingredients.some((line) => line.state === "cooked")) {
      throw new Error(
        `UNSUPPORTED_COOKED_QUANTITY: ${recipe.key}. Use a distinct prepared canonical ingredient; raw-to-cooked yield is not known.`,
      );
    }
  }
  return recipes.map((recipe) =>
    matchingRecipeSchema.parse({
      key: recipe.key,
      revision: recipe.revision,
      title: recipe.title,
      dataClass: recipe.dataClass,
      baseServings: recipe.servings,
      totalMinutes: recipe.totalMinutes,
      tags: recipe.tags,
      ingredients: recipe.ingredients.map((line) => ({
        ingredientSlug: line.ingredientSlug,
        quantity: line.quantity,
        unit: line.unit,
        optional: line.optional,
      })),
      allergens: {
        status: recipe.allergens.status,
        contains: recipe.allergens.contains,
        mayContain: recipe.allergens.mayContain,
      },
    }),
  );
}
