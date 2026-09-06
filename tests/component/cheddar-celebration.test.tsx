import { describe, expect, it, vi, afterEach } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CheddarCelebration } from "@/components/register/CheddarCelebration";
import { CELEBRATION_FADE_MS, CHEDDAR_QUIPS, CRUMB_COUNT } from "@/lib/celebration";
import { VERIFICATION_WINDOW_TEXT } from "@/lib/payment-proof";

/**
 * Cheddar's appearance, from the outside.
 *
 * The picking itself is covered in tests/unit/celebration.test.ts. What matters
 * here is the behaviour around it: that he shows up at all, that he says what
 * the team needs to know, and that every route out of the overlay works. The
 * confirmation underneath him carries the resume code, so one that could not be
 * dismissed would be a real problem rather than an annoyance.
 */

/** Always the first quip, so assertions can name it. */
const firstQuip = () => 0;

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/** Runs out the fade so the overlay has actually left the DOM. */
function settle(extraMs = 0) {
  act(() => {
    vi.advanceTimersByTime(extraMs + CELEBRATION_FADE_MS + 10);
  });
}

describe("CheddarCelebration", () => {
  it("shows up with a quip", () => {
    render(<CheddarCelebration random={firstQuip} />);

    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText(CHEDDAR_QUIPS[0]!)).toBeTruthy();
  });

  it("says the registration is complete and how long the check takes", () => {
    // The joke is the reason he is here; this is the reason the panel is. A
    // team must not have to guess whether they are actually registered, or how
    // long the silence before the confirmation email is meant to last.
    render(<CheddarCelebration random={firstQuip} />);

    expect(screen.getByRole("heading", { name: /registration complete/i })).toBeTruthy();
    expect(screen.getByText(new RegExp(VERIFICATION_WINDOW_TEXT))).toBeTruthy();
  });

  it("offers a way back to the main page", () => {
    render(<CheddarCelebration random={firstQuip} />);

    const home = screen.getByRole("link", { name: /back to the main page/i });
    expect(home.getAttribute("href")).toBe("/");
  });

  it("remembers nothing, so he cannot be suppressed forever", () => {
    // The regression this exists for. He used to write a "seen" flag to
    // localStorage the moment he mounted, so one stray mount — an earlier
    // build, an abandoned attempt — retired him for that browser permanently,
    // with no way for the person to get him back and no way for us to
    // reproduce it. Completing a registration is the only condition now.
    const first = render(<CheddarCelebration random={firstQuip} />);
    expect(screen.getByRole("dialog")).toBeTruthy();
    first.unmount();

    render(<CheddarCelebration random={firstQuip} />);
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("touches no storage at all", () => {
    // Belt and braces on the above: if nothing is read or written, nothing can
    // accumulate that quietly changes his behaviour later.
    const getItem = vi.spyOn(Storage.prototype, "getItem");
    const setItem = vi.spyOn(Storage.prototype, "setItem");

    render(<CheddarCelebration random={firstQuip} />);

    expect(getItem).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
  });

  it("hangs off the body rather than off whatever rendered it", () => {
    // Not a detail. This is rendered from inside the register form, which sits
    // inside PageTransition's `.page-enter` — and that animates `transform`,
    // which makes it a containing block for fixed-position descendants. Left in
    // place, the overlay resolves `position: fixed` against the page wrapper
    // instead of the viewport: measured in a browser it came out 69px down and
    // 1767px tall, so the dim began below the header and scrolled with the
    // page. The portal is what keeps it covering the screen.
    const { container } = render(<CheddarCelebration random={firstQuip} />);

    expect(container.querySelector(".cheddar-celebration")).toBeNull();
    expect(screen.getByRole("dialog").parentElement).toBe(document.body);
  });

  it("puts focus on the way out, so a keyboard is not trapped behind him", () => {
    render(<CheddarCelebration random={firstQuip} />);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /stay here/i }));
  });

  it("leaves when Stay here is pressed", () => {
    vi.useFakeTimers();
    render(<CheddarCelebration random={firstQuip} />);

    fireEvent.click(screen.getByRole("button", { name: /stay here/i }));
    settle();

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("leaves on Escape", () => {
    vi.useFakeTimers();
    render(<CheddarCelebration random={firstQuip} />);

    fireEvent.keyDown(window, { key: "Escape" });
    settle();

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("does not vanish on a stray click", () => {
    // It used to dismiss on a click anywhere, which was fine when it held only
    // a joke. It now holds the only statement of what happens next and a choice
    // of where to go, so a misfired click on the way to a button must not take
    // all of that away mid-sentence.
    vi.useFakeTimers();
    render(<CheddarCelebration random={firstQuip} />);

    fireEvent.click(screen.getByRole("dialog"));
    settle();

    expect(screen.queryByRole("dialog")).toBeTruthy();
  });

  it("stays put on its own, rather than timing out from under a reader", () => {
    vi.useFakeTimers();
    render(<CheddarCelebration random={firstQuip} />);

    settle(30_000);

    expect(screen.queryByRole("dialog")).toBeTruthy();
  });

  it("throws cheese rather than confetti", () => {
    vi.useFakeTimers();
    // Queried off the document, not the render container: the overlay is
    // portalled to document.body, as every other test here relies on too.
    render(<CheddarCelebration random={firstQuip} />);
    settle();

    // Confetti is what every form does at this moment and says nothing about
    // this one; the mouse has been chasing cheese since the landing page.
    expect(document.querySelectorAll(".cheddar-crumb").length).toBe(CRUMB_COUNT);
  });

  it("keeps the crumbs out of the way of the reference", () => {
    vi.useFakeTimers();
    render(<CheddarCelebration random={firstQuip} />);
    settle();

    // Decoration, and hidden as such: the panel underneath carries the six
    // characters a team must not miss.
    const crumbs = document.querySelector(".cheddar-crumbs");
    expect(crumbs?.getAttribute("aria-hidden")).toBe("true");
  });
});
