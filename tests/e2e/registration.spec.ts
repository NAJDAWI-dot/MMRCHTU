import { test, expect } from "@playwright/test";

test("registering a team increments the live counter", async ({ page, request }) => {
  const before = await (await request.get("/api/stats")).json();
  const beforeCount = before.registrations ?? 0;

  await page.goto("/register");
  await page.getByLabel("Team name").fill(`Playwright Test Team ${Date.now()}`);
  await page.getByLabel("Contact name").fill("Test Runner");
  await page.getByLabel("Contact email").fill(`playwright-${Date.now()}@example.com`);
  await page.getByLabel("Team size").fill("2");
  await page.getByRole("button", { name: "Register team" }).click();

  await expect(page.getByText("You're registered!")).toBeVisible();

  const after = await (await request.get("/api/stats")).json();
  expect(after.registrations).toBe(beforeCount + 1);
});

test("shows validation errors for an incomplete form", async ({ page }) => {
  await page.goto("/register");
  await page.getByLabel("Contact email").fill("not-an-email");
  await page.getByRole("button", { name: "Register team" }).click();
  await expect(page.getByRole("alert").first()).toBeVisible();
});
