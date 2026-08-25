# CliQ Payment Portal Implementation Plan

> **SUPERSEDED — do not implement.** Written but never executed. Replaced on
> 2026-08-25 by a two-stage registration flow: payment lives inside `/register`
> rather than a `/payment/[code]` portal, priced by one team-wide membership
> tier with an optional early-bird percentage discount. Ignore the tasks below.
> The one mechanism carried forward is the short-code generator, re-scoped as a
> resume code for `/register?code=`.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move CliQ payment out of the register form into its own portal — a
team gets a short payment code at registration, uses it at `/payment/[code]`
to see CliQ details, report a transfer with an optional screenshot, and get
a WhatsApp deep link to send proof — with a new admin **Payments** tab
owning all of it.

**Architecture:** A Next.js 14 App Router feature split across public pages
(`/register`, `/payment`, `/payment/[code]`) and one admin page
(`/admin/payments`), backed by two Prisma models (`Registration` gains a
`paymentCode` + screenshot fields; a new `PaymentConfig` singleton replaces
the CliQ fields currently on `RegisterFormConfig`). Business logic (code
generation, amount/reference parsing, WhatsApp link building) lives in
framework-free `src/lib` modules, unit-tested directly; page-level behaviour
is verified with Playwright, matching how the rest of this codebase is
tested.

**Tech Stack:** Next.js 14 (App Router, Server Actions), Prisma + Postgres,
Vitest, Playwright, `@vercel/blob` (already a dependency, via the existing
`src/lib/photo-storage.ts`).

**Spec:** `docs/superpowers/specs/2026-08-22-cliq-payment-portal-design.md`

## Global Constraints

- Branch `feat/cliq-payment` stays **unmerged** — do not merge or push to
  `master` as part of this plan.
- Money is stored in fils (integers), never floats. `FILS_PER_JOD = 1000`.
- `PaymentStatus` (`UNPAID`/`SUBMITTED`/`VERIFIED`/`REJECTED`) stays
  completely separate from `RegistrationStatus`
  (`PENDING`/`CONFIRMED`/`WAITLISTED`/`CANCELLED`) — never let one action
  update both.
- Reuse existing infrastructure rather than re-implementing it: rate
  limiting via `src/lib/rate-limit.ts`, image upload validation via
  `ALLOWED_IMAGE_TYPES`/`MAX_UPLOAD_BYTES`/`checkUpload` in
  `src/lib/gallery.ts`, storage via `src/lib/photo-storage.ts`. This means
  the proof-screenshot cap is the same 4 MB the gallery uses, not the 8 MB
  the spec first floated — the existing constant wins over inventing a new
  one.
- No automated WhatsApp sending — `wa.me` deep link only, per the approved
  design.
- Every schema/migration change is verified against a throwaway Docker
  Postgres, never the developer's real `DATABASE_URL` in `.env`.

---

## Task 1: Schema and migration

**Files:**
- Modify: `prisma/schema.prisma`
- Delete: `prisma/migrations/20260821174556_cliq_payment/` (folder)
- Create: a new migration folder under `prisma/migrations/` (name it
  `payment_portal`; Prisma will prefix it with a timestamp)

**Interfaces:**
- Produces: `Registration.paymentCode` (`String`, unique),
  `Registration.paymentScreenshotUrl` / `paymentScreenshotKey`
  (`String?`); a new `PaymentConfig` model with fields
  `paymentEnabled`, `cliqAlias`, `cliqAliasType`, `cliqBankName`,
  `cliqAccountName`, `paymentNote`, `whatsappNumber`,
  `whatsappContactName`, `updatedAt`. `RegisterFormConfig` loses
  `paymentEnabled`/`cliqAlias`/`cliqAliasType`/`cliqBankName`/
  `cliqAccountName`/`paymentNote`.

This branch's existing `20260821174556_cliq_payment` migration was only
ever applied to throwaway Docker Postgres instances — never to a real
deployment — so it is deleted and replaced with one clean migration
reflecting the final shape, rather than laying a revert-and-redo on top of
it.

- [ ] **Step 1: Remove the old migration folder**

```bash
git rm -r prisma/migrations/20260821174556_cliq_payment
```

- [ ] **Step 2: Edit the schema**

In `prisma/schema.prisma`, change the `Registration` model's payment block
from:

```prisma
  /// Payment is tracked separately from `status`: a team can be CONFIRMED on
  /// merit while its fee is still outstanding, and refusing a payment must not
  /// silently cancel a registration. See PaymentStatus in src/lib/payment.ts.
  paymentStatus      String    @default("UNPAID")
  /// The CliQ transaction reference the team reports, normalised on the way in.
  paymentReference   String?
  /// Stored in fils (1 JOD = 1000) so money is never a float.
  paymentAmountFils  Int?
  paymentSubmittedAt DateTime?
  paymentVerifiedAt  DateTime?
  /// Admin-facing: why a payment was refused, or any reconciliation note.
  paymentNote        String?
```

to:

```prisma
  /// Payment is tracked separately from `status`: a team can be CONFIRMED on
  /// merit while its fee is still outstanding, and refusing a payment must not
  /// silently cancel a registration. See PaymentStatus in src/lib/payment.ts.
  paymentStatus      String    @default("UNPAID")
  /// Short code (see src/lib/payment-code.ts) a team uses to find this
  /// registration at /payment/[code] without an account.
  paymentCode        String    @unique
  /// The CliQ transaction reference the team reports, normalised on the way in.
  paymentReference   String?
  /// Stored in fils (1 JOD = 1000) so money is never a float.
  paymentAmountFils  Int?
  paymentSubmittedAt DateTime?
  paymentVerifiedAt  DateTime?
  /// Admin-facing: why a payment was refused, or any reconciliation note.
  paymentNote        String?
  /// Where the team's uploaded proof screenshot lives, if they gave one.
  /// Same shape as GalleryPhoto.url/storageKey — see src/lib/photo-storage.ts.
  paymentScreenshotUrl String?
  paymentScreenshotKey String?
```

Replace the `RegisterFormConfig` model's payment block:

```prisma
  /// CliQ payment details, all admin-supplied.
  ///
  /// Off by default and blank: nobody but the committee knows the chapter's
  /// alias, and a payment panel showing a placeholder would send money to
  /// nowhere. The register page shows nothing until this is filled in and
  /// switched on.
  paymentEnabled  Boolean @default(false)
  cliqAlias       String  @default("")
  /// ALIAS or MOBILE — banking apps ask which kind of CliQ identifier this is.
  cliqAliasType   String  @default("ALIAS")
  cliqBankName    String  @default("")
  cliqAccountName String  @default("")
  /// Anything else the team needs to know, shown under the details.
  paymentNote     String  @default("")

  updatedAt DateTime @updatedAt
}
```

with just:

```prisma
  updatedAt DateTime @updatedAt
}
```

(i.e. delete that whole payment block from `RegisterFormConfig`, leaving
`deadlineText`/`deadlineDate`/`feeInfoText`/`isOpen`/`updatedAt` as it was
before this branch touched it).

Add a new model, placed after `RegisterFormConfig`:

```prisma
// Singleton row (id is always "singleton") holding the CliQ payment portal's
// admin-editable configuration. Its own model rather than fields on
// RegisterFormConfig: payment is reachable long after registration closes,
// so it is not a register-form concern.
model PaymentConfig {
  id String @id @default("singleton")

  /// Off by default and blank: nobody but the committee knows the chapter's
  /// alias or the WhatsApp number proofs go to, and a portal showing a
  /// placeholder would send transfers nowhere. The payment portal shows
  /// nothing until this is filled in (alias AND WhatsApp number) and
  /// switched on. See isPaymentConfigured in src/lib/payment.ts.
  paymentEnabled  Boolean @default(false)
  cliqAlias       String  @default("")
  /// ALIAS or MOBILE — banking apps ask which kind of CliQ identifier this is.
  cliqAliasType   String  @default("ALIAS")
  cliqBankName    String  @default("")
  cliqAccountName String  @default("")
  /// Anything else the team needs to know, shown under the details.
  paymentNote     String  @default("")

  /// Where a team sends their proof-of-payment screenshot. A wa.me deep
  /// link, not the WhatsApp Business API — see the design spec for why.
  whatsappNumber       String @default("")
  whatsappContactName  String @default("")

  updatedAt DateTime @updatedAt
}
```

- [ ] **Step 3: Start a throwaway Postgres and apply migrations up to (not including) the deleted one**

```bash
docker run --rm -d --name mmrc-plan-db -e POSTGRES_PASSWORD=postgres -p 55437:5432 postgres:16
```

Wait a few seconds for it to accept connections, then in a shell with these
env vars set for the rest of this task:

```bash
export DATABASE_URL="postgresql://postgres:postgres@localhost:55437/postgres"
export DIRECT_URL="postgresql://postgres:postgres@localhost:55437/postgres"
npx prisma migrate deploy
```

Expected: applies `20260818000000_init` and `20260820000000_countdown_and_gallery`
only (the third migration folder no longer exists).

- [ ] **Step 4: Generate the new migration from the edited schema**

```bash
npx prisma migrate dev --name payment_portal
```

Expected: Prisma prints a migration plan touching only `Registration`
(add `paymentCode`, `paymentScreenshotUrl`, `paymentScreenshotKey`) and
`CREATE TABLE "PaymentConfig"` — no `RegisterFormConfig` changes should
appear, because this throwaway database never had the CliQ columns applied
to `RegisterFormConfig` in the first place. If a `DROP COLUMN` on
`RegisterFormConfig` shows up, the old migration folder deletion in Step 1
did not take, or `migrate deploy` was run against a database that already
had it — stop and re-check before applying.

- [ ] **Step 5: Verify the new shape with a throwaway script**

Create a temporary file (not committed) `tmp-verify-schema.mjs`:

```js
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const reg = await prisma.registration.create({
  data: {
    teamName: "Schema Check",
    submitterEmail: "check@example.com",
    memberCount: 1,
    technicalExperience: "n/a",
    motivation: "n/a",
    paymentCode: "TEST01",
    members: { create: [{ order: 1, firstName: "A", lastName: "B", email: "a@b.com", whatsapp: "1", university: "U", major: "M", ieeeStatus: "NON_MEMBER", ieeeMembershipId: "Non-Member" }] },
  },
});
console.log("Registration OK:", reg.paymentCode, reg.paymentScreenshotUrl);

const config = await prisma.paymentConfig.upsert({
  where: { id: "singleton" },
  update: {},
  create: { id: "singleton", whatsappNumber: "+962700000000" },
});
console.log("PaymentConfig OK:", config.whatsappNumber);

await prisma.$disconnect();
```

Run: `node tmp-verify-schema.mjs`
Expected: prints both OK lines with no errors. Then delete the file — it is
throwaway, not part of the plan's deliverables.

- [ ] **Step 6: Regenerate the Prisma client and tear down the database**

```bash
npx prisma generate
docker stop mmrc-plan-db
```

(The container was started with `--rm`, so stopping it removes it too.)
Unset `DATABASE_URL`/`DIRECT_URL` so later tasks don't accidentally point at
a database that no longer exists.

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "Move CliQ config off RegisterFormConfig and add the payment portal schema"
```

---

## Task 2: Payment code generation

**Files:**
- Create: `src/lib/payment-code.ts`
- Test: `tests/unit/payment-code.test.ts`

**Interfaces:**
- Produces: `PAYMENT_CODE_ALPHABET`, `PAYMENT_CODE_LENGTH`,
  `generatePaymentCode(random?: () => number): string`,
  `isValidPaymentCodeFormat(value: string): boolean`,
  `normalisePaymentCode(raw: string): string`,
  `createUniquePaymentCode(exists: (code: string) => Promise<boolean>, attempts?: number): Promise<string>`
  — consumed by Task 5 (`registration.ts`) and Task 8 (`/payment` lookup).

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/payment-code.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import {
  PAYMENT_CODE_ALPHABET,
  PAYMENT_CODE_LENGTH,
  createUniquePaymentCode,
  generatePaymentCode,
  isValidPaymentCodeFormat,
  normalisePaymentCode,
} from "@/lib/payment-code";

describe("generatePaymentCode", () => {
  it("produces a code of the expected length from the expected alphabet", () => {
    const code = generatePaymentCode();
    expect(code).toHaveLength(PAYMENT_CODE_LENGTH);
    for (const char of code) expect(PAYMENT_CODE_ALPHABET).toContain(char);
  });

  it("excludes characters that are easy to misread", () => {
    for (let i = 0; i < 200; i++) {
      expect(generatePaymentCode()).not.toMatch(/[01OIL]/);
    }
  });
});

describe("isValidPaymentCodeFormat", () => {
  it("accepts a well-formed code", () => {
    expect(isValidPaymentCodeFormat(generatePaymentCode())).toBe(true);
  });

  it("rejects the wrong length, lowercase, and excluded characters", () => {
    expect(isValidPaymentCodeFormat("ABC")).toBe(false);
    expect(isValidPaymentCodeFormat("abcdef")).toBe(false);
    expect(isValidPaymentCodeFormat("ABCD0I")).toBe(false);
  });
});

describe("normalisePaymentCode", () => {
  it("uppercases and strips anything that is not alphanumeric", () => {
    expect(normalisePaymentCode(" a2-3k 4 ")).toBe("A23K4");
  });
});

describe("createUniquePaymentCode", () => {
  it("returns a code immediately when there is no collision", async () => {
    const exists = vi.fn().mockResolvedValue(false);
    const code = await createUniquePaymentCode(exists);
    expect(isValidPaymentCodeFormat(code)).toBe(true);
    expect(exists).toHaveBeenCalledTimes(1);
  });

  it("retries past a collision", async () => {
    const exists = vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const code = await createUniquePaymentCode(exists);
    expect(isValidPaymentCodeFormat(code)).toBe(true);
    expect(exists).toHaveBeenCalledTimes(2);
  });

  it("gives up after the attempt limit", async () => {
    const exists = vi.fn().mockResolvedValue(true);
    await expect(createUniquePaymentCode(exists, 3)).rejects.toThrow(/3 attempts/);
    expect(exists).toHaveBeenCalledTimes(3);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/unit/payment-code.test.ts`
Expected: FAIL — `Cannot find module '@/lib/payment-code'`.

- [ ] **Step 3: Implement**

Create `src/lib/payment-code.ts`:

```ts
/**
 * Short codes teams use to find their payment status without an account.
 *
 * The alphabet excludes 0/O and 1/I/L: characters a phone camera, a tired
 * volunteer, or a bank app screenshot can turn into each other. Six
 * characters from a 32-symbol alphabet is over a billion combinations —
 * collisions are a formality to guard against, not a real risk.
 */
export const PAYMENT_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const PAYMENT_CODE_LENGTH = 6;

const FORMAT_RE = new RegExp(`^[${PAYMENT_CODE_ALPHABET}]{${PAYMENT_CODE_LENGTH}}$`);

export function generatePaymentCode(random: () => number = Math.random): string {
  let code = "";
  for (let i = 0; i < PAYMENT_CODE_LENGTH; i++) {
    code += PAYMENT_CODE_ALPHABET[Math.floor(random() * PAYMENT_CODE_ALPHABET.length)];
  }
  return code;
}

/** True only for a code shaped exactly like one this module generates. */
export function isValidPaymentCodeFormat(value: string): boolean {
  return FORMAT_RE.test(value);
}

/**
 * Strips whatever a team typed down to the comparable form: uppercase,
 * alphanumeric only. A code that still fails `isValidPaymentCodeFormat`
 * after this is not a formatting slip — it is not a code this site issued.
 */
export function normalisePaymentCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * Generates a code guaranteed unique against `exists`, retrying on the
 * (extremely unlikely) collision. `exists` is injected so this stays free of
 * Prisma and testable without a database.
 */
export async function createUniquePaymentCode(
  exists: (code: string) => Promise<boolean>,
  attempts = 5,
): Promise<string> {
  for (let i = 0; i < attempts; i++) {
    const code = generatePaymentCode();
    if (!(await exists(code))) return code;
  }
  throw new Error(`Could not generate a unique payment code after ${attempts} attempts.`);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/payment-code.test.ts`
Expected: PASS, all tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/payment-code.ts tests/unit/payment-code.test.ts
git commit -m "Add payment code generation, formatting and uniqueness helpers"
```

---

## Task 3: Extend payment.ts for the portal

**Files:**
- Modify: `src/lib/payment.ts`
- Modify: `tests/unit/payment.test.ts`

**Interfaces:**
- Consumes: `formatFils` (already in this file).
- Produces: `WhatsAppContact` type, `PaymentPortalConfig` type,
  `isPaymentConfigured(config: PaymentPortalConfig): boolean` (signature
  change — now also requires `whatsappNumber`), `whatsappNumberDigits`,
  `buildWhatsappProofLink(whatsappNumber: string, message: string): string`,
  `buildProofMessage(args: { teamName: string; paymentCode: string; amountFils: number | null }): string`,
  `validatePayment(input: PaymentInput, options?: { required?: boolean }): PaymentFieldErrors`
  (signature change — new optional second parameter). Consumed by Task 9
  (`/payment/[code]`) and Task 10 (admin Payments page).

- [ ] **Step 1: Write the failing tests**

In `tests/unit/payment.test.ts`, update the `isPaymentConfigured` describe
block's fixture to include the WhatsApp fields, and add a test for the new
requirement:

```ts
describe("isPaymentConfigured", () => {
  const base: PaymentPortalConfig = {
    paymentEnabled: true,
    cliqAlias: "MMRC26",
    cliqAliasType: "ALIAS",
    cliqBankName: "Bank",
    cliqAccountName: "IEEE RAS HTU",
    paymentNote: "",
    whatsappNumber: "+962700000000",
    whatsappContactName: "Ahmad",
  };

  it("is configured once switched on with an alias and a WhatsApp number", () => {
    expect(isPaymentConfigured(base)).toBe(true);
  });

  it("is not configured without an alias, however else it is filled in", () => {
    expect(isPaymentConfigured({ ...base, cliqAlias: "" })).toBe(false);
    expect(isPaymentConfigured({ ...base, cliqAlias: "   " })).toBe(false);
  });

  it("is not configured without a WhatsApp number", () => {
    expect(isPaymentConfigured({ ...base, whatsappNumber: "" })).toBe(false);
  });

  it("stays hidden while switched off", () => {
    expect(isPaymentConfigured({ ...base, paymentEnabled: false })).toBe(false);
  });
});
```

Update the import line to add `type PaymentPortalConfig` (replacing
`type CliqDetails` in the import list — `CliqDetails` is still used
elsewhere in the file so keep both):

```ts
import {
  FILS_PER_JOD,
  MAX_REFERENCE_LENGTH,
  PAYMENT_STATUSES,
  PAYMENT_STATUS_BLURB,
  PAYMENT_STATUS_LABELS,
  aliasTypeLabel,
  buildProofMessage,
  buildWhatsappProofLink,
  formatFils,
  hasPaymentErrors,
  isPaymentConfigured,
  isPaymentStatus,
  normaliseReference,
  parseAmountToFils,
  parsePayment,
  validatePayment,
  whatsappNumberDigits,
  type CliqDetails,
  type PaymentPortalConfig,
} from "@/lib/payment";
```

Add new test blocks (anywhere after the existing `describe("aliasTypeLabel"...)` block):

```ts
describe("whatsappNumberDigits", () => {
  it("strips everything but digits", () => {
    expect(whatsappNumberDigits("+962 7-0000 0000")).toBe("9627000000" + "0");
  });
});

describe("buildWhatsappProofLink", () => {
  it("builds a wa.me link with the number digits-only and the message encoded", () => {
    const link = buildWhatsappProofLink("+962 700 000 000", "hello team");
    expect(link).toBe("https://wa.me/962700000000?text=hello%20team");
  });
});

describe("buildProofMessage", () => {
  it("includes the team, the code, and the amount when known", () => {
    const message = buildProofMessage({ teamName: "Maze Runners", paymentCode: "7F3K29", amountFils: 25_000 });
    expect(message).toContain("Maze Runners");
    expect(message).toContain("7F3K29");
    expect(message).toContain("25 JD");
  });

  it("omits the amount line when it is not known yet", () => {
    const message = buildProofMessage({ teamName: "Maze Runners", paymentCode: "7F3K29", amountFils: null });
    expect(message).not.toContain("Amount:");
  });
});
```

Add a test for `validatePayment`'s new `required` option inside the existing
`describe("validatePayment", ...)` block:

```ts
  it("requires both fields when told they are required, even if both are blank", () => {
    const errors = validatePayment({}, { required: true });
    expect(errors.reference).toBeTruthy();
    expect(errors.amount).toBeTruthy();
  });

  it("without the required option, an empty report is still fine", () => {
    expect(validatePayment({})).toEqual({});
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/unit/payment.test.ts`
Expected: FAIL — `whatsappNumberDigits`/`buildWhatsappProofLink`/
`buildProofMessage`/`PaymentPortalConfig` do not exist yet, and the
`isPaymentConfigured`/`validatePayment` behaviour changes are not yet
implemented.

- [ ] **Step 3: Implement**

In `src/lib/payment.ts`, change the `validatePayment` signature and its
first line:

```ts
export function validatePayment(
  input: PaymentInput,
  options: { required?: boolean } = {},
): PaymentFieldErrors {
  const rawReference = (input.reference ?? "").trim();
  const rawAmount = (input.amount ?? "").trim();
  const errors: PaymentFieldErrors = {};

  if (!rawReference && !rawAmount && !options.required) return errors;
```

(the rest of the function body is unchanged).

Replace the `isPaymentConfigured` block and everything below it (from
`export function isPaymentConfigured` to the end of the file) with:

```ts
export interface WhatsAppContact {
  whatsappNumber: string;
  whatsappContactName: string;
}

export type PaymentPortalConfig = CliqDetails & WhatsAppContact;

/**
 * Whether there is enough here to ask anyone for money.
 *
 * The alias and the WhatsApp number are both parts nothing can guess or
 * default — a panel showing either blank would send transfers nowhere, or
 * leave a team with no way to reach anyone about proof. The whole payment
 * portal stays hidden until an admin has filled in both and switched it on.
 */
export function isPaymentConfigured(config: PaymentPortalConfig): boolean {
  return (
    config.paymentEnabled &&
    config.cliqAlias.trim().length > 0 &&
    config.whatsappNumber.trim().length > 0
  );
}

export function aliasTypeLabel(value: string): string {
  return value === "MOBILE" ? "Mobile number" : "CliQ alias";
}

/** Mobile aliases are dialable; named aliases are not. */
export function isMobileAlias(value: string): boolean {
  return value === "MOBILE";
}

/** Strips everything but digits, so a number typed with +/spaces/dashes still forms a valid wa.me link. */
export function whatsappNumberDigits(raw: string): string {
  return raw.replace(/\D/g, "");
}

/** A `wa.me` link pre-addressed and pre-filled — WhatsApp has no way to attach the screenshot itself. */
export function buildWhatsappProofLink(whatsappNumber: string, message: string): string {
  return `https://wa.me/${whatsappNumberDigits(whatsappNumber)}?text=${encodeURIComponent(message)}`;
}

/** The message a team's WhatsApp opens with, prefilled so they only have to attach the screenshot and send. */
export function buildProofMessage(args: {
  teamName: string;
  paymentCode: string;
  amountFils: number | null;
}): string {
  const amountLine = args.amountFils !== null ? ` Amount: ${formatFils(args.amountFils)}.` : "";
  return `MMRC 26 payment proof — Team: ${args.teamName}. Payment code: ${args.paymentCode}.${amountLine} Screenshot attached.`;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/payment.test.ts`
Expected: PASS, all tests green (existing 33 plus the new ones).

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors from this file (other files that still reference
the old `isPaymentConfigured(CliqDetails)` shape will fail here — that is
expected and fixed in later tasks; if this is the *only* file changed so
far, ignore downstream errors from files this task doesn't touch and
proceed).

- [ ] **Step 6: Commit**

```bash
git add src/lib/payment.ts tests/unit/payment.test.ts
git commit -m "Require a WhatsApp number to enable payments; add wa.me link helpers"
```

---

## Task 4: PaymentConfig read access

**Files:**
- Modify: `src/lib/site-config.ts`

**Interfaces:**
- Consumes: `PaymentConfig` Prisma type (from Task 1).
- Produces: `getPaymentConfig(): Promise<PaymentConfig>`. Consumed by Task 9
  and Task 10.

No dedicated unit test for this file — it has none today (it is a thin,
two-line-per-function wrapper around Prisma, exercised through the pages
that call it, same as `getRegisterFormConfig` already is).

- [ ] **Step 1: Remove the CliQ fields from `REGISTER_FORM_FALLBACK` and add the new fallback + getter**

In `src/lib/site-config.ts`, change the import line:

```ts
import type { CompetitionDayConfig, PaymentConfig, RegisterFormConfig } from "@prisma/client";
```

Replace `REGISTER_FORM_FALLBACK`:

```ts
const REGISTER_FORM_FALLBACK: RegisterFormConfig = {
  id: SINGLETON_ID,
  deadlineText: "Registration closes soon — check back for the exact date.",
  deadlineDate: null,
  feeInfoText: "35 JD (non-member) / 25 JD (IEEE member) / 15 JD (IEEE RAS member) per team.",
  isOpen: true,
  updatedAt: NEVER_SAVED,
};

// Off until an admin fills the details in and switches it on — see
// isPaymentConfigured in src/lib/payment.ts, which gates on this shape.
const PAYMENT_CONFIG_FALLBACK: PaymentConfig = {
  id: SINGLETON_ID,
  paymentEnabled: false,
  cliqAlias: "",
  cliqAliasType: "ALIAS",
  cliqBankName: "",
  cliqAccountName: "",
  paymentNote: "",
  whatsappNumber: "",
  whatsappContactName: "",
  updatedAt: NEVER_SAVED,
};
```

Add the getter after `getRegisterFormConfig`:

```ts
export async function getPaymentConfig(): Promise<PaymentConfig> {
  const row = await prisma.paymentConfig.findUnique({ where: { id: SINGLETON_ID } });
  return row ?? PAYMENT_CONFIG_FALLBACK;
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors from `site-config.ts` itself (downstream call-site
errors in files not yet updated are expected at this point in the plan).

- [ ] **Step 3: Commit**

```bash
git add src/lib/site-config.ts
git commit -m "Add PaymentConfig read access alongside RegisterFormConfig"
```

---

## Task 5: Registration creates a payment code, no longer accepts payment input

**Files:**
- Modify: `src/lib/registration.ts`

**Interfaces:**
- Consumes: `createUniquePaymentCode` (Task 2).
- Produces: `RegistrationInput` no longer has a `payment` field;
  `createRegistration` returns a registration row whose `paymentCode` is
  populated. Consumed by Task 7 (register form/action/route) and Task 6
  (email).

- [ ] **Step 1: Edit the file**

In `src/lib/registration.ts`, change the imports:

```ts
import { prisma } from "@/lib/prisma";
import { sendRegistrationConfirmation } from "@/lib/email";
import { IEEE_STATUS_OPTIONS, type IeeeStatus } from "@/lib/ieee-status";
import { createUniquePaymentCode } from "@/lib/payment-code";
```

(drop the `parsePayment`/`PaymentInput` import from `@/lib/payment`
entirely — nothing in this file needs it anymore).

Remove the `payment?: PaymentInput` field and its doc comment from
`RegistrationInput`, leaving:

```ts
export interface RegistrationInput {
  teamName: string;
  submitterEmail: string;
  memberCount: number;
  technicalExperience: string;
  motivation: string;
  members: TeamMemberInput[];
}
```

Replace `createRegistration`:

```ts
export async function createRegistration(input: RegistrationInput) {
  const paymentCode = await createUniquePaymentCode((code) =>
    prisma.registration
      .findUnique({ where: { paymentCode: code }, select: { id: true } })
      .then((row) => row !== null),
  );

  return prisma.$transaction(async (tx) => {
    const registration = await tx.registration.create({
      data: {
        teamName: input.teamName.trim(),
        submitterEmail: input.submitterEmail.trim(),
        memberCount: input.memberCount,
        technicalExperience: input.technicalExperience.trim(),
        motivation: input.motivation.trim(),
        paymentCode,
        members: {
          create: input.members.map((member, i) => ({
            order: i + 1,
            firstName: member.firstName.trim(),
            lastName: member.lastName.trim(),
            email: member.email.trim(),
            whatsapp: member.whatsapp.trim(),
            university: member.university.trim(),
            major: member.major.trim(),
            ieeeStatus: member.ieeeStatus,
            ieeeMembershipId: member.ieeeMembershipId.trim(),
          })),
        },
      },
      include: { members: true },
    });

    await tx.counter.upsert({
      where: { key: "registrations" },
      update: { value: { increment: 1 } },
      create: { key: "registrations", value: 1 },
    });

    return registration;
  }).then(async (registration) => {
    await sendRegistrationConfirmation(registration.submitterEmail, {
      teamName: registration.teamName,
      paymentCode: registration.paymentCode,
      members: registration.members.map((m) => ({
        order: m.order,
        firstName: m.firstName,
        lastName: m.lastName,
        university: m.university,
        major: m.major,
      })),
    });
    return registration;
  });
}
```

`validateMember`/`validateRegistration`/`hasFieldErrors`/
`RegistrationValidationInput`/`TeamMemberFieldErrors`/`FieldErrors` are
unchanged.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: an error in `email-templates.ts`/`email.ts` about the new
`paymentCode` field not existing on `RegistrationConfirmationData` yet —
that's Task 6. Errors from `src/app/register/*` and `src/app/api/register/route.ts`
about the removed `payment` field are expected — that's Task 7.

- [ ] **Step 3: Commit**

```bash
git add src/lib/registration.ts
git commit -m "Generate a payment code at registration instead of collecting payment there"
```

---

## Task 6: Payment code in the confirmation email

**Files:**
- Modify: `src/lib/email-templates.ts`
- Test: `tests/unit/email-templates.test.ts` (new file)

**Interfaces:**
- Consumes: nothing new.
- Produces: `RegistrationConfirmationData` gains `paymentCode: string`.
  Consumed by Task 5 (already calling it with this field).

- [ ] **Step 1: Write the failing test**

Create `tests/unit/email-templates.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { registrationConfirmationEmail } from "@/lib/email-templates";

describe("registrationConfirmationEmail", () => {
  const data = {
    teamName: "Maze Runners",
    paymentCode: "7F3K29",
    members: [
      { order: 1, firstName: "Ada", lastName: "Lovelace", university: "UJ", major: "Computer Engineering" },
    ],
    siteUrl: "https://mmrc26.example",
  };

  it("includes the payment code and a link to that team's payment page", () => {
    const { html, text } = registrationConfirmationEmail(data);
    expect(html).toContain("7F3K29");
    expect(html).toContain("https://mmrc26.example/payment/7F3K29");
    expect(text).toContain("7F3K29");
    expect(text).toContain("https://mmrc26.example/payment/7F3K29");
  });

  it("escapes the team name in the HTML part", () => {
    const { html } = registrationConfirmationEmail({ ...data, teamName: "<script>alert(1)</script>" });
    expect(html).not.toContain("<script>alert(1)</script>");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/unit/email-templates.test.ts`
Expected: FAIL — type error / missing `paymentCode` field, and the HTML
does not yet contain the code.

- [ ] **Step 3: Implement**

In `src/lib/email-templates.ts`, add `paymentCode: string;` to
`RegistrationConfirmationData`:

```ts
export interface RegistrationConfirmationData {
  teamName: string;
  paymentCode: string;
  members: RegistrationConfirmationMember[];
  siteUrl: string;
}
```

In `registrationConfirmationEmail`, insert a new block right after the
existing team/members `<div>` and before the "What happens next?"
paragraph:

```ts
      <div style="margin:0 0 20px; padding:18px 20px; background-color:${SURFACE}; border:1px solid ${BORDER}; border-radius:10px;">
        <div style="font-size:11px; font-weight:600; color:${GRAY}; letter-spacing:0.12em; text-transform:uppercase;">Payment code</div>
        <p style="margin:2px 0 6px; font-size:20px; font-weight:800; letter-spacing:0.06em; color:${PURPLE};">${escapeHtml(data.paymentCode)}</p>
        <p style="margin:0; color:${GRAY};">
          Use this any time at ${escapeHtml(data.siteUrl)}/payment to see your fee status, get the CliQ
          details, and report a transfer.
        </p>
      </div>
```

Change the trailing button line from:

```ts
      ${button("View schedule", `${data.siteUrl}/schedule`)}
```

to:

```ts
      ${button("Pay your registration fee", `${data.siteUrl}/payment/${data.paymentCode}`)}
      ${button("View schedule", `${data.siteUrl}/schedule`)}
```

Update the plain-text version:

```ts
  const text = `You're registered for MMRC 26!\n\nTeam: ${data.teamName}\n\n${memberLines}\n\nYour payment code: ${data.paymentCode}\nCheck your fee status or pay: ${data.siteUrl}/payment/${data.paymentCode}\n\nApplications are screened on a rolling basis. Selected teams will be contacted for verification and fee payment.\n\nSchedule: ${data.siteUrl}/schedule`;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/unit/email-templates.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/email-templates.ts tests/unit/email-templates.test.ts
git commit -m "Include the payment code and portal link in the confirmation email"
```

---

## Task 7: Strip payment out of the register form

**Files:**
- Modify: `src/app/register/RegisterForm.tsx`
- Modify: `src/app/register/actions.ts`
- Modify: `src/app/register/page.tsx`
- Modify: `src/app/api/register/route.ts`

**Interfaces:**
- Consumes: `createRegistration` (Task 5, no longer takes `payment`).
- Produces: `RegisterActionState` drops `paymentErrors`/`paymentReported`,
  gains `paymentCode?: string`.

- [ ] **Step 1: Rewrite `src/app/register/RegisterForm.tsx`**

Remove the `CliqPanel` import, the `CliqDetails` type import, the `cliq`
prop, the "Already paid?" fieldset, and the `inputMode` prop from
`FieldProps` (it was only used by the now-removed payment-amount field).
The success branch now shows the payment code:

```tsx
"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { registerTeam, type RegisterActionState } from "@/app/register/actions";
import { Button } from "@/components/ui/Button";
import { IEEE_STATUS_OPTIONS } from "@/lib/ieee-status";
import type { TeamMemberFieldErrors } from "@/lib/registration";
import { UNIVERSITIES } from "@/lib/universities";

const initialState: RegisterActionState = { status: "idle" };

interface RegisterFormProps {
  feeInfoText: string;
}

export function RegisterForm({ feeInfoText }: RegisterFormProps) {
  const [state, formAction] = useFormState(registerTeam, initialState);
  const [memberCount, setMemberCount] = useState(1);

  if (state.status === "success" && state.paymentCode) {
    return (
      <div
        role="status"
        className="rounded-md border border-ras-purple/30 bg-ras-purple/5 p-6 text-ras-purple dark:text-white"
      >
        <p className="font-display text-lg font-bold">You&apos;re registered!</p>
        <p className="mt-1 text-sm">
          We&apos;ll email your team with next steps as the competition date approaches.
        </p>
        <div className="mt-4 rounded-md border border-ras-purple/20 bg-[var(--color-surface)] p-4">
          <p className="text-xs uppercase tracking-widest text-ras-gray dark:text-white/60">Payment code</p>
          <p className="mt-1 font-mono text-2xl font-bold tracking-widest text-ras-purple dark:text-white">
            {state.paymentCode}
          </p>
          <p className="mt-2 text-sm text-ras-gray dark:text-white/70">
            We&apos;ve emailed this to you too. Use it at{" "}
            <a href="/payment" className="font-semibold text-ras-purple underline dark:text-white">
              /payment
            </a>{" "}
            any time to see your fee status, get the CliQ details, and report a transfer.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} noValidate className="space-y-6">
      <p className="rounded-md bg-ras-purple/5 p-3 text-xs text-ras-gray dark:bg-white/5 dark:text-white/70">
        {feeInfoText}
      </p>

      <Field
        id="teamName"
        name="teamName"
        label="Team name"
        error={state.errors?.teamName}
        autoComplete="organization"
      />
      <Field
        id="submitterEmail"
        name="submitterEmail"
        type="email"
        label="Submitter email"
        error={state.errors?.submitterEmail}
        autoComplete="email"
      />

      <fieldset>
        <legend className="block text-sm font-medium text-ras-gray dark:text-white/80">
          How many members are in your team?
        </legend>
        <div className="mt-2 flex gap-4">
          {[1, 2, 3].map((n) => (
            <label key={n} className="flex min-h-[44px] items-center gap-2 text-sm text-ras-gray dark:text-white/80">
              <input
                type="radio"
                name="memberCount"
                value={n}
                checked={memberCount === n}
                onChange={() => setMemberCount(n)}
              />
              {n} member{n > 1 ? "s" : ""}
            </label>
          ))}
        </div>
        {state.errors?.memberCount ? (
          <p role="alert" className="mt-1 text-sm text-ras-crimson">
            {state.errors.memberCount}
          </p>
        ) : null}
      </fieldset>

      {Array.from({ length: memberCount }, (_, i) => (
        <MemberFields
          key={i}
          index={i + 1}
          isLeader={i === 0}
          errors={state.errors?.members?.[i]}
        />
      ))}

      <Field
        id="technicalExperience"
        name="technicalExperience"
        label="Briefly describe the technical experience of each member"
        error={state.errors?.technicalExperience}
        textarea
      />
      <Field
        id="motivation"
        name="motivation"
        label="What is your motivation to participate?"
        error={state.errors?.motivation}
        textarea
      />

      <SubmitButton />
    </form>
  );
}

interface MemberFieldsProps {
  index: number;
  isLeader: boolean;
  errors?: TeamMemberFieldErrors;
}

function MemberFields({ index, isLeader, errors }: MemberFieldsProps) {
  const prefix = `member${index}`;

  return (
    <fieldset className="rounded-lg border border-ras-gray/20 p-4">
      <legend className="px-1 font-display text-sm font-bold text-ras-purple dark:text-white">
        {isLeader ? "Team Leader" : `Member ${index}`}
      </legend>
      <div className="mt-2 grid gap-4 sm:grid-cols-2">
        <Field id={`${prefix}FirstName`} name={`${prefix}FirstName`} label="First name" error={errors?.firstName} />
        <Field id={`${prefix}LastName`} name={`${prefix}LastName`} label="Last name" error={errors?.lastName} />
        <Field
          id={`${prefix}Email`}
          name={`${prefix}Email`}
          type="email"
          label="Email"
          error={errors?.email}
        />
        <Field id={`${prefix}Whatsapp`} name={`${prefix}Whatsapp`} label="WhatsApp number" error={errors?.whatsapp} />
        <div>
          <label htmlFor={`${prefix}University`} className="block text-sm font-medium text-ras-gray dark:text-white/80">
            University
          </label>
          <select
            id={`${prefix}University`}
            name={`${prefix}University`}
            className="mt-1 w-full rounded-md border border-ras-gray/30 bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-fg)] focus:border-ras-purple focus:outline-none"
            defaultValue=""
          >
            <option value="" disabled>
              Select a university
            </option>
            {UNIVERSITIES.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
          {errors?.university ? (
            <p role="alert" className="mt-1 text-sm text-ras-crimson">
              {errors.university}
            </p>
          ) : null}
        </div>
        <Field id={`${prefix}Major`} name={`${prefix}Major`} label="Major" error={errors?.major} />
      </div>

      <div className="mt-4">
        <span className="block text-sm font-medium text-ras-gray dark:text-white/80">IEEE membership status</span>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:gap-4">
          {IEEE_STATUS_OPTIONS.map((opt) => (
            <label key={opt.value} className="flex min-h-[44px] items-center gap-2 text-sm text-ras-gray dark:text-white/80">
              <input type="radio" name={`${prefix}IeeeStatus`} value={opt.value} />
              {opt.label}
            </label>
          ))}
        </div>
        {errors?.ieeeStatus ? (
          <p role="alert" className="mt-1 text-sm text-ras-crimson">
            {errors.ieeeStatus}
          </p>
        ) : null}
      </div>

      <div className="mt-4">
        <Field
          id={`${prefix}IeeeMembershipId`}
          name={`${prefix}IeeeMembershipId`}
          label='IEEE membership ID (write "Non-Member" if not)'
          error={errors?.ieeeMembershipId}
        />
      </div>
    </fieldset>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Submitting…" : "Register team"}
    </Button>
  );
}

interface FieldProps {
  id: string;
  name: string;
  label: string;
  error?: string;
  type?: string;
  autoComplete?: string;
  textarea?: boolean;
}

function Field({ id, name, label, error, type = "text", textarea = false, ...rest }: FieldProps) {
  const errorId = `${id}-error`;
  const className =
    "mt-1 w-full rounded-md border border-ras-gray/30 bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-fg)] focus:border-ras-purple focus:outline-none";
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-ras-gray dark:text-white/80">
        {label}
      </label>
      {textarea ? (
        <textarea
          id={id}
          name={name}
          rows={3}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          className={className}
        />
      ) : (
        <input
          id={id}
          name={name}
          type={type}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          className={className}
          {...rest}
        />
      )}
      {error ? (
        <p id={errorId} role="alert" className="mt-1 text-sm text-ras-crimson">
          {error}
        </p>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 2: Rewrite `src/app/register/actions.ts`**

```ts
"use server";

import {
  createRegistration,
  validateRegistration,
  hasFieldErrors,
  type FieldErrors,
  type IeeeStatus,
  type TeamMemberInput,
} from "@/lib/registration";

export interface RegisterActionState {
  status: "idle" | "success" | "error";
  errors?: FieldErrors;
  /** Set on success so the confirmation screen can show it (it is also emailed). */
  paymentCode?: string;
}

function readMember(formData: FormData, index: number): Partial<TeamMemberInput> {
  return {
    firstName: String(formData.get(`member${index}FirstName`) ?? ""),
    lastName: String(formData.get(`member${index}LastName`) ?? ""),
    email: String(formData.get(`member${index}Email`) ?? ""),
    whatsapp: String(formData.get(`member${index}Whatsapp`) ?? ""),
    university: String(formData.get(`member${index}University`) ?? ""),
    major: String(formData.get(`member${index}Major`) ?? ""),
    ieeeStatus: String(formData.get(`member${index}IeeeStatus`) ?? "") as IeeeStatus,
    ieeeMembershipId: String(formData.get(`member${index}IeeeMembershipId`) ?? ""),
  };
}

export async function registerTeam(
  _prevState: RegisterActionState,
  formData: FormData,
): Promise<RegisterActionState> {
  const memberCount = Number(formData.get("memberCount") ?? 1);

  const input = {
    teamName: String(formData.get("teamName") ?? ""),
    submitterEmail: String(formData.get("submitterEmail") ?? ""),
    memberCount,
    technicalExperience: String(formData.get("technicalExperience") ?? ""),
    motivation: String(formData.get("motivation") ?? ""),
    members: Array.from({ length: memberCount }, (_, i) => readMember(formData, i + 1)) as TeamMemberInput[],
  };

  const errors = validateRegistration(input);
  if (hasFieldErrors(errors)) {
    return { status: "error", errors };
  }

  const registration = await createRegistration(input);

  return { status: "success", paymentCode: registration.paymentCode };
}
```

- [ ] **Step 3: Rewrite `src/app/register/page.tsx`**

```tsx
import type { Metadata } from "next";
import { RegisterForm } from "@/app/register/RegisterForm";
import { getRegisterFormConfig } from "@/lib/site-config";

// Only the form's configuration comes from the database, and closing
// registration revalidates this path immediately.
export const revalidate = 300;

export const metadata: Metadata = {
  title: "Register",
  description: "Register your team for MMRC 26.",
};

export default async function RegisterPage() {
  const config = await getRegisterFormConfig();

  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <h1 className="font-display text-3xl font-extrabold text-ras-purple dark:text-white">
        Register your team
      </h1>
      <p className="mt-2 text-sm text-ras-gray dark:text-white/70">{config.deadlineText}</p>
      <div className="mt-8">
        {config.isOpen ? (
          <RegisterForm feeInfoText={config.feeInfoText} />
        ) : (
          <div
            role="status"
            className="rounded-md border border-ras-gray/20 bg-ras-gray/5 p-6 text-sm text-ras-gray dark:text-white/70"
          >
            Registration is currently closed. Check back soon, or contact the organizing committee for more
            information.
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Rewrite `src/app/api/register/route.ts`**

```ts
import { NextResponse } from "next/server";
import { createRegistration, validateRegistration, hasFieldErrors } from "@/lib/registration";
import { clientKey, createRateLimiter } from "@/lib/rate-limit";

/**
 * Module scope, so the counter survives between requests handled by the same
 * instance. See rate-limit.ts for what that does and does not buy on
 * serverless.
 *
 * Five in ten minutes: comfortably more than a team fixing a typo and
 * resubmitting, far less than a script filling the table.
 */
const limiter = createRateLimiter({ limit: 5, windowMs: 10 * 60 * 1000 });

export async function POST(request: Request) {
  const limit = limiter.check(clientKey(request.headers));
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many registration attempts. Please wait a few minutes and try again." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)) },
      },
    );
  }

  const body = await request.json().catch(() => null);

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const errors = validateRegistration(body);
  if (hasFieldErrors(errors)) {
    return NextResponse.json({ errors }, { status: 422 });
  }

  const registration = await createRegistration({
    teamName: body.teamName,
    submitterEmail: body.submitterEmail,
    memberCount: Number(body.memberCount),
    technicalExperience: body.technicalExperience,
    motivation: body.motivation,
    members: body.members,
  });

  return NextResponse.json({ registration }, { status: 201 });
}
```

- [ ] **Step 5: Typecheck and run the existing registration tests**

Run: `npx tsc --noEmit`
Expected: no errors from any of the four files touched in this task.

Run: `npx vitest run tests/component/registration.test.ts`
Expected: PASS (this test only exercises `validateRegistration`, which is
untouched).

- [ ] **Step 6: Commit**

```bash
git add src/app/register/RegisterForm.tsx src/app/register/actions.ts src/app/register/page.tsx src/app/api/register/route.ts
git commit -m "Remove CliQ payment from the register form; registration only issues a payment code"
```

---

## Task 8: Payment code lookup page

**Files:**
- Create: `src/app/payment/page.tsx`
- Create: `src/app/payment/actions.ts`

**Interfaces:**
- Consumes: `normalisePaymentCode` (Task 2).
- Produces: `GET /payment` (the lookup form), `findPayment(formData)` server
  action that redirects to `/payment/[code]`.

- [ ] **Step 1: Create `src/app/payment/actions.ts`**

```ts
"use server";

import { redirect } from "next/navigation";
import { normalisePaymentCode } from "@/lib/payment-code";

export async function findPayment(formData: FormData) {
  const code = normalisePaymentCode(String(formData.get("code") ?? ""));
  // No existence check here: an unrecognised code is handled by the status
  // page itself, which already has to explain "we could not find that" for
  // a code that later stops matching (a typo corrected mid-visit, a reset
  // database in development).
  redirect(code ? `/payment/${code}` : "/payment");
}
```

- [ ] **Step 2: Create `src/app/payment/page.tsx`**

```tsx
import type { Metadata } from "next";
import { findPayment } from "@/app/payment/actions";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "Find your payment",
  description: "Look up your MMRC 26 team's registration fee status.",
};

export default function PaymentLookupPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="font-display text-3xl font-extrabold text-ras-purple dark:text-white">
        Find your payment
      </h1>
      <p className="mt-2 text-sm text-ras-gray dark:text-white/70">
        Enter the payment code from your registration confirmation email.
      </p>
      <form action={findPayment} className="mt-6 space-y-4">
        <div>
          <label htmlFor="code" className="block text-sm font-medium text-ras-gray dark:text-white/80">
            Payment code
          </label>
          <input
            id="code"
            name="code"
            required
            autoComplete="off"
            autoCapitalize="characters"
            className="mt-1 w-full rounded-md border border-ras-gray/30 bg-[var(--color-bg)] px-3 py-2 font-mono text-lg tracking-widest text-[var(--color-fg)] focus:border-ras-purple focus:outline-none"
            placeholder="7F3K29"
          />
        </div>
        <Button type="submit">Continue</Button>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors from these two files.

- [ ] **Step 4: Commit**

```bash
git add src/app/payment/page.tsx src/app/payment/actions.ts
git commit -m "Add the payment code lookup page"
```

---

## Task 9: Payment status + report page

**Files:**
- Create: `src/components/payment/PaymentBadge.tsx`
- Create: `src/app/payment/[code]/page.tsx`
- Create: `src/app/payment/[code]/actions.ts`
- Create: `src/components/payment/ReportPaymentForm.tsx`

**Interfaces:**
- Consumes: `getPaymentConfig`/`getRegisterFormConfig` (Task 4),
  `isPaymentConfigured`/`buildProofMessage`/`buildWhatsappProofLink`/
  `validatePayment`/`hasPaymentErrors`/`parsePayment`/`isPaymentStatus`/
  `PAYMENT_STATUS_LABELS`/`PAYMENT_STATUS_BLURB` (Task 3 and existing
  `payment.ts`), `normalisePaymentCode` (Task 2), `CliqPanel` (existing,
  unchanged), `checkUpload` (existing `src/lib/gallery.ts`), `storePhoto`
  (existing `src/lib/photo-storage.ts`), `clientKey`/`createRateLimiter`
  (existing `src/lib/rate-limit.ts`).
- Produces: `PaymentBadge` component (also consumed by Task 10's admin
  page and by the trimmed Registrations admin page).

- [ ] **Step 1: Create the shared badge component**

Create `src/components/payment/PaymentBadge.tsx`:

```tsx
import { PAYMENT_STATUS_LABELS, isPaymentStatus } from "@/lib/payment";

/** Colour carries the same meaning as the words, never instead of them. */
export function PaymentBadge({ status }: { status: string }) {
  const known = isPaymentStatus(status) ? status : "UNPAID";
  const tone =
    known === "VERIFIED"
      ? "bg-ras-purple/15 text-ras-purple dark:bg-white/15 dark:text-white"
      : known === "SUBMITTED"
        ? "bg-[#F2A900]/20 text-[#8a6200] dark:text-[#F2A900]"
        : known === "REJECTED"
          ? "bg-ras-crimson/15 text-ras-crimson dark:text-rose-300"
          : "bg-ras-gray/15 text-ras-gray dark:text-white/60";

  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${tone}`}>
      {PAYMENT_STATUS_LABELS[known]}
    </span>
  );
}
```

- [ ] **Step 2: Create the report-payment server action**

Create `src/app/payment/[code]/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { clientKey, createRateLimiter } from "@/lib/rate-limit";
import { checkUpload } from "@/lib/gallery";
import { storePhoto } from "@/lib/photo-storage";
import {
  hasPaymentErrors,
  parsePayment,
  validatePayment,
  type PaymentFieldErrors,
} from "@/lib/payment";

export interface ReportPaymentState {
  status: "idle" | "success" | "error";
  errors?: PaymentFieldErrors & { screenshot?: string };
}

/**
 * Five in ten minutes, the same budget as registration itself: enough for a
 * team fixing a typo, far less than a script probing codes.
 */
const limiter = createRateLimiter({ limit: 5, windowMs: 10 * 60 * 1000 });

export async function reportPayment(
  code: string,
  _prevState: ReportPaymentState,
  formData: FormData,
): Promise<ReportPaymentState> {
  const limit = limiter.check(clientKey(headers()));
  if (!limit.allowed) {
    return {
      status: "error",
      errors: { reference: "Too many attempts. Please wait a few minutes and try again." },
    };
  }

  const registration = await prisma.registration.findUnique({ where: { paymentCode: code } });
  if (!registration) {
    return { status: "error", errors: { reference: "We could not find that payment code." } };
  }

  const paymentInput = {
    reference: String(formData.get("reference") ?? ""),
    amount: String(formData.get("amount") ?? ""),
  };
  const errors: ReportPaymentState["errors"] = validatePayment(paymentInput, { required: true });

  const file = formData.get("screenshot");
  let screenshot: { url: string; key: string } | null = null;
  if (file instanceof File && file.size > 0) {
    const problem = checkUpload({ name: file.name, type: file.type, size: file.size });
    if (problem) {
      errors.screenshot = problem;
    } else {
      const ext = (file.name.match(/\.([a-zA-Z0-9]{1,5})$/)?.[1] ?? "jpg").toLowerCase();
      const key = `payment/${registration.paymentCode}/${Date.now().toString(36)}.${ext}`;
      screenshot = await storePhoto(key, file);
    }
  }

  if (hasPaymentErrors(errors)) {
    return { status: "error", errors };
  }

  const parsed = parsePayment(paymentInput);

  await prisma.registration.update({
    where: { id: registration.id },
    data: {
      paymentStatus: "SUBMITTED",
      paymentReference: parsed.reference,
      paymentAmountFils: parsed.amountFils,
      paymentSubmittedAt: new Date(),
      ...(screenshot ? { paymentScreenshotUrl: screenshot.url, paymentScreenshotKey: screenshot.key } : {}),
    },
  });

  revalidatePath(`/payment/${code}`);
  revalidatePath("/admin/payments");

  return { status: "success" };
}
```

- [ ] **Step 3: Create the report form client component**

Create `src/components/payment/ReportPaymentForm.tsx`:

```tsx
"use client";

import { useFormState, useFormStatus } from "react-dom";
import { reportPayment, type ReportPaymentState } from "@/app/payment/[code]/actions";
import { Button } from "@/components/ui/Button";

const initialState: ReportPaymentState = { status: "idle" };

export function ReportPaymentForm({ code }: { code: string }) {
  const boundAction = reportPayment.bind(null, code);
  const [state, formAction] = useFormState(boundAction, initialState);

  if (state.status === "success") {
    return (
      <div
        role="status"
        className="rounded-md border border-ras-purple/30 bg-ras-purple/5 p-4 text-sm text-ras-purple dark:text-white"
      >
        Thanks — we have your reference and are matching it against the account.
      </div>
    );
  }

  return (
    <form action={formAction} noValidate className="space-y-4 rounded-md border border-ras-gray/25 p-4">
      <p className="text-sm font-semibold text-ras-purple dark:text-white">Report your payment</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="reference" name="reference" label="CliQ transaction reference" error={state.errors?.reference} />
        <Field
          id="amount"
          name="amount"
          label="Amount transferred (JD)"
          inputMode="decimal"
          error={state.errors?.amount}
        />
      </div>
      <div>
        <label htmlFor="screenshot" className="block text-sm font-medium text-ras-gray dark:text-white/80">
          Screenshot of the transfer (optional)
        </label>
        <input
          id="screenshot"
          name="screenshot"
          type="file"
          accept="image/*"
          className="mt-1 w-full text-sm text-ras-gray dark:text-white/70"
        />
        {state.errors?.screenshot ? (
          <p role="alert" className="mt-1 text-sm text-ras-crimson">
            {state.errors.screenshot}
          </p>
        ) : null}
      </div>
      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Submitting…" : "Report payment"}
    </Button>
  );
}

interface FieldProps {
  id: string;
  name: string;
  label: string;
  error?: string;
  inputMode?: "text" | "decimal" | "numeric";
}

function Field({ id, name, label, error, ...rest }: FieldProps) {
  const errorId = `${id}-error`;
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-ras-gray dark:text-white/80">
        {label}
      </label>
      <input
        id={id}
        name={name}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        className="mt-1 w-full rounded-md border border-ras-gray/30 bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-fg)] focus:border-ras-purple focus:outline-none"
        {...rest}
      />
      {error ? (
        <p id={errorId} role="alert" className="mt-1 text-sm text-ras-crimson">
          {error}
        </p>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: Create the status page**

Create `src/app/payment/[code]/page.tsx`:

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getPaymentConfig, getRegisterFormConfig } from "@/lib/site-config";
import {
  PAYMENT_STATUS_BLURB,
  PAYMENT_STATUS_LABELS,
  buildProofMessage,
  buildWhatsappProofLink,
  isPaymentConfigured,
  isPaymentStatus,
  type PaymentStatus,
} from "@/lib/payment";
import { normalisePaymentCode } from "@/lib/payment-code";
import { CliqPanel } from "@/components/payment/CliqPanel";
import { ReportPaymentForm } from "@/components/payment/ReportPaymentForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Payment status",
};

export default async function PaymentStatusPage({ params }: { params: { code: string } }) {
  const code = normalisePaymentCode(params.code);
  const registration = code ? await prisma.registration.findUnique({ where: { paymentCode: code } }) : null;

  if (!registration) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-extrabold text-ras-purple dark:text-white">
          We couldn&apos;t find that code
        </h1>
        <p className="mt-2 text-sm text-ras-gray dark:text-white/70">
          Double-check the code from your confirmation email, or{" "}
          <Link href="/payment" className="font-semibold text-ras-purple underline dark:text-white">
            try again
          </Link>
          .
        </p>
      </div>
    );
  }

  const status: PaymentStatus = isPaymentStatus(registration.paymentStatus)
    ? registration.paymentStatus
    : "UNPAID";
  const [paymentConfig, registerFormConfig] = await Promise.all([
    getPaymentConfig(),
    getRegisterFormConfig(),
  ]);
  const configured = isPaymentConfigured(paymentConfig);
  const message = buildProofMessage({
    teamName: registration.teamName,
    paymentCode: registration.paymentCode,
    amountFils: registration.paymentAmountFils,
  });
  const whatsappHref = configured ? buildWhatsappProofLink(paymentConfig.whatsappNumber, message) : null;

  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <h1 className="font-display text-3xl font-extrabold text-ras-purple dark:text-white">
        {registration.teamName}
      </h1>
      <p className="mt-1 text-sm text-ras-gray dark:text-white/70">
        {PAYMENT_STATUS_LABELS[status]} &mdash; {PAYMENT_STATUS_BLURB[status]}
      </p>

      {status === "VERIFIED" ? (
        <div className="mt-6 rounded-md border border-ras-purple/30 bg-ras-purple/5 p-6 text-ras-purple dark:text-white">
          <p className="font-display text-lg font-bold">Your fee is paid. Nothing further to do.</p>
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {configured ? (
            <CliqPanel config={paymentConfig} feeInfoText={registerFormConfig.feeInfoText} />
          ) : (
            <p className="rounded-md bg-ras-purple/5 p-3 text-xs text-ras-gray dark:bg-white/5 dark:text-white/70">
              Payment details are not published yet — check back soon.
            </p>
          )}

          {status === "REJECTED" && registration.paymentNote ? (
            <p className="rounded-md border border-ras-crimson/30 bg-ras-crimson/5 p-3 text-sm text-ras-crimson">
              {registration.paymentNote}
            </p>
          ) : null}

          {configured ? (
            <>
              <ReportPaymentForm code={registration.paymentCode} />
              {whatsappHref ? (
                <div>
                  <a
                    href={whatsappHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-[44px] items-center justify-center rounded-md bg-[#25D366] px-4 py-2 text-sm font-semibold text-white transition-colors hover:brightness-95"
                  >
                    Send proof on WhatsApp
                    {paymentConfig.whatsappContactName ? ` to ${paymentConfig.whatsappContactName}` : ""}
                  </a>
                  <p className="mt-2 text-xs text-ras-gray dark:text-white/60">
                    This opens WhatsApp with a message ready to go — attach your screenshot yourself
                    before sending, since a link can&apos;t carry an image.
                  </p>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors from any file created in this task.

- [ ] **Step 6: Manual verification against a throwaway database**

Since this touches file uploads and a public unauthenticated page, verify
by hand before moving on (Playwright coverage comes in Task 11):

1. Start a throwaway Postgres (as in Task 1, Steps 3), apply all
   migrations with `npx prisma migrate deploy`, and run the seed:
   `npx prisma db seed` (or `npm run prisma:seed`).
2. In a `.env.local` pointed at that database (with a `BLOB_READ_WRITE_TOKEN`
   if screenshot upload is being exercised — otherwise the upload step is
   optional and `storePhoto` is simply not reached), run `npm run dev`.
3. Register a team through `/register`, note the payment code shown.
4. Visit `/payment/<code>` — expect "Payment details are not published
   yet" (nothing configured yet — Task 10 adds the admin panel that turns
   this on).
5. Visit `/payment/WRONGCODE` — expect the "We couldn't find that code"
   state.
6. Tear down the throwaway database.

- [ ] **Step 7: Commit**

```bash
git add src/components/payment/PaymentBadge.tsx src/app/payment/[code]/page.tsx src/app/payment/[code]/actions.ts src/components/payment/ReportPaymentForm.tsx
git commit -m "Add the payment status and report-payment page"
```

---

## Task 10: Admin Payments tab; trim the old locations

**Files:**
- Create: `src/app/admin/(protected)/payments/page.tsx`
- Create: `src/app/admin/(protected)/payments/actions.ts`
- Modify: `src/app/admin/(protected)/layout.tsx`
- Modify: `src/app/admin/(protected)/register-form/page.tsx`
- Modify: `src/app/admin/(protected)/register-form/actions.ts`
- Modify: `src/app/admin/(protected)/registrations/page.tsx`
- Modify: `src/app/admin/(protected)/registrations/actions.ts`

**Interfaces:**
- Consumes: `getPaymentConfig` (Task 4), `PaymentBadge` (Task 9),
  `PAYMENT_STATUSES`/`PAYMENT_STATUS_LABELS`/`formatFils`/`isPaymentStatus`
  (existing `payment.ts`).
- Produces: `updatePaymentConfig(formData)`, `updatePaymentStatus(formData)`
  server actions (the latter moved here from
  `src/app/admin/(protected)/registrations/actions.ts`).

- [ ] **Step 1: Create the Payments admin actions**

Create `src/app/admin/(protected)/payments/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isPaymentStatus } from "@/lib/payment";

export async function updatePaymentConfig(formData: FormData) {
  await requireAdmin();

  // Built once and used for both halves of the upsert, so the two can never
  // drift apart the way they would if a new field were added to only one.
  const fields = {
    paymentEnabled: formData.get("paymentEnabled") === "on",
    cliqAlias: String(formData.get("cliqAlias") ?? "").trim(),
    cliqAliasType: String(formData.get("cliqAliasType") ?? "ALIAS") === "MOBILE" ? "MOBILE" : "ALIAS",
    cliqBankName: String(formData.get("cliqBankName") ?? "").trim(),
    cliqAccountName: String(formData.get("cliqAccountName") ?? "").trim(),
    paymentNote: String(formData.get("paymentNote") ?? "").trim(),
    whatsappNumber: String(formData.get("whatsappNumber") ?? "").trim(),
    whatsappContactName: String(formData.get("whatsappContactName") ?? "").trim(),
  };

  await prisma.paymentConfig.upsert({
    where: { id: "singleton" },
    update: fields,
    create: { id: "singleton", ...fields },
  });

  revalidatePath("/admin/payments");
  revalidatePath("/payment", "layout");
}

/**
 * Records the outcome of matching a reported CliQ transfer against the account.
 *
 * Separate from registration status on purpose: refusing a payment must not
 * cancel a registration, and confirming a team must not silently mark their
 * fee as received. The two are different facts about a team, decided by
 * different evidence.
 */
export async function updatePaymentStatus(formData: FormData) {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const paymentStatus = String(formData.get("paymentStatus") ?? "");
  const note = String(formData.get("paymentNote") ?? "").trim();

  if (!id) throw new Error("Missing registration id.");
  if (!isPaymentStatus(paymentStatus)) {
    throw new Error(`Unknown payment status: ${paymentStatus}`);
  }

  await prisma.registration.update({
    where: { id },
    data: {
      paymentStatus,
      paymentNote: note || null,
      paymentVerifiedAt: paymentStatus === "VERIFIED" ? new Date() : null,
    },
  });

  revalidatePath("/admin/payments");
}
```

- [ ] **Step 2: Create the Payments admin page**

Create `src/app/admin/(protected)/payments/page.tsx`:

```tsx
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { getPaymentConfig } from "@/lib/site-config";
import { PaymentBadge } from "@/components/payment/PaymentBadge";
import { updatePaymentConfig, updatePaymentStatus } from "./actions";
import { PAYMENT_STATUSES, PAYMENT_STATUS_LABELS, formatFils } from "@/lib/payment";

export const metadata: Metadata = {
  title: "Admin — Payments",
};

const inputClass =
  "mt-1 w-full rounded-md border border-ras-gray/30 bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-fg)] focus:border-ras-purple focus:outline-none";
const labelClass = "block text-xs font-medium text-ras-gray dark:text-white/70";

export default async function AdminPaymentsPage() {
  const [config, registrations] = await Promise.all([
    getPaymentConfig(),
    prisma.registration.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        teamName: true,
        paymentCode: true,
        paymentStatus: true,
        paymentReference: true,
        paymentAmountFils: true,
        paymentSubmittedAt: true,
        paymentScreenshotUrl: true,
        paymentNote: true,
      },
    }),
  ]);

  const awaiting = registrations.filter((r) => r.paymentStatus === "SUBMITTED").length;
  const paid = registrations.filter((r) => r.paymentStatus === "VERIFIED").length;

  return (
    <div>
      <h1 className="font-display text-2xl font-extrabold text-ras-purple dark:text-white">Payments</h1>
      <p className="mt-2 text-sm text-ras-gray dark:text-white/70">
        {registrations.length} teams · {paid} paid{awaiting > 0 ? ` · ${awaiting} awaiting a check` : ""}
      </p>

      <Card className="mt-6">
        <form action={updatePaymentConfig} className="grid gap-4">
          <p className="text-xs text-ras-gray dark:text-white/70">
            Shown on a team&apos;s payment page once this is switched on <em>and</em> both an alias and a
            WhatsApp number are entered.
          </p>
          <label className="flex items-center gap-2 text-sm text-ras-gray dark:text-white/80">
            <input type="checkbox" name="paymentEnabled" defaultChecked={config.paymentEnabled} />
            Show CliQ payment details
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>CliQ alias or mobile number</label>
              <input name="cliqAlias" defaultValue={config.cliqAlias} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Identifier type</label>
              <select name="cliqAliasType" defaultValue={config.cliqAliasType} className={inputClass}>
                <option value="ALIAS">CliQ alias</option>
                <option value="MOBILE">Mobile number</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Account name</label>
              <input name="cliqAccountName" defaultValue={config.cliqAccountName} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Bank</label>
              <input name="cliqBankName" defaultValue={config.cliqBankName} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>WhatsApp number (proof screenshots)</label>
              <input
                name="whatsappNumber"
                defaultValue={config.whatsappNumber}
                placeholder="+9627XXXXXXXX"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>WhatsApp contact name</label>
              <input
                name="whatsappContactName"
                defaultValue={config.whatsappContactName}
                placeholder="Ahmad — Treasurer"
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Extra instructions (optional)</label>
            <textarea name="paymentNote" rows={3} defaultValue={config.paymentNote} className={inputClass} />
          </div>

          <div>
            <Button type="submit">Save</Button>
          </div>
        </form>
      </Card>

      <div className="mt-6 space-y-3">
        {registrations.length === 0 ? (
          <p className="text-sm text-ras-gray dark:text-white/60">No registrations yet.</p>
        ) : (
          registrations.map((reg) => (
            <Card key={reg.id}>
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                <div>
                  <p className="font-display font-bold text-ras-purple dark:text-white">{reg.teamName}</p>
                  <p className="font-mono text-xs text-ras-gray dark:text-white/60">{reg.paymentCode}</p>
                </div>
                <PaymentBadge status={reg.paymentStatus} />
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ras-gray dark:text-white/70">
                {reg.paymentReference ? <span className="font-mono">{reg.paymentReference}</span> : null}
                {reg.paymentAmountFils ? (
                  <span className="font-semibold text-ras-purple dark:text-white">
                    {formatFils(reg.paymentAmountFils)}
                  </span>
                ) : null}
                {reg.paymentSubmittedAt ? (
                  <span>reported {reg.paymentSubmittedAt.toLocaleDateString()}</span>
                ) : null}
                {reg.paymentScreenshotUrl ? (
                  <a
                    href={reg.paymentScreenshotUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-ras-purple underline dark:text-white"
                  >
                    View screenshot
                  </a>
                ) : null}
              </div>

              {reg.paymentNote ? (
                <p className="mt-2 text-xs text-ras-gray dark:text-white/60">
                  <strong>Note:</strong> {reg.paymentNote}
                </p>
              ) : null}

              <form action={updatePaymentStatus} className="mt-3 flex flex-wrap items-center gap-2">
                <input type="hidden" name="id" value={reg.id} />
                <select
                  name="paymentStatus"
                  defaultValue={reg.paymentStatus}
                  aria-label={`Payment status for ${reg.teamName}`}
                  className="rounded-md border border-ras-gray/30 bg-[var(--color-bg)] px-2 py-1 text-xs text-[var(--color-fg)]"
                >
                  {PAYMENT_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {PAYMENT_STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
                <input
                  name="paymentNote"
                  defaultValue={reg.paymentNote ?? ""}
                  placeholder="Note (e.g. why it did not match)"
                  aria-label={`Payment note for ${reg.teamName}`}
                  className="min-w-0 flex-1 rounded-md border border-ras-gray/30 bg-[var(--color-bg)] px-2 py-1 text-xs text-[var(--color-fg)]"
                />
                <Button type="submit" variant="ghost" className="px-2 py-1 text-xs">
                  Save fee
                </Button>
              </form>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Add the nav link**

In `src/app/admin/(protected)/layout.tsx`, insert a new entry into
`NAV_LINKS` right after Registrations:

```ts
const NAV_LINKS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/schedule", label: "Schedule" },
  { href: "/admin/competition-day", label: "Competition Day" },
  { href: "/admin/faq", label: "FAQ" },
  { href: "/admin/gallery", label: "Gallery" },
  { href: "/admin/register-form", label: "Register Form" },
  { href: "/admin/registrations", label: "Registrations" },
  { href: "/admin/payments", label: "Payments" },
  { href: "/admin/broadcasts", label: "Email Lists" },
  { href: "/admin/admins", label: "Admins" },
];
```

- [ ] **Step 4: Trim the Register Form admin page**

In `src/app/admin/(protected)/register-form/actions.ts`, remove the CliQ
fields from `updateFormConfig`, leaving:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function updateFormConfig(formData: FormData) {
  await requireAdmin();

  const deadlineDateStr = String(formData.get("deadlineDate") ?? "");
  const deadlineDate = deadlineDateStr ? new Date(deadlineDateStr) : null;

  const fields = {
    deadlineText: String(formData.get("deadlineText") ?? ""),
    deadlineDate: deadlineDate && !Number.isNaN(deadlineDate.getTime()) ? deadlineDate : null,
    feeInfoText: String(formData.get("feeInfoText") ?? ""),
    isOpen: formData.get("isOpen") === "on",
  };

  await prisma.registerFormConfig.upsert({
    where: { id: "singleton" },
    update: fields,
    create: { id: "singleton", ...fields },
  });

  revalidatePath("/register");
  revalidatePath("/admin/register-form");
}
```

In `src/app/admin/(protected)/register-form/page.tsx`, delete the entire
`<fieldset>...CliQ payment...</fieldset>` block (the one with legend
"CliQ payment", between the `isOpen` checkbox label and the Save button),
leaving the form with just deadline text, deadline date, fee info text, the
open/closed checkbox, and the Save button.

- [ ] **Step 5: Trim the Registrations admin page**

In `src/app/admin/(protected)/registrations/actions.ts`, remove
`updatePaymentStatus` (it now lives in `payments/actions.ts`) and its now
unused `isPaymentStatus` import, leaving only:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function updateRegistrationStatus(formData: FormData) {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !status) throw new Error("Missing registration id or status.");

  await prisma.registration.update({ where: { id }, data: { status } });

  revalidatePath("/admin/registrations");
}
```

Rewrite `src/app/admin/(protected)/registrations/page.tsx` to drop the
payment editing panel, keeping only a read-only badge and a pointer to the
new tab:

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { updateRegistrationStatus } from "./actions";
import { PaymentBadge } from "@/components/payment/PaymentBadge";

export const metadata: Metadata = {
  title: "Admin — Registrations",
};

const STATUS_OPTIONS = ["PENDING", "CONFIRMED", "WAITLISTED", "CANCELLED"];

export default async function AdminRegistrationsPage() {
  const registrations = await prisma.registration.findMany({
    include: { members: { orderBy: { order: "asc" } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <h1 className="font-display text-2xl font-extrabold text-ras-purple dark:text-white">Registrations</h1>
      <p className="mt-2 text-sm text-ras-gray dark:text-white/70">
        {registrations.length} teams registered. Fee status and reconciliation live on the{" "}
        <Link href="/admin/payments" className="font-semibold text-ras-purple underline dark:text-white">
          Payments
        </Link>{" "}
        tab.
      </p>

      <div className="mt-6 space-y-4">
        {registrations.map((reg) => (
          <Card key={reg.id}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-display font-bold text-ras-purple dark:text-white">{reg.teamName}</p>
                <p className="text-xs text-ras-gray dark:text-white/60">
                  {reg.submitterEmail} · {reg.memberCount} member{reg.memberCount > 1 ? "s" : ""} ·{" "}
                  {reg.createdAt.toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <PaymentBadge status={reg.paymentStatus} />
                <form action={updateRegistrationStatus} className="flex items-center gap-2">
                  <input type="hidden" name="id" value={reg.id} />
                  <select
                    name="status"
                    defaultValue={reg.status}
                    className="rounded-md border border-ras-gray/30 bg-[var(--color-bg)] px-2 py-1 text-xs text-[var(--color-fg)]"
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <Button type="submit" variant="ghost" className="px-2 py-1 text-xs">
                    Update
                  </Button>
                </form>
              </div>
            </div>

            <ul className="mt-3 space-y-1 text-sm text-ras-gray dark:text-white/80">
              {reg.members.map((m) => (
                <li key={m.id}>
                  {m.order === 1 ? "Team Leader" : `Member ${m.order}`}: {m.firstName} {m.lastName} — {m.university},{" "}
                  {m.major} — {m.ieeeStatus} ({m.ieeeMembershipId}) — {m.email} / {m.whatsapp}
                </li>
              ))}
            </ul>

            <p className="mt-2 text-xs text-ras-gray dark:text-white/60">
              <strong>Experience:</strong> {reg.technicalExperience}
            </p>
            <p className="mt-1 text-xs text-ras-gray dark:text-white/60">
              <strong>Motivation:</strong> {reg.motivation}
            </p>
          </Card>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors anywhere in the project.

- [ ] **Step 7: Commit**

```bash
git add src/app/admin/\(protected\)/payments src/app/admin/\(protected\)/layout.tsx src/app/admin/\(protected\)/register-form src/app/admin/\(protected\)/registrations
git commit -m "Add the admin Payments tab; move payment editing out of Registrations and Register Form"
```

---

## Task 11: End-to-end verification

**Files:**
- Create: `tests/e2e/payment.spec.ts`

**Interfaces:**
- Consumes: the whole feature, end to end.

- [ ] **Step 1: Run the full non-e2e verification suite first**

```bash
npx tsc --noEmit
npm run lint
npx vitest run
```

Expected: all clean. This should already be true from the per-task
verification along the way; this is the final confirmation before the
browser pass.

- [ ] **Step 2: Set up an isolated environment for the browser pass**

Do not run this against the real `.env` `DATABASE_URL` — use a throwaway
Docker Postgres, the same as Task 1:

```bash
docker run --rm -d --name mmrc-e2e-db -e POSTGRES_PASSWORD=postgres -p 55438:5432 postgres:16
```

Create a temporary `.env.local` (or export env vars for the dev server
process) pointing at it, with a bootstrap admin:

```
DATABASE_URL=postgresql://postgres:postgres@localhost:55438/postgres
DIRECT_URL=postgresql://postgres:postgres@localhost:55438/postgres
SESSION_SECRET=e2e-not-a-real-secret
ADMIN_BOOTSTRAP_USERNAME=e2e-admin
ADMIN_BOOTSTRAP_PASSWORD=e2e-password-change-me
```

```bash
npx prisma migrate deploy
npm run prisma:seed
npm run dev
```

- [ ] **Step 3: Configure CliQ payment via the admin UI**

With the dev server running, log in at `/admin/login` with
`e2e-admin` / `e2e-password-change-me`, go to `/admin/payments`, fill in a
CliQ alias, account name, bank, a WhatsApp number (any placeholder number
is fine — no real message is ever sent, this only builds a link), and
check "Show CliQ payment details". Save.

- [ ] **Step 4: Write the end-to-end test**

Create `tests/e2e/payment.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

test("payment code lookup finds an unknown code gracefully", async ({ page }) => {
  await page.goto("/payment/NOTREAL");
  await expect(page.getByText("We couldn't find that code")).toBeVisible();
});

test("full flow: register, look up by code, report a payment", async ({ page }) => {
  const teamName = `Payment Flow Team ${Date.now()}`;

  await page.goto("/register");
  await page.getByLabel("Team name").fill(teamName);
  await page.getByLabel("Submitter email").fill(`payflow-${Date.now()}@example.com`);
  await page.getByLabel("First name").fill("Grace");
  await page.getByLabel("Last name").fill("Hopper");
  await page.getByLabel("Email", { exact: true }).fill(`grace-${Date.now()}@example.com`);
  await page.getByLabel("WhatsApp number").fill("+962700000001");
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
  const code = (await page.locator("p.font-mono").first().textContent())?.trim();
  expect(code).toBeTruthy();

  await page.goto("/payment");
  await page.getByLabel("Payment code").fill(code!);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(new RegExp(`/payment/${code}$`));
  await expect(page.getByRole("heading", { name: teamName })).toBeVisible();

  await page.getByLabel("CliQ transaction reference").fill(`FT${Date.now()}`);
  await page.getByLabel("Amount transferred (JD)").fill("25");
  await page.getByRole("button", { name: "Report payment" }).click();
  await expect(page.getByText(/we have your reference and are matching it/i)).toBeVisible();

  await expect(
    page.getByRole("link", { name: /Send proof on WhatsApp/ }),
  ).toHaveAttribute("href", /^https:\/\/wa\.me\/\d+\?text=/);
});
```

- [ ] **Step 5: Run it**

```bash
npx playwright test tests/e2e/payment.spec.ts
```

Expected: both tests pass. Note: `tests/e2e/registration.spec.ts` calls a
`/api/stats` route that no longer exists in this codebase (removed in an
earlier, unrelated change) — that test was already broken before this plan
and is out of scope to fix here; do not let its failure block this task,
only check the two payment tests above.

- [ ] **Step 6: Tear down**

```bash
docker stop mmrc-e2e-db
```

Delete the temporary `.env.local` (or unset the exported variables) so the
next `npm run dev` goes back to the real `.env`.

- [ ] **Step 7: Commit**

```bash
git add tests/e2e/payment.spec.ts
git commit -m "Add end-to-end coverage for the payment portal flow"
```

- [ ] **Step 8: Final check — branch stays unmerged**

```bash
git branch --show-current
```

Expected: `feat/cliq-payment`. Do not merge or push to `master` — the user
asked for this feature to stay unmerged until they say otherwise.
