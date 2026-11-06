import { expect, test } from "@playwright/test";
test("guest favorites, collections and history persist on mobile and clear independently", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/v1/pantry", (route) =>
    route.fulfill({ status: 401, json: { error: { code: "AUTH_REQUIRED" } } }),
  );
  await page.goto("/recipes/terci-de-ovaz-cu-mere?source=demo");
  await page.getByRole("button", { name: "Adaugă la favorite", exact: true }).click();
  await page.getByRole("button", { name: "Am gătit", exact: true }).click();
  await page.getByRole("button", { name: "Confirmă: am gătit, fără scăderea stocului" }).click();
  await page.goto("/favorites");
  const favorites = page.getByRole("region", { name: "Rețete favorite", exact: true });
  await expect(favorites.getByRole("link")).toHaveAttribute(
    "href",
    "/recipes/terci-de-ovaz-cu-mere?source=demo",
  );
  await page.getByLabel("Numele colecției", { exact: true }).fill("Fitness");
  await page.getByRole("button", { name: "Creează colecția", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Fitness", exact: true })).toBeVisible();
  await favorites.getByRole("button", { name: "Adaugă în Fitness" }).click();
  await page.reload();
  const collections = page.getByRole("region", { name: "Colecții personalizate", exact: true });
  await expect(collections.getByRole("link")).toHaveCount(1);
  await favorites.getByRole("button", { name: "Elimină din favorite" }).click();
  await expect(favorites.getByRole("heading", { name: "Nu ai rețete favorite" })).toBeVisible();
  await expect(collections.getByRole("link")).toHaveCount(1);
  await page.getByRole("button", { name: "Șterge istoricul", exact: true }).click();
  await page.getByRole("button", { name: "Confirmă ștergerea istoricului", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Nu ai preparări înregistrate" })).toBeVisible();
  await expect(collections.getByRole("link")).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await collections.getByRole("button", { name: "Elimină din Fitness" }).click();
  await expect(collections.getByRole("link")).toHaveCount(0);
});
test("unavailable or corrupt data has retry and is never silently replaced", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("cookly-recipe-actions-v1", "broken"));
  await page.goto("/favorites");
  await expect(page.getByRole("alert")).toContainText("Nu au fost înlocuite");
  expect(await page.evaluate(() => localStorage.getItem("cookly-recipe-actions-v1"))).toBe(
    "broken",
  );
  await page.evaluate(() => localStorage.removeItem("cookly-recipe-actions-v1"));
  await page.getByRole("button", { name: "Reîncearcă", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Nu ai rețete favorite" })).toBeVisible();
  await page.route("**/api/v1/recipes/organization", (route) =>
    route.fulfill({
      status: 503,
      json: { error: { message: "Serviciu indisponibil pentru test." } },
    }),
  );
  await page.reload();
  await expect(page.getByRole("alert")).toContainText("Serviciu indisponibil pentru test.");
});

test("account snapshots use the API and a changed session never writes guest data", async ({
  page,
}) => {
  const accountId = "00000000-0000-4000-8000-000000000001";
  const snapshot = {
    accountId,
    favorites: ["published:cooking-fixture"],
    collections: [],
    cooked: [],
    titles: { "published:cooking-fixture": "Rețetă în cont" },
  };
  let switched = false;
  const commands: unknown[] = [];
  await page.route("**/api/v1/recipes/organization", async (route) => {
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON();
      commands.push(body);
      expect(body.expectedAccountId).toBe(accountId);
      await route.fulfill({
        json: {
          ...snapshot,
          collections: [{ id: body.command.id, name: body.command.name, recipeKeys: [] }],
        },
      });
    } else
      await route.fulfill({
        json: switched
          ? { ...snapshot, accountId: "00000000-0000-4000-8000-000000000002" }
          : snapshot,
      });
  });
  await page.goto("/favorites");
  await expect(page.getByRole("link", { name: "Rețetă în cont", exact: true })).toBeVisible();
  await page.getByLabel("Numele colecției", { exact: true }).fill("Rapid");
  await page.getByRole("button", { name: "Creează colecția", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Rapid", exact: true })).toBeVisible();
  expect(commands).toHaveLength(1);
  switched = true;
  await page.getByRole("button", { name: "Elimină din favorite", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Contul s-a schimbat");
  expect(commands).toHaveLength(1);
  expect(await page.evaluate(() => localStorage.getItem("cookly-recipe-actions-v1"))).toBeNull();
});

test("organization API rejects foreign origin and invalid bodies and does not cache guest responses", async ({
  request,
}) => {
  const response = await request.get("/api/v1/recipes/organization");
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toBe("private, no-store");
  expect((await response.json()).accountId).toBeNull();
  const foreign = await request.post("/api/v1/recipes/organization", {
    headers: { Origin: "https://foreign.example" },
    data: {},
  });
  expect(foreign.status()).toBe(403);
  const invalid = await request.post("/api/v1/recipes/organization", {
    headers: { Origin: "http://127.0.0.1:3100" },
    data: { ownerId: crypto.randomUUID(), command: { kind: "clearHistory" } },
  });
  expect(invalid.status()).toBe(400);
});
test("a history confirmation is discarded when the active account changes", async ({ page }) => {
  let accountId = "00000000-0000-4000-8000-000000000001";
  const commands: unknown[] = [];
  await page.route("**/api/v1/recipes/organization", async (route) => {
    if (route.request().method() === "POST") commands.push(route.request().postDataJSON());
    await route.fulfill({
      json: {
        accountId,
        favorites: [],
        collections: [],
        cooked: [
          { recipeKey: "published:cooking-fixture", at: "2026-11-04T12:00:00Z", servings: 2 },
        ],
        titles: { "published:cooking-fixture": "Rețetă în cont" },
      },
    });
  });
  await page.goto("/favorites");
  await page.getByRole("button", { name: "Șterge istoricul", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  accountId = "00000000-0000-4000-8000-000000000002";
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.getByRole("button", { name: "Șterge istoricul", exact: true })).toBeVisible();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  expect(commands).toHaveLength(0);
});
test("guest collection rename, duplicate rejection and delete confirmation preserve saved recipes", async ({
  page,
}) => {
  await page.goto("/favorites");
  await page.getByLabel("Numele colecției", { exact: true }).fill("Fitness");
  await page.getByRole("button", { name: "Creează colecția", exact: true }).click();
  await page.getByRole("button", { name: "Redenumește Fitness", exact: true }).click();
  await page.getByLabel("Nume nou", { exact: true }).fill("Rapid");
  await page.getByRole("button", { name: "Salvează numele", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Rapid", exact: true })).toBeVisible();
  await page.getByLabel("Numele colecției", { exact: true }).fill(" rapid ");
  await page.getByRole("button", { name: "Creează colecția", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Există deja o colecție");
  await page.getByRole("button", { name: "Reîncearcă", exact: true }).click();
  await page.getByRole("button", { name: "Șterge colecția Rapid", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Șterge colecția Rapid", exact: true }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Șterge colecția Rapid", exact: true }).click();
  await page.getByRole("button", { name: "Confirmă ștergerea colecției", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Nu ai colecții", exact: true })).toBeVisible();
});
