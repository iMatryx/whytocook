import {
  baseMicros,
  displayMicros,
  scaleRequirement,
  supportedUnit,
  unitTable,
} from "../../../shared/domain/cooking-quantity.ts";
import { quantityMicros } from "../../../shared/domain/quantity.ts";
import type { SearchRecipe } from "../contracts/search.schema.ts";
export function scaleIngredient(
  quantity: string,
  unit: string,
  baseServings: number,
  servings: number,
) {
  if (
    !supportedUnit(unit) ||
    !Number.isInteger(baseServings) ||
    !Number.isInteger(servings) ||
    baseServings < 1 ||
    baseServings > 20 ||
    servings < 1 ||
    servings > 20
  )
    throw new Error("Porții sau unitate nesuportate.");
  if (unit === "piece" && quantityMicros(quantity) % 1000000n !== 0n)
    throw new Error("Bucățile trebuie să fie întregi.");
  const base = unitTable[unit].base,
    result = scaleRequirement(baseMicros(quantity, unit), base, servings, baseServings);
  return {
    quantity: displayMicros(result.required),
    unitCode: base,
    rounded: result.rounding !== null,
  };
}
const staples = new Set(["apa-potabila", "sare-alimentara", "ulei-de-floarea-soarelui"]);
export function findSimilarRecipes(
  target: SearchRecipe,
  candidates: SearchRecipe[],
  allergies: readonly string[],
  excluded: readonly string[],
) {
  const main = new Set(
    target.ingredients.map((i) => i.ingredientSlug).filter((s) => !staples.has(s)),
  );
  return candidates
    .filter(
      (r) =>
        r.key !== target.key &&
        !r.ingredients.some((i) => excluded.includes(i.ingredientSlug)) &&
        (!allergies.length ||
          (r.allergens.status === "verified" &&
            !allergies.some(
              (a) => r.allergens.contains.includes(a) || r.allergens.mayContain.includes(a),
            ))),
    )
    .map((recipe) => ({
      recipe,
      overlap: new Set(recipe.ingredients.map((i) => i.ingredientSlug).filter((s) => main.has(s)))
        .size,
      diet: recipe.diets.filter((d) => target.diets.includes(d)).length,
    }))
    .filter((r) => r.overlap > 0)
    .sort(
      (a, b) =>
        b.overlap - a.overlap ||
        b.diet - a.diet ||
        Math.abs(a.recipe.totalMinutes - target.totalMinutes) -
          Math.abs(b.recipe.totalMinutes - target.totalMinutes) ||
        (a.recipe.key < b.recipe.key ? -1 : 1),
    )
    .slice(0, 4)
    .map((r) => r.recipe);
}
