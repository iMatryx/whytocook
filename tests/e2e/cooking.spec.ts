import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
async function guest(page: Page) {
  await page.route("**/api/v1/pantry", (route) =>
    route.fulfill({ status: 401, json: { error: { code: "AUTH_REQUIRED" } } }),
  );
}
test("detail portions, Cooking navigation, timers, favorites, shopping and cooked never consume stock", async ({
  page,
}) => {
  await guest(page);
  await page.goto("/recipes/terci-de-ovaz-cu-mere?source=demo");
  await expect(
    page.getByRole("heading", { name: "Terci de ovăz cu mere", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: "Bol cu terci de ovăz, mere și scorțișoară" }),
  ).toBeVisible();
  await page.getByLabel("Porții", { exact: true }).fill("4");
  await page.getByRole("button", { name: "Ajustează porțiile" }).click();
  await expect(page).toHaveURL(/servings=4/);
  await expect(page.getByRole("heading", { name: "Ingrediente pentru 4 porții" })).toBeVisible();
  await page.getByRole("button", { name: "Adaugă la favorite", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Elimină din favorite", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  const before = await page.evaluate(() => localStorage.getItem("cookly-pantry-v1"));
  await page.getByRole("button", { name: "Începe Cooking", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Pasul 1 din", { exact: false })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Pasul anterior" })).toBeDisabled();
  await dialog.getByLabel("Minute pas 1").fill("0");
  await dialog.getByLabel("Secunde pas 1").fill("2");
  await dialog.getByRole("button", { name: "Setează durata" }).click();
  await dialog.getByRole("button", { name: "Pornește cronometrul" }).click();
  await dialog.getByRole("button", { name: "Pasul următor" }).click();
  await expect(dialog.getByRole("heading", { name: "Pasul 2", exact: true })).toBeFocused();
  await expect(dialog.getByText("Timp expirat", { exact: false })).toBeVisible({ timeout: 10000 });
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Începe Cooking", exact: true })).toBeFocused();
  await page.getByRole("button", { name: "Adaugă lipsurile în lista de cumpărături" }).click();
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("cookly-recipe-actions-v1")!).shopping.length,
    ),
  ).toBe(0);
  await dialog.getByRole("button", { name: "Confirmă adăugarea în listă" }).click();
  await expect(dialog).not.toBeVisible();
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("cookly-recipe-actions-v1")!).shopping.length,
    ),
  ).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Am gătit", exact: true }).click();
  await dialog.getByRole("button", { name: "Confirmă: am gătit, fără scăderea stocului" }).click();
  await expect(
    page.getByText("Rețetă marcată ca gătită. Inventarul nu a fost modificat."),
  ).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("cookly-pantry-v1"))).toBe(before);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Elimină din favorite", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Începe Cooking", exact: true }).click();
  await expect(dialog.getByRole("heading", { name: "Pasul 2", exact: true })).toBeVisible();
});
test("recipe stock changes only after manual lot preview and final confirmation", async ({
  page,
}) => {
  await guest(page);
  await page.addInitScript(() => {
    if (localStorage.getItem("cookly-pantry-v1")) return;
    localStorage.setItem(
      "cookly-pantry-v1",
      JSON.stringify({
        version: 1,
        revision: "1",
        operations: [],
        items: [
          {
            id: "00000000-0000-4000-8000-000000000001",
            ingredient: {
              id: "10000000-0000-4000-8000-000000000001",
              slug: "fulgi-de-ovaz",
              name: "Fulgi de ovăz",
              categoryId: null,
              categoryName: null,
              active: true,
              allowedUnits: ["g", "kg"],
            },
            quantity: "100",
            unitCode: "g",
            location: "pantry",
            expiresOn: null,
            revision: "1",
            createdAt: "2026-11-03T00:00:00Z",
            updatedAt: "2026-11-03T00:00:00Z",
          },
        ],
      }),
    );
  });
  const quantity = () =>
    page.evaluate(() => JSON.parse(localStorage.getItem("cookly-pantry-v1")!).items[0].quantity);
  await page.goto("/recipes/terci-de-ovaz-cu-mere?source=demo");
  await page.getByRole("button", { name: "Am gătit", exact: true }).click();
  await page.getByRole("button", { name: "Revizuiește consumul din inventar" }).click();
  await page.getByLabel("Consum Fulgi de ovăz, lot 000001").fill("25");
  await page.getByRole("button", { name: "Verifică înainte de scădere" }).click();
  await expect(page.getByText("Rămâne:", { exact: false })).toBeVisible();
  expect(await quantity()).toBe("100");
  await page.getByRole("button", { name: "Confirmă consumul", exact: true }).click();
  await expect(page.getByText("Inventar actualizat după confirmarea consumului.")).toBeVisible();
  expect(await quantity()).toBe("75");
});
test("detail restrictions, missing photo, invalid URL and server error have recoverable states", async ({
  page,
}) => {
  await guest(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/recipes/terci-de-ovaz-cu-mere?source=demo&allergy=milk");
  await expect(page.getByRole("button", { name: "Începe Cooking", exact: true })).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.goto("/recipes/terci-de-ovaz-cu-mere?source=demo&servings=0");
  await expect(page.getByRole("alert")).toBeVisible();
  await page.goto("/recipes/no-such-recipe?source=demo");
  await expect(page.getByRole("heading", { name: "Rețeta nu a fost găsită" })).toBeVisible();
});
test("Cooking survives pantry revalidation on hide/focus and reacquires only an opted-in wake lock", async ({
  page,
}) => {
  await guest(page);
  await page.addInitScript(() => {
    const stats = { requests: 0, releases: 0 };
    Object.assign(window, { cookingWakeStats: stats });
    Object.defineProperty(navigator, "wakeLock", {
      configurable: true,
      value: {
        request: async () => {
          stats.requests++;
          const sentinel = new EventTarget();
          return Object.assign(sentinel, {
            release: async () => {
              stats.releases++;
              sentinel.dispatchEvent(new Event("release"));
            },
          });
        },
      },
    });
  });
  await page.goto("/recipes/terci-de-ovaz-cu-mere?source=demo");
  await page.getByRole("button", { name: "Începe Cooking", exact: true }).click();
  await page.getByRole("button", { name: "Pasul următor" }).click();
  await page.getByRole("button", { name: "Menține ecranul aprins", exact: true }).click();
  await expect(page.getByText("Ecranul este menținut aprins.", { exact: true })).toBeVisible();
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("focus"));
  });
  await expect(page.getByRole("heading", { name: "Pasul 2", exact: true })).toBeVisible();
  await expect(page.getByText("Ecranul este menținut aprins.", { exact: true })).toBeVisible();
  const stats = await page.evaluate(
    () =>
      (window as Window & { cookingWakeStats: { requests: number; releases: number } })
        .cookingWakeStats,
  );
  expect(stats).toEqual({ requests: 2, releases: 1 });
  await page.keyboard.press("Escape");
});
