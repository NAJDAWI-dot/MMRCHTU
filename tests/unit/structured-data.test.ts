import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eventJsonLd, organizationJsonLd, webSiteJsonLd } from "@/lib/structured-data";

let saved: string | undefined;

beforeEach(() => {
  saved = process.env.SITE_URL;
  process.env.SITE_URL = "https://mmrc26.org";
});

afterEach(() => {
  if (saved === undefined) delete process.env.SITE_URL;
  else process.env.SITE_URL = saved;
});

const base = {
  name: "Competition Day",
  description: "Everything you need for the day itself.",
  startDate: new Date("2026-10-15T09:00:00.000Z"),
  venue: "HTU Main Hall",
};

describe("organizationJsonLd", () => {
  it("identifies the chapter with absolute URLs", () => {
    const data = organizationJsonLd();
    expect(data["@type"]).toBe("Organization");
    expect(data.url).toBe("https://mmrc26.org");
    expect(String(data.logo)).toMatch(/^https:\/\/mmrc26\.org\//);
  });
});

describe("webSiteJsonLd", () => {
  it("points the search action at a real, absolute endpoint", () => {
    const action = webSiteJsonLd().potentialAction as Record<string, any>;
    expect(action.target.urlTemplate).toBe("https://mmrc26.org/search?q={search_term_string}");
    expect(action["query-input"]).toContain("search_term_string");
  });
});

describe("eventJsonLd", () => {
  it("describes a fully-specified event", () => {
    const data = eventJsonLd(base);
    expect(data["@type"]).toBe("Event");
    expect(data.name).toBe("Competition Day");
    expect(data.startDate).toBe("2026-10-15T09:00:00.000Z");
    expect((data.location as any).name).toBe("HTU Main Hall");
    expect(data.url).toBe("https://mmrc26.org/competition-day");
  });

  /**
   * Google drops a whole Event block when a property is malformed, so an
   * unknown date must be absent rather than empty — a partial description is
   * worth more than a complete-looking invalid one.
   */
  it("omits the date entirely when there is not one yet", () => {
    const data = eventJsonLd({ ...base, startDate: null });
    expect(data).not.toHaveProperty("startDate");
    expect(data["@type"]).toBe("Event");
  });

  it("omits the location rather than emitting a blank venue", () => {
    expect(eventJsonLd({ ...base, venue: "" })).not.toHaveProperty("location");
    expect(eventJsonLd({ ...base, venue: "   " })).not.toHaveProperty("location");
  });

  it("still produces a valid block when nothing but the name is known", () => {
    const data = eventJsonLd({ name: "Competition Day", description: "", startDate: null, venue: "" });
    expect(data["@context"]).toBe("https://schema.org");
    expect(data.name).toBe("Competition Day");
    expect(data.organizer).toBeDefined();
  });

  it("uses absolute URLs throughout, since a crawler has no page context", () => {
    const data = eventJsonLd(base);
    for (const value of [data.url, data.image, (data.organizer as any).url]) {
      expect(String(value)).toMatch(/^https:\/\//);
    }
  });
});
