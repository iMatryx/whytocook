import { z } from "zod";
import { readRecipeCatalog } from "../recipes/catalog.ts";
import { readBundleFile } from "../recipes/io.ts";
import { validateRecipeBundle } from "../../src/features/recipes/application/validate-bundle.ts";
import { recipesForMatching } from "../../src/features/matching/application/adapters.ts";
import {
  matchingConfigurationSchema,
  matchingRequestSchema,
} from "../../src/features/matching/contracts/index.ts";

export async function loadMatchingExample() {
  const { catalog, references } = await readRecipeCatalog();
  const bundle = validateRecipeBundle(
    await readBundleFile("data/recipes/demonstration.v1.json"),
    catalog,
  );
  if (!bundle.valid || !bundle.bundle)
    throw new Error("The recipe demonstration collection is invalid");
  const ingredient = z.object({
    slug: z.string(),
    name: z.string(),
    units: z.array(z.enum(["g", "kg", "ml", "l", "piece"])),
    aliases: z.object({
      "ro-RO": z.array(z.string()),
      "ru-RU": z.array(z.string()),
      "en-GB": z.array(z.string()),
    }),
  });
  const original = z.array(ingredient).parse(await readBundleFile("docs/data/ingredients-v1.json"));
  const hints = new Map(catalog.ingredients.map((i) => [i.slug, i.allergenHints ?? []]));
  const configuration = matchingConfigurationSchema.parse({
    catalog: {
      ingredients: [...original, ...references.ingredients].map((i) => ({
        slug: i.slug,
        name: i.name,
        units: i.units,
        active: true,
        aliases: (["ro-RO", "ru-RU", "en-GB"] as const).flatMap((locale) =>
          i.aliases[locale].map((label) => ({ locale, label })),
        ),
        allergenHints: hints.get(i.slug),
      })),
    },
    recipes: recipesForMatching(bundle.bundle.recipes),
  });
  const supplies = [
    ["fulgi-de-ovaz", "1000", "g"],
    ["lapte-de-vaca", "3", "l"],
    ["mar", "2", "kg"],
    ["scortisoara-macinata", "50", "g"],
    ["sare-alimentara", "100", "g"],
    ["apa-potabila", "20", "l"],
    ["ulei-de-floarea-soarelui", "1", "l"],
    ["ou-de-gaina", "12", "piece"],
    ["rosii", "1", "kg"],
    ["ceapa", "1", "kg"],
    ["cartof", "2", "kg"],
    ["iaurt-natural", "500", "g"],
    ["branza-proaspata-de-vaca", "500", "g"],
  ];
  const request = matchingRequestSchema.parse({
    today: "2026-11-03",
    preferences: { maxTotalMinutes: 30, preferredTags: ["vegetarian"] },
    inventory: supplies.map(([slug, quantity, unit], index) => ({
      id: `example-lot-${index}`,
      ingredient: { slug },
      quantity,
      unit,
      expiresOn: null,
    })),
  });
  return { configuration, request };
}
