---
name: MMRC 26 Competition Day
description: The live site, hall screen and desks for the MMRC 26 micromouse competition, built from the maze itself.
colors:
  chalk: "#F4F1F5"
  panel: "#FFFFFF"
  sunk: "#EAE5EC"
  aubergine-ink: "#200D27"
  muted-ink: "#56445C"
  faint-ink: "#6E5F74"
  maze-floor: "#1B0C22"
  floor-ink: "#F6F0F7"
  wall-crimson: "#A3173A"
  live-rose: "#C4124A"
  leader-gold: "#855600"
  through-green: "#0E6B45"
  plum: "#6A2A78"
  night: "#130A18"
  night-panel: "#1D1124"
  night-ink: "#F4EEF5"
  night-crimson: "#FF8AA2"
  night-gold: "#F4B53A"
typography:
  display:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "clamp(2.5rem, 6vw, 5rem)"
    fontWeight: 800
    lineHeight: 0.95
    letterSpacing: "-0.02em"
    fontVariation: "'wdth' 118"
  headline:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 760
    lineHeight: 1.05
    fontVariation: "'wdth' 112"
  data:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 620
    fontFeature: "'tnum'"
    fontVariation: "'wdth' 78"
  body:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 600
  wordmark:
    fontFamily: "Bevan, serif"
    fontWeight: 400
rounded:
  cell: "3px"
  control: "6px"
  sheet: "14px"
spacing:
  post: "6px"
  cell: "8px"
  gutter: "16px"
  section: "96px"
components:
  button-primary:
    backgroundColor: "{colors.aubergine-ink}"
    textColor: "{colors.panel}"
    rounded: "{rounded.control}"
    height: "44px"
    padding: "0 18px"
  button-quiet:
    backgroundColor: "{colors.sunk}"
    textColor: "{colors.aubergine-ink}"
    rounded: "{rounded.control}"
    height: "44px"
  panel:
    backgroundColor: "{colors.panel}"
    rounded: "{rounded.cell}"
  floor-panel:
    backgroundColor: "{colors.maze-floor}"
    textColor: "{colors.floor-ink}"
    rounded: "{rounded.cell}"
---

# Design System: MMRC 26 Competition Day

## 1. Overview

**Creative North Star: "The Maze Floor"**

A micromouse maze is a board of cells, walls and the small square posts where walls meet. The day site is laid out the same way. Panels are cells with a post at each corner, sections are divided by walls that end in posts, progress is counted in cells, and the one thing that runs through the page is the crimson line of a mouse's route. Nothing is soft or floaty: surfaces are flat, edges are crisp, and depth comes from the dark maze floor that the live moments sit on.

It is a working surface for a real event, so it stays calm and legible first. Numbers are set like a timing board. The loud moments (a live match, the champion, the reveal on the hall screen) are loud because the rest is quiet.

It rejects the AI landing-page kit: pill badges, stat-card rows, eyebrow labels over every heading, icon tiles, glass bars, soft shadows, gradient text and cream paper.

**Key Characteristics:**
- Chalk light theme for the bright hall; aubergine night theme for the projected screen.
- One family, Archivo, used at three widths: wide for names, normal for reading, narrow for numbers.
- Posts and walls as the structural ornament; the crimson route as the one line of colour that moves.
- Flat surfaces, hairline edges, square-ish corners.

## 2. Colors: The Maze Palette

The brand's aubergine, crimson and gold, set on chalk by day and on the maze floor by night.

### Primary
- **Aubergine Ink** (#200D27): text, primary buttons, posts, and in light mode the dark maze-floor panels for live moments (#1B0C22).
- **Wall Crimson** (#A3173A / night #FF8AA2): the route, walls that carry meaning, the current place in the nav, the qualification line.

### Secondary
- **Leader Gold** (#855600 / night #F4B53A): first place, winners, the champion. Never decoration.
- **Live Rose** (#C4124A / night #FF5E8E): on the maze now. Always paired with the pulsing dot.
- **Through Green** (#0E6B45 / night #62D9A0): went through, checked in.

### Neutral
- **Chalk** (#F4F1F5): the page in light mode, a near-white tinted toward aubergine, not toward warmth.
- **Panel** (#FFFFFF): cells and tables.
- **Sunk** (#EAE5EC): wells, inputs at rest, quiet buttons.
- **Muted Ink** (#56445C) and **Faint Ink** (#6E5F74): secondary text; both pass 4.5:1 on chalk, panel and sunk.
- **Night** (#130A18) and **Night Panel** (#1D1124): the dark theme.

### Named Rules
**The Earned Colour Rule.** Gold, rose and green each mean one thing (lead, live, through). A colour that does not carry that meaning is ink.

## 3. Typography

**Display, body and data:** Archivo (variable, width axis 62 to 125)
**Wordmark:** Bevan, for "MMRC 26" only

**Character:** One family pulled to three widths. Team names and headings run wide like lettering on a start banner; times and scores run narrow and tabular like a timing board.

### Hierarchy
- **Display** (800, wdth 118, clamp(2.5rem, 6vw, 5rem), line-height 0.95): page titles.
- **Headline** (760, wdth 112, 1.75rem): section titles, set on a wall rule.
- **Data** (620, wdth 78, tabular): places, times, scores, counts. Every number on the site.
- **Body** (400, 1rem, line-height 1.6, max 68ch): prose and guides.
- **Label** (600, 0.8125rem, sentence case): field labels and metadata. No tracked uppercase.

### Named Rules
**The No Eyebrow Rule.** Headings carry their own context in a quiet line after them, never in a tracked uppercase label above.

## 4. Elevation

Flat. Surfaces sit on the page with a hairline edge and never cast a shadow at rest. Depth is tonal: the maze floor (dark) sits under the chalk page, and panels sit on chalk. Only things that float above the page (the follow card, sheets, dialogs) get one hard, short shadow.

### Shadow Vocabulary
- **Float** (`box-shadow: 0 1px 0 rgb(var(--day-line) / 0.08), 0 18px 40px -18px rgb(20 6 26 / 0.45)`): overlays only.

## 5. Components

### Cells (panels)
- **Shape:** 3px corners, 1px hairline edge at 14% ink.
- **Posts:** a 6px square of ink at each corner of a major panel, the maze post.
- **Floor cells:** the same shape on the maze floor, for what is live.

### Wall rules
- A 2px wall ending in a 6px post. A section title sits on the left end; the section's link sits on the right. The wall draws itself in when it enters the view.

### Buttons
- **Shape:** 6px corners, 44px tall (36px small).
- **Primary:** aubergine with white text. **Quiet:** sunk with ink text. **Danger:** rose outline.
- **States:** hover darkens 6%; active presses 1px; focus shows a 2px crimson ring offset 3px; disabled at 50%.

### Timing rows
- Place in a square block (gold, ink, crimson for the podium), crest, wide name, narrow numbers, gap to the leader. A row that moved since your last look shows its change (▲2) and slides to its new place.

### Navigation
- A flat bar. The current page is marked by a crimson wall under it that slides between items. On phones a solid tab bar docks to the bottom edge.

## 6. Do's and Don'ts

### Do:
- **Do** count in cells: one cell per team for progress, one per match for a round.
- **Do** set every number in the narrow tabular width.
- **Do** keep the route crimson and let it be the only moving line.
- **Do** give every animation a reduced-motion fallback that shows the end state.

### Don't:
- **Don't** use pill badges, stat-card rows, eyebrow labels, icon tiles in rounded squares, glass bars or gradient text.
- **Don't** add soft drop shadows to panels at rest.
- **Don't** use a colour for decoration; gold, rose and green are meanings.
- **Don't** put a card inside a card.
