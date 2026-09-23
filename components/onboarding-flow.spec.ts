import { test, expect } from "@playwright/test";

test("assistant and cards share values; advancing does not submit the new form", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .locator("#assistant")
    .getByRole("button", { name: "Алматы", exact: true })
    .click();
  await page.locator(".assistant-toggle").click();
  await expect(page.locator("#assistant")).toHaveCount(0);
  await expect(page.locator(".chosen")).toContainText("Алматы");
  await expect(page.locator(".events")).toBeVisible();
  await page.locator(".event-card").filter({ hasText: "Свадьба" }).click();
  let calls = 0;
  page.on("request", (request) => {
    if (request.url().endsWith("/api/match")) calls++;
  });
  await page
    .getByRole("button", { name: "Перейти к деталям", exact: true })
    .click();
  await expect(page.locator("#details-form")).toBeVisible();
  expect(calls).toBe(0);
  await page.locator('input[name="budget"]').fill("900000");
  await page.locator(".assistant-toggle").click();
  await expect(page.locator("#assistant")).toBeVisible();
  await expect(page.locator('input[name="budget"]')).toHaveValue("900000");
  await page.locator(".assistant-toggle").click();
  await page.reload();
  await expect(page.locator("#details-form")).toBeVisible();
  await expect(page.locator("#assistant")).toHaveCount(0);
  await expect(page.locator('input[name="budget"]')).toHaveValue("900000");
  const sent = page.waitForRequest((request) =>
    request.url().endsWith("/api/match"),
  );
  await page
    .getByRole("button", { name: "Подобрать подрядчиков", exact: true })
    .click();
  expect((await sent).postDataJSON()).toEqual({
    city: "Алматы",
    eventType: "свадьба",
    date: "2026-10-15",
    category: "Ведущий",
    budget: 900000,
  });
  await expect(
    page.getByTestId("match-results").getByTestId("match-card"),
  ).toHaveCount(3);
});

test("instant assistant answers are editable; calendar and budget send exact values", async ({
  page,
}) => {
  await page.goto("/");
  const assistant = page.locator("#assistant");
  await assistant.getByRole("button", { name: "Алматы", exact: true }).click();
  await expect(
    assistant.getByRole("button", { name: "Дальше", exact: true }),
  ).toHaveCount(0);
  await assistant
    .getByRole("button", { name: "Изменить город: Алматы" })
    .click();
  await assistant.getByRole("button", { name: "Астана", exact: true }).click();
  await assistant.getByRole("button", { name: "свадьба", exact: true }).click();
  await expect(page.locator("#details-form")).toBeVisible();
  await page
    .getByRole("button", { name: "Календарь: Дата мероприятия", exact: true })
    .click();
  await page.locator('.rdp-day[data-day="2026-10-20"] button').click();
  await expect(page.locator('input[name="date"]')).toHaveValue("2026-10-20");
  await expect(page.locator(".event-calendar")).toHaveCount(0);
  await page.getByRole("slider").focus();
  await page.getByRole("slider").press("ArrowRight");
  await expect(page.locator('input[name="budget"]')).toHaveValue("1010000");
  await page.locator('input[name="budget"]').fill("1234567");
  await expect(page.getByRole("slider")).toHaveAttribute(
    "aria-valuenow",
    "1234567",
  );
  const sent = page.waitForRequest((request) =>
    request.url().endsWith("/api/match"),
  );
  await page
    .getByRole("button", { name: "Подобрать подрядчиков", exact: true })
    .click();
  expect((await sent).postDataJSON()).toMatchObject({
    city: "Астана",
    date: "2026-10-20",
    budget: 1234567,
  });
});

test("storage unavailable does not block independent city-card flow", async ({
  page,
}) => {
  await page.addInitScript(() => {
    for (const key of ["localStorage", "sessionStorage"]) {
      Object.defineProperty(window, key, {
        get() {
          throw new DOMException("Storage disabled", "SecurityError");
        },
      });
    }
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.locator(".assistant-toggle").click();
  await page.locator(".city-card").filter({ hasText: "Астана" }).click();
  await page
    .getByRole("button", { name: "Выбрать формат", exact: true })
    .click();
  await page.locator(".event-card").filter({ hasText: "Свадьба" }).click();
  await page
    .getByRole("button", { name: "Перейти к деталям", exact: true })
    .click();
  await page.locator('select[name="category"]').selectOption("Декоратор");
  await page.locator('input[name="budget"]').fill("2000000");
  await page
    .getByRole("button", { name: "Подобрать подрядчиков", exact: true })
    .click();
  await expect(page.getByTestId("match-results")).toContainText(
    "В городе нет этой категории",
  );
  await expect(page.getByTestId("match-card")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("catalog failure offers retry and does not depend on assistant visibility", async ({
  page,
}) => {
  await page.route("**/api/catalog", (route) => route.abort());
  await page.goto("/");
  await expect(page.locator('.error-box[role="alert"]')).toBeVisible();
  await page.locator(".assistant-toggle").click();
  await page.unroute("**/api/catalog");
  await page.getByRole("button", { name: "Загрузить снова" }).click();
  await expect(page.locator(".city-card")).toHaveCount(2);
  await expect(page.locator('.error-box[role="alert"]')).toHaveCount(0);
  await expect(page.locator("#assistant")).toHaveCount(0);
});

test("mobile calendar fits; slider supports pointer and boundary keys", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page
    .locator("#assistant")
    .getByRole("button", { name: "Алматы", exact: true })
    .click();
  await page
    .locator("#assistant")
    .getByRole("button", { name: "свадьба", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Календарь: Дата мероприятия" })
    .click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.locator('.rdp-day[data-day="2026-10-15"] button').press("Escape");
  await expect(page.locator(".event-calendar")).toHaveCount(0);
  const track = await page.locator(".budget-track").boundingBox();
  if (!track) throw new Error("Budget track is missing");
  await page.mouse.click(track.x + track.width / 2, track.y + track.height / 2);
  const budget = Number(
    await page.locator('input[name="budget"]').inputValue(),
  );
  expect(budget).toBeGreaterThan(2300000);
  expect(budget).toBeLessThan(2700000);
  await page.getByRole("slider").press("Home");
  await expect(page.locator('input[name="budget"]')).toHaveValue("0");
  await page.getByRole("slider").press("End");
  await expect(page.locator('input[name="budget"]')).toHaveValue("5000000");
  await page.locator('input[name="budget"]').fill("8000000");
  await expect(page.getByRole("slider")).toHaveAttribute(
    "aria-valuemax",
    "8000000",
  );
});
