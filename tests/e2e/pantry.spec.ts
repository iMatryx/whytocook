import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
const id = "10000000-0000-4000-8000-000000000002";
const ingredient = {
  id,
  slug: "rosii",
  name: "Roșii",
  canonicalName: "Roșii",
  matchedTerm: "tomatoes",
  kind: "specific",
  category: { id: "10000000-0000-4000-8000-000000000003", slug: "legume", name: "Legume" },
  broader: null,
};
const detail = {
  ...ingredient,
  aliases: [],
  units: [
    { id, code: "g", name: "gram", dimension: "mass", isDefault: true },
    {
      id: "10000000-0000-4000-8000-000000000004",
      code: "kg",
      name: "kilogram",
      dimension: "mass",
      isDefault: false,
    },
  ],
  nutrition: {
    status: "unavailable",
    basis: "100g",
    energyKcal: null,
    proteinG: null,
    carbohydrateG: null,
    fatG: null,
    fiberG: null,
    saltG: null,
    source: null,
  },
};
async function catalog(page: Page) {
  await page.route(/\/api\/v1\/ingredients\?/, (route) =>
    route.fulfill({ json: { items: [ingredient], catalogVersion: "1", nextCursor: null } }),
  );
  await page.route(`**/api/v1/ingredients/${id}?*`, (route) => route.fulfill({ json: detail }));
}
async function add(page: Page) {
  await page.getByRole("button", { name: "Adaugă ingredient", exact: true }).click();
  const dialog = page.getByRole("dialog");
  const input = dialog.getByRole("combobox", { name: "Caută un ingredient" });
  await input.fill("tomatoes");
  await expect(page.getByRole("option", { name: "Roșii" })).toBeVisible();
  await input.press("ArrowDown");
  await input.press("Enter");
  await expect(dialog.getByRole("button", { name: "Salvează lotul" })).toBeEnabled();
  await dialog.getByLabel(/^Cantitate/).fill("1000");
  await dialog.getByLabel("Data expirării", { exact: true }).fill("2026-11-04");
  await dialog.getByRole("button", { name: "Salvează lotul" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}
test("guest inventory is public, persists, edits exact units, filters and confirms deletion", async ({
  page,
}) => {
  await catalog(page);
  await page.route("**/api/v1/pantry", (route) =>
    route.fulfill({ status: 401, json: { error: { code: "AUTH_REQUIRED" } } }),
  );
  await page.goto("/my-fridge");
  await expect(page).toHaveURL(/\/my-fridge$/);
  await expect(page.getByRole("heading", { name: "Frigiderul tău începe aici" })).toBeVisible();
  await add(page);
  await expect(page.getByText("1000 g", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("1000 g", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /^Editează Roșii/ }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Unitate", { exact: true }).selectOption("kg");
  await expect(dialog.getByLabel(/^Cantitate/)).toHaveValue("1");
  await dialog.getByRole("button", { name: "Salvează lotul" }).click();
  await expect(page.getByText("1 kg", { exact: true })).toBeVisible();
  await page.getByLabel("Caută în inventar").fill("orez");
  await expect(
    page.getByRole("heading", { name: "Niciun lot pentru aceste filtre" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Resetează filtrele" }).click();
  await page.getByRole("button", { name: /^Elimină Roșii/ }).click();
  await page.getByRole("button", { name: "Anulează", exact: true }).click();
  await expect(page.getByText("1 kg", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /^Elimină Roșii/ }).click();
  await page.getByRole("button", { name: "Confirmă eliminarea" }).click();
  await expect(page.getByRole("heading", { name: "Frigiderul tău începe aici" })).toBeVisible();
});
test("cooking preview and cancellation never deduct; explicit confirmation deducts once", async ({
  page,
}) => {
  await catalog(page);
  await page.route("**/api/v1/pantry", (route) =>
    route.fulfill({ status: 401, json: { error: { code: "AUTH_REQUIRED" } } }),
  );
  await page.goto("/my-fridge");
  await add(page);
  await page.getByRole("button", { name: "Am gătit", exact: true }).click();
  await page.getByLabel(/^Consum Roșii/).fill("250");
  await page.getByRole("button", { name: "Verifică înainte de scădere" }).click();
  await expect(page.getByText("750 g", { exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("cookly-pantry-v1")!).items[0].quantity,
    ),
  ).toBe("1000");
  await page.getByRole("button", { name: "Închide", exact: true }).click();
  await expect(page.getByText("1000 g", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Am gătit", exact: true }).click();
  await page.getByLabel(/^Consum Roșii/).fill("250");
  await page.getByRole("button", { name: "Verifică înainte de scădere" }).click();
  await page.getByRole("button", { name: "Confirmă consumul" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("750 g", { exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("cookly-pantry-v1")!).items[0].revision,
    ),
  ).toBe("2");
});
test("corrupt guest storage is preserved and shown as an error", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("cookly-pantry-v1", "broken data"));
  await page.route("**/api/v1/pantry", (route) =>
    route.fulfill({ status: 401, json: { error: { code: "AUTH_REQUIRED" } } }),
  );
  await page.goto("/my-fridge");
  await expect(
    page.getByRole("heading", { name: "Inventarul nu poate fi încărcat" }),
  ).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("cookly-pantry-v1"))).toBe("broken data");
  await expect(page.getByRole("button", { name: "Adaugă ingredient", exact: true })).toBeDisabled();
});
test("account conflicts preserve the displayed stock and never create a guest copy", async ({
  page,
}) => {
  const row = {
    id,
    ingredient: {
      id,
      name: "Roșii",
      slug: "rosii",
      categoryId: null,
      categoryName: null,
      active: true,
      allowedUnits: ["g", "kg"],
    },
    quantity: "1000",
    unitCode: "g",
    location: "fridge",
    expiresOn: null,
    revision: "3",
    createdAt: "2026-11-01T00:00:00.000Z",
    updatedAt: "2026-11-01T00:00:00.000Z",
  };
  let posts = 0;
  await page.route("**/api/v1/pantry", (route) => {
    if (route.request().method() === "POST") {
      posts++;
      return route.fulfill({ status: 409, json: { error: { code: "CONFLICT" } } });
    }
    return route.fulfill({
      json: { mode: "account", accountId: "00000000-0000-4000-8000-000000000001", items: [row] },
    });
  });
  await page.goto("/my-fridge");
  await expect(page.getByText("Sincronizat cu contul")).toBeVisible();
  await page.getByRole("button", { name: "Am gătit", exact: true }).click();
  await page.getByLabel(/^Consum Roșii/).fill("250");
  await page.getByRole("button", { name: "Verifică înainte de scădere" }).click();
  expect(posts).toBe(0);
  await page.getByRole("button", { name: "Confirmă consumul" }).click();
  await expect(page.getByRole("alert")).toContainText("Inventarul s-a modificat");
  expect(posts).toBe(1);
  expect(await page.evaluate(() => localStorage.getItem("cookly-pantry-v1"))).toBeNull();
  await expect(page.getByText("1000 g", { exact: true })).toBeVisible();
});
test("returning to a tab after an account switch blocks its stale create form", async ({
  page,
}) => {
  await catalog(page);
  let accountId = "00000000-0000-4000-8000-000000000001",
    posts = 0;
  await page.route("**/api/v1/pantry", (route) => {
    if (route.request().method() === "POST") {
      posts++;
      return route.fulfill({ status: 409, json: { error: { code: "SESSION_CHANGED" } } });
    }
    return route.fulfill({ json: { mode: "account", accountId, items: [] } });
  });
  await page.goto("/my-fridge");
  await page.getByRole("button", { name: "Adaugă ingredient", exact: true }).click();
  accountId = "00000000-0000-4000-8000-000000000002";
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText("Contul s-a schimbat");
  await expect(page.getByRole("button", { name: "Salvează lotul", exact: true })).toHaveCount(0);
  expect(posts).toBe(0);
});
test("an old-account mutation response cannot replace a newer account snapshot", async ({
  page,
}) => {
  const a = "00000000-0000-4000-8000-000000000001",
    b = "00000000-0000-4000-8000-000000000002";
  const row = {
    id,
    ingredient: {
      id,
      name: "Roșii",
      slug: "rosii",
      categoryId: null,
      categoryName: null,
      active: true,
      allowedUnits: ["g", "kg"],
    },
    quantity: "1000",
    unitCode: "g",
    location: "fridge",
    expiresOn: null,
    revision: "1",
    createdAt: "2026-11-01T00:00:00.000Z",
    updatedAt: "2026-11-01T00:00:00.000Z",
  };
  let accountId = a;
  let release: () => void = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/v1/pantry", async (route) => {
    if (route.request().method() === "POST") {
      await held;
      return route.fulfill({
        json: {
          mode: "account",
          accountId: a,
          items: [{ ...row, quantity: "750", revision: "2" }],
        },
      });
    }
    return route.fulfill({
      json: { mode: "account", accountId, items: accountId === a ? [row] : [] },
    });
  });
  await page.goto("/my-fridge");
  await page.getByRole("button", { name: "Am gătit", exact: true }).click();
  await page.getByLabel(/^Consum Roșii/).fill("250");
  await page.getByRole("button", { name: "Verifică înainte de scădere" }).click();
  const started = page.waitForRequest(
    (request) => request.url().endsWith("/api/v1/pantry") && request.method() === "POST",
  );
  await page.getByRole("button", { name: "Confirmă consumul" }).click();
  await started;
  accountId = b;
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText("Contul s-a schimbat");
  release();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Frigiderul tău începe aici" })).toBeVisible();
  await expect(page.getByText("750 g", { exact: true })).toHaveCount(0);
});
