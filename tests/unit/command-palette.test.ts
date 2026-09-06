import { describe, expect, it } from "vitest";
import {
  type Command,
  isSubsequence,
  rankCommands,
  scoreCommand,
  wrapIndex,
} from "@/lib/command-palette";
import { ADMIN_LINKS } from "@/lib/admin-nav";

/**
 * The palette's whole value is that the first row is the right one — nobody
 * reads a ranked list, they press Enter. So the ordering rules are worth
 * pinning down: they are invisible when correct and infuriating when not.
 */

const command = (label: string, extra: Partial<Command> = {}): Command => ({
  id: label,
  label,
  href: `/admin/${label.toLowerCase()}`,
  group: "Pages",
  ...extra,
});

describe("isSubsequence", () => {
  it("finds characters in order, with gaps", () => {
    expect(isSubsequence("competition day", "cmpday")).toBe(true);
  });

  it("rejects characters that appear out of order", () => {
    expect(isSubsequence("payments", "syap")).toBe(false);
  });

  it("treats an empty query as matching", () => {
    expect(isSubsequence("anything", "")).toBe(true);
  });
});

describe("scoreCommand", () => {
  const ordered: Array<[string, Command, string]> = [
    ["an exact label", command("Payments"), "payments"],
    ["a label prefix", command("Payments"), "pay"],
    ["a word prefix", command("Register Form"), "form"],
    ["a label substring", command("Broadcasts"), "cast"],
    ["a keyword", command("Email Lists", { keywords: "broadcast" }), "broadcast"],
    ["a subsequence", command("Competition Day"), "cmpday"],
  ];

  it("ranks the match kinds in the order they are listed", () => {
    const scores = ordered.map(([, cmd, query]) => scoreCommand(cmd, query)!);
    for (let i = 1; i < scores.length; i += 1) {
      expect(scores[i - 1]!).toBeGreaterThan(scores[i]!);
    }
  });

  it("returns null when nothing matches at all", () => {
    expect(scoreCommand(command("Payments"), "zzz")).toBeNull();
  });

  it("ignores case on both sides", () => {
    expect(scoreCommand(command("Payments"), "PAY")).toBe(scoreCommand(command("payments"), "pay"));
  });

  it("matches the hint, which is where a team's email address lives", () => {
    const team = command("Maze Runners", { hint: "captain@htu.edu.jo" });
    expect(scoreCommand(team, "htu.edu")).not.toBeNull();
  });

  it("scores everything the same for an empty query", () => {
    expect(scoreCommand(command("Payments"), "")).toBe(0);
    expect(scoreCommand(command("Gallery"), "   ")).toBe(0);
  });
});

describe("rankCommands", () => {
  it("keeps the given order when there is no query", () => {
    const ranked = rankCommands(ADMIN_LINKS.map((link) => command(link.label)), "");
    expect(ranked.map((c) => c.label)).toEqual(ADMIN_LINKS.map((link) => link.label));
  });

  it("drops everything that does not match", () => {
    const ranked = rankCommands([command("Payments"), command("Gallery")], "pay");
    expect(ranked.map((c) => c.label)).toEqual(["Payments"]);
  });

  it("puts a prefix match above a merely-contained one", () => {
    const ranked = rankCommands([command("Broadcasts"), command("Cast List")], "cast");
    expect(ranked[0]!.label).toBe("Cast List");
  });

  it("holds the original order between equally good matches", () => {
    const ranked = rankCommands([command("Pages"), command("Payments")], "pa");
    expect(ranked.map((c) => c.label)).toEqual(["Pages", "Payments"]);
  });

  it("finds the real admin pages by the words people use for them", () => {
    const commands = ADMIN_LINKS.map((link) =>
      command(link.label, { keywords: link.keywords, href: link.href }),
    );

    expect(rankCommands(commands, "pay")[0]!.label).toBe("Payments");
    expect(rankCommands(commands, "photos")[0]!.label).toBe("Gallery");
    expect(rankCommands(commands, "broadcast")[0]!.label).toBe("Email Lists");
    expect(rankCommands(commands, "cmpday")[0]!.label).toBe("Competition Day");
  });
});

describe("wrapIndex", () => {
  it("wraps past the end and before the start", () => {
    expect(wrapIndex(3, 3)).toBe(0);
    expect(wrapIndex(-1, 3)).toBe(2);
  });

  it("leaves an index inside the list alone", () => {
    expect(wrapIndex(1, 3)).toBe(1);
  });

  it("selects nothing when there is nothing to select", () => {
    expect(wrapIndex(0, 0)).toBe(-1);
  });
});
