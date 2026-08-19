import { describe, expect, it } from "vitest";
import {
  averageTeamSize,
  dailyCounts,
  orderBy,
  percent,
  tally,
  teamSizeSpread,
  topN,
  type Tally,
} from "@/lib/analytics";

describe("tally", () => {
  it("counts by key, largest first", () => {
    const rows = [{ u: "HTU" }, { u: "UJ" }, { u: "HTU" }, { u: "HTU" }, { u: "JUST" }];
    expect(tally(rows, (r) => r.u)).toEqual([
      { label: "HTU", value: 3 },
      { label: "JUST", value: 1 },
      { label: "UJ", value: 1 },
    ]);
  });

  it("breaks ties alphabetically so the order does not shift between loads", () => {
    const a = tally([{ k: "b" }, { k: "a" }], (r) => r.k);
    const b = tally([{ k: "a" }, { k: "b" }], (r) => r.k);
    expect(a).toEqual(b);
  });

  it("collects blank and missing values rather than dropping them", () => {
    // A field nobody filled in is a finding about the form, not a row to hide.
    const rows = [{ m: "CS" }, { m: "" }, { m: "   " }, { m: null }, { m: undefined }];
    expect(tally(rows, (r) => r.m)).toEqual([
      { label: "Not given", value: 4 },
      { label: "CS", value: 1 },
    ]);
  });

  it("applies human labels but keeps unknown values visible", () => {
    const rows = [{ s: "PENDING" }, { s: "WEIRD" }];
    expect(tally(rows, (r) => r.s, { labels: { PENDING: "Pending" } })).toEqual([
      { label: "Pending", value: 1 },
      { label: "WEIRD", value: 1 },
    ]);
  });

  it("trims whitespace around values so they do not split into two buckets", () => {
    expect(tally([{ u: "HTU" }, { u: " HTU" }], (r) => r.u)).toEqual([{ label: "HTU", value: 2 }]);
  });

  it("returns nothing for no rows", () => {
    expect(tally([], (r: { u: string }) => r.u)).toEqual([]);
  });
});

describe("topN", () => {
  const data: Tally[] = [
    { label: "a", value: 10 },
    { label: "b", value: 5 },
    { label: "c", value: 3 },
    { label: "d", value: 2 },
  ];

  it("keeps the largest and rolls up the rest", () => {
    expect(topN(data, 2)).toEqual([
      { label: "a", value: 10 },
      { label: "b", value: 5 },
      { label: "Other", value: 5 },
    ]);
  });

  it("loses nothing: the rolled-up total still matches", () => {
    const total = data.reduce((s, d) => s + d.value, 0);
    expect(topN(data, 2).reduce((s, d) => s + d.value, 0)).toBe(total);
  });

  it("adds no remainder when everything already fits", () => {
    expect(topN(data, 4)).toEqual(data);
    expect(topN(data, 9)).toEqual(data);
  });
});

describe("percent", () => {
  it("gives a whole-percent share", () => {
    expect(percent(1, 4)).toBe(25);
    expect(percent(2, 3)).toBe(67);
  });

  it("reads zero rather than NaN when there is nothing to divide by", () => {
    // The page renders this before anyone has registered.
    expect(percent(0, 0)).toBe(0);
    expect(percent(5, 0)).toBe(0);
  });
});

describe("dailyCounts", () => {
  const now = new Date(2026, 7, 19, 15, 0, 0); // 19 Aug 2026, local

  it("returns one bucket per day, oldest first, ending today", () => {
    const buckets = dailyCounts([], 7, now);
    expect(buckets).toHaveLength(7);
    expect(buckets[0]!.key).toBe("2026-08-13");
    expect(buckets[6]!.key).toBe("2026-08-19");
  });

  it("keeps empty days instead of dropping them", () => {
    // A quiet week should read as a flat run of zeros, not vanish.
    const buckets = dailyCounts([new Date(2026, 7, 19)], 5, now);
    expect(buckets.map((b) => b.count)).toEqual([0, 0, 0, 0, 1]);
  });

  it("buckets by local calendar day, not by UTC", () => {
    // Late-evening local time can already be the next day in UTC; the
    // organisers read these against their own dates.
    const lateLocal = new Date(2026, 7, 19, 23, 30, 0);
    const buckets = dailyCounts([lateLocal], 2, now);
    expect(buckets[1]!.count).toBe(1);
  });

  it("ignores timestamps outside the window", () => {
    const old = new Date(2026, 0, 1);
    const future = new Date(2026, 11, 1);
    const buckets = dailyCounts([old, future, now], 3, now);
    expect(buckets.reduce((s, b) => s + b.count, 0)).toBe(1);
  });

  it("counts several on the same day", () => {
    const buckets = dailyCounts([now, now, now], 3, now);
    expect(buckets[2]!.count).toBe(3);
  });
});

describe("teamSizeSpread", () => {
  it("orders by team size, not by how common it is", () => {
    // The shape of the distribution is the point: a spike at 1 means something
    // different from a spike at 4.
    expect(teamSizeSpread([3, 1, 3, 2, 3])).toEqual([
      { label: "1 member", value: 1 },
      { label: "2 members", value: 1 },
      { label: "3 members", value: 3 },
    ]);
  });

  it("says 'member' singular for teams of one", () => {
    expect(teamSizeSpread([1])[0]!.label).toBe("1 member");
  });
});

describe("averageTeamSize", () => {
  it("gives one decimal place", () => {
    expect(averageTeamSize(7, 3)).toBe(2.3);
    expect(averageTeamSize(8, 4)).toBe(2);
  });

  it("reads zero before anyone registers, rather than dividing by nothing", () => {
    expect(averageTeamSize(0, 0)).toBe(0);
  });
});

describe("orderBy", () => {
  it("uses the given order rather than size", () => {
    const data: Tally[] = [
      { label: "Cancelled", value: 9 },
      { label: "Pending", value: 1 },
      { label: "Confirmed", value: 4 },
    ];
    expect(orderBy(data, ["Pending", "Confirmed", "Cancelled"]).map((d) => d.label)).toEqual([
      "Pending",
      "Confirmed",
      "Cancelled",
    ]);
  });

  it("keeps unexpected values visible at the end instead of dropping them", () => {
    const data: Tally[] = [
      { label: "MYSTERY", value: 2 },
      { label: "Pending", value: 1 },
    ];
    expect(orderBy(data, ["Pending"]).map((d) => d.label)).toEqual(["Pending", "MYSTERY"]);
  });

  it("never loses a bucket", () => {
    const data: Tally[] = [
      { label: "a", value: 1 },
      { label: "b", value: 2 },
      { label: "c", value: 3 },
    ];
    expect(orderBy(data, ["c"])).toHaveLength(3);
  });
});
