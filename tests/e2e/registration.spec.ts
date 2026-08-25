import { test, expect } from "@playwright/test";

/**
 * Stage one driven entirely through accessible names.
 *
 * Deliberately different from payment.spec.ts, which addresses the same form by
 * id: if a label is dropped or stops being associated with its input, the id
 * selectors keep passing and this fails, which is the point.
 *
 * This test used to assert that the registrations counter went up, reading it
 * from /api/stats. That route was removed in 6457914 and nothing public exposes
 * the counter now, so the assertion could not be kept. The counter is still
 * incremented inside createRegistration's transaction; it simply has no reader
 * left to check it from the outside.
 */
test("registering a 1-member team reaches the payment stage", async ({ page }) => {
  const teamName = `Playwright Test Team ${Date.now()}`;

  await page.goto("/register");
  await page.getByLabel("Team name").fill(teamName);
  await page.getByLabel("Submitter email").fill(`playwright-${Date.now()}@example.com`);
  // memberCount defaults to 1, so only the Team Leader fields are visible.
  await page.getByLabel("First name").fill("Ada");
  await page.getByLabel("Last name").fill("Lovelace");
  await page.getByLabel("Email", { exact: true }).fill(`ada-${Date.now()}@example.com`);
  await page.getByLabel("WhatsApp number").fill("+962700000000");
  await page.getByLabel("University").selectOption("The University of Jordan (UJ)");
  await page.getByLabel("Major").fill("Computer Engineering");
  // Scoped to the member fieldset: the fee-tier group offers a "Non-Member"
  // radio too, and the two mean different things — one records who this person
  // is, the other decides what the team pays.
  await page
    .getByRole("group", { name: "Team Leader" })
    .getByRole("radio", { name: "Non-Member", exact: true })
    .check();
  await page.getByLabel(/IEEE membership ID/).fill("Non-Member");
  await page
    .getByLabel("Briefly describe the technical experience of each member")
    .fill("Two years building line-following robots.");
  await page.getByLabel("What is your motivation to participate?").fill("Excited to build a maze-solver.");

  await page.getByRole("group", { name: /registration fee/i }).getByRole("radio", { name: /Non-Member/ }).check();
  await page.getByRole("checkbox", { name: /accept the/i }).check();

  await page.getByRole("button", { name: "Register team" }).click();

  await expect(page.getByText(`${teamName} is registered.`)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Total due")).toBeVisible();
});

test("shows validation errors for an incomplete form", async ({ page }) => {
  await page.goto("/register");
  await page.getByLabel("Team name").fill("A");
  await page.getByRole("button", { name: "Register team" }).click();
  await expect(page.getByRole("alert").first()).toBeVisible();
});
