import { detailQuerySchema } from "./detail.schema.ts";
export function parseDetailQuery(params: URLSearchParams) {
  const values: Record<string, unknown> = {};
  for (const key of new Set(params.keys())) {
    const all = params.getAll(key);
    if (key !== "allergy" && key !== "exclude" && all.length !== 1)
      return { success: false as const, message: "Parametru repetat în adresa rețetei." };
    values[key] =
      key === "allergy" || key === "exclude"
        ? all
        : key === "servings" && /^\d+$/.test(all[0]!)
          ? Number(all[0])
          : all[0];
  }
  const parsed = detailQuerySchema.safeParse(values);
  return parsed.success
    ? { success: true as const, data: parsed.data }
    : { success: false as const, message: "Verifică sursa, porțiile și restricțiile din adresă." };
}
export function recipeDetailHref(
  slug: string,
  query: {
    source: "demo" | "published";
    servings: number | null;
    allergy: readonly string[];
    exclude: readonly string[];
  },
) {
  const params = new URLSearchParams();
  if (query.source === "demo") params.set("source", "demo");
  if (query.servings !== null) params.set("servings", String(query.servings));
  for (const allergy of [...query.allergy].sort()) params.append("allergy", allergy);
  for (const excluded of [...query.exclude].sort()) params.append("exclude", excluded);
  const encoded = params.toString();
  return `/recipes/${encodeURIComponent(slug)}${encoded ? `?${encoded}` : ""}`;
}
