import { test, expect } from "@playwright/test";

test.describe("Pac Mouse", () => {
  test("Classic Maze starts and responds to input", async ({ page }) => {
    await page.goto("/game");
    await expect(page.getByRole("heading", { name: "Pac Mouse" })).toBeVisible();

    await page.getByRole("button", { name: "Start Mission" }).click();
    const canvas = page.getByRole("application", { name: "Classic Maze game" });
    await expect(canvas).toBeVisible();

    await page.keyboard.press("ArrowUp");
    await page.waitForTimeout(2200); // ready countdown + a little play time
    await page.keyboard.press("ArrowLeft");
    await page.waitForTimeout(300);

    // score should have increased from pellet pickup during that window
    const score = await page.getByTestId("classic-score").textContent();
    expect(Number(score)).toBeGreaterThan(0);
  });

  test("switching to First-Person mode mounts its own canvas", async ({ page }) => {
    await page.goto("/game");
    await page.getByRole("button", { name: /First-Person/ }).click();
    await expect(page.getByRole("button", { name: "Enter the Maze" })).toBeVisible();

    await page.getByRole("button", { name: "Enter the Maze" }).click();
    const canvas = page.getByRole("application", { name: "First-person maze view" });
    await expect(canvas).toBeVisible();
  });

  test("switching tabs unmounts the previous mode cleanly (no console errors)", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/game");
    await page.getByRole("button", { name: "Start Mission" }).click();
    await page.waitForTimeout(300);
    await page.getByRole("button", { name: /First-Person/ }).click();
    await page.waitForTimeout(300);
    await page.getByRole("button", { name: /Classic Maze/ }).click();
    await page.waitForTimeout(300);

    expect(errors).toEqual([]);
  });
});
