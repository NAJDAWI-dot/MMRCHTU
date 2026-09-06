import type { ScheduleEvent } from "@prisma/client";

/**
 * iCalendar output for the schedule, in two shapes.
 *
 * `buildIcsEvent` is the one-off download beside a single item — the reader
 * wants that talk in their calendar and nothing else. `buildIcsCalendar` is the
 * whole schedule as a feed, meant to be *subscribed* to rather than downloaded:
 * the calendar app re-fetches it, so an event moved a week before the day
 * reaches everyone who subscribed instead of everyone who remembered to
 * download the file again.
 *
 * Both are built from one set of event lines. A subscription that disagreed
 * with the download about an event's time would be worse than not offering it.
 */

const CRLF = "\r\n";
const PRODID = "-//MMRC26//Schedule//EN";

/** How often a subscribed client should come back. Advisory; clients may ignore it. */
const REFRESH = "PT1H";

function escapeIcsText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/,/g, "\\,").replace(/;/g, "\\;").replace(/\n/g, "\\n");
}

function toIcsDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

/**
 * Folds one content line to 75 octets, per RFC 5545 section 3.1.
 *
 * Counted in UTF-8 bytes rather than characters, and never split mid-character:
 * a description carrying an Arabic venue name or a curly apostrophe is two or
 * three bytes per character, so a naive `slice(0, 75)` would both overrun the
 * limit and cut a character in half. Strict parsers reject the result; lenient
 * ones show a replacement glyph in the middle of a word.
 *
 * Continuation lines begin with a single space, which the reader strips back
 * off when unfolding.
 */
export function foldIcsLine(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;

  const chunks: string[] = [];
  const decoder = new TextDecoder();
  let start = 0;
  // 75 octets for the first line, then 74 plus the leading space for the rest,
  // so every emitted line is at most 75 octets on the wire.
  let limit = 75;

  while (start < bytes.length) {
    let end = Math.min(start + limit, bytes.length);
    // Walk back off a continuation byte (10xxxxxx) so a multi-byte character
    // stays whole.
    while (end > start && end < bytes.length && (bytes[end]! & 0xc0) === 0x80) end -= 1;
    chunks.push(decoder.decode(bytes.subarray(start, end)));
    start = end;
    limit = 74;
  }

  return chunks.join(`${CRLF} `);
}

/**
 * A revision counter that only ever goes up.
 *
 * Calendar clients use SEQUENCE to decide whether an incoming copy of an event
 * is newer than the one they hold; a feed that always sends 0 can leave a
 * moved event sitting at its old time. Seconds since the row was created is
 * monotonic per event, starts at 0, and stays a small integer — where the raw
 * epoch would be within a rounding error of the spec's signed-32-bit ceiling.
 */
function sequenceFor(event: ScheduleEvent): number {
  const delta = event.updatedAt.getTime() - event.createdAt.getTime();
  return Math.max(0, Math.floor(delta / 1000));
}

function eventLines(event: ScheduleEvent, stamp: string): string[] {
  const dtStart = toIcsDate(event.startsAt);
  const dtEnd = toIcsDate(event.endsAt ?? new Date(event.startsAt.getTime() + 60 * 60 * 1000));

  const lines = [
    "BEGIN:VEVENT",
    `UID:${event.id}@mmrc26`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SEQUENCE:${sequenceFor(event)}`,
    `LAST-MODIFIED:${toIcsDate(event.updatedAt)}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
    `DESCRIPTION:${escapeIcsText(event.description)}`,
  ];

  if (event.location) {
    lines.push(`LOCATION:${escapeIcsText(event.location)}`);
  }

  lines.push("END:VEVENT");
  return lines;
}

function wrap(body: string[], extraHeaders: string[] = []): string {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${PRODID}`,
    "CALSCALE:GREGORIAN",
    ...extraHeaders,
    ...body,
    "END:VCALENDAR",
  ]
    .map(foldIcsLine)
    .join(CRLF);
}

/** One event, for the download link beside it. */
export function buildIcsEvent(event: ScheduleEvent, now: Date = new Date()): string {
  return wrap(eventLines(event, toIcsDate(now)));
}

export interface IcsCalendarOptions {
  /** Shown as the calendar's name in the client that subscribes to it. */
  name?: string;
  description?: string;
  now?: Date;
}

/**
 * The whole schedule as a subscribable feed.
 *
 * `METHOD:PUBLISH` marks it as a published calendar rather than an invitation,
 * which is what stops some clients treating each event as an RSVP request.
 * The two refresh hints are the same interval said twice, because Apple reads
 * one and most other clients read the other.
 */
export function buildIcsCalendar(
  events: readonly ScheduleEvent[],
  options: IcsCalendarOptions = {},
): string {
  const stamp = toIcsDate(options.now ?? new Date());
  const name = options.name ?? "MMRC 26";
  const description = options.description ?? "The MMRC 26 schedule, kept up to date.";

  const headers = [
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcsText(name)}`,
    `X-WR-CALDESC:${escapeIcsText(description)}`,
    `REFRESH-INTERVAL;VALUE=DURATION:${REFRESH}`,
    `X-PUBLISHED-TTL:${REFRESH}`,
  ];

  // Ordered by start time so a client that renders the file in document order
  // — and some still do — shows the day in the order it happens.
  const ordered = [...events].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  const body = ordered.flatMap((event) => eventLines(event, stamp));

  return wrap(body, headers);
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
