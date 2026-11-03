import "server-only";
import demo from "../../../data/recipes/demonstration.v1.json";
import original from "../../../docs/data/ingredients-v1.json";
import references from "../../../data/recipes/references.v1.json";
import { recipeBundleSchema } from "../../features/recipes/contracts/recipe-bundle.schema.ts";
import { recipeSnapshotSchema } from "../../features/recipes/contracts/search.schema.ts";
import type { RecipeSnapshot } from "../../features/recipes/contracts/search.schema.ts";
let cached: RecipeSnapshot | undefined;
export function demoRecipeSnapshot(): RecipeSnapshot {
  if (cached) return cached;
  const bundle = recipeBundleSchema.parse(demo);
  const catalog = [...original, ...references.ingredients];
  const names = new Map(catalog.map((i) => [i.slug, i.name]));
  cached = recipeSnapshotSchema.parse({
    catalog: {
      ingredients: catalog.map((i) => ({
        slug: i.slug,
        name: i.name,
        units: i.units,
        active: true,
        allergenHints: [],
        aliases: (["ro-RO", "ru-RU", "en-GB"] as const).flatMap((locale) =>
          i.aliases[locale].map((label) => ({ locale, label })),
        ),
      })),
    },
    recipes: bundle.recipes.map((r) => ({
      id: null,
      key: r.key,
      revision: r.revision,
      dataClass: r.dataClass,
      title: r.title,
      summary: r.summary,
      servings: r.servings,
      totalMinutes: r.totalMinutes,
      difficulty: r.difficulty,
      mealTypes: r.mealTypes,
      cuisines: r.tags.filter((tag) =>
        references.tags.some((t) => t.slug === tag && t.kind === "cuisine"),
      ),
      diets: r.tags.filter((t) =>
        ["vegetarian", "vegan", "pescatarian", "gluten-free", "lactose-free"].includes(t),
      ),
      equipment: r.equipment,
      tags: r.tags,
      ingredients: r.ingredients.map((i) => ({
        ingredientSlug: i.ingredientSlug,
        name: names.get(i.ingredientSlug) ?? i.ingredientSlug,
        quantity: i.quantity,
        unit: i.unit,
        optional: i.optional,
        preparation: i.preparation,
      })),
      steps: r.steps.map((s) => s.instruction),
      allergens: {
        status: r.allergens.status,
        contains: r.allergens.contains,
        mayContain: r.allergens.mayContain,
      },
      nutrition:
        r.nutrition.status === "verified" && r.nutrition.perServing
          ? {
              calories: r.nutrition.perServing.energyKcal,
              protein: r.nutrition.perServing.proteinG,
            }
          : null,
      budget:
        r.budget.status === "verified" && r.budget.perServing !== null
          ? { amount: r.budget.perServing, currency: r.budget.currency }
          : null,
    })),
  });
  return cached;
}
