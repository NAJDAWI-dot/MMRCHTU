import { describe, expect, it } from "vitest";
import {
  bannerAlerts,
  dismiss,
  parseDismissed,
  parseTone,
  pendingAlerts,
  sortAlerts,
  type DayAlert,
} from "@/lib/day-alerts";

const alert = (id: string, version: number, tone: DayAlert["tone"] = "INFO"): DayAlert => ({
  id,
  title: "",
  body: id,
  tone,
  version,
});

describe("day alerts", () => {
  it("pops an alert up until it is dismissed, then keeps it in the banner", () => {
    const alerts = [alert("a", 1), alert("b", 1)];
    let seen = parseDismissed(null);
    expect(pendingAlerts(alerts, seen).map((a) => a.id)).toEqual(["a", "b"]);

    seen = dismiss(seen, alerts[0]!, alerts);
    expect(pendingAlerts(alerts, seen).map((a) => a.id)).toEqual(["b"]);
    expect(bannerAlerts(alerts, seen).map((a) => a.id)).toEqual(["a"]);
  });

  it("pops it up again when an admin edits it", () => {
    const seen = dismiss({}, alert("a", 1), [alert("a", 1)]);
    const edited = [alert("a", 2)];
    expect(pendingAlerts(edited, seen)).toHaveLength(1);
    expect(bannerAlerts(edited, seen)).toHaveLength(0);
  });

  it("drops it from the banner once an admin clears it, and forgets it", () => {
    const seen = dismiss({}, alert("a", 1), [alert("a", 1)]);
    expect(bannerAlerts([], seen)).toEqual([]);
    expect(dismiss(seen, alert("b", 5), [alert("b", 5)])).toEqual({ b: 5 });
  });

  it("reads back only well-formed storage", () => {
    expect(parseDismissed("not json")).toEqual({});
    expect(parseDismissed("[1,2]")).toEqual({});
    expect(parseDismissed('{"a":3,"b":"x"}')).toEqual({ a: 3 });
  });

  it("shows urgent ones first, then the newest", () => {
    expect(sortAlerts([alert("old", 1), alert("new", 9), alert("urgent", 2, "URGENT")]).map((a) => a.id)).toEqual([
      "urgent",
      "new",
      "old",
    ]);
    expect(parseTone("urgent")).toBe("URGENT");
    expect(parseTone("nope")).toBe("INFO");
  });
});
