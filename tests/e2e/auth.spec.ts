import { expect, test } from "@playwright/test";

for (const route of [
  "/my-fridge",
  "/meal-planner",
  "/shopping-list",
  "/favorites",
  "/assistant",
  "/profile",
  "/admin",
]) {
  test(`anonymous ${route} redirects to login`, async ({ page }) => {
    await page.goto(route);
    await expect(page).toHaveURL(new RegExp(`/login\\?next=${encodeURIComponent(route)}$`));
    await expect(page.getByRole("heading", { level: 1, name: "Bine ai revenit" })).toBeVisible();
  });
}
test("recipes remain public and registration/recovery forms are accessible", async ({ page }) => {
  await page.goto("/recipes");
  await expect(page).toHaveURL(/\/recipes$/);
  await page.goto("/register");
  await expect(page.getByLabel(/^E-mail/)).toBeVisible();
  await expect(page.getByLabel(/^Confirmă parola/)).toBeVisible();
  await page.goto("/forgot-password");
  await expect(page.getByRole("button", { name: "Trimite linkul de resetare" })).toBeVisible();
});
test("password reset requires an email recovery context and invalid confirmation links recover", async ({
  page,
}) => {
  await page.goto("/auth/reset-password");
  await expect(page).toHaveURL(/\/forgot-password/);
  await page.goto("/auth/confirm?token_hash=invalid&type=email");
  await expect(page.getByRole("heading", { name: "Link indisponibil" })).toBeVisible();
});
test("registration rejects mismatched passwords with an accessible field error", async ({
  page,
}) => {
  await page.goto("/register");
  await page.getByLabel(/^E-mail/).fill("test@example.com");
  await page.getByLabel(/^Parolă/).fill("test-password-one-only");
  await page.getByLabel(/^Confirmă parola/).fill("test-password-two-only");
  await page.getByRole("button", { name: "Creează contul" }).click();
  await expect(page.getByText("Parolele trebuie să coincidă.", { exact: true })).toBeVisible();
  await expect(page.getByLabel(/^Confirmă parola/)).toHaveAttribute("aria-invalid", "true");
});
