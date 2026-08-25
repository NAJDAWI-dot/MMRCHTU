import { test, expect, type Page } from "@playwright/test";

/**
 * The two-step registration flow, end to end.
 *
 * Assumes an admin has configured the Payments tab — CliQ switched on with an
 * alias, and (for the discount assertions) a running early bird. Without that
 * configuration step two correctly shows no payment details, which these tests
 * would read as a failure.
 */

function uniqueTeamName(): string {
  return `E2E Team ${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

async function fillStepOne(
  page: Page,
  teamName: string,
  leaderStatus: "IEEE_RAS_MEMBER" | "IEEE_MEMBER" | "NON_MEMBER" = "IEEE_MEMBER",
) {
  await page.goto("/register");

  await page.fill("#teamName", teamName);
  await page.fill("#submitterEmail", "e2e@example.com");

  await page.fill("#member1FirstName", "Ada");
  await page.fill("#member1LastName", "Lovelace");
  await page.fill("#member1Email", "ada@example.com");
  await page.fill("#member1Whatsapp", "+962700000000");
  await page.selectOption("#member1University", { index: 1 });
  await page.fill("#member1Major", "Computer Engineering");
  await page.check(`input[name="member1IeeeStatus"][value="${leaderStatus}"]`);
  await page.fill("#member1IeeeMembershipId", "12345678");

  await page.fill("#technicalExperience", "Built line-following robots for two years.");
  await page.fill("#motivation", "Excited to build a maze solver.");
}

test("step one shows nothing about payment until Next is pressed", async ({ page }) => {
  await page.goto("/register");

  // The whole point of the split: no prices, no CliQ alias, no upload box.
  await expect(page.getByText("Total due")).toBeHidden();
  await expect(page.getByRole("heading", { name: /paying the fee with cliq/i })).toBeHidden();
  await expect(page.locator("#screenshot")).toBeHidden();
  await expect(page.getByRole("button", { name: /next: payment/i })).toBeVisible();
});

test("refuses to continue without accepting the terms", async ({ page }) => {
  await fillStepOne(page, uniqueTeamName());
  // Consent deliberately left unchecked.
  await page.getByRole("button", { name: /next: payment/i }).click();

  await expect(page.getByText(/accept the terms and policies/i)).toBeVisible();
  // Still on step one — payment never appeared.
  await expect(page.getByText("Total due")).toBeHidden();
});

test("prices the team from the team leader's IEEE status", async ({ page }) => {
  // IEEE member is 25 JD, less the running 20% early bird.
  await fillStepOne(page, uniqueTeamName(), "IEEE_MEMBER");
  await page.check('input[name="consentAccepted"]');
  await page.getByRole("button", { name: /next: payment/i }).click();

  await expect(page.getByText("Total due")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("25 JD")).toBeVisible();
  await expect(page.getByText("Early bird discount")).toBeVisible();
  await expect(page.getByText("20 JD", { exact: true }).first()).toBeVisible();

  await expect(page.getByRole("heading", { name: /paying the fee with cliq/i })).toBeVisible();
  await expect(page.getByText("MMRCHTU")).toBeVisible();
  await expect(page.getByText(/24–48 hours/).first()).toBeVisible();
});

test("a RAS member leader is priced lower than a non-member leader", async ({ page }) => {
  await fillStepOne(page, uniqueTeamName(), "IEEE_RAS_MEMBER");
  await page.check('input[name="consentAccepted"]');
  await page.getByRole("button", { name: /next: payment/i }).click();
  // 15 JD less 20%.
  await expect(page.getByText("12 JD", { exact: true }).first()).toBeVisible({ timeout: 15_000 });

  await fillStepOne(page, uniqueTeamName(), "NON_MEMBER");
  await page.check('input[name="consentAccepted"]');
  await page.getByRole("button", { name: /next: payment/i }).click();
  // 35 JD less 20%.
  await expect(page.getByText("28 JD", { exact: true }).first()).toBeVisible({ timeout: 15_000 });
});

test("Back returns to step one with the answers still filled in", async ({ page }) => {
  const teamName = uniqueTeamName();
  await fillStepOne(page, teamName);
  await page.check('input[name="consentAccepted"]');
  await page.getByRole("button", { name: /next: payment/i }).click();
  await expect(page.getByText("Total due")).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: /^back$/i }).click();
  await expect(page.locator("#teamName")).toHaveValue(teamName);
  await expect(page.getByText("Total due")).toBeHidden();
});

test("step two rejects a submission with no reference or screenshot", async ({ page }) => {
  await fillStepOne(page, uniqueTeamName());
  await page.check('input[name="consentAccepted"]');
  await page.getByRole("button", { name: /next: payment/i }).click();
  await expect(page.getByText("Total due")).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: /complete registration/i }).click();

  await expect(page.getByText(/enter the transaction reference/i)).toBeVisible();
  await expect(page.getByText(/attach a screenshot/i)).toBeVisible();
});

test("a draft survives leaving the page before payment", async ({ page }) => {
  const teamName = uniqueTeamName();
  await fillStepOne(page, teamName);
  await page.check('input[name="consentAccepted"]');
  await page.getByRole("button", { name: /next: payment/i }).click();
  await expect(page.getByText("Total due")).toBeVisible({ timeout: 15_000 });

  // Exactly what happens when someone leaves to open their banking app.
  await page.goto("/register");
  await expect(page.locator("#teamName")).toHaveValue(teamName);
  await expect(page.locator("#member1FirstName")).toHaveValue("Ada");
});

test("an unknown reference says so rather than failing", async ({ page }) => {
  await page.goto("/register?code=ZZZZZZ");
  await expect(page.getByRole("heading", { name: /reference not found/i })).toBeVisible();
  await expect(page.getByText("ZZZZZZ")).toBeVisible();
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

  // The refund policy is the one a paying team needs; check it states the
  // window rather than merely existing.
  await page.goto("/legal/payment-refund-policy");
  await expect(page.getByText(/24 to 48 hours/i)).toBeVisible();
});
