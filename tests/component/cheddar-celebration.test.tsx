import { describe, expect, it, vi, afterEach } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CheddarCelebration } from "@/components/register/CheddarCelebration";
import {
  CELEBRATION_AUTO_MS,
  CELEBRATION_FADE_MS,
  CELEBRATION_SEEN_KEY,
  CHEDDAR_QUIPS,
} from "@/lib/celebration";

/**
 * Cheddar's appearance, from the outside.
 *
 * The picking itself is covered in tests/unit/celebration.test.ts. What matters
 * here is the behaviour around it: that he shows up once, that every route out
 * of the overlay works, and — most importantly — that he can always be got rid
 * of. The confirmation underneath him carries the team's resume code, so an
 * overlay that could not be dismissed would be a genuine problem rather than an
 * annoyance.
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

  it("records that this browser has met him", () => {
    render(<CheddarCelebration random={firstQuip} />);
    expect(window.localStorage.getItem(CELEBRATION_SEEN_KEY)).toBe("1");
  });

  it("stays away once he has been seen", () => {
    window.localStorage.setItem(CELEBRATION_SEEN_KEY, "1");
    render(<CheddarCelebration random={firstQuip} />);

    // Not merely hidden — never rendered, so nothing covers the reference.
    expect(screen.queryByRole("dialog")).toBeNull();
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
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /nice/i }));
  });

  it("leaves when the button is pressed", () => {
    vi.useFakeTimers();
    render(<CheddarCelebration random={firstQuip} />);

    fireEvent.click(screen.getByRole("button", { name: /nice/i }));
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

  it("leaves on a click anywhere", () => {
    vi.useFakeTimers();
    render(<CheddarCelebration random={firstQuip} />);

    fireEvent.click(screen.getByRole("dialog"));
    settle();

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("lets itself out if nobody touches it", () => {
    // The one that matters most: a team who wanders off to tell someone must
    // come back to their confirmation, not to a mouse.
    vi.useFakeTimers();
    render(<CheddarCelebration random={firstQuip} />);

    expect(screen.getByRole("dialog")).toBeTruthy();
    settle(CELEBRATION_AUTO_MS);

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("still appears when storage refuses to answer", () => {
    // Private browsing throws on access. The right outcome is a mouse, possibly
    // twice — not a confirmation screen that crashed.
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("denied");
    });

    expect(() => render(<CheddarCelebration random={firstQuip} />)).not.toThrow();
    expect(screen.getByRole("dialog")).toBeTruthy();
  });
});
