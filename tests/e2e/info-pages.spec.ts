import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
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
    // Exact: the 3D rulebook banner above it has "Rulebook" in its heading too.
    await expect(page.getByRole("heading", { name: "Rulebook", exact: true })).toBeVisible();

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

  /**
   * The one thing about the tribute popup that only a real browser can answer.
   *
   * The Team page is wrapped in an element that animates transform, which makes
   * it a containing block for its fixed-position descendants — so an overlay
   * rendered inline lands somewhere down the page at the wrong size instead of
   * covering the screen. It renders, it is visible, and every unit test passes.
   * Only measuring it catches it.
   *
   * Skips itself while nothing has been written about anybody, because the
   * roster is filled in over weeks and a suite that fails until then is a suite
   * people learn to ignore.
   */
  test("a tribute covers the screen and is readable on its stage", async ({ page }) => {
    await goto(page, "/team");

    const cards = page.getByRole("button", { name: /open their honourable mention/i });
    test.skip((await cards.count()) === 0, "No honourable mentions written yet.");

    // The key to the stars. Hover tells a mouse user a card opens and tells a
    // phone nothing, so if this line goes the mentions go unread.
    await expect(page.getByText(/starred face/i)).toBeVisible();

    await cards.first().click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    const overlay = page.locator(".tribute-dim");
    const box = await overlay.boundingBox();
    const viewport = page.viewportSize();
    expect(box).not.toBeNull();
    expect(viewport).not.toBeNull();
    expect(box!.y).toBeLessThanOrEqual(1);
    expect(box!.height).toBeGreaterThanOrEqual(viewport!.height - 2);

    // Scoped to the dialog: the stage is the one surface here whose contrast
    // depends on a picture chosen after this test was written.
    const audit = await new AxeBuilder({ page }).include('[role="dialog"]').analyze();
    expect(audit.violations).toEqual([]);

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });
});
