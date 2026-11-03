import { recipeBundleSchema } from "../contracts/recipe-bundle.schema.ts";
import type { RecipeCatalog } from "../contracts/recipe-bundle.schema.ts";
import { quantityMicros } from "../../../shared/domain/quantity.ts";
export type RecipeIssue = {
  severity: "error" | "warning";
  code: string;
  recipeKey: string | null;
  path: string;
  message: string;
};
export function validateRecipeBundle(value: unknown, catalog: RecipeCatalog) {
  const issues: RecipeIssue[] = [];
  const parsed = recipeBundleSchema.safeParse(value);
  const summary = {
    total: 0,
    demonstration: 0,
    verified: 0,
    mealTypes: {} as Record<string, number>,
    collections: {} as Record<string, number>,
    errors: 0,
    warnings: 0,
  };
  if (!parsed.success) {
    for (const issue of parsed.error.issues)
      issues.push({
        severity: "error",
        code: "SCHEMA_VALIDATION",
        recipeKey: null,
        path: issue.path.join("."),
        message: issue.message,
      });
    return { valid: false, summary: { ...summary, errors: issues.length }, issues, bundle: null };
  }
  const bundle = parsed.data;
  summary.total = bundle.recipes.length;
  const add = (
    severity: RecipeIssue["severity"],
    code: string,
    key: string | null,
    path: string,
    message: string,
  ) => issues.push({ severity, code, recipeKey: key, path, message });
  if (!bundle.recipes.length)
    add("warning", "EMPTY_COLLECTION", null, "recipes", "Colecția este goală.");
  const seen = new Set<string>();
  const refs = new Map(catalog.ingredients.map((i) => [i.slug, i]));
  for (const recipe of bundle.recipes) {
    summary[recipe.dataClass]++;
    for (const type of recipe.mealTypes)
      summary.mealTypes[type] = (summary.mealTypes[type] ?? 0) + 1;
    for (const c of recipe.collections) summary.collections[c] = (summary.collections[c] ?? 0) + 1;
    const error = (code: string, path: string, message: string) =>
      add("error", code, recipe.key, path, message);
    const warning = (code: string, path: string, message: string) =>
      add("warning", code, recipe.key, path, message);
    if (!recipe.ingredients.some((i) => !i.optional))
      error(
        "REQUIRED_INGREDIENT_MISSING",
        "ingredients",
        "Este necesar cel puțin un ingredient obligatoriu.",
      );
    if (seen.has(recipe.key)) error("DUPLICATE_RECIPE", "key", "Cheie duplicată în bundle.");
    seen.add(recipe.key);
    for (const [field, values] of Object.entries({
      regions: recipe.regions,
      mealTypes: recipe.mealTypes,
      collections: recipe.collections,
      equipment: recipe.equipment,
      tags: recipe.tags,
      ingredients: recipe.ingredients.map((i) => i.ingredientSlug),
      contains: recipe.allergens.contains,
      mayContain: recipe.allergens.mayContain,
    })) {
      if (new Set(values).size !== values.length)
        error(
          "DUPLICATE_VALUE",
          field,
          "Valoare repetată; agregă ingredientul sau elimină duplicatul.",
        );
    }
    for (const [position, line] of recipe.ingredients.entries()) {
      const ingredient = refs.get(line.ingredientSlug);
      if (!ingredient)
        error(
          "UNKNOWN_INGREDIENT",
          `ingredients.${position}`,
          `Slug canonic necunoscut: ${line.ingredientSlug}`,
        );
      else {
        if (!ingredient.units.includes(line.unit))
          error(
            "UNIT_NOT_ALLOWED",
            `ingredients.${position}.unit`,
            "Unitate nepermisă pentru ingredient.",
          );
        if (ingredient.kind === "generic")
          warning(
            "GENERIC_INGREDIENT",
            `ingredients.${position}`,
            "Identitatea generală trebuie precizată înaintea verificării nutriției.",
          );
        for (const hint of ingredient.allergenHints ?? [])
          if (!recipe.allergens.contains.includes(hint))
            add(
              recipe.allergens.status === "verified" ? "error" : "warning",
              "ALLERGEN_HINT_MISSING",
              recipe.key,
              "allergens",
              `Declarație editorială minimă lipsă pentru ${line.ingredientSlug}: ${hint}. Nu este o listă exhaustivă.`,
            );
      }
      if (line.unit === "piece" && quantityMicros(line.quantity) % 1_000_000n !== 0n)
        error(
          "FRACTIONAL_PIECE",
          `ingredients.${position}.quantity`,
          "Bucățile trebuie să fie întregi.",
        );
    }
    for (const [field, values, allowed] of [
      ["equipment", recipe.equipment, catalog.equipment],
      ["tags", recipe.tags, catalog.tags],
      [
        "allergens",
        [...recipe.allergens.contains, ...recipe.allergens.mayContain],
        catalog.allergens,
      ],
    ] as const)
      for (const code of values)
        if (!allowed.includes(code))
          error("UNKNOWN_REFERENCE", field, `Referință necunoscută: ${code}`);
    if (recipe.allergens.contains.some((code) => recipe.allergens.mayContain.includes(code)))
      error("ALLERGEN_OVERLAP", "allergens", "Același alergen nu poate fi în ambele relații.");
    if (
      (recipe.collections.includes("vegetarian") || recipe.tags.includes("vegetarian")) &&
      recipe.ingredients.some((i) => ["piept-de-pui", "carne-de-pui"].includes(i.ingredientSlug))
    )
      error("VEGETARIAN_CONFLICT", "collections", "Rețeta conține carne de pui.");
    if (recipe.nutrition.status === "unavailable")
      warning(
        "NUTRITION_UNAVAILABLE",
        "nutrition",
        "Sursa și valorile nutritive nu sunt verificate; nu se interpretează ca zero.",
      );
    if (recipe.allergens.status !== "verified")
      warning(
        "ALLERGENS_UNVERIFIED",
        "allergens",
        "Lista editorială de alergeni necesită verificare, inclusiv etichetele produselor.",
      );
    if (recipe.dataClass === "demonstration")
      warning(
        "CULINARY_REVIEW_REQUIRED",
        "verification",
        "Timpii, porțiile și pașii necesită gătire de probă.",
      );
    if (recipe.budget.status !== "verified")
      warning(
        "BUDGET_UNVERIFIED",
        "budget",
        "Caracterul economic nu are încă prețuri regionale documentate.",
      );
    if (recipe.proteinClaim === "candidate")
      warning(
        "HIGH_PROTEIN_UNVERIFIED",
        "proteinClaim",
        "Candidat editorial, nu afirmație nutrițională verificată.",
      );
    if (
      recipe.nutrition.perServing &&
      quantityMicros(recipe.nutrition.perServing.proteinG) * 4n >
        quantityMicros(recipe.nutrition.perServing.energyKcal)
    )
      error(
        "NUTRITION_ENERGY_CONFLICT",
        "nutrition",
        "Energia provenită din proteine depășește energia totală declarată.",
      );
    if (recipe.tags.includes("high-protein") && recipe.proteinClaim !== "verified")
      error(
        "HIGH_PROTEIN_UNVERIFIED",
        "tags",
        "Eticheta nutrițională high-protein cere verificare; folosește eticheta de candidat.",
      );
    if (recipe.proteinClaim === "verified" && recipe.nutrition.perServing) {
      const n = recipe.nutrition.perServing;
      if (quantityMicros(n.proteinG) * 4n * 100n < quantityMicros(n.energyKcal) * 20n)
        error(
          "HIGH_PROTEIN_THRESHOLD",
          "proteinClaim",
          "Proteinele nu furnizează cel puțin 20% din energia declarată.",
        );
    }
  }
  summary.errors = issues.filter((i) => i.severity === "error").length;
  summary.warnings = issues.length - summary.errors;
  return { valid: summary.errors === 0, summary, issues, bundle };
}
