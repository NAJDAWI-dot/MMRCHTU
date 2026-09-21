import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { OpenDaySlider } from "@/components/home/OpenDaySlider";
import { SLIDE_INTERVAL_MS } from "@/lib/open-day";

/**
 * The band at the top of the homepage.
 *
 * Everything worth pinning here is invisible in a screenshot. A carousel that
 * turns on its own has to be stoppable, or it fails WCAG outright. The slides
 * waiting off the side of the screen are still in the markup, so their links
 * have to be out of the tab order, or tabbing through the homepage drags the
 * band sideways. And the whole thing has to know when the day it is
 * advertising has been and gone.
 */

// jsdom ships no matchMedia, and every browser has one. Reporting no
// preference is the honest stand-in: a visitor who has asked for reduced
// motion is covered by its own test in the e2e walkthrough, against a real
// browser that can actually be told to prefer it.
beforeAll(() => {
  if (typeof window.matchMedia === "function") return;
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const HOUR = 60 * 60 * 1000;

const show = (props: Partial<Parameters<typeof OpenDaySlider>[0]> = {}) =>
  render(
    <OpenDaySlider
      startsAt={new Date(Date.now() + 48 * HOUR).toISOString()}
      endsAt={new Date(Date.now() + 54 * HOUR).toISOString()}
      location=""
      mapUrl=""
      initialPhase="before"
      locked={false}
      {...props}
    />,
  );

const dots = () => screen.getAllByRole("button").filter((b) => b.hasAttribute("aria-current"));

describe("the open day slider", () => {
  it("announces itself as a carousel rather than as a wall of headings", () => {
    show();
    expect(screen.getByRole("region", { name: /open day/i })).toHaveAttribute(
      "aria-roledescription",
      "carousel",
    );
  });

  it("offers one dot per slide, with the first one current", () => {
    show();
    const marks = dots();
    expect(marks).toHaveLength(3);
    expect(marks[0]).toHaveAttribute("aria-current", "true");
    expect(marks[1]).toHaveAttribute("aria-current", "false");
  });

  it("keeps the waiting slides out of the tab order", () => {
    show();
    // Every slide is in the markup so the row can slide. Only the one on
    // screen may be reachable by keyboard.
    const links = screen.getAllByRole("link", { hidden: true });
    const reachable = links.filter((link) => link.getAttribute("tabindex") !== "-1");
    expect(reachable).toHaveLength(1);
  });

  it("moves when a dot is pressed", () => {
    show();
    fireEvent.click(dots()[2]!);
    expect(dots()[2]).toHaveAttribute("aria-current", "true");
    expect(dots()[0]).toHaveAttribute("aria-current", "false");
  });

  it("turns on its own", async () => {
    vi.useFakeTimers();
    show();
    expect(dots()[0]).toHaveAttribute("aria-current", "true");

    await act(async () => {
      vi.advanceTimersByTime(SLIDE_INTERVAL_MS + 50);
    });

    expect(dots()[1]).toHaveAttribute("aria-current", "true");
  });

  it("can be stopped, which is the whole reason the button is there", async () => {
    vi.useFakeTimers();
    show();

    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    expect(screen.getByRole("button", { name: "Resume" })).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(SLIDE_INTERVAL_MS * 3);
    });

    expect(dots()[0]).toHaveAttribute("aria-current", "true");
  });

  it("holds still while somebody is reading it", async () => {
    vi.useFakeTimers();
    show();

    fireEvent.mouseEnter(screen.getByRole("region", { name: /open day/i }));
    await act(async () => {
      vi.advanceTimersByTime(SLIDE_INTERVAL_MS * 2);
    });
    expect(dots()[0]).toHaveAttribute("aria-current", "true");

    fireEvent.mouseLeave(screen.getByRole("region", { name: /open day/i }));
    await act(async () => {
      vi.advanceTimersByTime(SLIDE_INTERVAL_MS + 50);
    });
    expect(dots()[1]).toHaveAttribute("aria-current", "true");
  });

  it("says where the stand is once the day has started", () => {
    show({
      startsAt: new Date(Date.now() - HOUR).toISOString(),
      endsAt: new Date(Date.now() + HOUR).toISOString(),
      initialPhase: "during",
      location: "HTU Main Hall",
    });

    expect(screen.getByText(/happening now/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /HTU Main Hall/ })).toBeInTheDocument();
  });

  it("offers the map as a link rather than as a line of URL", () => {
    show({ location: "HTU Main Hall", mapUrl: "https://maps.example/xyz" });
    const map = screen.getByRole("link", { name: /find it on the map/i });
    expect(map).toHaveAttribute("href", "https://maps.example/xyz");
    // A new tab, and never handing the opener to whatever is at the other end.
    expect(map).toHaveAttribute("rel", expect.stringContaining("noopener"));
    // The URL itself never appears as text.
    expect(screen.queryByText(/maps\.example/)).toBeNull();
  });

  it("keeps the map link even while the page is shut", () => {
    // It points at a map, not at the page nobody can open yet.
    show({ mapUrl: "https://maps.example/xyz", locked: true });
    expect(screen.getByRole("link", { name: /find it on the map/i })).toBeInTheDocument();
    expect(screen.queryAllByRole("link", { hidden: true }).filter((a) => (a.getAttribute("href") ?? "").startsWith("/"))).toHaveLength(0);
  });

  it("carries no buttons while the page it points at is shut", () => {
    show({ locked: true });
    // The dots and the pause button stay: the band still turns, it just has
    // nowhere to send anybody yet.
    expect(screen.queryAllByRole("link", { hidden: true })).toHaveLength(0);
    expect(dots()).toHaveLength(3);
    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();
  });

  it("takes itself down once the day is over", () => {
    const { container } = show({
      startsAt: new Date(Date.now() - 8 * HOUR).toISOString(),
      endsAt: new Date(Date.now() - 2 * HOUR).toISOString(),
      initialPhase: "after",
    });
    expect(container).toBeEmptyDOMElement();
  });

  it("believes the clock rather than the phase it was handed", () => {
    // The homepage is cached for five minutes, so the phase it renders with
    // can be five minutes out of date by the time anyone sees it. Here the
    // server says the day is over and the dates say it has not started.
    show({ initialPhase: "after" });
    expect(screen.getByRole("region", { name: /open day/i })).toBeInTheDocument();
  });
});
