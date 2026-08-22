# CliQ payment portal — design

Branch: `feat/cliq-payment` (unmerged; stays unmerged until asked). Supersedes
the in-register-form CliQ panel already on this branch, which is removed.

## Why

CliQ is a bank-to-bank transfer with no callback: nothing on this site can
know a payment happened. The site's job is to (1) make the transfer details
impossible to get wrong, (2) give a team an obvious way to report what they
sent and prove it, and (3) give the admin a place to reconcile reports
against the bank statement — all without pretending to be a payment gateway.

The original design bolted this onto the register form. This revision splits
it into its own subsystem, reached after registration via a short code,
because paying often happens later than registering (a team registers, then
transfers, then reports) and forcing it into one page-load didn't fit that.

## Data model

**`Registration`** gains:
- `paymentCode String @unique` — short, human-typeable, generated at
  registration. Charset excludes `0/O/1/I/L` (read-aloud/typo ambiguous).
  6 characters from a ~30-symbol alphabet is ~7×10^8 combinations; generated
  and checked against the DB, retried up to 5 times on collision (matches the
  existing defensive-retry style used elsewhere in this codebase).
- `paymentScreenshotUrl String?`, `paymentScreenshotKey String?` — same
  shape as `GalleryPhoto.url`/`storageKey`, populated by the proof upload.

`paymentStatus` / `paymentReference` / `paymentAmountFils` /
`paymentSubmittedAt` / `paymentVerifiedAt` / `paymentNote` (already on this
branch) are unchanged in meaning. They stop being populated at registration
time and start being populated by the payment portal instead.

**`PaymentConfig`** — new singleton model (`id = "singleton"`, same pattern
as `RegisterFormConfig`/`CompetitionDayConfig`), replacing the `cliq*` /
`paymentEnabled` / `paymentNote` fields currently on `RegisterFormConfig`:
- `paymentEnabled Boolean @default(false)`
- `cliqAlias String @default("")`
- `cliqAliasType String @default("ALIAS")` — `ALIAS` | `MOBILE`
- `cliqBankName String @default("")`
- `cliqAccountName String @default("")`
- `paymentNote String @default("")`
- `whatsappNumber String @default("")` — E.164-ish, digits only after `+`
- `whatsappContactName String @default("")` — shown next to the WhatsApp
  button, e.g. "Ahmad — Treasurer", so a team knows who they're messaging
- `updatedAt DateTime @updatedAt`

Off by default and blank, same reasoning as before: nothing renders until
an admin has switched it on *and* filled in both the alias and the WhatsApp
number — a half-configured panel must never reach a real team.

`RegisterFormConfig` drops the `cliq*`/`paymentEnabled`/`paymentNote`
fields — payment is no longer a register-form concern.

Migration: this branch was only ever applied to throwaway Docker Postgres
instances, never to a real deployment, so the schema is edited directly and
one clean migration is generated from the new shape (no backfill/rollback
logic needed for data that never existed anywhere durable).

## Flow

1. **Register** (`/register`) — payment fields removed entirely; it is a
   plain registration form again. On success, `createRegistration` mints a
   `paymentCode`. The success screen shows it prominently with a link to
   `/payment`, and the existing confirmation email gains a section with the
   code and link.
2. **Find your payment** (`/payment`) — one input, the code, submits to
   `/payment/[code]`.
3. **Payment status page** (`/payment/[code]`) — public, unauthenticated,
   keyed by the code:
   - Not found → a friendly "couldn't find that code" state (not a bare 404;
     codes are hand-typed) with a link back to `/payment` and to `/register`.
   - Otherwise shows: team name, current status (same badge component style
     as admin), and CliQ details (alias/mobile, account name, bank) via a
     panel reusing `CliqPanel`'s content and copy-button behaviour.
   - If `UNPAID` or `REJECTED`: a report form — reference + amount (the
     existing optional-paired validation from `payment.ts`, still required
     together once either is filled) plus a screenshot file input. Submits
     via a server action that uploads the file through `photo-storage.ts`
     and sets `paymentStatus = SUBMITTED`, `paymentSubmittedAt = now()`. A
     `REJECTED` status also shows the admin's note above the form so the
     team knows what to fix before resubmitting.
   - A "Send proof on WhatsApp" link/button:
     `https://wa.me/<whatsappNumber>?text=<url-encoded: team name, payment
     code, amount if reported>`. Opens in a new tab. Copy under the button
     explains the screenshot has to be attached by hand — a `wa.me` link
     cannot carry an attachment, WhatsApp offers no API for that from a
     browser.
   - If `SUBMITTED`: form replaced by an "awaiting check" state, still
     showing the WhatsApp button (in case they haven't sent it yet) and
     what was reported so far.
   - If `VERIFIED`: form replaced by a plain "paid" confirmation. No further
     action possible from this page.
4. **Admin → Payments** (new top-level tab, `/admin/(protected)/payments`):
   - Config section: the `paymentEnabled` toggle, alias/type/account/bank,
     `paymentNote`, `whatsappNumber`, `whatsappContactName` — moved as-is
     from the current Register Form admin page.
   - Registrations-with-payment section: the summary counts and the
     per-team payment card (badge, reference, amount, note, status-editing
     form) already built on this branch, moved out of the Registrations
     admin page into here, plus: the `paymentCode` (so a WhatsApp message
     referencing a code can be matched to a team) and a link/thumbnail to
     the uploaded screenshot when present.
   - `Registrations` admin page keeps a read-only payment badge for
     at-a-glance context but no longer edits payment state — one place owns
     writes to avoid two forms drifting.

## Error handling / abuse resistance

The payment code is a bearer secret on an unauthenticated page — anyone
who has it can view (not modify beyond reporting a payment) that team's
status. Both the code lookup and the report-payment action are rate-limited
per IP using the existing `rate-limit.ts` limiter (same pattern as
`/api/register`). Screenshot uploads are capped by size (8 MB) and MIME type
(`image/*`); rejected with a field error, not a thrown exception, matching
the existing validation style. An unrecognised code is rejected before any
upload is attempted (no wasted storage on scans of random codes).

## Testing

- Unit: `paymentCode` generation (charset excludes ambiguous characters,
  fixed length, collision retry), any new formatting/validation helpers.
  Existing 33 tests in `payment.test.ts` are unaffected (parse/format/
  validate logic is unchanged).
- Playwright, end to end: register → code shown on success screen and in
  the confirmation email → `/payment` lookup by code → land on the status
  page → CliQ details render with working copy button → report a payment
  (reference + amount + screenshot) → status becomes `SUBMITTED` → admin
  Payments tab shows the report and a working screenshot link → admin marks
  `VERIFIED` → reloading the status page shows the paid state → WhatsApp
  button `href` matches the expected `wa.me` format. Also: unknown code
  shows the friendly not-found state; feature switched off at the config
  level means `/payment/[code]` still resolves (a team can still report)
  but the register-page mention and any promotional copy stays absent.

## Explicitly out of scope

- Automated WhatsApp sending (Business API) — deep link only, per decision.
- A multi-number picker for the team — a single active number/contact name,
  admin-edited directly; changing who receives proofs means editing the
  field, not managing a list.
- Computing the fee owed from member IEEE status — unchanged from the
  original branch; the team still self-reports the amount and the admin
  verifies it.
