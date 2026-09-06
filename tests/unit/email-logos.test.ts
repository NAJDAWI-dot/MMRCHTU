import { describe, expect, it } from "vitest";
import { MMRC_PLATE } from "@/lib/brand";
import { registrationConfirmationEmail } from "@/lib/email-templates";

/**
 * The marks in an outgoing email.
 *
 * Worth pinning because the failure is silent and outbound: nobody on the team
 * sees the email a competitor receives, so a logo that stopped rendering — or
 * one rendering as half a logo on the white band — would go unnoticed for the
 * whole season.
 */
/*
  A complete payload rather than a cast. The earlier version asserted its way
  past the type with `as`, which compiled only because nothing checked it —
  vitest does not typecheck, so the suite passed while `npm run typecheck`
  failed. Building the real shape means a field added to this email breaks here
  loudly instead of silently.
*/
const email = () =>
  registrationConfirmationEmail({
    teamName: "Maze Runners",
    resumeCode: "ABC123",
    siteUrl: "https://www.mmrchtu.tech",
    members: [
      {
        order: 1,
        firstName: "Ada",
        lastName: "Lovelace",
        university: "HTU",
        major: "Computer Engineering",
      },
    ],
    feeBaseFils: 25_000,
    feeDiscountFils: 0,
    feeDueFils: 25_000,
    earlyBirdApplied: false,
  }).html;

describe("email header logos", () => {
  it("carries all three marks", () => {
    const html = email();
    expect(html).toContain("/brand/logo/htu.png");
    expect(html).toContain("/brand/logo/lockup-htu-chapter.png");
    expect(html).toContain("/brand/logo/mmrc-mark.png");
  });

  it("gives the MMRC mark its plate", () => {
    // The band behind these logos is white and the left half of the glyph is
    // white too. Without a ground, half the logo is simply not in the email.
    expect(email()).toContain(`background-color:${MMRC_PLATE}`);
  });

  it("keeps every logo an absolute URL", () => {
    // Mail clients block data: URIs, and a relative path resolves against the
    // client, not the site — either way the image is a broken box.
    const html = email();
    for (const file of ["htu.png", "lockup-htu-chapter.png", "mmrc-mark.png"]) {
      expect(html).toContain(`https://www.mmrchtu.tech/brand/logo/${file}`);
    }
  });
});
