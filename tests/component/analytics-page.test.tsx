import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";

/**
 * Renders the analytics page against a known dataset.
 *
 * The shaping helpers are tested directly in tests/unit/analytics.test.ts;
 * what this covers is the wiring — that the page asks for the right things and
 * puts the right number under the right label. A transposed pair of counts
 * would pass every unit test and still mislead whoever reads the page.
 */

const db = {
  registration: { findMany: vi.fn() },
  teamMember: { findMany: vi.fn() },
  gameScore: { findMany: vi.fn() },
  faqEntry: { count: vi.fn() },
  faqQuestion: { findMany: vi.fn() },
  broadcastList: { count: vi.fn() },
  broadcastContact: { count: vi.fn() },
  broadcast: { findMany: vi.fn() },
};

vi.mock("@/lib/prisma", () => ({ prisma: db }));

const { default: AnalyticsPage } = await import("@/app/admin/(protected)/analytics/page");

/** Two teams: one confirmed team of three, one pending solo team. */
function seed() {
  const today = new Date();
  db.registration.findMany.mockResolvedValue([
    { id: "t1", status: "CONFIRMED", createdAt: today, memberCount: 3 },
    { id: "t2", status: "PENDING", createdAt: today, memberCount: 1 },
  ]);
  db.teamMember.findMany.mockResolvedValue([
    { registrationId: "t1", university: "HTU", major: "Mechatronics", ieeeStatus: "IEEE_RAS_MEMBER" },
    { registrationId: "t1", university: "HTU", major: "Mechatronics", ieeeStatus: "IEEE_MEMBER" },
    { registrationId: "t1", university: "UJ", major: "Computer Engineering", ieeeStatus: "NON_MEMBER" },
    { registrationId: "t2", university: "HTU", major: "Mechatronics", ieeeStatus: "NON_MEMBER" },
  ]);
  db.gameScore.findMany.mockResolvedValue([
    { mode: "classic", score: 900, level: 4, playerName: "Ada" },
    { mode: "classic", score: 300, level: 2, playerName: "ada" },
    { mode: "firstperson", score: 150, level: 1, playerName: "Bob" },
  ]);
  db.faqEntry.count.mockResolvedValue(7);
  db.faqQuestion.findMany.mockResolvedValue([{ status: "PENDING" }, { status: "ANSWERED" }]);
  db.broadcastList.count.mockResolvedValue(2);
  db.broadcastContact.count.mockResolvedValue(11);
  db.broadcast.findMany.mockResolvedValue([
    { sentCount: 10, failedCount: 1 },
    { sentCount: 5, failedCount: 0 },
  ]);
}

// Vitest runs without `globals: true`, so Testing Library never registers its
// automatic cleanup and renders would otherwise stack up between cases.
afterEach(cleanup);

/** The headline tile carrying a given label. */
function tile(label: string) {
  const el = screen.getByText(label).closest("div");
  if (!el) throw new Error(`no tile for ${label}`);
  return el;
}

/** The panel with a given heading. */
function panel(title: string) {
  const el = screen.getByRole("heading", { name: title }).closest("div");
  if (!el) throw new Error(`no panel for ${title}`);
  return el;
}

describe("analytics page", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    seed();
    render(await AnalyticsPage());
  });

  it("counts teams and participants separately", () => {
    // Two registrations, four people across them — the distinction the old
    // public counters never made.
    expect(within(tile("Teams registered")).getByText("2")).toBeTruthy();
    expect(within(tile("Participants")).getByText("4")).toBeTruthy();
  });

  it("reports the confirmed subset and the average team size", () => {
    expect(within(tile("Teams registered")).getByText(/1 confirmed/)).toBeTruthy();
    expect(within(tile("Participants")).getByText(/2 per team on average/)).toBeTruthy();
  });

  it("counts IEEE members as people, not teams, with their share", () => {
    // Two of the four participants hold some IEEE membership.
    expect(within(tile("IEEE members")).getByText("2")).toBeTruthy();
    expect(within(tile("IEEE members")).getByText(/50% of participants/)).toBeTruthy();
  });

  it("counts game plays and folds differently-cased names into one player", () => {
    expect(within(tile("Pac Mouse plays")).getByText("3")).toBeTruthy();
    expect(within(tile("Pac Mouse plays")).getByText(/2 distinct players/)).toBeTruthy();
  });

  it("breaks registrations down by status", () => {
    const statuses = panel("Status");
    expect(within(statuses).getByText("Pending")).toBeTruthy();
    expect(within(statuses).getByText("Confirmed")).toBeTruthy();
  });

  it("ranks universities by how many participants come from each", () => {
    const unis = panel("Universities");
    expect(within(unis).getByText("HTU")).toBeTruthy();
    expect(within(unis).getByText("UJ")).toBeTruthy();
  });

  it("shows the best score and level reached", () => {
    const game = panel("Pac Mouse");
    expect(within(game).getByText("900")).toBeTruthy();
    expect(within(game).getByText("4")).toBeTruthy();
  });

  it("surfaces failed sends rather than only successful ones", () => {
    const ops = panel("Questions and email");
    expect(within(ops).getByText("15")).toBeTruthy();
    expect(within(ops).getByText(/1 failed/)).toBeTruthy();
  });

  it("says the numbers are admin-only", () => {
    expect(screen.getByText(/public site no longer shows any of them/i)).toBeTruthy();
  });
});

describe("analytics page with an empty database", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    db.registration.findMany.mockResolvedValue([]);
    db.teamMember.findMany.mockResolvedValue([]);
    db.gameScore.findMany.mockResolvedValue([]);
    db.faqEntry.count.mockResolvedValue(0);
    db.faqQuestion.findMany.mockResolvedValue([]);
    db.broadcastList.count.mockResolvedValue(0);
    db.broadcastContact.count.mockResolvedValue(0);
    db.broadcast.findMany.mockResolvedValue([]);
    render(await AnalyticsPage());
  });

  it("renders zeros instead of crashing or showing NaN", () => {
    expect(screen.queryByText(/NaN/)).toBeNull();
    expect(within(tile("Teams registered")).getByText("0")).toBeTruthy();
  });

  it("explains the emptiness rather than looking broken", () => {
    expect(screen.getByText(/No registrations yet/i)).toBeTruthy();
  });

  it("says so where the game board is empty", () => {
    expect(screen.getByText(/Nobody has saved a score yet/i)).toBeTruthy();
  });
});
