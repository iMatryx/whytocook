import { test, expect } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  await page.route("**/api/v1/pantry", (r) =>
    r.fulfill({ status: 401, json: { error: { code: "AUTH_REQUIRED" } } }),
  );
});
test("multi-recipe guest shopping aggregates once, estimates entered prices, shares preview and transfers only after confirmation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/shopping-list?source=demo");
  await page
    .getByLabel("Alege una sau mai multe rețete", { exact: true })
    .selectOption(["terci-de-ovaz-cu-mere", "terci-de-ovaz-cu-banana"]);
  await page.getByRole("button", { name: "Calculează lipsurile", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Verifică necesarul înainte de adăugare" }),
  ).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("cookly-shopping-v1"))).toBeNull();
  await page.getByRole("button", { name: "Confirmă adăugarea necesarului", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Editează Fulgi de ovăz", exact: true }),
  ).toBeVisible();
  const items = await page.evaluate(
    () => JSON.parse(localStorage.getItem("cookly-shopping-v1")!).items,
  );
  expect(
    items.filter((i: { ingredient: { slug: string } }) => i.ingredient?.slug === "fulgi-de-ovaz"),
  ).toHaveLength(1);
  await page.getByRole("button", { name: "Editează Fulgi de ovăz", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Preț pentru cantitatea de referință", { exact: true }).fill("20");
  await dialog.getByRole("button", { name: "Salvează rândul", exact: true }).click();
  await expect(page.getByText("Prețurile pot varia.", { exact: false })).toBeVisible();
  const label = page
    .locator("li")
    .filter({ has: page.getByRole("button", { name: "Editează Fulgi de ovăz", exact: true }) });
  await label.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Partajează lista", exact: true }).click();
  await expect(dialog.getByLabel("Text de partajat")).toHaveValue(/Lista de cumpărături Cookly/);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Transferă cumpărăturile bifate", exact: true }).click();
  expect(await page.evaluate(() => localStorage.getItem("cookly-pantry-v1"))).toBeNull();
  await dialog
    .getByRole("button", { name: "Confirmă cumpărăturile și transferul", exact: true })
    .click();
  await expect(
    page.getByText("Cumpărăturile confirmate au fost transferate în loturi noi."),
  ).toBeVisible();
  const stock = await page.evaluate(
    () => JSON.parse(localStorage.getItem("cookly-pantry-v1")!).items,
  );
  expect(stock).toHaveLength(1);
  expect(stock[0].ingredient.slug).toBe("fulgi-de-ovaz");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.reload();
  await expect(page.getByText("Transferat în frigider", { exact: false })).toBeVisible();
});
test("manual rows support unknown amounts, editing, deletion, persistence and corrupt storage recovery", async ({
  page,
}) => {
  await page.goto("/shopping-list?source=demo");
  await page.getByRole("button", { name: "Adaugă manual", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Denumire", { exact: true }).fill("Șervețele");
  await dialog.getByRole("button", { name: "Salvează rândul", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Transferă cumpărăturile bifate", exact: true }),
  ).toBeDisabled();
  await page.reload();
  await page.getByRole("button", { name: "Elimină Șervețele", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Lista este goală", exact: true })).toBeVisible();
  await page.evaluate(() => localStorage.setItem("cookly-shopping-v1", "broken"));
  await page.reload();
  await expect(page.getByRole("alert")).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("cookly-shopping-v1"))).toBe("broken");
});
test("changing accounts before purchase prevents a write and discards old confirmations", async ({
  page,
}) => {
  const a = "00000000-0000-4000-8000-000000000001";
  const b = "00000000-0000-4000-8000-000000000002";
  const id = "00000000-0000-4000-8000-000000000003";
  const ingredient = {
    id,
    slug: "rosii",
    name: "Roșii",
    categoryId: null,
    categoryName: "Legume",
    active: true,
    allowedUnits: ["g", "kg"],
  };
  let accountId = a;
  const writes: unknown[] = [];
  await page.route("**/api/v1/shopping**", async (route) => {
    if (route.request().method() === "POST") writes.push(route.request().postDataJSON());
    await route.fulfill({
      json: {
        accountId,
        source: "demo",
        recipes: [],
        catalog: [ingredient],
        items: [
          {
            id,
            revision: "1",
            ingredient,
            label: accountId === a ? "Roșii cont A" : "Roșii cont B",
            category: "Legume",
            quantity: "100",
            unitCode: "g",
            checked: true,
            price: null,
            transferred: false,
            uncertain: false,
          },
        ],
      },
    });
  });
  await page.goto("/shopping-list?source=demo");
  await page.getByRole("button", { name: "Transferă cumpărăturile bifate", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  accountId = b;
  await page
    .getByRole("button", { name: "Confirmă cumpărăturile și transferul", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("Contul s-a schimbat");
  expect(writes).toHaveLength(0);
  expect(await page.evaluate(() => localStorage.getItem("cookly-pantry-v1"))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem("cookly-shopping-v1"))).toBeNull();
  await page.getByRole("button", { name: "Reîncearcă", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Editează Roșii cont B", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Transferă cumpărăturile bifate", exact: true }).click();
  accountId = a;
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(
    page.getByRole("button", { name: "Editează Roșii cont A", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  expect(writes).toHaveLength(0);
});
