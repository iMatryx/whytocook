import { expect, test } from "@playwright/test";

const id = "10000000-0000-4000-8000-000000000002";
const tomato = {
  id,
  slug: "rosii",
  name: "Roșii",
  canonicalName: "Roșii",
  matchedTerm: "tomatoes",
  kind: "specific",
  category: null,
  broader: null,
};
const rice = {
  ...tomato,
  id: "10000000-0000-4000-8000-000000000003",
  slug: "orez",
  name: "Orez",
  canonicalName: "Orez",
  matchedTerm: "rice",
  kind: "generic",
};
const pageData = (items: unknown[]) => ({ items, catalogVersion: "1", nextCursor: null });
const detail = {
  ...tomato,
  aliases: [{ locale: "en-GB", label: "tomatoes", preferred: true }],
  units: [],
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

test("cross-language autocomplete keeps remote results and selects by keyboard", async ({
  page,
}) => {
  await page.route("**/api/v1/ingredients/categories", (route) => route.fulfill({ json: [] }));
  await page.route(`**/api/v1/ingredients/${id}?*`, (route) => route.fulfill({ json: detail }));
  await page.route(/\/api\/v1\/ingredients\?/, (route) =>
    route.fulfill({ json: pageData([tomato]) }),
  );
  await page.goto("/ingredients");
  await expect(page).toHaveURL(/\/ingredients$/);
  const input = page.getByRole("combobox", { name: "Caută un ingredient" });
  await input.fill("tomatoes");
  await expect(page.getByRole("option", { name: "Roșii" })).toBeVisible();
  await input.press("ArrowDown");
  await input.press("Enter");
  await expect(page.locator('input[name="ingredientId"]')).toHaveValue(id);
  await expect(page.getByRole("heading", { name: "Nutriție indisponibilă" })).toBeVisible();
  await expect(page.getByText("Valorile lipsă nu înseamnă zero.", { exact: false })).toBeVisible();
});
test("late responses cannot replace the newest ingredient query", async ({ page }) => {
  await page.route("**/api/v1/ingredients/categories", (route) => route.fulfill({ json: [] }));
  await page.route(/\/api\/v1\/ingredients\?/, async (route) => {
    const query = new URL(route.request().url()).searchParams.get("query");
    if (query === "ros") {
      await new Promise((resolve) => setTimeout(resolve, 700));
      await route.fulfill({ json: pageData([tomato]) }).catch(() => {});
    } else await route.fulfill({ json: pageData(query === "orez" ? [rice] : []) });
  });
  await page.goto("/ingredients");
  const input = page.getByRole("combobox", { name: "Caută un ingredient" });
  const requested = page.waitForRequest(
    (request) => new URL(request.url()).searchParams.get("query") === "ros",
  );
  await input.fill("ros");
  await requested;
  await input.fill("orez");
  await expect(page.getByRole("option", { name: "Orez (general)" })).toBeVisible();
  await page.waitForTimeout(800);
  await expect(page.getByRole("option", { name: "Roșii" })).toHaveCount(0);
});
test("catalog errors can be retried into an explicit empty state", async ({ page }) => {
  await page.route("**/api/v1/ingredients/categories", (route) => route.fulfill({ json: [] }));
  let fail = true;
  await page.route(/\/api\/v1\/ingredients\?/, (route) =>
    fail
      ? route.fulfill({ status: 503, json: { error: { code: "UNAVAILABLE" } } })
      : route.fulfill({ json: pageData([]) }),
  );
  await page.goto("/ingredients");
  await expect(page.getByRole("heading", { name: "Căutare indisponibilă" })).toBeVisible();
  fail = false;
  await page.getByRole("button", { name: "Reîncepe căutarea" }).click();
  await expect(page.getByRole("heading", { name: "Nu am găsit ingrediente" })).toBeVisible();
});
