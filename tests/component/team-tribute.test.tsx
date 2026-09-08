import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";

import { TributeStage, type TributePerson } from "@/components/team/TributeStage";
import { TributeTrigger } from "@/components/team/TributeTrigger";

/**
 * The honourable mentions on the Team page.
 *
 * What is pinned here is the behaviour that a restyle would quietly take away,
 * and every one of these has a specific way of going wrong.
 *
 * A card only becomes a button when something has been written about that
 * person — the roster is filled in over weeks, and a card that invites a click
 * and then opens an empty stage is worse than the plain card it replaced. The
 * arrows walk past those people for the same reason. Focus has to come back to
 * the card behind the dialog, which after arrowing across the committee is not
 * the card that opened it. And the scrim has to be between the stage and the
 * words, because it is the only thing standing between a tribute and whatever
 * photograph somebody uploads for it next year.
 */

afterEach(() => {
  cleanup();
});

const PEOPLE: TributePerson[] = [
  {
    id: "m1",
    name: "Lina Haddad",
    role: "Head of Logistics",
    department: "Operations",
    photoUrl: null,
    stageUrl: null,
    tribute: "For turning a car park into an arena in one night.",
  },
  {
    id: "m2",
    name: "Omar Nasser",
    role: "Member",
    department: "Operations",
    photoUrl: null,
    stageUrl: null,
    // Nobody has written anything for Omar yet.
    tribute: "",
  },
  {
    id: "m3",
    name: "Sara Khoury",
    role: "Judge",
    department: "Judging",
    photoUrl: null,
    stageUrl: null,
    tribute: "For settling every disputed run before anybody thought to argue.",
  },
];

function Committee({ people = PEOPLE }: { people?: TributePerson[] }) {
  return (
    <TributeStage people={people}>
      {people.map((person) => (
        <TributeTrigger
          key={person.id}
          id={person.id}
          hasTribute={person.tribute.trim().length > 0}
          className="card"
        >
          <span>{person.name}</span>
        </TributeTrigger>
      ))}
    </TributeStage>
  );
}

const cardFor = (name: string) => screen.getByRole("button", { name: new RegExp(name, "i") });

function open(name: string) {
  fireEvent.click(cardFor(name));
  return screen.getByRole("dialog");
}

describe("the committee tributes", () => {
  it("opens the person that was clicked, with what was written about them", () => {
    render(<Committee />);

    const dialog = open("Lina Haddad");

    expect(within(dialog).getByText(/car park into an arena/i)).toBeInTheDocument();
    expect(within(dialog).getByRole("heading", { name: "Lina Haddad" })).toBeInTheDocument();
    // Named for assistive tech by the person, not by the word "dialog".
    expect(screen.getByRole("dialog", { name: /Lina Haddad/i })).toBe(dialog);
  });

  it("leaves a card alone until somebody has written something about them", () => {
    render(<Committee />);

    expect(screen.queryByRole("button", { name: /Omar Nasser/i })).toBeNull();
    // Still on the page, though — he is on the committee either way.
    expect(screen.getByText("Omar Nasser")).toBeInTheDocument();
  });

  it("walks past the people who have nothing written about them", () => {
    render(<Committee />);

    const dialog = open("Lina Haddad");
    expect(within(dialog).getByText("1 of 2")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /next person/i }));

    const next = screen.getByRole("dialog");
    expect(within(next).getByText(/every disputed run/i)).toBeInTheDocument();
    expect(within(next).getByText("2 of 2")).toBeInTheDocument();
    expect(within(next).queryByText(/Omar Nasser/i)).toBeNull();
  });

  it("wraps at the end rather than dead-ending on a disabled arrow", () => {
    render(<Committee />);

    open("Lina Haddad");
    fireEvent.keyDown(document, { key: "ArrowLeft" });

    // One step back from the first person is the last one.
    expect(within(screen.getByRole("dialog")).getByText(/every disputed run/i)).toBeInTheDocument();
  });

  it("closes on Escape and puts focus back on the card behind it", () => {
    render(<Committee />);

    open("Lina Haddad");
    fireEvent.keyDown(document, { key: "ArrowRight" });
    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("dialog")).toBeNull();
    // Sara's card, not Lina's: that is the one the visitor was just looking at.
    expect(document.activeElement).toBe(cardFor("Sara Khoury"));
  });

  it("holds the page still underneath, and lets it go again", () => {
    render(<Committee />);

    open("Lina Haddad");
    expect(document.body.style.overflow).toBe("hidden");

    fireEvent.keyDown(document, { key: "Escape" });
    expect(document.body.style.overflow).not.toBe("hidden");
  });

  it("keeps the scrim between the stage and the words", () => {
    render(<Committee />);

    const dialog = open("Lina Haddad");
    const scrim = dialog.querySelector(".tribute-scrim");

    expect(scrim).not.toBeNull();
    // Painted before the text, and the text is not inside it — the whole point
    // is that the words sit on top of the scrim rather than under it.
    const words = within(dialog).getByText(/car park into an arena/i);
    expect(scrim!.contains(words)).toBe(false);
    expect(scrim!.compareDocumentPosition(words) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("is presented by the chapter, not by the competition's own committee", () => {
    // The mention is issued by IEEE RAS HTU. It is their recognition to give,
    // and signing it "the MMRC 26 committee" would have the organisers thanking
    // themselves — so the chapter's lockup signs it and the old sign-off is
    // gone rather than merely reworded.
    render(<Committee />);

    const dialog = open("Lina Haddad");

    expect(within(dialog).getByText(/presented by/i)).toBeInTheDocument();
    expect(within(dialog).getByAltText("IEEE RAS HTU Student Chapter")).toBeInTheDocument();
    expect(within(dialog).queryByText(/mmrc 26 committee/i)).toBeNull();
    expect(within(dialog).queryByText(/with thanks/i)).toBeNull();
  });

  it("darkens the scrim for an uploaded picture, and lifts it for a composed stage", () => {
    // The two ramps answer two different risks. A composed stage is built from
    // colours this codebase pins dark, so it gets almost no scrim and the
    // colour reads. An uploaded picture is whatever somebody chooses later and
    // could be white, so it gets the heavy one. Collapsing these back into one
    // ramp either mutes every stage or puts the type at the mercy of a JPEG.
    const withStage: TributePerson[] = [
      { ...PEOPLE[0]!, stageUrl: "https://example.public.blob.vercel-storage.com/team/stages/a.jpg" },
    ];

    const { rerender } = render(<Committee people={withStage} />);
    const uploaded = open("Lina Haddad");
    expect(uploaded.querySelector("img[src*='stages']")).not.toBeNull();
    expect(uploaded.querySelector(".tribute-scrim--photo")).not.toBeNull();

    fireEvent.keyDown(document, { key: "Escape" });
    rerender(<Committee people={[PEOPLE[0]!]} />);

    // No upload, and still a stage — just one composed from their id instead.
    const composed = open("Lina Haddad");
    expect(composed.querySelector("img[src*='stages']")).toBeNull();
    expect(composed.querySelector(".tribute-scrim")).not.toBeNull();
    expect(composed.querySelector(".tribute-scrim--photo")).toBeNull();
  });
});
