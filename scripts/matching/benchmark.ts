import { performance } from "node:perf_hooks";
import { parseArgs } from "node:util";
import { createMatchingEngine } from "../../src/features/matching/application/matching.service.ts";
import { loadMatchingExample } from "./example.ts";

const { values } = parseArgs({ options: { iterations: { type: "string", default: "50" } } });
const iterations = Number(values.iterations);
if (!Number.isInteger(iterations) || iterations < 1 || iterations > 1000)
  throw new Error("Use 1–1000 iterations");
const { configuration, request } = await loadMatchingExample();
const samples = [];
for (const recipeCount of [72, 1000]) {
  // Scale workload with explicit copies of real recipes, never production seeds.
  const recipes = Array.from({ length: recipeCount }, (_, index) => ({
    ...configuration.recipes[index % configuration.recipes.length]!,
    key: `benchmark-recipe-${index}`,
  }));
  const inventory = Array.from({ length: 500 }, (_, index) => ({
    ...request.inventory[index % request.inventory.length]!,
    id: `benchmark-lot-${index}`,
  }));
  const startCompile = performance.now();
  const engine = createMatchingEngine({ ...configuration, recipes });
  const compileMs = performance.now() - startCompile;
  const input = { ...request, inventory };
  const warmup = engine.match(input);
  if (warmup.status === "error" || warmup.summary.evaluated !== recipeCount)
    throw new Error("Invalid benchmark workload");
  const timings: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    const result = engine.match(input);
    timings.push(performance.now() - start);
    if (result.summary.evaluated !== recipeCount) throw new Error("Incomplete evaluation");
  }
  timings.sort((a, b) => a - b);
  samples.push({
    recipes: recipeCount,
    inventoryLots: inventory.length,
    iterations,
    compileMs,
    medianMs: timings[Math.floor(timings.length / 2)],
    p95Ms: timings[Math.ceil(timings.length * 0.95) - 1],
  });
}
process.stdout.write(
  JSON.stringify(
    {
      node: process.version,
      note: "Local measurements; includes request validation, diagnostics, scoring and sorting; excludes IO and output JSON serialization. No timing assertion in tests.",
      samples,
    },
    null,
    2,
  ) + "\n",
);
