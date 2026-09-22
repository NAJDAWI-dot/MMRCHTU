/**
 * The long-form pages of the day site, and the tiny format they are written in.
 *
 * Stored in DayGuide rows, edited on the Media desk. Until a guide is saved the
 * default below is shown, written so that it is true for any MMRC day and names
 * nothing (a time, a room) that the committee has not decided. The specifics go
 * in from the admin screen.
 *
 * The format is plain text: a line starting "## " is a heading, a line starting
 * "- " is a list item, blank lines separate paragraphs. Parsed into blocks and
 * rendered as React children, never as markup, so nothing an admin types can
 * inject anything into the page.
 */

export const GUIDE_SLUGS = ["competitors", "volunteers", "organizers", "venue"] as const;
export type GuideSlug = (typeof GUIDE_SLUGS)[number];

export function isGuideSlug(value: string): value is GuideSlug {
  return (GUIDE_SLUGS as readonly string[]).includes(value);
}

export const GUIDE_BODY_MAX = 8000;

export interface GuideDefault {
  title: string;
  kicker: string;
  body: string;
}

export const GUIDE_DEFAULTS: Record<GuideSlug, GuideDefault> = {
  competitors: {
    title: "Your day as a competitor",
    kicker: "For teams",
    body: `## When you arrive
Come to the registration desk first, with your whole team and your robot. The desk checks you in, confirms your team name, and tells you where your pit table is.

## Inspection
Before your first run, the judges inspect your robot against the rulebook: size, weight, sensors, nothing that damages the maze. A robot that fails can be fixed and inspected again. It cannot run until it passes.

## Qualifying
Every team runs in qualifying. Your best run counts, and the top 32 teams go through to the knockout. The standings page updates as runs are recorded, so you can see where you are all day.

## The knockout
The top 32 are seeded by their qualifying score. First plays thirty-second, second plays thirty-first, and so on. Win and you go through to the round of 16, then the quarter-finals, the semi-finals and the final. The bracket page shows every match as it is decided.

## What to bring
- Your robot, charged, and a spare battery
- A laptop and cable to flash firmware
- Tools for quick repairs
- Your student ID

## Fair play
Only your team touches your robot. Ask a judge before you touch the maze. If you think a run was scored wrongly, tell the scoring desk straight away, before the next match starts.`,
  },
  volunteers: {
    title: "Volunteering on the day",
    kicker: "For volunteers",
    body: `## Before doors open
Come to the briefing at the organizers' desk. You will get your station, your shift and the name of the person you report to.

## At your station
Stay at your station until someone takes over from you. If you need a break, tell your lead first so the station is never left empty.

## Stations
- Registration desk: checking teams in and pointing them to their pit
- Inspection: helping the judges measure and weigh robots
- Maze marshals: keeping the maze clear and resetting between runs
- Scoring runners: bringing results from the maze to the scoring desk
- Media: photos and posts through the day
- Floor: answering questions and keeping walkways clear

## If something goes wrong
Tell your lead or the organizers' desk. Do not fix a scoring problem yourself: every result goes through the scoring desk.`,
  },
  organizers: {
    title: "Organizers and who to ask",
    kicker: "Organizing committee",
    body: `## Who does what
- Registration desk: check-in, team details and payments
- Scoring desk: qualifying runs, the bracket and every result
- Inspection: robot checks against the rulebook
- Media desk: announcements, photos and this site
- Operations: the schedule, the venue and the volunteers

## Need something?
Start at the registration desk. If they cannot help, they will find the person who can.`,
  },
  venue: {
    title: "The venue",
    kicker: "Getting there",
    body: `## Where
The venue and date are at the top of the live page. The organizers will post the exact hall and entrance here before the day.

## Inside
- The maze area is for competitors and judges only
- Pit tables are allocated at check-in
- Ask at the registration desk for power sockets, water and first aid`,
  },
};

export type GuideBlock =
  | { kind: "heading"; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "list"; items: string[] };

/** Plain text into headings, paragraphs and lists. */
export function parseGuide(body: string): GuideBlock[] {
  const blocks: GuideBlock[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];

  const flush = () => {
    if (paragraph.length) blocks.push({ kind: "paragraph", text: paragraph.join(" ") });
    if (list.length) blocks.push({ kind: "list", items: list });
    paragraph = [];
    list = [];
  };

  for (const raw of body.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trim();
    if (!line) {
      flush();
    } else if (line.startsWith("## ")) {
      flush();
      blocks.push({ kind: "heading", text: line.slice(3).trim() });
    } else if (line.startsWith("- ")) {
      if (paragraph.length) {
        blocks.push({ kind: "paragraph", text: paragraph.join(" ") });
        paragraph = [];
      }
      list.push(line.slice(2).trim());
    } else {
      if (list.length) {
        blocks.push({ kind: "list", items: list });
        list = [];
      }
      paragraph.push(line);
    }
  }
  flush();
  return blocks;
}
