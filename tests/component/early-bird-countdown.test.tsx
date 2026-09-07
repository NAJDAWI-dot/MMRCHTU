import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { EarlyBirdCountdown } from "@/components/promo/EarlyBirdCountdown";
import { EARLY_BIRD_LABEL_AR } from "@/lib/early-bird";

/**
 * The discount deadline, ticking under the competition-day clock.
 *
 * Three things here are worth pinning and none of them survive a restyle on
 * their own. It has to read as the smaller of the two clocks, which is the
 * whole reason it exists in this form rather than as a third paragraph of
 * text. It has to announce its own deadline rather than inheriting competition
 * day's, since both clocks hide their digits from assistive tech and speak one
 * sentence instead. And it has to take itself off the page the moment the
 * offer ends, because the sentence above it promises a discount that the
 * server will go on claiming until the route next revalidates.
 */

afterEach(() => {
  cleanup();
});

const HOUR = 60 * 60 * 1000;
const fromNow = (ms: number) => new Date(Date.now() + ms);

describe("the early bird countdown", () => {
  it("names the offer and says it is running out", () => {
    render(<EarlyBirdCountdown percent={20} cutoff={fromNow(30 * HOUR)} />);

    expect(screen.getByText(/early bird 20% off ends in/i)).toBeInTheDocument();
  });

  it("leaves the Arabic mark to the pill and the ribbon", () => {
    render(<EarlyBirdCountdown percent={20} cutoff={fromNow(30 * HOUR)} />);

    // The word is a mark — a word set against a colour, doing no other work.
    // Inside a line of running text it read as the same phrase said twice, so
    // it belongs to the badge and the marquee and to nothing here.
    expect(screen.queryByText(EARLY_BIRD_LABEL_AR)).toBeNull();
    expect(document.querySelector('[lang="ar"]')).toBeNull();
  });

  it("announces its own deadline, not competition day's", () => {
    render(<EarlyBirdCountdown percent={20} cutoff={fromNow(30 * HOUR)} />);

    expect(screen.getByText(/until the early bird discount ends\./i)).toBeInTheDocument();
    expect(screen.queryByText(/competition day/i)).toBeNull();
  });

  it("is drawn at the small scale, so it reads as the lesser of the two clocks", () => {
    render(<EarlyBirdCountdown percent={20} cutoff={fromNow(30 * HOUR)} />);

    // The point of the whole component. A digit at the hero size would put the
    // discount on equal footing with the date the competition is held.
    const digit = document.querySelector(".countdown-digit");
    expect(digit).not.toBeNull();
    expect(digit?.className).toContain("text-xl");
    expect(digit?.className).not.toContain("text-5xl");
  });

  it("shows the days remaining while the offer has days left to run", () => {
    render(<EarlyBirdCountdown percent={15} cutoff={fromNow(50 * HOUR)} />);

    expect(screen.getByText("days")).toBeInTheDocument();
  });

  it("takes itself off the page once the cutoff has passed", () => {
    // The page around it was rendered while the offer was live and will go on
    // saying so until it revalidates. This is the part that must not.
    const { container } = render(<EarlyBirdCountdown percent={20} cutoff={fromNow(-1000)} />);

    expect(container).toBeEmptyDOMElement();
  });
});
