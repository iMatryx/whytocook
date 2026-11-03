import { recipeFiltersSchema } from "./search.schema.ts";
import type { RecipeFilters } from "./search.schema.ts";
const arrays = new Set([
  "ingredient",
  "difficulty",
  "meal",
  "cuisine",
  "diet",
  "equipment",
  "exclude",
  "allergy",
]);
const integers = new Set(["minutes", "servings", "page", "size"]);
export function parseRecipeQuery(params: URLSearchParams) {
  const values: Record<string, unknown> = {};
  for (const key of new Set(params.keys())) {
    const all = params.getAll(key);
    if (!arrays.has(key) && all.length !== 1)
      return { success: false as const, message: `Parametru repetat: ${key}` };
    values[key] = arrays.has(key)
      ? all
      : integers.has(key) && /^\d+$/.test(all[0]!)
        ? Number(all[0])
        : all[0];
  }
  const parsed = recipeFiltersSchema.safeParse(values);
  return parsed.success
    ? { success: true as const, data: parsed.data }
    : { success: false as const, message: "Verifică filtrele și pagina din adresă." };
}
export function recipeQueryString(filters: RecipeFilters) {
  const defaults = recipeFiltersSchema.parse({});
  const params = new URLSearchParams();
  for (const key of Object.keys(filters).sort() as (keyof RecipeFilters)[]) {
    const value = filters[key];
    if (value === null || value === defaults[key] || (Array.isArray(value) && !value.length))
      continue;
    if (Array.isArray(value)) for (const item of [...value].sort()) params.append(key, item);
    else params.set(key, String(value));
  }
  return params.toString();
}
