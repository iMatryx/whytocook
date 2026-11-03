import { matchingConfigurationSchema, matchingRequestSchema } from "../contracts/index.ts";
import type {
  AllergenCode,
  MatchingConfiguration,
  MatchingItem,
  MatchingRecipe,
  MatchingRequest,
  MatchingResult,
} from "../contracts/index.ts";
import { ingredientSearchKey } from "../../../shared/domain/ingredient-search-key.ts";
import {
  baseMicros,
  coverageBps,
  displayMicros,
  scaleRequirement,
  supportedUnit,
  unitTable,
} from "./quantity.ts";
import { scoreRecipe } from "./scoring.ts";

type CatalogEntry = MatchingConfiguration["catalog"]["ingredients"][number];
type Problem = { path: string; message: string };
type CompiledRecipe = {
  recipe: MatchingRecipe;
  lines: {
    line: MatchingRecipe["ingredients"][number];
    base: bigint;
    unit: "g" | "ml" | "piece";
  }[];
  tags: Set<string>;
  contains: Set<AllergenCode>;
  mayContain: Set<AllergenCode>;
};
type Stock = { quantities: Map<string, bigint>; unknown: boolean };
function blank(): MatchingResult {
  return {
    algorithmVersion: "cookly-matching-v1",
    status: "empty",
    groups: { ready_to_cook: [], almost_ready: [], missing_ingredients: [] },
    excluded: [],
    diagnostics: [],
    summary: { evaluated: 0, matched: 0, excluded: 0, inventoryLots: 0, usableLots: 0 },
    error: null,
  };
}
function failure(
  code: "INVALID_CONFIGURATION" | "INVALID_REQUEST",
  issues: readonly Problem[],
): MatchingResult {
  return { ...blank(), status: "error", error: { code, issues: issues.map((i) => ({ ...i })) } };
}
const aliasKey = (locale: string, alias: string) => `${locale}:${ingredientSearchKey(alias)}`;

function compile(config: MatchingConfiguration) {
  const ingredients = new Map<string, CatalogEntry>();
  const aliases = new Map<string, string>();
  const problems: Problem[] = [];
  for (const [index, ingredient] of config.catalog.ingredients.entries()) {
    if (ingredients.has(ingredient.slug))
      problems.push({ path: `catalog.ingredients.${index}`, message: "Duplicate canonical slug" });
    ingredients.set(ingredient.slug, ingredient);
    for (const alias of ingredient.aliases) {
      const key = aliasKey(alias.locale, alias.label);
      if (
        !ingredientSearchKey(alias.label) ||
        (aliases.has(key) && aliases.get(key) !== ingredient.slug)
      )
        problems.push({
          path: `catalog.ingredients.${index}.aliases`,
          message: "Empty or ambiguous normalized alias",
        });
      aliases.set(key, ingredient.slug);
    }
  }
  const recipeKeys = new Set<string>();
  const recipes: CompiledRecipe[] = [];
  for (const [index, recipe] of config.recipes.entries()) {
    if (recipeKeys.has(recipe.key))
      problems.push({ path: `recipes.${index}.key`, message: "Duplicate recipe key" });
    recipeKeys.add(recipe.key);
    if (!recipe.ingredients.some((i) => !i.optional))
      problems.push({
        path: `recipes.${index}.ingredients`,
        message: "At least one required ingredient is needed",
      });
    const seen = new Set<string>();
    const contains = new Set(recipe.allergens.contains);
    for (const line of recipe.ingredients) {
      const entry = ingredients.get(line.ingredientSlug);
      if (
        seen.has(line.ingredientSlug) ||
        !entry ||
        !entry.active ||
        !entry.units.includes(line.unit)
      )
        problems.push({
          path: `recipes.${index}.ingredients`,
          message: `Duplicate, unknown, inactive ingredient or disallowed unit: ${line.ingredientSlug}`,
        });
      seen.add(line.ingredientSlug);
      for (const hint of entry?.allergenHints ?? []) contains.add(hint);
    }
    if (recipe.allergens.contains.some((a) => recipe.allergens.mayContain.includes(a)))
      problems.push({ path: `recipes.${index}.allergens`, message: "Allergen relations overlap" });
    recipes.push({
      recipe,
      lines: recipe.ingredients.map((line) => ({
        line,
        base: baseMicros(line.quantity, line.unit),
        unit: unitTable[line.unit].base,
      })),
      tags: new Set(recipe.tags),
      contains,
      mayContain: new Set(recipe.allergens.mayContain),
    });
  }
  return { ingredients, aliases, problems, recipes };
}

function inventoryIndex(
  request: MatchingRequest,
  compiled: ReturnType<typeof compile>,
  result: MatchingResult,
) {
  const stock = new Map<string, Stock>();
  result.summary.inventoryLots = request.inventory.length;
  if (!request.inventory.length)
    result.diagnostics.push({
      code: "EMPTY_INVENTORY",
      lotId: null,
      path: "inventory",
      message: "Inventarul este gol.",
    });
  for (const [index, lot] of request.inventory.entries()) {
    const diagnostic = (code: string, message: string) =>
      result.diagnostics.push({ code, lotId: lot.id, path: `inventory.${index}`, message });
    const slug =
      "slug" in lot.ingredient
        ? lot.ingredient.slug
        : compiled.aliases.get(aliasKey(lot.ingredient.locale, lot.ingredient.alias));
    const ingredient = slug ? compiled.ingredients.get(slug) : undefined;
    if (!ingredient) {
      diagnostic(
        "UNKNOWN_INGREDIENT",
        "Referința nu corespunde unui ingredient canonic sau alias explicit.",
      );
      continue;
    }
    if (!ingredient.active) {
      diagnostic("INACTIVE_INGREDIENT", "Ingredientul nu mai este activ în catalog.");
      continue;
    }
    if (lot.expiresOn !== null && lot.expiresOn < request.today) {
      diagnostic("EXPIRED_LOT", "Lotul expirat nu contribuie la stocul utilizabil.");
      continue;
    }
    if (lot.unit !== null && (!supportedUnit(lot.unit) || !ingredient.units.includes(lot.unit))) {
      diagnostic("UNSUPPORTED_UNIT", "Unitatea nu este suportată sau permisă pentru ingredient.");
      continue;
    }
    const value = stock.get(ingredient.slug) ?? {
      quantities: new Map<string, bigint>(),
      unknown: false,
    };
    if (lot.quantity === null || lot.unit === null) {
      value.unknown = true;
      diagnostic("UNKNOWN_QUANTITY", "Ingredientul este prezent, dar cantitatea trebuie măsurată.");
    } else if (supportedUnit(lot.unit)) {
      const base = unitTable[lot.unit].base;
      value.quantities.set(
        base,
        (value.quantities.get(base) ?? 0n) + baseMicros(lot.quantity, lot.unit),
      );
    }
    stock.set(ingredient.slug, value);
    result.summary.usableLots++;
  }
  return stock;
}

function evaluate(
  compiled: CompiledRecipe,
  request: MatchingRequest,
  stock: Map<string, Stock>,
): MatchingItem {
  const { recipe } = compiled;
  const servings = request.servings ?? recipe.baseServings;
  let quantitySum = 0,
    present = 0;
  const requiredSummary = { total: 0, sufficient: 0, insufficient: 0, missing: 0, unknown: 0 };
  const ingredients: MatchingItem["ingredients"] = compiled.lines.map(({ line, base, unit }) => {
    const itemStock = stock.get(line.ingredientSlug);
    const available = itemStock?.quantities.get(unit) ?? 0n;
    const { required, rounding } = scaleRequirement(base, unit, servings, recipe.baseServings);
    const unknown = itemStock?.unknown ?? false;
    const status =
      available >= required
        ? "sufficient"
        : available > 0n
          ? "insufficient"
          : unknown
            ? "unknown_quantity"
            : "missing";
    if (!line.optional) {
      requiredSummary.total++;
      requiredSummary[status === "unknown_quantity" ? "unknown" : status]++;
      quantitySum += coverageBps(available, required);
      if (available > 0n || unknown) present++;
    }
    const issues: string[] = [];
    if (unknown) issues.push("UNKNOWN_QUANTITY");
    if (
      itemStock &&
      [...itemStock.quantities].some(([other, quantity]) => other !== unit && quantity > 0n)
    )
      issues.push("INCOMPATIBLE_UNIT");
    return {
      ingredientSlug: line.ingredientSlug,
      role: line.optional ? "optional" : "required",
      status,
      unit,
      required: displayMicros(required),
      available: displayMicros(available),
      shortage: displayMicros(available < required ? required - available : 0n),
      quantityUncertain: unknown,
      rounding,
      issues,
    };
  });
  const quantityBps = Math.floor(quantitySum / requiredSummary.total);
  const deficient = requiredSummary.total - requiredSummary.sufficient;
  const category =
    deficient === 0
      ? "ready_to_cook"
      : deficient <= 1 && quantityBps >= 8000
        ? "almost_ready"
        : "missing_ingredients";
  const warnings: string[] = [];
  if (recipe.dataClass === "demonstration") warnings.push("DEMONSTRATION_RECIPE");
  if (recipe.allergens.status === "unverified") warnings.push("ALLERGENS_UNVERIFIED");
  if (ingredients.some((i) => i.quantityUncertain)) warnings.push("QUANTITY_MEASUREMENT_REQUIRED");
  return {
    recipeKey: recipe.key,
    revision: recipe.revision,
    title: recipe.title,
    dataClass: recipe.dataClass,
    servings,
    category,
    ingredients,
    requiredSummary,
    score: scoreRecipe(
      Math.floor((present * 10000) / requiredSummary.total),
      quantityBps,
      recipe.totalMinutes,
      compiled.tags,
      request.preferences,
    ),
    warnings,
  };
}

export function createMatchingEngine(value: unknown) {
  const parsed = matchingConfigurationSchema.safeParse(value);
  const compiled = parsed.success ? compile(parsed.data) : null;
  const problems = parsed.success
    ? compiled!.problems
    : parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
  return {
    match(value: unknown): MatchingResult {
      if (!compiled || problems.length) return failure("INVALID_CONFIGURATION", problems);
      const parsedRequest = matchingRequestSchema.safeParse(value);
      if (!parsedRequest.success)
        return failure(
          "INVALID_REQUEST",
          parsedRequest.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
        );
      const request = parsedRequest.data;
      const result = blank();
      const stock = inventoryIndex(request, compiled, result);
      for (const recipe of compiled.recipes) {
        result.summary.evaluated++;
        const reasons: MatchingResult["excluded"][number]["reasons"] = [];
        if (request.allergies.length && recipe.recipe.allergens.status !== "verified")
          reasons.push({ code: "ALLERGENS_UNVERIFIED", allergen: null });
        for (const allergen of request.allergies) {
          if (recipe.contains.has(allergen)) reasons.push({ code: "ALLERGEN_PRESENT", allergen });
          if (recipe.mayContain.has(allergen))
            reasons.push({ code: "ALLERGEN_MAY_CONTAIN", allergen });
        }
        if (reasons.length) {
          result.excluded.push({ recipeKey: recipe.recipe.key, reasons });
          continue;
        }
        const item = evaluate(recipe, request, stock);
        result.groups[item.category].push(item);
        result.summary.matched++;
      }
      for (const group of Object.values(result.groups))
        group.sort(
          (a, b) =>
            b.score.total - a.score.total ||
            (a.recipeKey < b.recipeKey ? -1 : a.recipeKey > b.recipeKey ? 1 : 0),
        );
      result.excluded.sort((a, b) =>
        a.recipeKey < b.recipeKey ? -1 : a.recipeKey > b.recipeKey ? 1 : 0,
      );
      result.summary.excluded = result.excluded.length;
      result.status = result.summary.matched ? "ready" : "empty";
      return result;
    },
  };
}
