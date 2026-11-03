import { z } from "zod";
// Validate content without rewriting the immutable payload used for import hashes.
const text = (max: number) =>
  z
    .string()
    .max(max)
    .refine((value) => {
      const length = value.trim().length;
      return length >= 1 && length <= max;
    }, `Text must contain 1–${max} non-padding characters`);
const slug = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(100);
const url = z
  .string()
  .max(2048)
  .refine((value) => {
    const match =
      /^https:\/\/([a-zA-Z0-9.-]+)(?::\d{1,5})?(?:[/?#][^\s\u0000-\u001f\u007f]*)?$/.exec(value);
    if (!match || !URL.canParse(value)) return false;
    const host = match[1]!;
    const dns =
      /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?\.)*[a-zA-Z](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?$/;
    const ipv4 = /^(?:0|[1-9]\d{0,2})(?:\.(?:0|[1-9]\d{0,2})){3}$/;
    return (
      dns.test(host) || (ipv4.test(host) && host.split(".").every((part) => Number(part) <= 255))
    );
  }, "Expected an HTTPS source URL with a hostname and valid optional port");
const decimal = z.string().regex(/^(?:0|[1-9]\d{0,11})(?:\.\d{1,6})?$/);
const positive = decimal.refine((value) => !/^0(?:\.0+)?$/.test(value));
export const sourceSchema = z
  .object({
    name: text(200),
    url,
    recordId: text(200),
    license: text(500),
    observedOn: z.iso.date(),
  })
  .strict();
const nutrients = z
  .object({
    energyKcal: positive,
    proteinG: decimal,
    carbohydrateG: decimal,
    fatG: decimal,
    fiberG: decimal,
    saltG: decimal,
  })
  .strict();
export const recipeSeedSchema = z
  .object({
    key: slug,
    revision: z.number().int().min(1).max(100000),
    title: text(200),
    summary: text(4000),
    dataClass: z.enum(["demonstration", "verified"]),
    regions: z
      .array(z.enum(["MD", "RO"]))
      .min(1)
      .max(2),
    mealTypes: z
      .array(z.enum(["breakfast", "lunch", "dinner", "dessert"]))
      .min(1)
      .max(4),
    collections: z.array(z.enum(["vegetarian", "high-protein"])).max(2),
    servings: z.number().int().min(1).max(20),
    difficulty: z.enum(["easy", "medium", "hard"]),
    activeMinutes: z.number().int().min(0).max(10080),
    totalMinutes: z.number().int().min(1).max(10080),
    ingredients: z
      .array(
        z
          .object({
            ingredientSlug: slug,
            quantity: positive,
            unit: z.enum(["g", "kg", "ml", "l", "piece"]),
            optional: z.boolean(),
            state: z.enum(["raw", "cooked", "ready-to-eat"]),
            preparation: text(500),
          })
          .strict(),
      )
      .min(1)
      .max(60),
    steps: z
      .array(
        z
          .object({
            instruction: text(8000),
            timerSeconds: z.number().int().min(1).max(604800).nullable(),
          })
          .strict(),
      )
      .min(1)
      .max(30),
    equipment: z
      .array(
        z
          .string()
          .regex(/^[a-z_]+$/)
          .max(32),
      )
      .min(1)
      .max(20),
    tags: z.array(slug).min(1).max(30),
    allergens: z
      .object({
        status: z.enum(["unverified", "verified"]),
        contains: z.array(z.string()).max(30),
        mayContain: z.array(z.string()).max(30),
        source: sourceSchema.nullable(),
        notes: text(1000),
      })
      .strict(),
    nutrition: z
      .object({
        status: z.enum(["unavailable", "verified"]),
        basis: z.literal("per-serving"),
        perServing: nutrients.nullable(),
        source: sourceSchema.nullable(),
        notes: text(1000),
      })
      .strict(),
    proteinClaim: z.enum(["none", "candidate", "verified"]),
    budget: z
      .object({
        status: z.enum(["unverified", "verified"]),
        currency: z.enum(["MDL", "RON"]),
        perServing: positive.nullable(),
        source: sourceSchema.nullable(),
        notes: text(1000),
      })
      .strict(),
    verification: z
      .object({
        status: z.enum(["unverified", "verified"]),
        reviewedBy: text(100).nullable(),
        reviewedAt: z.iso.datetime({ offset: true }).nullable(),
        evidenceUrl: url.nullable(),
        notes: text(1000),
      })
      .strict(),
    provenance: z
      .object({
        kind: z.enum(["original", "external"]),
        name: text(200),
        url: url.nullable(),
        license: text(500).nullable(),
      })
      .strict(),
  })
  .strict()
  .superRefine((recipe, ctx) => {
    const fail = (path: string, message: string) =>
      ctx.addIssue({ code: "custom", path: [path], message });
    if (recipe.activeMinutes > recipe.totalMinutes)
      fail("totalMinutes", "Total time must include active time");
    for (const [field, value, values] of [
      [
        "nutrition",
        recipe.nutrition.status === "verified",
        [recipe.nutrition.perServing, recipe.nutrition.source],
      ],
      [
        "budget",
        recipe.budget.status === "verified",
        [recipe.budget.perServing, recipe.budget.source],
      ],
    ] as const) {
      if (value ? values.some((x) => x === null) : values.some((x) => x !== null))
        fail(field, "Verified values require a source; unknown values must remain null");
    }
    if (recipe.allergens.status === "verified" && recipe.allergens.source === null)
      fail("allergens", "Verified allergens require evidence");
    const reviewed = [
      recipe.verification.reviewedBy,
      recipe.verification.reviewedAt,
      recipe.verification.evidenceUrl,
    ];
    if (
      recipe.verification.status === "verified"
        ? reviewed.some((x) => x === null)
        : reviewed.some((x) => x !== null)
    )
      fail("verification", "Review evidence and status must agree");
    if ((recipe.dataClass === "verified") !== (recipe.verification.status === "verified"))
      fail("dataClass", "Demonstration and verified records are separate classes");
    if (
      recipe.dataClass === "verified" &&
      (recipe.nutrition.status !== "verified" || recipe.allergens.status !== "verified")
    )
      fail("dataClass", "A verified record requires nutrition and allergen review");
    if (
      recipe.provenance.kind === "external" &&
      (!recipe.provenance.url || !recipe.provenance.license)
    )
      fail("provenance", "External content needs URL and reuse terms");
    if (recipe.collections.includes("high-protein") !== (recipe.proteinClaim !== "none"))
      fail("proteinClaim", "Protein collection and claim must agree");
    if (
      recipe.proteinClaim === "verified" &&
      (recipe.nutrition.status !== "verified" || recipe.dataClass !== "verified")
    )
      fail("proteinClaim", "Verified high protein needs verified recipe and nutrition");
  });
export const recipeBundleSchema = z
  .object({
    schemaVersion: z.literal(1),
    namespace: slug,
    locale: z.literal("ro-RO"),
    recipes: z.array(recipeSeedSchema).max(1000),
  })
  .strict();
export type RecipeSeed = z.infer<typeof recipeSeedSchema>;
export type RecipeBundle = z.infer<typeof recipeBundleSchema>;
export type RecipeCatalog = {
  ingredients: readonly {
    slug: string;
    units: readonly string[];
    kind: string;
    allergenHints?: readonly string[];
  }[];
  equipment: readonly string[];
  tags: readonly string[];
  allergens: readonly string[];
};
