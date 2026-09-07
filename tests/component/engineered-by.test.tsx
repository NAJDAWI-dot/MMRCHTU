import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { EngineeredBy } from "@/components/layout/EngineeredBy";

/**
 * The credit at the bottom of every page.
 *
 * Worth pinning down because everything interesting about it is invisible in a
 * screenshot: that the whole lockup is a single link rather than two, that it
 * still opens safely, and that the name a screen reader or a voice-control user
 * gets starts with the words actually printed on the page. A restyle that
 * quietly breaks any of those looks completely fine.
 */

afterEach(() => {
  cleanup();
});

const renderCredit = () => {
  render(<EngineeredBy />);
  return screen.getByRole("link");
};

describe("the engineering credit", () => {
  it("is one link, not a line of text with a link inside it", () => {
    render(<EngineeredBy />);
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });

  it("points at the profile it credits", () => {
    expect(renderCredit()).toHaveAttribute(
      "href",
      "https://www.linkedin.com/in/hashemnajdawi/",
    );
  });

  it("opens in a new tab without handing that tab this page", () => {
    const link = renderCredit();
    expect(link).toHaveAttribute("target", "_blank");

    // rel is checked by token rather than by exact string, so adding another
    // one later does not fail a test about these two.
    const rel = link.getAttribute("rel") ?? "";
    expect(rel.split(/\s+/)).toEqual(expect.arrayContaining(["noopener", "noreferrer"]));
  });

  /**
   * WCAG 2.5.3. Someone saying "click engineered by NAJDAWI" is reading the
   * page, so the accessible name has to begin with what is printed there — an
   * aria-label describing the link instead would leave the visible words
   * matching nothing anyone can say.
   */
  it("is named by the words a reader can see, then the ones they cannot", () => {
    const link = renderCredit();
    expect(link).toHaveAccessibleName(/engineered by\s+najdawi/i);
    expect(link).toHaveAccessibleName(/hashem najdawi/i);
  });

  it("warns that the tab will change before it changes", () => {
    expect(renderCredit()).toHaveAccessibleName(/opens in a new tab/i);
  });

  it("keeps the decoration out of the accessible name", () => {
    const link = renderCredit();

    // The hairlines either side of the label and the LinkedIn mark say nothing
    // that the text does not already say; announced, they would only pad the
    // name of a link whose whole job is to be short.
    const decorations = link.querySelectorAll("[aria-hidden='true']");
    expect(decorations.length).toBeGreaterThanOrEqual(3);
    expect(link.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });
});
