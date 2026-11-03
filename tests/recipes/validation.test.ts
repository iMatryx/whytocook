import assert from "node:assert/strict";
import { test } from "node:test";
import { recipeBundleSchema } from "../../src/features/recipes/contracts/recipe-bundle.schema.ts";
import { validateRecipeBundle } from "../../src/features/recipes/application/validate-bundle.ts";
export const recipe = {
  key: "omleta-de-test",
  revision: 1,
  title: "Omletă de test",
  summary: "Exemplu sintetic pentru teste, nu rețetă publicabilă.",
  dataClass: "demonstration",
  regions: ["MD", "RO"],
  mealTypes: ["breakfast"],
  collections: ["vegetarian"],
  servings: 2,
  difficulty: "easy",
  activeMinutes: 10,
  totalMinutes: 15,
  ingredients: [
    {
      ingredientSlug: "ou-de-gaina",
      quantity: "2",
      unit: "piece",
      optional: false,
      state: "raw",
      preparation: "Ouă de găină fără coajă, bătute.",
    },
  ],
  steps: [
    {
      instruction: "Gătește ouăle complet într-o tigaie, măsurând temperatura preparatului.",
      timerSeconds: null,
    },
  ],
  equipment: ["hob", "pan"],
  tags: ["economic"],
  allergens: {
    status: "unverified",
    contains: ["eggs"],
    mayContain: [],
    source: null,
    notes: "Lista este editorială, nu verificată.",
  },
  nutrition: {
    status: "unavailable",
    basis: "per-serving",
    perServing: null,
    source: null,
    notes: "Nu există date pentru acest exemplu.",
  },
  proteinClaim: "none",
  budget: {
    status: "unverified",
    currency: "MDL",
    perServing: null,
    source: null,
    notes: "Fără prețuri curente.",
  },
  verification: {
    status: "unverified",
    reviewedBy: null,
    reviewedAt: null,
    evidenceUrl: null,
    notes: "Exemplu netestat.",
  },
  provenance: { kind: "original", name: "Fixture sintetic Cookly", url: null, license: null },
};
export const bundle = {
  schemaVersion: 1,
  namespace: "cookly-test",
  locale: "ro-RO",
  recipes: [recipe],
};
export const catalog = {
  ingredients: [{ slug: "ou-de-gaina", units: ["piece", "g"], kind: "specific" }],
  equipment: ["hob", "pan"],
  tags: ["economic"],
  allergens: ["eggs"],
};
test("demonstration bundle validates structurally while missing evidence remains explicit", () => {
  assert.ok(recipeBundleSchema.safeParse(bundle).success);
  const result = validateRecipeBundle(bundle, catalog);
  assert.equal(result.valid, true);
  assert.equal(result.summary.demonstration, 1);
  assert.equal(result.summary.verified, 0);
  assert.ok(result.issues.some((issue) => issue.code === "NUTRITION_UNAVAILABLE"));
});
test("canonical references, compatible units and uniqueness are enforced without synonym matching", () => {
  for (const change of [
    { ingredients: [{ ...recipe.ingredients[0], ingredientSlug: "eggs" }] },
    { ingredients: [{ ...recipe.ingredients[0], unit: "ml" }] },
    { ingredients: [{ ...recipe.ingredients[0], quantity: "0.5" }] },
    { equipment: ["unknown"] },
    { tags: ["unknown"] },
    { allergens: { ...recipe.allergens, contains: ["unknown"] } },
  ])
    assert.equal(
      validateRecipeBundle({ ...bundle, recipes: [{ ...recipe, ...change }] }, catalog).valid,
      false,
    );
  assert.equal(
    validateRecipeBundle({ ...bundle, recipes: [recipe, recipe] }, catalog).valid,
    false,
  );
  assert.equal(
    recipeBundleSchema.safeParse({
      ...bundle,
      recipes: [{ ...recipe, activeMinutes: 20, totalMinutes: 10 }],
    }).success,
    false,
  );
});
test("verified status cannot be promoted without review, licensed nutrition and allergen evidence", () => {
  assert.equal(
    recipeBundleSchema.safeParse({ ...bundle, recipes: [{ ...recipe, dataClass: "verified" }] })
      .success,
    false,
  );
  assert.equal(
    recipeBundleSchema.safeParse({
      ...bundle,
      recipes: [{ ...recipe, nutrition: { ...recipe.nutrition, status: "verified" } }],
    }).success,
    false,
  );
  assert.equal(
    recipeBundleSchema.safeParse({
      ...bundle,
      recipes: [{ ...recipe, ingredients: [{ ...recipe.ingredients[0], quantity: "NaN" }] }],
    }).success,
    false,
  );
});
test("empty files have a clear empty report, never pretend to contain a collection", () => {
  const report = validateRecipeBundle({ ...bundle, recipes: [] }, catalog);
  assert.equal(report.valid, true);
  assert.equal(report.summary.total, 0);
  assert.ok(report.issues.some((issue) => issue.code === "EMPTY_COLLECTION"));
});
test("malformed URL evidence produces a validation report instead of throwing", () => {
  for (const url of ["https://example.com:bad", "https://[broken", "http://example.com/evidence"]) {
    const result = validateRecipeBundle(
      {
        ...bundle,
        recipes: [
          {
            ...recipe,
            provenance: {
              kind: "external",
              name: "Invalid source fixture",
              url,
              license: "Fixture only",
            },
          },
        ],
      },
      catalog,
    );
    assert.equal(result.valid, false);
    assert.ok(
      result.issues.some(
        (issue) => issue.code === "SCHEMA_VALIDATION" && issue.path === "recipes.0.provenance.url",
      ),
    );
  }
});
test("preserved text padding cannot exceed database field limits", () => {
  const result = validateRecipeBundle(
    {
      ...bundle,
      recipes: [{ ...recipe, title: ` ${"a".repeat(200)} ` }],
    },
    catalog,
  );
  assert.equal(result.valid, false);
});
test("a recipe needs a required ingredient and verified high protein must meet the energy threshold", () => {
  assert.equal(
    validateRecipeBundle(
      {
        ...bundle,
        recipes: [{ ...recipe, ingredients: [{ ...recipe.ingredients[0], optional: true }] }],
      },
      catalog,
    ).valid,
    false,
  );
  const source = {
    name: "Synthetic test fixture",
    url: "https://example.com/synthetic-test-only",
    recordId: "fixture",
    license: "Test fixture only",
    observedOn: "2026-11-03",
  };
  const verified = {
    ...recipe,
    dataClass: "verified",
    collections: ["vegetarian", "high-protein"],
    proteinClaim: "verified",
    verification: {
      ...recipe.verification,
      status: "verified",
      reviewedBy: "Synthetic fixture reviewer",
      reviewedAt: "2026-11-03T00:00:00Z",
      evidenceUrl: source.url,
    },
    allergens: { ...recipe.allergens, status: "verified", source },
    nutrition: {
      ...recipe.nutrition,
      status: "verified",
      source,
      perServing: {
        energyKcal: "300",
        proteinG: "10",
        carbohydrateG: "30",
        fatG: "10",
        fiberG: "2",
        saltG: "1",
      },
    },
  };
  assert.equal(validateRecipeBundle({ ...bundle, recipes: [verified] }, catalog).valid, false);
  assert.equal(
    validateRecipeBundle(
      {
        ...bundle,
        recipes: [
          {
            ...verified,
            nutrition: {
              ...verified.nutrition,
              perServing: { ...verified.nutrition.perServing, proteinG: "15" },
            },
          },
        ],
      },
      catalog,
    ).valid,
    true,
  );
  assert.equal(
    validateRecipeBundle(
      {
        ...bundle,
        recipes: [
          {
            ...verified,
            nutrition: {
              ...verified.nutrition,
              perServing: { ...verified.nutrition.perServing, proteinG: "100" },
            },
          },
        ],
      },
      catalog,
    ).valid,
    false,
  );
  const withHints = {
    ...catalog,
    ingredients: [{ ...catalog.ingredients[0]!, allergenHints: ["eggs"] }],
  };
  assert.equal(
    validateRecipeBundle(
      {
        ...bundle,
        recipes: [
          {
            ...verified,
            proteinClaim: "none",
            collections: ["vegetarian"],
            allergens: { ...verified.allergens, contains: [] },
          },
        ],
      },
      withHints,
    ).valid,
    false,
  );
});
