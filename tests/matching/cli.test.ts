import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
test("demo CLI reports empty allergy results and invalid requests with proper exit codes", () => {
  const run = (...args: string[]) =>
    spawnSync(process.execPath, ["scripts/matching/demo.ts", ...args], {
      encoding: "utf8",
      timeout: 10000,
    });
  const empty = run("--allergy", "milk");
  assert.equal(empty.status, 0);
  const result = JSON.parse(empty.stdout);
  assert.equal(result.status, "empty");
  assert.equal(result.summary.excluded, 72);
  assert.match(empty.stderr, /Nicio rețetă eligibilă/);
  const invalid = run("--servings", "0");
  assert.equal(invalid.status, 1);
  assert.equal(JSON.parse(invalid.stdout).error.code, "INVALID_REQUEST");
});
