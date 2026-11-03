import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validateRecipeBundle } from "../../src/features/recipes/application/validate-bundle.ts";
import { readRecipeCatalog } from "./catalog.ts";
import { readBundleFile, recipeSql } from "./io.ts";
import { referenceSql } from "./reference-sql.ts";
const { catalog } = await readRecipeCatalog();
const demo = validateRecipeBundle(
  await readBundleFile("data/recipes/demonstration.v1.json"),
  catalog,
);
const verified = validateRecipeBundle(
  await readBundleFile("data/recipes/verified.v1.json"),
  catalog,
);
assert.equal(demo.valid, true, "Demonstration validation errors");
assert.equal(verified.valid, true, "Verified validation errors");
assert.ok(demo.bundle && verified.bundle);
assert.ok(
  demo.summary.total + verified.summary.total >= 60 &&
    demo.summary.total + verified.summary.total <= 100,
);
assert.ok(demo.bundle.recipes.every((r) => r.dataClass === "demonstration"));
assert.ok(verified.bundle.recipes.every((r) => r.dataClass === "verified"));
const keys = [...demo.bundle.recipes, ...verified.bundle.recipes].map((r) => r.key);
assert.equal(new Set(keys).size, keys.length, "A recipe occurs in both data classes");
for (const group of ["breakfast", "lunch", "dinner", "dessert"])
  assert.ok((demo.summary.mealTypes[group] ?? 0) + (verified.summary.mealTypes[group] ?? 0) > 0);
for (const group of ["vegetarian", "high-protein"])
  assert.ok(
    (demo.summary.collections[group] ?? 0) + (verified.summary.collections[group] ?? 0) > 0,
  );
assert.equal(
  await readFile("supabase/migrations/20261103000014_recipe_references.sql", "utf8"),
  await referenceSql(),
  "Reference SQL drift",
);
assert.equal(
  await readFile("supabase/migrations/20261103000015_initial_recipes.sql", "utf8"),
  recipeSql(demo.bundle, true),
  "Recipe seed SQL drift",
);
assert.deepEqual(
  JSON.parse(await readFile("docs/recipes/COMPLETENESS.json", "utf8")),
  { schemaVersion: 1, valid: demo.valid, summary: demo.summary, issues: demo.issues },
  "Completeness report drift",
);
process.stdout.write(
  `PASS: ${demo.summary.total} demonstrative, ${verified.summary.total} verificate; SQL și raport reproductibile; ${demo.summary.warnings} avertizări explicite.\n`,
);
