import { expect, test } from "@playwright/test";

test("foundation starts and the light/dark theme persists without hydration errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && /hydrat|did not match|server.rendered/i.test(message.text())) {
      errors.push(message.text());
    }
  });
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await expect(page).toHaveTitle(/Cookly/);
  await expect(page.locator("html")).toHaveAttribute("lang", "ro");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Cookly începe aici.");
  const theme = page.getByLabel("Tema interfeței");
  await expect(theme).toBeEnabled();
  await theme.selectOption("dark");
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.reload();
  await expect(theme).toHaveValue("dark");
  await expect(page.locator("html")).toHaveClass(/dark/);
  await theme.selectOption("light");
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await theme.selectOption("system");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveClass(/dark/);
  expect(errors).toEqual([]);
});

test("keyboard navigation reaches the main content and missing routes recover", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Sari la conținut" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("main")).toBeFocused();
  const response = await page.goto("/missing-foundation-page");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Pagina nu a fost găsită" })).toBeVisible();
  await page.getByRole("link", { name: "Înapoi la început" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Cookly începe aici.");
});
