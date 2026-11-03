import { parseArgs } from "node:util";
import { validateRecipeBundle } from "../../src/features/recipes/application/validate-bundle.ts";
import { readRecipeCatalog } from "./catalog.ts";
import { readBundleFile, recipeSql, normalizedBundle, writeArtifact } from "./io.ts";

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      input: { type: "string" },
      output: { type: "string" },
      report: { type: "string" },
      strict: { type: "boolean" },
      migration: { type: "boolean" },
      check: { type: "boolean" },
    },
  });
  const action = positionals[0];
  if (
    positionals.length !== 1 ||
    !["validate", "export", "import"].includes(action ?? "") ||
    !values.input ||
    ((action === "export" || action === "import") && !values.output)
  )
    throw new Error(
      "Usage: recipes <validate|export|import> --input file.json [--output file] [--report file.json] [--strict] [--migration] [--check]",
    );
  if (
    values.input === values.output ||
    values.input === values.report ||
    (values.output && values.output === values.report)
  )
    throw new Error("Input, output and report must use distinct paths");
  process.stderr.write("Validare și rezolvare referințe…\n");
  const { catalog } = await readRecipeCatalog();
  const result = validateRecipeBundle(await readBundleFile(values.input), catalog);
  const report = {
    schemaVersion: 1,
    valid: result.valid,
    summary: result.summary,
    issues: result.issues,
  };
  if (values.report)
    await writeArtifact(
      values.report,
      JSON.stringify(report, null, 2) + "\n",
      Boolean(values.check),
    );
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  if (!result.valid || (values.strict && result.summary.warnings)) {
    process.exitCode = 1;
    return;
  }
  if (result.bundle && values.output) {
    const artifact =
      action === "import"
        ? recipeSql(result.bundle, Boolean(values.migration))
        : JSON.stringify(normalizedBundle(result.bundle), null, 2) + "\n";
    await writeArtifact(values.output, artifact, Boolean(values.check));
  }
  process.stderr.write(
    result.summary.total
      ? `Valid: ${result.summary.total} rețete; ${result.summary.warnings} avertizări. Nicio bază de date nu a fost modificată.\n`
      : "Colecție goală, fără rețete de importat.\n",
  );
}
main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : "Recipe tool failed"}\n`);
  process.exitCode = 1;
});
