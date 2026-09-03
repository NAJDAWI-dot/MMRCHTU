import { describe, expect, it } from "vitest";
import { EARLY_BIRD_LABEL_AR, earlyBirdState } from "@/lib/early-bird";
import type { EarlyBirdConfig } from "@/lib/pricing";

const CUTOFF = new Date("2026-09-01T00:00:00.000Z");
const BEFORE = new Date("2026-08-31T23:59:59.000Z");
const AFTER = new Date("2026-09-01T00:00:01.000Z");

const RUNNING: EarlyBirdConfig = {
  earlyBirdEnabled: true,
  earlyBirdPercent: 20,
  earlyBirdCutoff: CUTOFF,
};

describe("earlyBirdState", () => {
  it("reports the terms while the offer is running", () => {
    const state = earlyBirdState(RUNNING, BEFORE);

    expect(state.active).toBe(true);
    // Narrowed by the check above; the union is what makes this safe to read.
    if (!state.active) throw new Error("unreachable");
    expect(state.percent).toBe(20);
    expect(state.cutoff).toEqual(CUTOFF);
  });

  it("is inactive once the cutoff has passed", () => {
    expect(earlyBirdState(RUNNING, AFTER)).toEqual({ active: false });
  });

  it("is inactive while the kill switch is off, whatever else is configured", () => {
    // The case that matters commercially: a discount can be set up in advance,
    // and nothing about it may reach the site before it is switched on.
    const state = earlyBirdState({ ...RUNNING, earlyBirdEnabled: false }, BEFORE);

    expect(state).toEqual({ active: false });
    // The union is the guarantee — there is no percentage to read at all, so a
    // surface cannot print one by forgetting to check the flag first.
    expect("percent" in state).toBe(false);
  });

  it("is inactive with no cutoff set, rather than running forever", () => {
    expect(earlyBirdState({ ...RUNNING, earlyBirdCutoff: null }, BEFORE)).toEqual({
      active: false,
    });
  });

  it("is inactive at nought percent, so the banner never promises nothing", () => {
    expect(earlyBirdState({ ...RUNNING, earlyBirdPercent: 0 }, BEFORE)).toEqual({
      active: false,
    });
  });

  it("advertises the word the promotion was signed off with", () => {
    // Cheap, and it catches a paste that swaps in a visually similar string —
    // the letters here are easy to transpose and nobody reviewing English
    // diffs would notice.
    expect(EARLY_BIRD_LABEL_AR).toBe("تخفيضات");
  });
});
