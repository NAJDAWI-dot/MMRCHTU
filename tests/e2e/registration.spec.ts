import { test, expect } from "@playwright/test";

test("registering a 1-member team increments the live counter", async ({ page, request }) => {
  const before = await (await request.get("/api/stats")).json();
  const beforeCount = before.registrations ?? 0;

  await page.goto("/register");
  await page.getByLabel("Team name").fill(`Playwright Test Team ${Date.now()}`);
  await page.getByLabel("Submitter email").fill(`playwright-${Date.now()}@example.com`);
  // memberCount defaults to 1, so only the Team Leader fields are visible.
  await page.getByLabel("First name").fill("Ada");
  await page.getByLabel("Last name").fill("Lovelace");
  await page.getByLabel("Email", { exact: true }).fill(`ada-${Date.now()}@example.com`);
  await page.getByLabel("WhatsApp number").fill("+962700000000");
  await page.getByLabel("University").selectOption("The University of Jordan (UJ)");
  await page.getByLabel("Major").fill("Computer Engineering");
  await page.getByRole("radio", { name: "Non-Member" }).check();
  await page.getByLabel(/IEEE membership ID/).fill("Non-Member");
  await page
    .getByLabel("Briefly describe the technical experience of each member")
    .fill("Two years building line-following robots.");
  await page.getByLabel("What is your motivation to participate?").fill("Excited to build a maze-solver.");
  await page.getByRole("button", { name: "Register team" }).click();

  await expect(page.getByText("You're registered!")).toBeVisible();

  const after = await (await request.get("/api/stats")).json();
  expect(after.registrations).toBe(beforeCount + 1);
});

test("shows validation errors for an incomplete form", async ({ page }) => {
  await page.goto("/register");
  await page.getByLabel("Team name").fill("A");
  await page.getByRole("button", { name: "Register team" }).click();
  await expect(page.getByRole("alert").first()).toBeVisible();
});
