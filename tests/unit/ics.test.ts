import { describe, expect, it } from "vitest";
import type { ScheduleEvent } from "@prisma/client";
import { buildIcsCalendar, buildIcsEvent, foldIcsLine } from "@/lib/ics";

function event(overrides: Partial<ScheduleEvent> = {}): ScheduleEvent {
  const createdAt = new Date(Date.UTC(2026, 0, 1, 9, 0, 0));
  return {
    id: "evt1",
    title: "Qualifiers",
    description: "Phase 1 runs.",
    startsAt: new Date(Date.UTC(2026, 2, 14, 9, 0, 0)),
    endsAt: new Date(Date.UTC(2026, 2, 14, 12, 0, 0)),
    location: "HTU",
    sortOrder: 0,
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  };
}

/** Undoes RFC 5545 folding, the way a calendar client does before parsing. */
function unfold(ics: string): string {
  return ics.replace(/\r\n /g, "");
}

function lines(ics: string): string[] {
  return ics.split("\r\n");
}

describe("foldIcsLine", () => {
  it("leaves a short line alone", () => {
    expect(foldIcsLine("SUMMARY:Qualifiers")).toBe("SUMMARY:Qualifiers");
  });

  it("keeps every emitted line within 75 octets", () => {
    const folded = foldIcsLine(`DESCRIPTION:${"a".repeat(400)}`);
    for (const line of folded.split("\r\n")) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    }
  });

  it("unfolds back to exactly what went in", () => {
    const original = `DESCRIPTION:${"the maze is painted plywood. ".repeat(12)}`;
    expect(unfold(foldIcsLine(original))).toBe(original);
  });

  it("does not split a multi-byte character in half", () => {
    // Arabic is two bytes per character, so a fold counted in characters
    // rather than octets lands mid-character roughly half the time.
    const original = `LOCATION:${"جامعة الحسين التقنية ".repeat(8)}`;
    const folded = foldIcsLine(original);

    expect(folded).not.toContain("�");
    expect(unfold(folded)).toBe(original);
    for (const line of folded.split("\r\n")) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    }
  });
});

describe("buildIcsEvent", () => {
  it("wraps a single event in a calendar", () => {
    const ics = buildIcsEvent(event());
    expect(lines(ics)[0]).toBe("BEGIN:VCALENDAR");
    expect(lines(ics).at(-1)).toBe("END:VCALENDAR");
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1);
    expect(ics).toContain("UID:evt1@mmrc26");
    expect(ics).toContain("LOCATION:HTU");
  });

  it("uses CRLF line endings throughout", () => {
    const ics = buildIcsEvent(event());
    // Every LF in the output must be preceded by a CR. A bare LF is the
    // single most common reason a hand-built .ics is rejected outright.
    expect(ics.split("\n").length - 1).toBe(ics.split("\r\n").length - 1);
  });

  it("gives an event with no end time a one-hour default", () => {
    const ics = buildIcsEvent(event({ endsAt: null }));
    expect(ics).toContain("DTSTART:20260314T090000Z");
    expect(ics).toContain("DTEND:20260314T100000Z");
  });

  it("escapes the characters that would otherwise end a property early", () => {
    const ics = buildIcsEvent(
      event({ description: "Bring: a mouse, a battery; and spares.\nDoors at 08:00." }),
    );
    expect(unfold(ics)).toContain(
      "DESCRIPTION:Bring: a mouse\\, a battery\\; and spares.\\nDoors at 08:00.",
    );
  });
});

describe("buildIcsCalendar", () => {
  const events = [
    event({ id: "b", title: "Finals", startsAt: new Date(Date.UTC(2026, 2, 14, 14, 0, 0)) }),
    event({ id: "a", title: "Check-in", startsAt: new Date(Date.UTC(2026, 2, 14, 8, 0, 0)) }),
  ];

  it("carries every event in one calendar", () => {
    const ics = buildIcsCalendar(events);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(ics.match(/BEGIN:VCALENDAR/g)).toHaveLength(1);
  });

  it("orders events by start time, not by the order given", () => {
    const ics = buildIcsCalendar(events);
    expect(ics.indexOf("SUMMARY:Check-in")).toBeLessThan(ics.indexOf("SUMMARY:Finals"));
  });

  it("announces itself as a published, refreshing calendar", () => {
    const ics = buildIcsCalendar(events, { name: "MMRC 26" });
    expect(ics).toContain("METHOD:PUBLISH");
    expect(ics).toContain("X-WR-CALNAME:MMRC 26");
    expect(ics).toContain("REFRESH-INTERVAL;VALUE=DURATION:PT1H");
    expect(ics).toContain("X-PUBLISHED-TTL:PT1H");
  });

  it("is valid with no events at all", () => {
    const ics = buildIcsCalendar([]);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics).not.toContain("BEGIN:VEVENT");
  });

  it("raises SEQUENCE when an event has been edited since it was created", () => {
    const created = new Date(Date.UTC(2026, 0, 1, 9, 0, 0));
    const fresh = buildIcsCalendar([event({ createdAt: created, updatedAt: created })]);
    const edited = buildIcsCalendar([
      event({ createdAt: created, updatedAt: new Date(created.getTime() + 90_000) }),
    ]);

    // A client compares the two and takes the higher number as newer; a feed
    // that always sent 0 would leave a moved event at its old time.
    expect(fresh).toContain("SEQUENCE:0");
    expect(edited).toContain("SEQUENCE:90");
  });
});
