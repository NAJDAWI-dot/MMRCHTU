import type { Page } from "@playwright/test";

/**
 * Navigate, then get past the intro.
 *
 * The splash now plays on every document load rather than once per tab, so a
 * test that visits three pages sits through three of them — several seconds
 * each, during which the overlay covers everything and Playwright's
 * actionability checks simply wait it out. That still passes; it just makes the
 * suite far slower than the thing it is testing.
 *
 * This uses the same escape hatch a real visitor has — the splash skips on any
 * deliberate keypress — rather than a test-only flag, so what runs in CI is the
 * behaviour that ships. Escape specifically, because it is the one key that
 * does nothing else on a page that has only just loaded.
 */
export async function goto(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await dismissSplash(page);
}

export async function dismissSplash(page: Page): Promise<void> {
  // Pressed more than once, spread out: the listener is attached by an effect,
  // so a keypress that lands before hydration has nobody to hear it. Each press
  // is only an optimisation — if every one of them is early, the splash simply
  // runs its own course, which the timeout below already allows for.
  for (const wait of [0, 250, 600]) {
    if (wait) await page.waitForTimeout(wait);
    if (await page.locator("#mmrc-splash").isHidden()) return;
    await page.keyboard.press("Escape").catch(() => {});
  }

  // Comfortably past the unskipped path: at most ~4.4s of maze plus a 400ms
  // fade, so this only fails if the overlay is genuinely stuck.
  await page.locator("#mmrc-splash").waitFor({ state: "hidden", timeout: 15_000 });
}
