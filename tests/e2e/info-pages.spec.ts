import { test, expect } from "@playwright/test";
import { goto } from "./helpers";

test.describe("info pages", () => {
  test("home page renders and links to key routes", async ({ page }) => {
    await goto(page, "/");
    await expect(page.getByRole("heading", { name: "MMRC 26" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Register your team" })).toBeVisible();
  });

  test("navigates to rules, schedule, and faq", async ({ page }) => {
    await goto(page, "/");
    await page.getByRole("link", { name: "Rules", exact: true }).first().click();
    await expect(page).toHaveURL(/\/rules$/);
    await expect(page.getByRole("heading", { name: "Rulebook" })).toBeVisible();

    await goto(page, "/schedule");
    await expect(page.getByRole("heading", { name: "Schedule" })).toBeVisible();

    await goto(page, "/faq");
    await expect(page.getByRole("heading", { name: "Frequently asked questions" })).toBeVisible();
  });

  test("dark mode toggle swaps the logo image", async ({ page }) => {
    await goto(page, "/");
    const logo = page.locator("header img").first();
    const lightSrc = await logo.getAttribute("src");

    await page.getByRole("button", { name: "Dark mode" }).click();
    await expect(page.locator("html")).toHaveClass(/dark/);

    const darkSrc = await logo.getAttribute("src");
    expect(darkSrc).not.toBe(lightSrc);
  });
});
