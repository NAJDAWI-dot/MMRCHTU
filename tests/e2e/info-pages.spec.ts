import { test, expect } from "@playwright/test";

test.describe("info pages", () => {
  test("home page renders and links to key routes", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "MMRC 26" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Register your team" })).toBeVisible();
  });

  test("navigates to rules, schedule, and faq", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Rules", exact: true }).first().click();
    await expect(page).toHaveURL(/\/rules$/);
    await expect(page.getByRole("heading", { name: "Rulebook" })).toBeVisible();

    await page.goto("/schedule");
    await expect(page.getByRole("heading", { name: "Schedule" })).toBeVisible();

    await page.goto("/faq");
    await expect(page.getByRole("heading", { name: "Frequently asked questions" })).toBeVisible();
  });

  test("dark mode toggle swaps the logo image", async ({ page }) => {
    await page.goto("/");
    const logo = page.locator("header img").first();
    const lightSrc = await logo.getAttribute("src");

    await page.getByRole("button", { name: "Dark mode" }).click();
    await expect(page.locator("html")).toHaveClass(/dark/);

    const darkSrc = await logo.getAttribute("src");
    expect(darkSrc).not.toBe(lightSrc);
  });
});
