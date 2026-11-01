import path from "node:path";
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { checkImportBoundary } from "../../tooling/eslint/import-boundaries.mjs";

const root = process.cwd();
const check = (file, imported) => checkImportBoundary(path.join(root, file), imported, root);

describe("import boundaries", () => {
  it("blocks client imports of server code through aliases and relative paths", () => {
    assert.ok(check("src/components/theme/theme-control.tsx", "@/config/env/server"));
    assert.ok(check("src/components/theme/theme-control.tsx", "../../server/composition/create-services"));
  });

  it("blocks SDKs and frameworks inside feature domains", () => {
    assert.ok(check("src/features/pantry/domain/lot.ts", "@supabase/supabase-js"));
    assert.ok(check("src/features/pantry/domain/lot.ts", "zod"));
    assert.equal(check("src/features/pantry/domain/lot.ts", "@/shared/domain/quantity"), null);
  });

  it("blocks deep imports between features, including relative paths", () => {
    assert.ok(check("src/features/pantry/application/create-lot.service.ts", "@/features/ingredients/infrastructure/repository"));
    assert.ok(check("src/features/pantry/application/create-lot.service.ts", "../../ingredients/server"));
    assert.equal(check("src/features/pantry/application/create-lot.service.ts", "@/features/ingredients/contracts"), null);
  });

  it("checks the public contracts dependency direction", () => {
    assert.ok(check("src/features/ingredients/contracts/ingredient.schema.ts", "@/features/recipes/contracts"));
    assert.equal(check("src/features/recipes/contracts/recipe.schema.ts", "@/features/ingredients/contracts"), null);
  });

  it("keeps route adapters away from repositories", () => {
    assert.ok(check("src/app/page.tsx", "@/features/pantry/infrastructure/repository"));
    assert.equal(check("src/app/page.tsx", "@/server/composition/create-services"), null);
  });

  it("normalizes alias traversal and keeps shared client helpers browser-safe", () => {
    assert.ok(check("src/components/theme/theme-control.tsx", "@/shared/../server/secret"));
    assert.ok(check("src/shared/presentation/api-client.ts", "@/config/env/maintenance"));
  });

  it("protects shared, workflow and infrastructure boundaries", () => {
    assert.ok(check("src/shared/contracts/index.ts", "@/config/env/maintenance"));
    assert.ok(check("src/shared/domain/quantity.ts", "@/features/pantry/infrastructure/repository"));
    assert.ok(check("src/features/pantry/infrastructure/repository.ts", "@/server/composition/create-services"));
    assert.ok(check("src/workflows/application/confirm.service.ts", "@supabase/supabase-js"));
    assert.equal(check("src/shared/contracts/index.ts", "zod"), null);
    assert.equal(check("src/features/pantry/infrastructure/repository.ts", "@/server/supabase/create-user-client"), null);
  });

  it("prevents infrastructure UI dependencies and private workflow contract imports", () => {
    assert.ok(check("src/features/pantry/infrastructure/repository.ts", "../presentation/client"));
    assert.ok(check("src/workflows/application/confirm.service.ts", "@/features/pantry/contracts/internal"));
    assert.equal(check("src/workflows/application/confirm.service.ts", "@/features/pantry/contracts"), null);
  });
});
