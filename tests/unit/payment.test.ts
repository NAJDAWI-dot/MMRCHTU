import { describe, expect, it } from "vitest";
import {
  FILS_PER_JOD,
  MAX_REFERENCE_LENGTH,
  PAYMENT_STATUSES,
  PAYMENT_STATUS_BLURB,
  PAYMENT_STATUS_LABELS,
  aliasTypeLabel,
  paymentActor,
  type PaymentActorSource,
  formatFils,
  hasPaymentErrors,
  isPaymentConfigured,
  isPaymentStatus,
  normaliseReference,
  parseAmountToFils,
  parsePayment,
  validatePayment,
  type CliqDetails,
} from "@/lib/payment";

describe("parseAmountToFils", () => {
  it("reads whole dinars", () => {
    expect(parseAmountToFils("35")).toBe(35 * FILS_PER_JOD);
  });

  it("reads fractions to three places, padding short ones", () => {
    expect(parseAmountToFils("35.5")).toBe(35_500);
    expect(parseAmountToFils("35.50")).toBe(35_500);
    expect(parseAmountToFils("35.500")).toBe(35_500);
    expect(parseAmountToFils("0.250")).toBe(250);
  });

  it("tolerates whitespace, separators and a currency suffix", () => {
    for (const input of [" 35 ", "35 JD", "35JD", "35 jd", "1,000"]) {
      expect(parseAmountToFils(input), input).not.toBeNull();
    }
    expect(parseAmountToFils("1,000")).toBe(1_000_000);
  });

  /**
   * A space is a thousands separator in plenty of the world, so interior
   * spaces are stripped rather than rejected. The cost of that choice is that
   * "3 5" reads as 35; the benefit is that "1 000" reads as a thousand, which
   * is a far more likely thing for someone to type.
   */
  it("treats a space inside a number as a thousands separator", () => {
    expect(parseAmountToFils("1 000")).toBe(1_000_000);
    expect(parseAmountToFils("3 5")).toBe(35 * FILS_PER_JOD);
  });

  /**
   * A phone keyboard set to Arabic types these without the person noticing,
   * and every naive numeric check rejects a perfectly valid amount.
   */
  it("reads Arabic-Indic digits", () => {
    expect(parseAmountToFils("٣٥")).toBe(35 * FILS_PER_JOD);
    expect(parseAmountToFils("۲۵")).toBe(25 * FILS_PER_JOD);
  });

  it("refuses what it cannot read rather than guessing zero", () => {
    for (const input of ["", "   ", "abc", "35.5.5", "-35", "35.1234", "1e3", "35..5"]) {
      expect(parseAmountToFils(input), input).toBeNull();
    }
  });

  it("refuses nonsense magnitudes", () => {
    expect(parseAmountToFils("0")).toBeNull();
    expect(parseAmountToFils("999999")).toBeNull();
  });
});

describe("formatFils", () => {
  it("drops the decimal part when there is none", () => {
    expect(formatFils(35 * FILS_PER_JOD)).toBe("35 JD");
  });

  it("keeps significant fractional digits without trailing zeros", () => {
    expect(formatFils(35_500)).toBe("35.5 JD");
    expect(formatFils(35_050)).toBe("35.05 JD");
    expect(formatFils(35_001)).toBe("35.001 JD");
  });

  it("round-trips whatever parse produced", () => {
    for (const input of ["35", "25.5", "15.250"]) {
      const fils = parseAmountToFils(input)!;
      expect(parseAmountToFils(formatFils(fils))).toBe(fils);
    }
  });
});

describe("normaliseReference", () => {
  it("uppercases and strips the spaces banks print", () => {
    expect(normaliseReference("cliq ref 12ab-34")).toBe("CLIQREF12AB-34");
  });

  it("keeps hyphens, which are part of many references", () => {
    expect(normaliseReference("ABC-123")).toBe("ABC-123");
  });

  it("matches the same payment reported two different ways", () => {
    expect(normaliseReference(" ftx 99 88 ")).toBe(normaliseReference("FTX-9988".replace("-", "")));
  });

  it("caps the length so a paste of a whole receipt cannot fill the column", () => {
    expect(normaliseReference("A".repeat(200))).toHaveLength(MAX_REFERENCE_LENGTH);
  });

  it("returns empty for input with nothing usable in it", () => {
    expect(normaliseReference("   ")).toBe("");
    expect(normaliseReference("!!!")).toBe("");
  });
});

describe("validatePayment", () => {
  /**
   * Reporting a payment is optional: a team may register now and transfer
   * later, and blocking the form on a bank transfer would lose entries.
   */
  it("accepts an entirely empty report", () => {
    expect(validatePayment({})).toEqual({});
    expect(validatePayment({ reference: "", amount: "" })).toEqual({});
    expect(validatePayment({ reference: "  ", amount: "  " })).toEqual({});
  });

  /**
   * But half a report cannot be reconciled against a statement, so once either
   * field is filled the other becomes required.
   */
  it("requires the amount once a reference is given", () => {
    const errors = validatePayment({ reference: "FT12345" });
    expect(errors.amount).toBeTruthy();
    expect(errors.reference).toBeUndefined();
  });

  it("requires the reference once an amount is given", () => {
    const errors = validatePayment({ amount: "35" });
    expect(errors.reference).toBeTruthy();
  });

  it("rejects a reference too short to be real", () => {
    expect(validatePayment({ reference: "AB", amount: "35" }).reference).toBeTruthy();
  });

  it("rejects an unreadable amount", () => {
    expect(validatePayment({ reference: "FT12345", amount: "thirty five" }).amount).toBeTruthy();
  });

  it("accepts a complete, well-formed report", () => {
    expect(validatePayment({ reference: "FT-123456", amount: "25.500" })).toEqual({});
  });

  it("hasPaymentErrors agrees with the object it is given", () => {
    expect(hasPaymentErrors({})).toBe(false);
    expect(hasPaymentErrors({ amount: "nope" })).toBe(true);
  });
});

describe("parsePayment", () => {
  it("normalises both fields together", () => {
    expect(parsePayment({ reference: " ft 123 456 ", amount: "25.5" })).toEqual({
      reference: "FT123456",
      amountFils: 25_500,
      submitted: true,
    });
  });

  it("reports nothing submitted when the team left it blank", () => {
    expect(parsePayment({})).toEqual({ reference: null, amountFils: null, submitted: false });
  });

  it("is not submitted unless both halves are present", () => {
    expect(parsePayment({ reference: "FT123456" }).submitted).toBe(false);
    expect(parsePayment({ amount: "25" }).submitted).toBe(false);
  });
});

describe("payment status", () => {
  it("recognises only the statuses it defines", () => {
    for (const status of PAYMENT_STATUSES) expect(isPaymentStatus(status)).toBe(true);
    for (const bad of ["paid", "", null, undefined, 1, "PENDING"]) {
      expect(isPaymentStatus(bad)).toBe(false);
    }
  });

  it("labels and explains every status", () => {
    for (const status of PAYMENT_STATUSES) {
      expect(PAYMENT_STATUS_LABELS[status]).toBeTruthy();
      expect(PAYMENT_STATUS_BLURB[status]).toBeTruthy();
    }
  });

  /** Registration status must not be mistaken for payment status. */
  it("does not overlap with the registration statuses", () => {
    for (const registration of ["PENDING", "CONFIRMED", "WAITLISTED", "CANCELLED"]) {
      expect(isPaymentStatus(registration)).toBe(false);
    }
  });
});

describe("isPaymentConfigured", () => {
  const base: CliqDetails = {
    paymentEnabled: true,
    cliqAlias: "MMRC26",
    cliqAliasType: "ALIAS",
    cliqBankName: "Bank",
    cliqAccountName: "IEEE RAS HTU",
    paymentNote: "",
  };

  it("is configured once switched on with an alias", () => {
    expect(isPaymentConfigured(base)).toBe(true);
  });

  /**
   * The alias cannot be guessed or defaulted, and a panel showing a blank one
   * would send transfers into the void — so it gates the whole section.
   */
  it("is not configured without an alias, however else it is filled in", () => {
    expect(isPaymentConfigured({ ...base, cliqAlias: "" })).toBe(false);
    expect(isPaymentConfigured({ ...base, cliqAlias: "   " })).toBe(false);
  });

  it("stays hidden while switched off", () => {
    expect(isPaymentConfigured({ ...base, paymentEnabled: false })).toBe(false);
  });
});

describe("aliasTypeLabel", () => {
  it("names each kind the way a banking app does", () => {
    expect(aliasTypeLabel("MOBILE")).toBe("Mobile number");
    expect(aliasTypeLabel("ALIAS")).toBe("CliQ alias");
  });

  it("falls back to alias for anything unexpected", () => {
    expect(aliasTypeLabel("")).toBe("CliQ alias");
  });
});

/**
 * Who last touched a payment.
 *
 * The verified-only columns are deliberately cleared when a verification is
 * withdrawn, which is correct for what they mean and useless for the question
 * an admin asks most: who decided this one was not a match. These assertions
 * pin down that every status now carries an actor, and that rows changed
 * before the columns existed degrade to something honest rather than to a
 * blank that reads as "nobody did it".
 */
describe("paymentActor", () => {
  const row = (overrides: Partial<PaymentActorSource> = {}): PaymentActorSource => ({
    paymentStatus: "VERIFIED",
    paymentStatusBy: null,
    paymentStatusAt: null,
    paymentVerifiedBy: null,
    paymentVerifiedAt: null,
    ...overrides,
  });

  const changedOn = new Date(Date.UTC(2026, 8, 5, 12, 0, 0));

  it("names the admin who set the current status, whatever it is", () => {
    const actor = paymentActor(
      row({ paymentStatus: "REJECTED", paymentStatusBy: "hatem", paymentStatusAt: changedOn }),
    );
    expect(actor).toEqual({ label: "Marked Not matched", who: "hatem", at: changedOn });
  });

  it("labels each status in its own words", () => {
    const labelFor = (paymentStatus: string) =>
      paymentActor(row({ paymentStatus, paymentStatusBy: "sara", paymentStatusAt: changedOn }))?.label;

    expect(labelFor("UNPAID")).toBe("Marked Not paid");
    expect(labelFor("SUBMITTED")).toBe("Marked Awaiting check");
    expect(labelFor("VERIFIED")).toBe("Marked Paid");
    expect(labelFor("REJECTED")).toBe("Marked Not matched");
  });

  it("falls back to the older verified-only columns for rows that predate this", () => {
    const actor = paymentActor(
      row({ paymentStatus: "VERIFIED", paymentVerifiedBy: "hatem", paymentVerifiedAt: changedOn }),
    );
    expect(actor).toEqual({ label: "Marked Paid", who: "hatem", at: changedOn });
  });

  it("does not use the verified columns for a status that is no longer verified", () => {
    // A row rejected after having been verified: the old columns were cleared
    // on the way through, so there is nothing to fall back to and nothing to
    // claim. Reporting the previous verifier here would be actively wrong.
    expect(paymentActor(row({ paymentStatus: "REJECTED" }))).toBeNull();
  });

  it("returns null when nothing at all was recorded", () => {
    expect(paymentActor(row({ paymentStatus: "UNPAID" }))).toBeNull();
  });

  it("reports a recorded time with no name rather than hiding the change", () => {
    const actor = paymentActor(row({ paymentStatus: "SUBMITTED", paymentStatusAt: changedOn }));
    expect(actor).toEqual({ label: "Marked Awaiting check", who: null, at: changedOn });
  });

  it("does not fall over on a status the schema does not know", () => {
    const actor = paymentActor(
      row({ paymentStatus: "WHAT", paymentStatusBy: "hatem", paymentStatusAt: changedOn }),
    );
    expect(actor?.label).toBe("Last changed");
  });
});
