import { parseArgs } from "node:util";
import { createMatchingEngine } from "../../src/features/matching/application/matching.service.ts";
import { loadMatchingExample } from "./example.ts";

async function main() {
  const { values } = parseArgs({
    options: { allergy: { type: "string", multiple: true }, servings: { type: "string" } },
  });
  process.stderr.write("Se încarcă datele și se calculează potrivirile…\n");
  const { configuration, request } = await loadMatchingExample();
  const result = createMatchingEngine(configuration).match({
    ...request,
    ...(values.allergy ? { allergies: values.allergy } : {}),
    ...(values.servings ? { servings: Number(values.servings) } : {}),
  });
  process.stdout.write(
    JSON.stringify({ exampleOnly: true, today: request.today, ...result }, null, 2) + "\n",
  );
  if (result.status === "error") process.exitCode = 1;
  process.stderr.write(
    result.status === "empty"
      ? "Nicio rețetă eligibilă pentru aceste restricții.\n"
      : "Rezultatul nu modifică inventarul și folosește rețete demonstrative.\n",
  );
}
main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : "Matching example failed"}\n`);
  process.exitCode = 1;
});
