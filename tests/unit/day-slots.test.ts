import { describe, expect, it } from "vitest";
import { parseClock, parseSlotLines, slotsToEvents, slotsToText, zonedInstant } from "@/lib/day-slots";

describe("the running order", () => {
  it("reads a clock time however it is typed", () => {
    expect(["9", "9:00", "09.00", "0900", "9:00 am"].map(parseClock)).toEqual(Array(5).fill("09:00"));
    expect(parseClock("2:30pm")).toBe("14:30");
    expect(parseClock("12am")).toBe("00:00");
    for (const value of ["", "25:00", "9:75", "13pm", "noon"]) expect(parseClock(value)).toBeNull();
  });

  it("places a clock time on the day in Amman", () => {
    // Jordan keeps UTC+3 all year.
    expect(zonedInstant("2026-11-14", "09:00").toISOString()).toBe("2026-11-14T06:00:00.000Z");
  });

  it("reads a pasted running order line by line, reporting what it cannot", () => {
    const { slots, bad } = parseSlotLines(
      ["09:00 - 09:45 | Check-in | Main hall | Bring your robot", "", "10:00 Opening", "Lunch at some point", "11:00-11:30 |"].join("\n"),
    );
    expect(slots).toEqual([
      { startTime: "09:00", endTime: "09:45", title: "Check-in", location: "Main hall", detail: "Bring your robot" },
      { startTime: "10:00", endTime: "", title: "Opening", location: "", detail: "" },
    ]);
    expect(bad).toEqual([4, 5]);
  });

  it("writes it back out in the same shape", () => {
    const text = "09:00 - 09:45 | Check-in | Main hall | Bring your robot\n10:00 | Opening";
    const { slots } = parseSlotLines(text);
    expect(slotsToText(slots.map((slot, i) => ({ ...slot, id: String(i) })))).toBe(text);
  });

  it("runs a line with no end until the next one starts", () => {
    const events = slotsToEvents(
      [
        { id: "b", startTime: "10:00", endTime: "", title: "Opening", location: "", detail: "" },
        { id: "a", startTime: "09:00", endTime: "", title: "Check-in", location: "Hall", detail: "" },
      ],
      new Date("2026-11-14T08:00:00Z"),
      new Date("2026-11-14T06:30:00Z"),
    );
    expect(events.map((event) => event.id)).toEqual(["a", "b"]);
    expect(events[0]!.endsAt?.toISOString()).toBe("2026-11-14T07:00:00.000Z");
    expect(events[1]!.endsAt).toBeNull();
    expect(events[0]!.location).toBe("Hall");
  });
});
