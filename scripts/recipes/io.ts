import { createHash } from "node:crypto";
import { open, readFile } from "node:fs/promises";
import type { RecipeBundle } from "../../src/features/recipes/contracts/recipe-bundle.schema.ts";
export const maxBundleBytes = 8 * 1024 * 1024;
export async function readBundleFile(path: string): Promise<unknown> {
  const handle = await open(path, "r");
  try {
    const buffer = Buffer.alloc(maxBundleBytes + 1);
    let size = 0;
    for (;;) {
      const part = await handle.read(buffer, size, buffer.length - size, null);
      size += part.bytesRead;
      if (size > maxBundleBytes) throw new Error("Bundle exceeds 8 MiB");
      if (part.bytesRead === 0) break;
    }
    try {
      return JSON.parse(buffer.subarray(0, size).toString("utf8")) as unknown;
    } catch {
      throw new Error("Invalid JSON bundle");
    }
  } finally {
    await handle.close();
  }
}
export function normalizedBundle(bundle: RecipeBundle) {
  return {
    ...bundle,
    recipes: [...bundle.recipes].sort((a, b) => a.key.localeCompare(b.key, "en")),
  };
}
export function sqlJson(value: unknown): string {
  const json = JSON.stringify(value);
  const tag = `$cookly_${createHash("sha256").update(json).digest("hex").slice(0, 24)}$`;
  if (json.includes(tag)) throw new Error("SQL delimiter collision");
  return `${tag}${json}${tag}::jsonb`;
}
export function recipeSql(bundle: RecipeBundle, migration = false): string {
  return `-- Generated from validated Cookly JSON. Do not edit; change JSON and generate again.\n${migration ? "" : "BEGIN;\n"}SELECT app_private.import_recipe_bundle(${sqlJson(normalizedBundle(bundle))});\n${migration ? "" : "COMMIT;\n"}`;
}
export async function writeArtifact(path: string, content: string, check: boolean) {
  if (check) {
    if ((await readFile(path, "utf8")) !== content)
      throw new Error("Generated artifact differs from the committed file");
    return;
  }
  const handle = await open(path, "wx");
  try {
    await handle.writeFile(content, "utf8");
  } finally {
    await handle.close();
  }
}
