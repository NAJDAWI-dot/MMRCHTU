import { describe, expect, it } from "vitest";
import {
  FEE_TIER_OPTIONS,
  basePriceForTier,
  computeFee,
  isEarlyBirdActive,
  isFeeTier,
  type EarlyBirdConfig,
  type FeeTier,
  type TierPrices,
} from "@/lib/pricing";

const PRICES: TierPrices = {
  priceRasMemberFils: 15_000,
  priceIeeeMemberFils: 25_000,
  priceNonMemberFils: 35_000,
};

const NO_EARLY_BIRD: EarlyBirdConfig = {
  earlyBirdEnabled: false,
  earlyBirdPercent: 0,
  earlyBirdCutoff: null,
};

const CUTOFF = new Date("2026-09-01T00:00:00.000Z");
const BEFORE = new Date("2026-08-31T23:59:59.000Z");
const AFTER = new Date("2026-09-01T00:00:01.000Z");

describe("basePriceForTier", () => {
  it("prices each tier from the configured amounts", () => {
    expect(basePriceForTier("IEEE_RAS_MEMBER", PRICES)).toBe(15_000);
    expect(basePriceForTier("IEEE_MEMBER", PRICES)).toBe(25_000);
    expect(basePriceForTier("NON_MEMBER", PRICES)).toBe(35_000);
  });

  it("has a price for every tier the form can offer", () => {
    // Guards against the options list and the price switch drifting apart —
    // a new tier added to one and not the other would charge zero.
    for (const option of FEE_TIER_OPTIONS) {
      expect(basePriceForTier(option.value, PRICES)).toBeGreaterThan(0);
    }
  });
});

describe("isFeeTier", () => {
  it("accepts the three real tiers", () => {
    expect(isFeeTier("IEEE_RAS_MEMBER")).toBe(true);
    expect(isFeeTier("IEEE_MEMBER")).toBe(true);
    expect(isFeeTier("NON_MEMBER")).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isFeeTier("")).toBe(false);
    expect(isFeeTier("ieee_member")).toBe(false);
    expect(isFeeTier("FREE")).toBe(false);
  });
});

describe("isEarlyBirdActive", () => {
  it("is off when the toggle is off, whatever the date says", () => {
    expect(
      isEarlyBirdActive(
        { earlyBirdEnabled: false, earlyBirdPercent: 20, earlyBirdCutoff: CUTOFF },
        BEFORE,
      ),
    ).toBe(false);
  });

  it("is off when no cutoff is set, even while enabled", () => {
    // "No date" must not read as "forever" — an admin who ticks the box before
    // choosing a date would otherwise discount every registration indefinitely.
    expect(
      isEarlyBirdActive(
        { earlyBirdEnabled: true, earlyBirdPercent: 20, earlyBirdCutoff: null },
        BEFORE,
      ),
    ).toBe(false);
  });

  it("is off when the percentage is zero", () => {
    expect(
      isEarlyBirdActive(
        { earlyBirdEnabled: true, earlyBirdPercent: 0, earlyBirdCutoff: CUTOFF },
        BEFORE,
      ),
    ).toBe(false);
  });

  it("is on strictly before the cutoff", () => {
    expect(
      isEarlyBirdActive(
        { earlyBirdEnabled: true, earlyBirdPercent: 20, earlyBirdCutoff: CUTOFF },
        BEFORE,
      ),
    ).toBe(true);
  });

  it("expires at the cutoff itself, not a moment later", () => {
    expect(
      isEarlyBirdActive(
        { earlyBirdEnabled: true, earlyBirdPercent: 20, earlyBirdCutoff: CUTOFF },
        CUTOFF,
      ),
    ).toBe(false);
    expect(
      isEarlyBirdActive(
        { earlyBirdEnabled: true, earlyBirdPercent: 20, earlyBirdCutoff: CUTOFF },
        AFTER,
      ),
    ).toBe(false);
  });
});

describe("computeFee", () => {
  it("charges the full tier price when no discount is running", () => {
    const fee = computeFee("IEEE_MEMBER", PRICES, NO_EARLY_BIRD, BEFORE);
    expect(fee).toEqual({
      tier: "IEEE_MEMBER",
      baseFils: 25_000,
      discountFils: 0,
      dueFils: 25_000,
      earlyBirdApplied: false,
    });
  });

  it("applies the percentage while the early bird is running", () => {
    const fee = computeFee(
      "IEEE_MEMBER",
      PRICES,
      { earlyBirdEnabled: true, earlyBirdPercent: 20, earlyBirdCutoff: CUTOFF },
      BEFORE,
    );
    expect(fee.discountFils).toBe(5_000);
    expect(fee.dueFils).toBe(20_000);
    expect(fee.earlyBirdApplied).toBe(true);
  });

  it("goes back to full price once the cutoff passes, with no toggle change", () => {
    const earlyBird: EarlyBirdConfig = {
      earlyBirdEnabled: true,
      earlyBirdPercent: 20,
      earlyBirdCutoff: CUTOFF,
    };
    expect(computeFee("IEEE_MEMBER", PRICES, earlyBird, AFTER).dueFils).toBe(25_000);
    expect(computeFee("IEEE_MEMBER", PRICES, earlyBird, AFTER).earlyBirdApplied).toBe(false);
  });

  it("rounds the discount down so it never exceeds the advertised percentage", () => {
    // 15_025 * 10% = 1502.5 — floor keeps the discount at or under 10%.
    const fee = computeFee(
      "IEEE_RAS_MEMBER",
      { ...PRICES, priceRasMemberFils: 15_025 },
      { earlyBirdEnabled: true, earlyBirdPercent: 10, earlyBirdCutoff: CUTOFF },
      BEFORE,
    );
    expect(fee.discountFils).toBe(1_502);
    expect(fee.dueFils).toBe(13_523);
  });

  it("keeps a non-dividing percentage exact in fils", () => {
    // 25_000 * 33% = 8250 exactly; 15_025 * 33% = 4958.25 -> 4958.
    expect(
      computeFee(
        "IEEE_MEMBER",
        PRICES,
        { earlyBirdEnabled: true, earlyBirdPercent: 33, earlyBirdCutoff: CUTOFF },
        BEFORE,
      ).discountFils,
    ).toBe(8_250);
    expect(
      computeFee(
        "IEEE_RAS_MEMBER",
        { ...PRICES, priceRasMemberFils: 15_025 },
        { earlyBirdEnabled: true, earlyBirdPercent: 33, earlyBirdCutoff: CUTOFF },
        BEFORE,
      ).discountFils,
    ).toBe(4_958);
  });

  it("always returns whole fils", () => {
    const fee = computeFee(
      "NON_MEMBER",
      { ...PRICES, priceNonMemberFils: 33_333 },
      { earlyBirdEnabled: true, earlyBirdPercent: 17, earlyBirdCutoff: CUTOFF },
      BEFORE,
    );
    expect(Number.isInteger(fee.discountFils)).toBe(true);
    expect(Number.isInteger(fee.dueFils)).toBe(true);
    expect(fee.baseFils).toBe(fee.discountFils + fee.dueFils);
  });

  it("clamps a percentage above 100 rather than paying the team", () => {
    const fee = computeFee(
      "IEEE_MEMBER",
      PRICES,
      { earlyBirdEnabled: true, earlyBirdPercent: 150, earlyBirdCutoff: CUTOFF },
      BEFORE,
    );
    expect(fee.discountFils).toBe(25_000);
    expect(fee.dueFils).toBe(0);
  });

  it("ignores a negative or unreadable percentage", () => {
    const negative = computeFee(
      "IEEE_MEMBER",
      PRICES,
      { earlyBirdEnabled: true, earlyBirdPercent: -5, earlyBirdCutoff: CUTOFF },
      BEFORE,
    );
    expect(negative.discountFils).toBe(0);
    expect(negative.dueFils).toBe(25_000);

    const notANumber = computeFee(
      "IEEE_MEMBER",
      PRICES,
      { earlyBirdEnabled: true, earlyBirdPercent: Number.NaN, earlyBirdCutoff: CUTOFF },
      BEFORE,
    );
    expect(notANumber.discountFils).toBe(0);
    expect(notANumber.dueFils).toBe(25_000);
  });

  it("is deterministic for a given instant, so a quoted price is reproducible", () => {
    const args = [
      "NON_MEMBER" as FeeTier,
      PRICES,
      { earlyBirdEnabled: true, earlyBirdPercent: 20, earlyBirdCutoff: CUTOFF },
    ] as const;
    expect(computeFee(...args, BEFORE)).toEqual(computeFee(...args, BEFORE));
  });
});
