import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
async function guest(page: Page) {
  await page.route("**/api/v1/pantry", (route) =>
    route.fulfill({ status: 401, json: { error: { code: "AUTH_REQUIRED" } } }),
  );
}
test("recipes filters survive URL, refresh, history and pagination; reset starts page one", async ({
  page,
}) => {
  await guest(page);
  await page.goto("/recipes?source=demo&size=6&sort=name");
  await expect(page.getByText("72 rețete găsite", { exact: false })).toBeVisible();
  await page.getByRole("link", { name: "Pagina următoare", exact: true }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.getByText("Pagina 2 din 12", { exact: false })).toBeVisible();
  await page.getByLabel("Caută după nume sau ingrediente").fill("tomatoes");
  await page.getByLabel("Tip de masă", { exact: true }).selectOption(["lunch"]);
  await page.getByRole("button", { name: "Aplică filtrele", exact: true }).click();
  await expect(page).toHaveURL(/q=tomatoes/);
  expect(new URL(page.url()).searchParams.has("page")).toBe(false);
  await expect(page.getByRole("article").first()).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Caută după nume sau ingrediente")).toHaveValue("tomatoes");
  await expect(page.getByLabel("Tip de masă", { exact: true })).toHaveValues(["lunch"]);
  await page.getByRole("button", { name: "Resetează filtrele", exact: true }).first().click();
  await expect(page).toHaveURL(/\/recipes\?source=demo$/);
  await page.goBack();
  await expect(page.getByLabel("Caută după nume sau ingrediente")).toHaveValue("tomatoes");
});
test("local inventory drives compatibility and recipe dialog restores focus", async ({ page }) => {
  await guest(page);
  await page.addInitScript(() => {
    const quantities = [
      ["fulgi-de-ovaz", "100", "g"],
      ["lapte-de-vaca", "400", "ml"],
      ["mar", "200", "g"],
      ["scortisoara-macinata", "1", "g"],
    ];
    const items = quantities.map(([slug, quantity, unit], index) => ({
      id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      ingredient: {
        id: `10000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
        slug,
        name: slug,
        categoryId: null,
        categoryName: null,
        active: true,
        allowedUnits: [unit],
      },
      quantity,
      unitCode: unit,
      location: "pantry",
      expiresOn: null,
      revision: "1",
      createdAt: "2026-11-03T00:00:00Z",
      updatedAt: "2026-11-03T00:00:00Z",
    }));
    localStorage.setItem(
      "cookly-pantry-v1",
      JSON.stringify({ version: 1, revision: "1", items, operations: [] }),
    );
  });
  await page.goto("/recipes?source=demo&compatibility=ready_to_cook");
  await expect(
    page.getByRole("heading", { name: "Terci de ovăz cu mere", exact: true }),
  ).toBeVisible();
  const button = page.getByRole("button", {
    name: "Vezi rețeta Terci de ovăz cu mere",
    exact: true,
  });
  await button.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pași de preparare", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(button).toBeFocused();
  const stored = await page.evaluate(
    () => JSON.parse(localStorage.getItem("cookly-pantry-v1")!).items[0].quantity,
  );
  expect(stored).toBe("100");
});
test("unknown numeric facts produce empty results; invalid URLs and service errors are recoverable", async ({
  page,
}) => {
  await guest(page);
  await page.goto("/recipes?source=demo&protein=10");
  await expect(
    page.getByRole("heading", { name: "Nicio rețetă pentru aceste filtre" }),
  ).toBeVisible();
  await page.goto("/recipes?source=demo&minutes=abc");
  await expect(
    page.getByRole("heading", { name: "Filtrele din adresă nu sunt valide" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Resetează filtrele", exact: true }).click();
  await expect(page.getByText("72 rețete găsite", { exact: false })).toBeVisible();
  let fail = true;
  await page.route("**/api/v1/recipes/search", (route) =>
    fail
      ? route.fulfill({
          status: 503,
          json: { error: { message: "Serviciu indisponibil pentru test." } },
        })
      : route.continue(),
  );
  await page.reload();
  await expect(page.getByRole("heading", { name: "Rețetele nu pot fi încărcate" })).toBeVisible();
  fail = false;
  await page.getByRole("button", { name: "Reîncearcă", exact: true }).click();
  await expect(page.getByText("72 rețete găsite", { exact: false })).toBeVisible();
});
test("mobile results and controls fit the viewport and allergy filters exclude unreviewed examples", async ({
  page,
}) => {
  await guest(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/recipes?source=demo&allergy=milk");
  await expect(page.getByText("72 rețete excluse", { exact: false })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
test("inventory error announcements are not held in an indefinitely busy results region", async ({
  page,
}) => {
  await page.route("**/api/v1/pantry", (route) =>
    route.fulfill({ status: 503, json: { error: { code: "UNAVAILABLE" } } }),
  );
  await page.goto("/recipes?source=demo");
  await expect(
    page.getByRole("heading", { name: "Inventarul nu poate fi încărcat" }),
  ).toBeVisible();
  await expect(page.getByRole("region", { name: "Rezultate rețete" })).toHaveAttribute(
    "aria-busy",
    "false",
  );
});
