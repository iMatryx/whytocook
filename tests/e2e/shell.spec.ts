import { expect, test } from "@playwright/test";

const routes = [
  ["/", "Cookly începe aici."],
  ["/recipes", "Rețete"],
  ["/recipes/demo", "Detalii rețetă"],
  ["/login", "Bine ai revenit"],
] as const;

for (const [path, heading] of routes) {
  test(`shell route ${path} renders a coherent server page`, async ({ page }) => {
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1, name: heading, exact: true })).toBeVisible();
    await expect(page.getByRole("main")).toHaveCount(1);
    await expect(page.getByRole("banner")).toHaveCount(1);
    await expect(page.getByRole("contentinfo")).toHaveCount(1);
    const breadcrumb = page.getByRole("navigation", { name: "Traseu de navigare", exact: true });
    await expect(breadcrumb).toBeVisible();
    await expect(breadcrumb.locator('[aria-current="page"]')).toHaveCount(1);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });
}

test("desktop navigation tracks details, breadcrumbs and browser history", async ({ page }) => {
  await page.goto("/recipes");
  const nav = page.getByRole("navigation", { name: "Navigare principală", exact: true });
  const recipes = nav.getByRole("link", { name: "Rețete", exact: true });
  const home = nav.getByRole("link", { name: "Acasă", exact: true });
  await expect(recipes).toHaveAttribute("aria-current", "page");
  await expect(home).not.toHaveAttribute("aria-current");
  await page.getByRole("link", { name: "Vezi structura unei rețete" }).click();
  await expect(page).toHaveURL(/\/recipes\/demo$/);
  await expect(recipes).toHaveAttribute("aria-current", "location");
  const breadcrumbs = page.getByRole("navigation", { name: "Traseu de navigare", exact: true });
  await expect(breadcrumbs.getByRole("link", { name: "Rețete", exact: true })).toHaveAttribute(
    "href",
    "/recipes",
  );
  await page.goBack();
  await expect(recipes).toHaveAttribute("aria-current", "page");
  await page.goForward();
  await expect(recipes).toHaveAttribute("aria-current", "location");
});

test("mobile menu includes every route, restores focus and closes on navigation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/recipes");
  const trigger = page.getByRole("button", { name: "Deschide meniul Cookly" });
  await trigger.click();
  const menu = page.getByRole("dialog", { name: "Navigare Cookly", exact: true });
  await expect(menu.getByRole("link")).toHaveCount(10);
  await expect(menu.getByRole("link", { name: "Rețete", exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await trigger.click();
  await menu.getByRole("link", { name: "Acasă" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Cookly începe aici." })).toBeVisible();
  await expect(menu).toBeHidden();
  await expect(page.getByRole("main")).toBeFocused();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
});

test("invalid detail IDs and unknown routes recover without duplicate shell landmarks", async ({
  page,
}) => {
  for (const path of ["/recipes/bad!", "/unknown-shell-route"]) {
    await page.goto(path);
    await expect(
      page.getByRole("heading", { name: "Pagina nu a fost găsită", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("main")).toHaveCount(1);
    await expect(page.getByRole("banner")).toHaveCount(1);
    await page.getByRole("link", { name: "Înapoi la început", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Cookly începe aici.");
  }
});

test("authentication form is available while anonymous admin access redirects", async ({
  page,
}) => {
  await page.goto("/login");
  await expect(page.getByLabel(/^Parolă/)).toBeVisible();
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login\?next=%2Fadmin$/);
});

test("browser history closes an open mobile drawer without losing focus", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/recipes");
  await page.getByRole("button", { name: "Deschide meniul Cookly" }).click();
  await page
    .getByRole("dialog", { name: "Navigare Cookly", exact: true })
    .getByRole("link", { name: "Acasă", exact: true })
    .click();
  await expect(page).toHaveURL(/\/$/);
  await page.getByRole("button", { name: "Deschide meniul Cookly" }).click();
  await page.goBack();
  await expect(page).toHaveURL(/\/recipes$/);
  await expect(page.getByRole("dialog", { name: "Navigare Cookly", exact: true })).toBeHidden();
  await expect(page.getByRole("main")).toBeFocused();
  await page.getByRole("button", { name: "Deschide meniul Cookly" }).click();
  await page.goForward();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("dialog", { name: "Navigare Cookly", exact: true })).toBeHidden();
  await expect(page.getByRole("main")).toBeFocused();
});
