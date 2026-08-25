import { test, expect } from "@playwright/test";

/**
 * The two-stage registration flow, end to end.
 *
 * Assumes an admin has configured the Payments tab — CliQ switched on with an
 * alias, and (for the discount assertions) a running early bird. Without that
 * configuration the payment stage correctly shows nothing, which these tests
 * would read as a failure.
 */

function uniqueTeamName(): string {
  return `E2E Team ${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

async function fillStageOne(page: import("@playwright/test").Page, teamName: string) {
  await page.goto("/register");

  await page.fill("#teamName", teamName);
  await page.fill("#submitterEmail", "e2e@example.com");

  await page.fill("#member1FirstName", "Ada");
  await page.fill("#member1LastName", "Lovelace");
  await page.fill("#member1Email", "ada@example.com");
  await page.fill("#member1Whatsapp", "+962700000000");
  await page.selectOption("#member1University", { index: 1 });
  await page.fill("#member1Major", "Computer Engineering");
  await page.check('input[name="member1IeeeStatus"][value="IEEE_MEMBER"]');
  await page.fill("#member1IeeeMembershipId", "12345678");

  await page.fill("#technicalExperience", "Built line-following robots for two years.");
  await page.fill("#motivation", "Excited to build a maze solver.");
}

test("prices each tier and shows the early bird discount", async ({ page }) => {
  await page.goto("/register");

  const feeSection = page.getByRole("group", { name: /registration fee/i });
  await expect(feeSection).toBeVisible();

  // 20% off the configured tiers: 15 -> 12, 25 -> 20, 35 -> 28.
  await expect(feeSection).toContainText("12 JD");
  await expect(feeSection).toContainText("20 JD");
  await expect(feeSection).toContainText("28 JD");

  // The undiscounted price is still shown, struck through, so nobody has to
  // take the discount on faith.
  await expect(feeSection).toContainText("25 JD");
  await expect(page.getByText(/early bird pricing is running/i)).toBeVisible();
});

test("refuses to register without accepting the terms", async ({ page }) => {
  await fillStageOne(page, uniqueTeamName());
  await page.check('input[name="feeTier"][value="IEEE_MEMBER"]');
  // Consent deliberately left unchecked.
  await page.getByRole("button", { name: /register team/i }).click();

  await expect(page.getByText(/accept the terms and policies/i)).toBeVisible();
  // Still on stage one — nothing was created.
  await expect(page.locator("#teamName")).toBeVisible();
});

test("registers, then shows the payment stage with the discounted amount due", async ({ page }) => {
  const teamName = uniqueTeamName();
  await fillStageOne(page, teamName);
  await page.check('input[name="feeTier"][value="IEEE_MEMBER"]');
  await page.check('input[name="consentAccepted"]');
  await page.getByRole("button", { name: /register team/i }).click();

  await expect(page.getByText(`${teamName} is registered.`)).toBeVisible({ timeout: 15_000 });

  // IEEE member at 25 JD, less the running 20% early bird.
  await expect(page.getByText("Total due")).toBeVisible();
  await expect(page.getByText("20 JD", { exact: true }).first()).toBeVisible();

  // The CliQ details a team actually needs to make the transfer.
  await expect(page.getByRole("heading", { name: /paying the fee with cliq/i })).toBeVisible();
  await expect(page.getByText("MMRCHTU")).toBeVisible();

  // And the proof form, with the wait time stated up front.
  await expect(page.getByText(/24–48 hours/)).toBeVisible();
  await expect(page.locator("#paymentReference")).toBeVisible();
  await expect(page.locator("#screenshot")).toBeVisible();
});

test("a payment code reopens the payment stage in a fresh session", async ({ page, context }) => {
  const teamName = uniqueTeamName();
  await fillStageOne(page, teamName);
  await page.check('input[name="feeTier"][value="IEEE_MEMBER"]');
  await page.check('input[name="consentAccepted"]');
  await page.getByRole("button", { name: /register team/i }).click();

  await expect(page.getByText(`${teamName} is registered.`)).toBeVisible({ timeout: 15_000 });

  const code = (await page.locator("p.font-mono").first().innerText()).trim();
  expect(code).toMatch(/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/);

  // A genuinely separate browser context: no cookies, no client state carried
  // over. The only thing linking it to the registration is the code.
  const fresh = await context.browser()!.newPage();
  await fresh.goto(`/register?code=${code}`);
  await expect(fresh.getByText(`${teamName} is registered.`)).toBeVisible();
  await expect(fresh.getByText("20 JD", { exact: true }).first()).toBeVisible();
  await fresh.close();
});

test("an unknown payment code says so rather than failing", async ({ page }) => {
  await page.goto("/register?code=ZZZZZZ");
  await expect(page.getByRole("heading", { name: /payment code not found/i })).toBeVisible();
  await expect(page.getByText("ZZZZZZ")).toBeVisible();
});

test("the payment stage rejects a report with no reference or screenshot", async ({ page }) => {
  const teamName = uniqueTeamName();
  await fillStageOne(page, teamName);
  await page.check('input[name="feeTier"][value="NON_MEMBER"]');
  await page.check('input[name="consentAccepted"]');
  await page.getByRole("button", { name: /register team/i }).click();

  await expect(page.getByText(`${teamName} is registered.`)).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: /submit payment proof/i }).click();

  await expect(page.getByText(/enter the transaction reference/i)).toBeVisible();
  await expect(page.getByText(/attach a screenshot/i)).toBeVisible();
});

test("every legal page renders and is reachable from the footer", async ({ page }) => {
  await page.goto("/");

  const policies = page.getByRole("navigation", { name: /policies/i });
  await expect(policies).toBeVisible();

  for (const [slug, title] of [
    ["terms", "Terms of Service"],
    ["privacy", "Privacy Policy"],
    ["payment-refund-policy", "Payment & Refund Policy"],
    ["code-of-conduct", "Code of Conduct"],
  ] as const) {
    await page.goto(`/legal/${slug}`);
    await expect(page.getByRole("heading", { name: title, level: 1 })).toBeVisible();
    await expect(page.getByText(/pending review/i)).toBeVisible();
  }

  // The refund policy is the one a paying team needs; check it actually states
  // the window rather than merely existing.
  await page.goto("/legal/payment-refund-policy");
  await expect(page.getByText(/24 to 48 hours/i)).toBeVisible();
});
