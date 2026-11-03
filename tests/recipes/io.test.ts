import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import {
  maxBundleBytes,
  normalizedBundle,
  recipeSql,
  readBundleFile,
} from "../../scripts/recipes/io.ts";
import { readRecipeCatalog } from "../../scripts/recipes/catalog.ts";
import { validateRecipeBundle } from "../../src/features/recipes/application/validate-bundle.ts";
test("the initial collection has 60–100 real complete records across all requested groups", async () => {
  const { catalog } = await readRecipeCatalog();
  const result = validateRecipeBundle(
    await readBundleFile("data/recipes/demonstration.v1.json"),
    catalog,
  );
  assert.equal(result.valid, true);
  assert.ok(result.bundle);
  const b = result.bundle;
  assert.equal(b.recipes.length, 72);
  assert.equal(new Set(b.recipes.map((r) => r.title)).size, 72);
  for (const category of ["breakfast", "lunch", "dinner", "dessert"])
    assert.ok((result.summary.mealTypes[category] ?? 0) > 0);
  for (const group of ["vegetarian", "high-protein"])
    assert.ok((result.summary.collections[group] ?? 0) > 0);
  for (const r of b.recipes) {
    assert.equal(r.dataClass, "demonstration");
    assert.equal(r.nutrition.source, null);
    assert.equal(r.nutrition.perServing, null);
    assert.ok(r.steps.length >= 3);
    assert.ok(r.ingredients.length >= 3);
  }
  const verified = validateRecipeBundle(
    await readBundleFile("data/recipes/verified.v1.json"),
    catalog,
  );
  assert.equal(verified.valid, true);
  assert.equal(verified.summary.total, 0);
});
test("CLI export/import roundtrip preserves structured data and never silently overwrites files", async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), "cookly-recipe-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const exported = path.join(dir, "export.json"),
    sql = path.join(dir, "seed.sql");
  const run = (...args: string[]) =>
    spawnSync(process.execPath, ["scripts/recipes/cli.ts", ...args], {
      encoding: "utf8",
      timeout: 10000,
    });
  assert.equal(
    run("export", "--input", "data/recipes/demonstration.v1.json", "--output", exported).status,
    0,
  );
  const { catalog } = await readRecipeCatalog();
  const original = validateRecipeBundle(
    await readBundleFile("data/recipes/demonstration.v1.json"),
    catalog,
  ).bundle!;
  assert.deepEqual(await readBundleFile(exported), normalizedBundle(original));
  assert.equal(run("import", "--input", exported, "--output", sql).status, 0);
  assert.equal(await readFile(sql, "utf8"), recipeSql(original));
  assert.equal(
    run("export", "--input", "data/recipes/demonstration.v1.json", "--output", exported).status,
    1,
  );
  const strict = path.join(dir, "strict.sql");
  assert.equal(run("import", "--input", exported, "--output", strict, "--strict").status, 1);
  await assert.rejects(readFile(strict));
  const bad = path.join(dir, "bad.json");
  await writeFile(
    bad,
    JSON.stringify({ ...original, recipes: [{ ...original.recipes[0], equipment: [] }] }),
  );
  const report = run("validate", "--input", bad);
  assert.equal(report.status, 1);
  assert.ok(JSON.parse(report.stdout).issues.length > 0);
  await writeFile(bad, "not json");
  assert.equal(run("validate", "--input", bad).status, 1);
});
test("the real reference catalog accepts a fully reviewed synthetic high-protein tag", async () => {
  const { catalog } = await readRecipeCatalog();
  const base = validateRecipeBundle(
    await readBundleFile("data/recipes/demonstration.v1.json"),
    catalog,
  ).bundle!;
  const source = {
    name: "Synthetic fixture only",
    url: "https://example.com/test-only",
    recordId: "test",
    license: "Test fixture only",
    observedOn: "2026-11-03",
  };
  const r = {
    ...base.recipes[0]!,
    dataClass: "verified",
    collections: ["vegetarian", "high-protein"],
    proteinClaim: "verified",
    tags: ["high-protein"],
    allergens: { ...base.recipes[0]!.allergens, status: "verified", source },
    verification: {
      status: "verified",
      reviewedBy: "Synthetic reviewer",
      reviewedAt: "2026-11-03T00:00:00Z",
      evidenceUrl: source.url,
      notes: "Test fixture only",
    },
    nutrition: {
      status: "verified",
      basis: "per-serving",
      source,
      notes: "Test fixture only",
      perServing: {
        energyKcal: "300",
        proteinG: "15",
        carbohydrateG: "30",
        fatG: "10",
        fiberG: "2",
        saltG: "1",
      },
    },
  };
  assert.equal(validateRecipeBundle({ ...base, recipes: [r] }, catalog).valid, true);
});

test("invalid imports write an actionable report without producing SQL", async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), "cookly-recipe-report-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const input = path.join(dir, "incomplete.json");
  const output = path.join(dir, "import.sql");
  const report = path.join(dir, "report.json");
  const bundle = (await readBundleFile("data/recipes/demonstration.v1.json")) as {
    recipes: Record<string, unknown>[];
  };
  delete bundle.recipes[0]!.ingredients;
  await writeFile(input, JSON.stringify(bundle));
  const result = spawnSync(
    process.execPath,
    ["scripts/recipes/cli.ts", "import", "--input", input, "--output", output, "--report", report],
    { encoding: "utf8", timeout: 10000 },
  );
  assert.equal(result.status, 1);
  const saved = JSON.parse(await readFile(report, "utf8"));
  assert.equal(saved.valid, false);
  assert.ok(
    saved.issues.some(
      (issue: { path: string; severity: string }) =>
        issue.path === "recipes.0.ingredients" && issue.severity === "error",
    ),
  );
  assert.deepEqual(JSON.parse(result.stdout), saved);
  await assert.rejects(readFile(output), { code: "ENOENT" });
});

test("bundle reader rejects oversized files and reports missing input", async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), "cookly-recipe-size-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const input = path.join(dir, "oversized.json");
  await writeFile(input, Buffer.alloc(maxBundleBytes + 1, 32));
  await assert.rejects(readBundleFile(input), /Bundle exceeds 8 MiB/);
  const result = spawnSync(
    process.execPath,
    ["scripts/recipes/cli.ts", "validate", "--input", path.join(dir, "missing.json")],
    { encoding: "utf8", timeout: 10000 },
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /ENOENT/);
});

test("artifact checks detect drift without overwriting an existing export", async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), "cookly-recipe-check-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const output = path.join(dir, "export.json");
  const args = [
    "scripts/recipes/cli.ts",
    "export",
    "--input",
    "data/recipes/verified.v1.json",
    "--output",
    output,
  ];
  const run = (...extra: string[]) =>
    spawnSync(process.execPath, [...args, ...extra], { encoding: "utf8", timeout: 10000 });
  const empty = run();
  assert.equal(empty.status, 0);
  assert.ok(
    JSON.parse(empty.stdout).issues.some(
      (issue: { code: string }) => issue.code === "EMPTY_COLLECTION",
    ),
  );
  assert.equal(run("--check").status, 0);
  await writeFile(output, "changed artifact");
  assert.equal(run("--check").status, 1);
  assert.equal(await readFile(output, "utf8"), "changed artifact");
});
