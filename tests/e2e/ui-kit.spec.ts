import { expect, test } from "@playwright/test";

test("combobox filters diacritics, selects by keyboard and restores focus after chip removal", async ({ page }) => {
  await page.goto("/ui-kit");
  const input = page.getByRole("combobox", { name: "Ingredient demonstrativ" });
  await input.fill("rosii");
  await input.click();
  await expect(input).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("option", { name: "Roșii" })).toBeVisible();
  await input.press("ArrowDown");
  await input.press("Enter");
  await expect(input).toHaveValue("Roșii");
  await input.click();
  await expect(input).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("option", { name: "Roșii" })).toBeVisible();
  await input.fill("necunoscut");
  await expect(page.getByRole("status").filter({ hasText: "Nu am găsit opțiuni" })).toBeVisible();
  await input.press("Escape");
  await expect(input).toHaveValue("Roșii");
  await page.getByRole("button", { name: "Elimină Roșii" }).click();
  await expect(input).toBeFocused();
  await expect(input).toHaveValue("");
});

test("modal traps focus and Escape restores the opener", async ({ page }) => {
  await page.goto("/ui-kit");
  const trigger = page.getByRole("button", { name: "Deschide un modal" });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Un moment pentru confirmare" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Eticheta exemplului")).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(dialog.getByRole("button", { name: "Închide", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("drawer and its nested suggestions close one layer at a time", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/ui-kit");
  const trigger = page.getByRole("button", { name: "Deschide un drawer" });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Detalii în lateral" });
  const combo = dialog.getByRole("combobox", { name: "Opțiune în drawer" });
  await combo.fill("oua");
  await expect(page.getByRole("option", { name: "Ouă" })).toBeVisible();
  await combo.press("Escape");
  await expect(dialog).toBeVisible();
  await expect(combo).toBeFocused();
  await expect(combo).toHaveAttribute("aria-expanded", "false");
  await combo.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("cards expose favorite state, preview recovery and unknown cost", async ({ page }) => {
  await page.goto("/ui-kit");
  const favorite = page.getByRole("button", { name: "Favorită: Salată cu năut și verdețuri" });
  await expect(favorite).toHaveAttribute("aria-pressed", "false");
  await favorite.click();
  await expect(favorite).toHaveAttribute("aria-pressed", "true");
  const title = page.getByRole("button", { name: "Salată cu năut și verdețuri", exact: true });
  await title.click();
  await expect(page.getByRole("dialog", { name: "Salată cu năut și verdețuri" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(title).toBeFocused();
  await expect(page.getByText("Cost indisponibil", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Notificare succes" }).click();
  await expect(page.getByText("Notificare demonstrativă", { exact: true })).toBeVisible();
});

test("gallery supports both themes, mobile navigation and no horizontal overflow", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error" && /hydrat|did not match/i.test(message.text())) errors.push(message.text()); });
  await page.goto("/ui-kit");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  for (const width of [360, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  await page.getByLabel("Tema interfeței").selectOption("dark");
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.getByLabel("Tema interfeței").selectOption("light");
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await page.setViewportSize({ width: 360, height: 800 });
  await page.getByRole("button", { name: "Deschide navigarea" }).click();
  const menu = page.getByRole("dialog", { name: "Navigare", exact: true });
  await menu.getByRole("link", { name: "Componente", exact: true }).click();
  await expect(menu).toBeHidden();
  await expect(page.locator("#components")).toBeFocused();
  expect(errors).toEqual([]);
});
