import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { goto } from "./helpers";

/**
 * The flip-book is page-flip driving DOM it owns, with React drawing into it
 * through portals — the one arrangement here that no unit test can exercise.
 * These walk it the way a reader does: open it, turn pages, follow the
 * contents, use a diagram without the page turning under them.
 */

const counter = (page: Page) => page.locator(".book-counter span").first();
const toolbar = (page: Page) => page.getByRole("toolbar", { name: "Rulebook controls" });

async function openBook(page: Page, path = "/rules") {
  await goto(page, path);
  await expect(page.locator(".book-host .stf__parent")).toBeVisible({ timeout: 30_000 });
}

test.describe("rulebook flip-book", () => {
  test.use({ viewport: { width: 1440, height: 1000 } });

  test("opens at the cover and turns a spread at a time", async ({ page }) => {
    await openBook(page);
    await expect(page.getByRole("heading", { name: "Rulebook" })).toBeVisible();
    await expect(counter(page)).toHaveText("Page 1 of 18");

    await toolbar(page).getByRole("button", { name: /Next/ }).click();
    await expect(counter(page)).toHaveText("Pages 2–3 of 18");
    await expect(page).toHaveURL(/[?&]page=2\b/);

    await page.keyboard.press("ArrowRight");
    await expect(counter(page)).toHaveText("Pages 4–5 of 18");
  });

  test("a contents entry in the PDF jumps to its page", async ({ page }) => {
    await openBook(page, "/rules?page=2");
    await page.getByRole("button", { name: "Go to 6.3 Scoring, and Tie-Breakers" }).click();
    await expect(counter(page)).toHaveText("Pages 12–13 of 18");
  });

  test("using a diagram does not turn the page", async ({ page }) => {
    await openBook(page, "/rules?page=13");
    await expect(counter(page)).toHaveText("Pages 12–13 of 18");

    const score = page.locator(".book-page").filter({ hasText: "Work out your score" });
    await score.getByLabel("Successful runs", { exact: true }).fill("4");
    await score.getByLabel("Official time", { exact: true }).fill("25");
    await expect(score.getByText("160.0").first()).toBeVisible();

    // A drag across the slider is exactly the gesture page-flip would take for
    // a page turn, if the page let it through.
    const slider = score.getByRole("slider", { name: /Successful runs/ });
    const box = (await slider.boundingBox())!;
    await page.mouse.move(box.x + 4, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width - 4, box.y + box.height / 2, { steps: 12 });
    await page.mouse.up();

    await page.waitForTimeout(1200);
    await expect(counter(page)).toHaveText("Pages 12–13 of 18");
  });

  test("a deep link opens the book at that page", async ({ page }) => {
    await openBook(page, "/rules?page=5");
    await expect(counter(page)).toHaveText("Pages 4–5 of 18");
    await expect(page.locator(".book-page").filter({ hasText: "Explore a maze" })).toBeVisible();
  });

  test("has no accessibility violations around the book", async ({ page }) => {
    await openBook(page);
    const audit = await new AxeBuilder({ page })
      .include(".book-stage")
      // The page images are the organisers' own artwork; their contrast is not
      // this page's to change.
      .exclude(".book-page")
      .analyze();
    expect(audit.violations).toEqual([]);
  });
});

test.describe("rulebook flip-book on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("shows one page at a time and turns both ways", async ({ page }) => {
    await openBook(page, "/rules?page=13");
    await expect(counter(page)).toHaveText("Page 13 of 18");

    await toolbar(page)
      .getByRole("button", { name: /Previous/ })
      .click();
    await expect(counter(page)).toHaveText("Page 12 of 18");

    await toolbar(page).getByRole("button", { name: /Next/ }).click();
    await expect(counter(page)).toHaveText("Page 13 of 18");
  });
});
