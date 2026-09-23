import type { DayIconName } from "@/components/day-site/icons";

/** Every HQ desk, in the order the tabs show them. Each opens by its own role. */
export const DESKS: readonly { href: string; label: string; blurb: string; icon: DayIconName }[] = [
  { href: "/day/hq", label: "Overview", blurb: "Everything at a glance.", icon: "live" },
  { href: "/day/hq/check-in", label: "Check-in", blurb: "Arrivals, members, badges, inspection and pits.", icon: "badge" },
  { href: "/day/hq/scoring", label: "Qualifying", blurb: "Enter each team's run times; the score works itself out.", icon: "timer" },
  { href: "/day/hq/scoring/bracket", label: "Bracket", blurb: "Draw the top 32 and enter every match.", icon: "bracket" },
  { href: "/day/hq/announcements", label: "Announcements", blurb: "News, and alerts that pop up on every screen.", icon: "megaphone" },
  { href: "/day/hq/photos", label: "Photos", blurb: "Add photos from the hall; they go live on the day site and the screen.", icon: "camera" },
  { href: "/day/hq/guides", label: "Guides", blurb: "The competitor, volunteer, organizer and venue pages.", icon: "book" },
  { href: "/day/hq/volunteers", label: "Volunteers", blurb: "Who is where, and when.", icon: "hand" },
  { href: "/day/hq/access", label: "Access", blurb: "Who can open the day site, and going live.", icon: "lock" },
];
