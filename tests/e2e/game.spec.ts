import { test, expect, type Page } from "@playwright/test";

declare global {
  interface Window {
    __CHEDDAR_MOUSE_DEBUG__?: { phase: string; mousePosition: { x: number; y: number }; score: number };
  }
}

async function readDebug(page: Page) {
  return page.evaluate(() => window.__CHEDDAR_MOUSE_DEBUG__);
}

test("Cheddar Mouse starts, mounts a canvas, and responds to input", async ({ page }) => {
  await page.goto("/game");
  await expect(page.getByRole("heading", { name: "Cheddar Mouse", level: 1 })).toBeVisible();

  await page.getByRole("button", { name: "Start game" }).click();
  await expect(page.locator("canvas")).toBeVisible();

  await expect
    .poll(async () => (await readDebug(page))?.phase, { timeout: 5000 })
    .not.toBeUndefined();

  const before = await readDebug(page);
  expect(before?.mousePosition).toBeDefined();

  const application = page.getByRole("application", { name: "Cheddar Mouse game" });
  await application.focus();
  await page.keyboard.press("ArrowLeft");

  await expect
    .poll(async () => {
      const debug = await readDebug(page);
      return debug?.mousePosition.x;
    }, { timeout: 5000 })
    .not.toBe(before?.mousePosition.x);
});
