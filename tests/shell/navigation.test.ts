import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { shellNavigation } from "../../src/config/navigation.ts";
import { getBreadcrumbs, isRouteActive } from "../../src/shared/presentation/shell-navigation.ts";
import { RecipeRouteIdSchema } from "../../src/shared/contracts/recipe-route.schema.ts";

describe("shell routing", () => {
  it("contains every requested top-level route exactly once", () => {
    const expected = [
      "/",
      "/recipes",
      "/my-fridge",
      "/meal-planner",
      "/shopping-list",
      "/favorites",
      "/assistant",
      "/profile",
      "/login",
      "/admin",
    ];
    assert.deepEqual(
      shellNavigation.map((item) => item.href),
      expected,
    );
    assert.equal(new Set(shellNavigation.map((item) => item.href)).size, 10);
  });

  it("matches full segments and does not mark home or similar prefixes as active", () => {
    assert.equal(isRouteActive("/recipes/demo", "/recipes"), true);
    assert.equal(isRouteActive("/recipes/?q=x", "/recipes"), true);
    assert.equal(isRouteActive("/recipes-extra", "/recipes"), false);
    assert.equal(isRouteActive("/recipes", "/"), false);
    assert.equal(isRouteActive("/", "/"), true);
    assert.equal(isRouteActive("/administer", "/admin"), false);
  });

  it("builds accessible breadcrumbs for home, details and unknown paths", () => {
    assert.deepEqual(getBreadcrumbs("/"), [{ label: "Acasă" }]);
    assert.deepEqual(getBreadcrumbs("/recipes/demo"), [
      { label: "Acasă", href: "/" },
      { label: "Rețete", href: "/recipes" },
      { label: "Detalii rețetă" },
    ]);
    assert.deepEqual(getBreadcrumbs("/my-fridge"), [
      { label: "Acasă", href: "/" },
      { label: "Frigiderul meu" },
    ]);
    assert.equal(getBreadcrumbs("/unknown").at(-1)?.label, "Pagina nu a fost găsită");
    assert.equal(getBreadcrumbs("/recipes/bad!").at(-1)?.label, "Pagina nu a fost găsită");
  });

  it("validates detail route syntax without claiming a recipe exists", () => {
    assert.equal(RecipeRouteIdSchema.safeParse("demo").success, true);
    assert.equal(
      RecipeRouteIdSchema.safeParse("d9428888-122b-11e1-b85c-61cd3cbb3210").success,
      true,
    );
    for (const id of ["", "bad!", "a/b", "a".repeat(129)])
      assert.equal(RecipeRouteIdSchema.safeParse(id).success, false);
  });
});
