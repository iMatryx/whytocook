import { expect, test } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-11-05T12:00:00Z"));
  await page.route("**/api/v1/pantry", (r) =>
    r.fulfill({ status: 401, json: { error: { code: "AUTH_REQUIRED" } } }),
  );
});
test("guest plans portions, moves meals, sets budget, copies dates and exports once with no consumption", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/meal-planner?source=demo&startsOn=2026-11-02");
  await expect(page.getByRole("heading", { name: "Mesele următoarelor 7 zile" })).toBeVisible();
  await page.getByRole("button", { name: "Adaugă Mic dejun 2026-11-05", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Rețetă", { exact: true }).selectOption("terci-de-ovaz-cu-mere");
  await dialog.getByLabel("Porții planificate", { exact: true }).fill("4");
  await dialog.getByLabel("Cost per porție", { exact: true }).fill("12.50");
  await dialog.getByLabel("Data observării costului", { exact: true }).fill("2026-11-05");
  await dialog.getByRole("button", { name: "Salvează masa", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole("button", { name: "Buget maxim", exact: true }).click();
  await dialog.getByLabel("Buget maxim", { exact: true }).fill("30");
  await dialog.getByRole("button", { name: "Salvează bugetul", exact: true }).click();
  await expect(
    page.getByText("Costul cunoscut depășește bugetul maxim.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: /^Editează / }).click();
  await dialog.getByLabel("Data mesei", { exact: true }).fill("2026-11-06");
  await dialog.getByLabel("Tipul mesei", { exact: true }).selectOption("dinner");
  await dialog.getByLabel("Pregătește în avans la (opțional)", { exact: true }).fill("2026-11-05");
  await dialog.getByRole("button", { name: "Salvează masa", exact: true }).click();
  await expect(
    page
      .getByRole("region", { name: "Mese 2026-11-06", exact: true })
      .getByRole("link", { name: "Terci de ovăz cu mere", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: /^Editează / })).toHaveCount(1);
  await page.getByRole("button", { name: "Generează lista consolidată", exact: true }).click();
  expect(await page.evaluate(() => localStorage.getItem("cookly-shopping-v1"))).toBeNull();
  await dialog.getByRole("button", { name: "Confirmă generarea listei", exact: true }).click();
  await expect(
    page.getByText(
      "Lista consolidată a fost generată. Inventarul și istoricul nu au fost modificate.",
      { exact: true },
    ),
  ).toBeVisible();
  const first = await page.evaluate(
    () => JSON.parse(localStorage.getItem("cookly-shopping-v1")!).items,
  );
  expect(
    first.find((i: { ingredient: { slug: string } }) => i.ingredient.slug === "fulgi-de-ovaz")
      .quantity,
  ).toBe("200");
  await page.getByRole("button", { name: "Generează lista consolidată", exact: true }).click();
  await dialog.getByRole("button", { name: "Confirmă generarea listei", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem("cookly-shopping-v1")!).items.length),
  ).toBe(first.length);
  expect(await page.evaluate(() => localStorage.getItem("cookly-pantry-v1"))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem("cookly-recipe-actions-v1"))).toBeNull();
  await page.getByRole("button", { name: "Copiază săptămâna", exact: true }).click();
  await dialog.getByLabel("Începutul săptămânii țintă", { exact: true }).fill("2026-11-09");
  await dialog.getByRole("button", { name: "Confirmă copierea", exact: true }).click();
  await expect(page).toHaveURL(/startsOn=2026-11-09/);
  await expect(
    page
      .getByRole("region", { name: "Mese 2026-11-13", exact: true })
      .getByRole("button", { name: /^Editează / }),
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test("invalid dates and corrupt local plans show recoverable errors without overwriting storage", async ({
  page,
}) => {
  await page.goto("/meal-planner?source=demo&startsOn=2026-02-30");
  await expect(page.getByRole("heading", { name: "Data săptămânii nu este validă" })).toBeVisible();
  await page.evaluate(() => localStorage.setItem("cookly-meal-plan-v1:demo:2026-11-02", "broken"));
  await page.goto("/meal-planner?source=demo&startsOn=2026-11-02");
  await expect(
    page.getByRole("heading", { name: "Plannerul nu poate fi confirmat" }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("cookly-meal-plan-v1:demo:2026-11-02")),
  ).toBe("broken");
});
test("a delayed export confirmation cannot write after navigating to another week", async ({
  page,
}) => {
  await page.goto("/meal-planner?source=demo&startsOn=2026-11-02");
  await page.getByRole("button", { name: "Adaugă Mic dejun 2026-11-05", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Rețetă", { exact: true }).selectOption("terci-de-ovaz-cu-mere");
  await dialog.getByRole("button", { name: "Salvează masa", exact: true }).click();
  await page.getByRole("button", { name: "Generează lista consolidată", exact: true }).click();
  let release!: () => void;
  const delayed = new Promise<void>((resolve) => {
    release = resolve;
  });
  let started!: () => void;
  const waiting = new Promise<void>((resolve) => {
    started = resolve;
  });
  await page.route("**/api/v1/planner/analyze", async (route) => {
    const response = await route.fetch();
    started();
    await delayed;
    await route.fulfill({ response });
  });
  await dialog.getByRole("button", { name: "Confirmă generarea listei", exact: true }).click();
  await waiting;
  await page.getByRole("button", { name: "Săptămâna următoare", exact: true }).click();
  await expect(page).toHaveURL(/startsOn=2026-11-09/);
  await expect(
    page.getByRole("button", { name: "Adaugă Mic dejun 2026-11-09", exact: true }),
  ).toBeVisible();
  const finished = page.waitForResponse((response) =>
    response.url().includes("/api/v1/planner/analyze"),
  );
  release();
  await finished;
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("button", { name: /^Editează / })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Generează lista consolidată", exact: true }),
  ).toBeDisabled();
  expect(await page.evaluate(() => localStorage.getItem("cookly-shopping-v1"))).toBeNull();
});
test("a completed copy does not redirect over a newer week selection", async ({ page }) => {
  await page.goto("/meal-planner?source=demo&startsOn=2026-11-02");
  await page.getByRole("button", { name: "Adaugă Mic dejun 2026-11-05", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Salvează masa", exact: true })
    .click();
  const stored = await page.evaluate(
    () => JSON.parse(localStorage.getItem("cookly-meal-plan-v1:demo:2026-11-02")!).week,
  );
  const bootResponse = await page.request.get("/api/v1/planner?source=demo&startsOn=2026-11-02");
  const boot = await bootResponse.json();
  const accountId = "00000000-0000-4000-8000-000000000001";
  let release!: () => void, started!: () => void;
  const delayed = new Promise<void>((resolve) => {
    release = resolve;
  });
  const waiting = new Promise<void>((resolve) => {
    started = resolve;
  });
  await page.route("**/api/v1/planner?**", (route) => {
    const startsOn = new URL(route.request().url()).searchParams.get("startsOn");
    return route.fulfill({
      json: {
        ...boot,
        accountId,
        week:
          startsOn === stored.startsOn
            ? stored
            : { ...stored, startsOn, revision: "0", entries: [] },
      },
    });
  });
  await page.route("**/api/v1/planner", async (route) => {
    started();
    await delayed;
    await route.fulfill({
      json: { accountId, week: { ...stored, startsOn: "2026-11-16", entries: [] } },
    });
  });
  await page.reload();
  await page.getByRole("button", { name: "Copiază săptămâna", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Începutul săptămânii țintă", { exact: true }).fill("2026-11-16");
  await dialog.getByRole("button", { name: "Confirmă copierea", exact: true }).click();
  await waiting;
  await page.getByRole("button", { name: "Săptămâna următoare", exact: true }).click();
  await expect(page).toHaveURL(/startsOn=2026-11-09/);
  const finished = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/v1/planner") && response.request().method() === "POST",
  );
  release();
  await finished;
  await page.waitForLoadState("networkidle");
  await expect(page).toHaveURL(/startsOn=2026-11-09/);
  await expect(
    page.getByRole("button", { name: "Adaugă Mic dejun 2026-11-09", exact: true }),
  ).toBeVisible();
});
