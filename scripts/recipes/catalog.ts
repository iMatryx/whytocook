import { readFile } from "node:fs/promises";
import { z } from "zod";
import type { RecipeCatalog } from "../../src/features/recipes/contracts/recipe-bundle.schema.ts";
const ingredient = z
  .object({
    slug: z.string(),
    name: z.string(),
    kind: z.enum(["generic", "specific"]),
    parent: z.string().nullable(),
    relation: z.enum(["part_of", "variant_of"]).nullable(),
    category: z.string(),
    aliases: z
      .object({
        "ro-RO": z.array(z.string()).min(1),
        "ru-RU": z.array(z.string()).min(1),
        "en-GB": z.array(z.string()).min(1),
      })
      .strict(),
    units: z.array(z.enum(["g", "kg", "ml", "l", "piece"])).min(1),
    defaultUnit: z.string(),
  })
  .strict();
export const referenceSchema = z
  .object({
    schemaVersion: z.literal(1),
    categories: z.array(z.object({ slug: z.string(), name: z.string() }).strict()),
    ingredients: z.array(ingredient),
    equipment: z.array(z.object({ code: z.string(), name: z.string() }).strict()),
    tags: z.array(
      z
        .object({
          slug: z.string(),
          name: z.string(),
          kind: z.enum(["general", "diet", "cuisine"]),
        })
        .strict(),
    ),
  })
  .strict();
export type RecipeReferences = z.infer<typeof referenceSchema>;
export async function readRecipeCatalog(): Promise<{
  catalog: RecipeCatalog;
  references: RecipeReferences;
}> {
  const references = referenceSchema.parse(
    JSON.parse(
      await readFile(new URL("../../data/recipes/references.v1.json", import.meta.url), "utf8"),
    ),
  );
  const original = z
    .array(ingredient)
    .parse(
      JSON.parse(
        await readFile(new URL("../../docs/data/ingredients-v1.json", import.meta.url), "utf8"),
      ),
    );
  // Minimum editorial hints, not a certification of labels or cross-contact.
  const hints: Record<string, string[]> = {
    "ou-de-gaina": ["eggs"],
    "lapte-de-vaca": ["milk"],
    "branza-proaspata-de-vaca": ["milk"],
    smantana: ["milk"],
    unt: ["milk"],
    "iaurt-natural": ["milk"],
    "faina-de-grau": ["gluten"],
    "fulgi-de-ovaz": ["gluten"],
    "gris-de-grau": ["gluten"],
    "arpacas-de-orz": ["gluten"],
    "paste-din-grau-fara-ou": ["gluten"],
    "paine-de-grau": ["gluten"],
    "miez-de-nuca": ["tree_nuts"],
  };
  const ingredients = [...original, ...references.ingredients].map((i) => ({
    ...i,
    allergenHints: hints[i.slug] ?? [],
  }));
  if (new Set(ingredients.map((i) => i.slug)).size !== ingredients.length)
    throw new Error("Duplicate canonical ingredient slug in references");
  for (const i of ingredients)
    if (!i.units.includes(i.defaultUnit as (typeof i.units)[number]))
      throw new Error("Default unit is not allowed");
  return {
    references,
    catalog: {
      ingredients,
      equipment: [
        "hob",
        "oven",
        "microwave",
        "pan",
        "pot",
        "blender",
        "mixer",
        "air_fryer",
        "grill",
        ...references.equipment.map((e) => e.code),
      ],
      tags: [
        "vegetarian",
        "vegan",
        "pescatarian",
        "gluten-free",
        "lactose-free",
        ...references.tags.map((t) => t.slug),
      ],
      allergens: [
        "gluten",
        "crustaceans",
        "eggs",
        "fish",
        "peanuts",
        "soy",
        "milk",
        "tree_nuts",
        "celery",
        "mustard",
        "sesame",
        "sulphites",
        "lupin",
        "molluscs",
      ],
    },
  };
}
