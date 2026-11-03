import { readRecipeCatalog } from "./catalog.ts";
import { sqlJson, writeArtifact } from "./io.ts";
export async function referenceSql() {
  const { references } = await readRecipeCatalog();
  return `-- Generated recipe reference data; no inferred substitutions or nutrition values.\nDO $recipe_refs$\nDECLARE catalog jsonb := ${sqlJson(references)}; entry jsonb; food jsonb; locale_code text; label text; v_unit_code text; ingredient_uuid uuid; unit_uuid uuid; alias_owner uuid; preferred boolean;\nBEGIN
  FOR entry IN SELECT value FROM jsonb_array_elements(catalog->'categories') LOOP
    INSERT INTO app_private.ingredient_categories(slug,name) VALUES(entry->>'slug',entry->>'name') ON CONFLICT(slug) DO NOTHING;
  END LOOP;
  FOR entry IN SELECT value FROM jsonb_array_elements(catalog->'equipment') LOOP
    INSERT INTO app_private.equipment_types(code,name) VALUES(entry->>'code',entry->>'name') ON CONFLICT(code) DO NOTHING;
  END LOOP;
  FOR entry IN SELECT value FROM jsonb_array_elements(catalog->'tags') LOOP
    INSERT INTO app_private.tags(slug,name,kind) VALUES(entry->>'slug',entry->>'name',entry->>'kind') ON CONFLICT(slug) DO NOTHING;
  END LOOP;
  FOR food IN SELECT value FROM jsonb_array_elements(catalog->'ingredients') LOOP
    INSERT INTO app_private.ingredients(slug,name,identity_kind,category_id)
      VALUES(food->>'slug',food->>'name',food->>'kind',(SELECT id FROM app_private.ingredient_categories WHERE slug=food->>'category')) ON CONFLICT(slug) DO NOTHING;
    SELECT id INTO ingredient_uuid FROM app_private.ingredients WHERE slug=food->>'slug' AND identity_kind=food->>'kind'
      AND search_key=app_private.ingredient_search_key(food->>'name') AND is_active;
    IF ingredient_uuid IS NULL THEN RAISE EXCEPTION 'Canonical reference conflict'; END IF;
    FOREACH locale_code IN ARRAY ARRAY['ro-RO','ru-RU','en-GB'] LOOP
      FOR label IN SELECT value FROM jsonb_array_elements_text(food->'aliases'->locale_code) LOOP
        SELECT ingredient_id INTO alias_owner FROM app_private.ingredient_aliases WHERE locale=locale_code AND normalized_alias=app_private.normalize_label(label);
        IF alias_owner IS NOT NULL AND alias_owner<>ingredient_uuid THEN RAISE EXCEPTION 'Alias reference conflict'; END IF;
        preferred:=NOT EXISTS(SELECT 1 FROM app_private.ingredient_aliases WHERE ingredient_id=ingredient_uuid AND locale=locale_code AND is_preferred);
        INSERT INTO app_private.ingredient_aliases(ingredient_id,locale,alias,is_preferred) VALUES(ingredient_uuid,locale_code,label,preferred) ON CONFLICT(locale,normalized_alias) DO NOTHING;
      END LOOP;
    END LOOP;
    FOR v_unit_code IN SELECT value FROM jsonb_array_elements_text(food->'units') LOOP
      SELECT id INTO unit_uuid FROM app_private.units u WHERE u.code=v_unit_code;
      IF unit_uuid IS NULL THEN RAISE EXCEPTION 'Missing canonical unit'; END IF;
      INSERT INTO app_private.ingredient_units(ingredient_id,unit_id,is_default) VALUES(ingredient_uuid,unit_uuid,v_unit_code=food->>'defaultUnit' AND NOT EXISTS(SELECT 1 FROM app_private.ingredient_units WHERE ingredient_id=ingredient_uuid AND is_default)) ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;
END;\n$recipe_refs$;\n`;
}
if (process.argv[1]?.endsWith("reference-sql.ts")) {
  const args = process.argv.slice(2);
  const check = args.includes("--check");
  if (args.some((arg) => arg !== "--check")) throw new Error("Usage: reference-sql.ts [--check]");
  await writeArtifact(
    new URL("../../supabase/migrations/20261103000014_recipe_references.sql", import.meta.url)
      .pathname,
    await referenceSql(),
    check,
  );
}
