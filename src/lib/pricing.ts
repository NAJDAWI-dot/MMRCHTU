/**
 * What a team owes: the tier they picked, and any early-bird discount.
 *
 * Kept apart from payment.ts on purpose. That module describes a transfer that
 * has already happened — a reference, an amount, a status to reconcile against
 * a bank statement. This one answers the earlier question of what should be
 * transferred in the first place. Mixing them would mean the arithmetic that
 * quotes a price and the arithmetic that matches a receipt share a file for no
 * reason other than both involving money.
 *
 * Free of React, Prisma and the DOM, so the money arithmetic is testable on its
 * own — and every amount here is integer fils, never a float.
 */

import { IEEE_STATUS_OPTIONS, type IeeeStatus } from "@/lib/ieee-status";

/**
 * The tier a whole team is priced at.
 *
 * Reuses IeeeStatus rather than declaring a parallel enum with the same three
 * values: a second list would drift from the per-member one the moment either
 * changed. The distinction is in what it means, not what it holds — each
 * TeamMember records their own status for the register, while exactly one tier
 * decides the fee for the team.
 */
export type FeeTier = IeeeStatus;

/** Same options as the per-member picker, reused verbatim for the tier radio group. */
export const FEE_TIER_OPTIONS = IEEE_STATUS_OPTIONS;

export function isFeeTier(value: string): value is FeeTier {
  return FEE_TIER_OPTIONS.some((option) => option.value === value);
}

/** The three configured per-team prices, in fils. Shape matches PaymentConfig. */
export interface TierPrices {
  priceRasMemberFils: number;
  priceIeeeMemberFils: number;
  priceNonMemberFils: number;
}

export function basePriceForTier(tier: FeeTier, prices: TierPrices): number {
  switch (tier) {
    case "IEEE_RAS_MEMBER":
      return prices.priceRasMemberFils;
    case "IEEE_MEMBER":
      return prices.priceIeeeMemberFils;
    case "NON_MEMBER":
      return prices.priceNonMemberFils;
  }
}

/** Early-bird settings. Shape matches PaymentConfig. */
export interface EarlyBirdConfig {
  earlyBirdEnabled: boolean;
  earlyBirdPercent: number;
  earlyBirdCutoff: Date | null;
}

/**
 * Whether the discount is running right now.
 *
 * The cutoff does the expiring, so nobody has to remember to switch the toggle
 * off; the toggle is there to end it early. A missing cutoff means inactive
 * rather than indefinite — an admin who ticks the box before picking a date
 * should get no discount, not a permanent one.
 */
export function isEarlyBirdActive(config: EarlyBirdConfig, now: Date = new Date()): boolean {
  if (!config.earlyBirdEnabled) return false;
  if (!config.earlyBirdCutoff) return false;
  if (!(config.earlyBirdPercent > 0)) return false;
  return now.getTime() < config.earlyBirdCutoff.getTime();
}

export interface FeeBreakdown {
  tier: FeeTier;
  baseFils: number;
  discountFils: number;
  dueFils: number;
  earlyBirdApplied: boolean;
}

/**
 * Clamps a configured percentage into 0–100.
 *
 * An admin typing 150 into the box should not have the site pay the team, and
 * an empty or malformed field arrives as NaN, which would otherwise propagate
 * silently through the multiplication and produce a NaN amount due.
 */
function clampPercent(percent: number): number {
  if (!Number.isFinite(percent) || percent <= 0) return 0;
  return Math.min(percent, 100);
}

/**
 * The full quote for one registration.
 *
 * `now` is injected so a quote is reproducible in a test and, more importantly,
 * so the caller can be explicit that a stored fee was frozen at a particular
 * instant rather than recomputed on every read.
 *
 * Rounding: the discount is floored, never rounded or ceiled. Flooring can only
 * ever hand back slightly less than the advertised percentage, and promising
 * "20% off" while taking 20.002% off is the worse failure. Both operands are
 * whole fils, so `dueFils` stays exact — no float enters this path.
 */
export function computeFee(
  tier: FeeTier,
  prices: TierPrices,
  earlyBird: EarlyBirdConfig,
  now: Date = new Date(),
): FeeBreakdown {
  const baseFils = basePriceForTier(tier, prices);
  const active = isEarlyBirdActive(earlyBird, now);
  const percent = active ? clampPercent(earlyBird.earlyBirdPercent) : 0;
  const discountFils = Math.floor((baseFils * percent) / 100);

  return {
    tier,
    baseFils,
    discountFils,
    dueFils: baseFils - discountFils,
    earlyBirdApplied: active && discountFils > 0,
  };
}
