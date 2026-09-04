import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { RULES } from "@/lib/rules";
import {
  highlight,
  rulebookSections,
  search,
  snippet,
  tokenize,
  type SearchDoc,
} from "@/lib/search";

const docs: SearchDoc[] = [
  {
    id: "a",
    title: "Robot rules",
    body: "Maximum footprint: 25cm by 25cm at any rotation. No jumping or climbing.",
    href: "/rules",
    kind: "rule",
  },
  {
    id: "b",
    title: "Scoring",
    body: "Speed runs must use only cells already discovered on a prior run. Search runs explore freely.",
    href: "/rules",
    kind: "rule",
  },
  {
    id: "c",
    title: "How big can the robot be?",
    body: "It must fit within 25cm by 25cm at any rotation.",
    href: "/faq",
    kind: "faq",
  },
];

describe("tokenize", () => {
  it("lowercases and splits on punctuation", () => {
    expect(tokenize("Speed-Run, scoring!")).toEqual(["speed", "run", "scoring"]);
  });

  it("drops single characters, which match everything equally", () => {
    expect(tokenize("a robot b")).toEqual(["robot"]);
  });

  it("returns nothing for an empty or symbol-only query", () => {
    expect(tokenize("")).toEqual([]);
    expect(tokenize("  ???  ")).toEqual([]);
  });
});

describe("search", () => {
  it("returns nothing for an empty query rather than everything", () => {
    expect(search(docs, "")).toEqual([]);
    expect(search(docs, "  ")).toEqual([]);
  });

  it("drops documents that match nothing", () => {
    expect(search(docs, "gearbox")).toEqual([]);
  });

  it("ranks a title match above a body match", () => {
    const hits = search(docs, "scoring");
    expect(hits[0]!.id).toBe("b");
  });

  it("prefers a document containing every term", () => {
    // "speed" appears only in b; "run" in b as well. A doc with both wins.
    const hits = search(docs, "speed run");
    expect(hits[0]!.id).toBe("b");
  });

  it("finds the same fact in the rulebook and the FAQ", () => {
    const ids = search(docs, "footprint rotation").map((h) => h.id);
    expect(ids).toContain("a");
  });

  it("is case-insensitive", () => {
    expect(search(docs, "ROBOT").length).toBe(search(docs, "robot").length);
  });

  it("attaches a snippet to every hit", () => {
    for (const hit of search(docs, "25cm")) expect(hit.snippet.length).toBeGreaterThan(0);
  });

  it("honours the limit", () => {
    expect(search(docs, "runs rotation robot", 1)).toHaveLength(1);
  });
});

describe("snippet", () => {
  it("returns short bodies whole", () => {
    expect(snippet("A short line.", ["short"])).toBe("A short line.");
  });

  it("windows around the match rather than starting at the beginning", () => {
    const body = `${"filler ".repeat(60)}needle ${"tail ".repeat(60)}`;
    const out = snippet(body, ["needle"]);
    expect(out).toContain("needle");
    expect(out.startsWith("…")).toBe(true);
  });

  it("falls back to the opening when nothing matches", () => {
    const out = snippet(`${"word ".repeat(100)}`, ["absent"]);
    expect(out.length).toBeGreaterThan(0);
    expect(out.endsWith("…")).toBe(true);
  });

  it("copes with an empty body", () => {
    expect(snippet("", ["x"])).toBe("");
  });
});

describe("highlight", () => {
  it("splits matched terms out of the surrounding text", () => {
    const parts = highlight("The speed run rule", ["speed"]);
    expect(parts.map((p) => p.text).join("")).toBe("The speed run rule");
    expect(parts.filter((p) => p.hit).map((p) => p.text)).toEqual(["speed"]);
  });

  it("matches regardless of case but keeps the original casing", () => {
    const parts = highlight("Speed runs", ["speed"]);
    expect(parts.find((p) => p.hit)?.text).toBe("Speed");
  });

  it("never loses or duplicates text", () => {
    const text = "Search runs and speed runs";
    expect(highlight(text, ["run", "speed"]).map((p) => p.text).join("")).toBe(text);
  });

  it("treats regex characters in a query as literal", () => {
    expect(() => highlight("a (b) c", ["("])).not.toThrow();
  });

  it("returns the text untouched when there are no terms", () => {
    expect(highlight("anything", [])).toEqual([{ text: "anything", hit: false }]);
  });
});

describe("rulebookSections", () => {
  const mdx = readFileSync(
    path.resolve(process.cwd(), "content/rules/rulebook.mdx"),
    "utf8",
  );
  const sections = rulebookSections(mdx);

  it("splits the real rulebook into its headed sections", () => {
    const titles = sections.map((s) => s.title);
    expect(titles).toContain("Eligibility");
    expect(titles).toContain("The maze");
    expect(titles).toContain("The robot");
  });

  it("keeps the prose but strips the embedded diagram components", () => {
    const maze = sections.find((s) => s.title === "The maze")!;
    expect(maze.body).toContain(`${RULES.mazeGrid}×${RULES.mazeGrid}`);
    expect(maze.body).not.toContain("<MazeAnatomy");
    expect(maze.body).not.toContain("/>");
  });

  it("strips markdown emphasis so it does not surface in snippets", () => {
    for (const section of sections) expect(section.body).not.toMatch(/\*\*/);
  });

  it("gives every section a unique id and a link", () => {
    const ids = new Set(sections.map((s) => s.id));
    expect(ids.size).toBe(sections.length);
    for (const s of sections) expect(s.href).toBe("/rules");
  });

  it("makes the real rulebook searchable end to end", () => {
    const hits = search(sections, "footprint");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]!.title).toBe("The robot");
  });
});
