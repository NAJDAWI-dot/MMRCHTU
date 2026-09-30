/**
 * Moving qualifying slots on the day: a break, a late start, a maze that
 * needed fixing. Plain clock arithmetic on "HH:MM", in the hall's own time, so
 * it can be tested without a calendar.
 *
 * A shifted team keeps its new time as its own slot time (TeamDayStatus
 * .slotTime), which is what the queue, the team pages and the hall screen
 * already read before working one out from the order.
 */

const DAY_MINUTES = 24 * 60;

function toMinutes(clock: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(clock.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function fromMinutes(total: number): string {
  const wrapped = ((total % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
  return `${String(Math.floor(wrapped / 60)).padStart(2, "0")}:${String(wrapped % 60).padStart(2, "0")}`;
}

/** A clock time moved by some minutes, either way, round the clock if it must. */
export function addMinutes(clock: string, minutes: number): string | null {
  const at = toMinutes(clock);
  return at === null ? null : fromMinutes(at + Math.round(minutes));
}

/** Minutes from one clock time to another, the short way round: "09:40" to "09:55" is 15. */
export function minutesBetween(from: string, to: string): number | null {
  const a = toMinutes(from);
  const b = toMinutes(to);
  if (a === null || b === null) return null;
  let difference = (b - a) % DAY_MINUTES;
  if (difference > DAY_MINUTES / 2) difference -= DAY_MINUTES;
  if (difference <= -DAY_MINUTES / 2) difference += DAY_MINUTES;
  return difference;
}

/** Where the draw put a place in the order: the start plus a slot for every place before it. */
export function drawnClock(start: string, slotMinutes: number, runOrder: number): string | null {
  return addMinutes(start, (runOrder - 1) * slotMinutes);
}

export interface SlotTeam {
  id: string;
  runOrder: number | null;
  /** When it runs now, "09:40", or "" when it has no slot. */
  slot: string;
}

/** The limit either way on one shift, so a slipped key cannot move the day by hours. */
export const MAX_SHIFT = 180;

/**
 * Every team from a place in the order onwards, moved by some minutes. The
 * teams before it keep their times. Returns the new slot time for each team
 * that moves.
 */
export function planShift(teams: SlotTeam[], from: number, minutes: number): { id: string; slotTime: string }[] {
  return teams
    .filter((team) => team.runOrder !== null && team.runOrder >= from && team.slot)
    .sort((a, b) => a.runOrder! - b.runOrder!)
    .flatMap((team) => {
      const slotTime = addMinutes(team.slot, minutes);
      return slotTime ? [{ id: team.id, slotTime }] : [];
    });
}
