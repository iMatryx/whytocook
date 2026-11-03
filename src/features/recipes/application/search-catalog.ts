import { ingredientSearchKey } from "../../../shared/domain/ingredient-search-key.ts";
import { quantityMicros } from "../../../shared/domain/quantity.ts";
import type {
  RecipeSnapshot,
  RecipeFilters,
  SearchRecipe,
  RecipeCompatibility,
  RecipeSearchResponse,
} from "../contracts/search.schema.ts";
type Scorer = (
  candidates: SearchRecipe[],
  filters: RecipeFilters,
) => Promise<Map<string, RecipeCompatibility>>;
export function createRecipeSearch(
  snapshot: RecipeSnapshot,
  scorer: Scorer = async () => new Map(),
) {
  const ingredients = new Map(snapshot.catalog.ingredients.map((i) => [i.slug, i]));
  const records = snapshot.recipes.map((recipe) => ({
    recipe,
    title: ingredientSearchKey(recipe.title),
    document: ingredientSearchKey(
      [
        recipe.title,
        ...recipe.ingredients.flatMap((line) => {
          const ref = ingredients.get(line.ingredientSlug);
          return [line.name, ...(ref?.aliases.map((a) => a.label) ?? [])];
        }),
      ].join(" "),
    ),
    slugs: new Set(recipe.ingredients.map((i) => i.ingredientSlug)),
    allergens: new Set([
      ...recipe.allergens.contains,
      ...recipe.allergens.mayContain,
      ...recipe.ingredients.flatMap((i) => ingredients.get(i.ingredientSlug)?.allergenHints ?? []),
    ]),
  }));
  const labels: Record<string, string> = {
    moldova: "Moldova",
    romania: "România",
    vegetarian: "Vegetarian",
    vegan: "Vegan",
    hob: "Plită",
    oven: "Cuptor",
    pot: "Oală",
    pan: "Tigaie",
    knife: "Cuțit",
    mixing_bowl: "Bol",
    blender: "Blender",
    baking_tray: "Tavă",
  };
  const options = (values: string[]) =>
    [...new Set(values)].sort().map((value) => ({
      value,
      label: labels[value] ?? value.replaceAll("_", " ").replaceAll("-", " "),
    }));
  const facets = {
    ingredients: snapshot.catalog.ingredients
      .map((i) => ({ value: i.slug, label: i.name }))
      .sort((a, b) => a.label.localeCompare(b.label, "ro")),
    cuisines: options(snapshot.recipes.flatMap((r) => r.cuisines)),
    diets: options(snapshot.recipes.flatMap((r) => r.diets)),
    equipment: options(snapshot.recipes.flatMap((r) => r.equipment)),
  };
  return {
    async search(filters: RecipeFilters): Promise<RecipeSearchResponse> {
      const tokens = ingredientSearchKey(filters.q).split(" ").filter(Boolean);
      let excludedCount = 0;
      const candidates = records.filter(({ recipe: r, document, slugs, allergens }) => {
        if (
          filters.allergy.length &&
          (r.allergens.status !== "verified" || filters.allergy.some((a) => allergens.has(a)))
        ) {
          excludedCount++;
          return false;
        }
        return (
          tokens.every((token) => document.includes(token)) &&
          filters.ingredient.every((i) => slugs.has(i)) &&
          !filters.exclude.some((i) => slugs.has(i)) &&
          (filters.minutes === null || r.totalMinutes <= filters.minutes) &&
          (!filters.difficulty.length || filters.difficulty.includes(r.difficulty)) &&
          (!filters.meal.length || filters.meal.some((m) => r.mealTypes.includes(m))) &&
          (!filters.cuisine.length || filters.cuisine.some((c) => r.cuisines.includes(c))) &&
          filters.diet.every((d) => r.diets.includes(d)) &&
          (!filters.equipment.length ||
            (r.equipment.length > 0 && r.equipment.every((e) => filters.equipment.includes(e)))) &&
          (filters.budget === null ||
            (r.budget !== null &&
              r.budget.currency === filters.currency &&
              quantityMicros(r.budget.amount) <= quantityMicros(filters.budget))) &&
          (filters.calories === null ||
            (r.nutrition !== null &&
              quantityMicros(r.nutrition.calories) <= quantityMicros(filters.calories))) &&
          (filters.protein === null ||
            (r.nutrition !== null &&
              quantityMicros(r.nutrition.protein) >= quantityMicros(filters.protein)))
        );
      });
      const scores = await scorer(
        candidates.map((r) => r.recipe),
        filters,
      );
      const items = candidates
        .map(({ recipe, title }) => ({
          recipe,
          title,
          compatibility: scores.get(recipe.key) ?? null,
        }))
        .filter(
          (r) =>
            filters.compatibility === "any" || r.compatibility?.category === filters.compatibility,
        );
      const compareKnown = (a: string | null, b: string | null, descending = false) =>
        a === null
          ? b === null
            ? 0
            : 1
          : b === null
            ? -1
            : quantityMicros(a) === quantityMicros(b)
              ? 0
              : (quantityMicros(a) < quantityMicros(b) ? -1 : 1) * (descending ? -1 : 1);
      items.sort((a, b) => {
        let order = 0;
        if (filters.sort === "compatibility")
          order = (b.compatibility?.score ?? -1) - (a.compatibility?.score ?? -1);
        if (filters.sort === "time") order = a.recipe.totalMinutes - b.recipe.totalMinutes;
        if (filters.sort === "budget")
          order = compareKnown(
            a.recipe.budget?.currency === filters.currency ? a.recipe.budget.amount : null,
            b.recipe.budget?.currency === filters.currency ? b.recipe.budget.amount : null,
          );
        if (filters.sort === "calories")
          order = compareKnown(
            a.recipe.nutrition?.calories ?? null,
            b.recipe.nutrition?.calories ?? null,
          );
        if (filters.sort === "protein")
          order = compareKnown(
            a.recipe.nutrition?.protein ?? null,
            b.recipe.nutrition?.protein ?? null,
            true,
          );
        if (filters.sort === "relevance" && tokens.length)
          order =
            Number(b.title.includes(ingredientSearchKey(filters.q))) -
            Number(a.title.includes(ingredientSearchKey(filters.q)));
        if (!order && filters.sort === "name")
          order = a.title < b.title ? -1 : a.title > b.title ? 1 : 0;
        return order || (a.recipe.key < b.recipe.key ? -1 : a.recipe.key > b.recipe.key ? 1 : 0);
      });
      const total = items.length,
        pages = Math.ceil(total / filters.size),
        page = Math.min(filters.page, Math.max(1, pages));
      return {
        source: filters.source,
        accountId: null,
        items: items
          .slice((page - 1) * filters.size, page * filters.size)
          .map(({ recipe, compatibility }) => ({ recipe, compatibility })),
        total,
        page,
        pages,
        size: filters.size,
        excludedCount,
        facets,
        unknown: {
          budget: snapshot.recipes.filter((r) => r.budget === null).length,
          nutrition: snapshot.recipes.filter((r) => r.nutrition === null).length,
        },
      };
    },
  };
}
