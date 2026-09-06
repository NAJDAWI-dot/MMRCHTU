/**
 * The committee's shape: ranks, ordering, and how the page is grouped.
 *
 * Free of Prisma, React and the blob store, so the part that is easy to get
 * quietly wrong — somebody disappearing from the page because their department
 * was deleted, or a co-chair sorting below a department head — is tested
 * directly instead of by loading a page and squinting at it.
 */

import { EXTENSION_FOR_IMAGE_TYPE, slugify, type AllowedImageType } from "@/lib/gallery";

/* -------------------------------------------------------------------------- */
/* Rank                                                                        */
/* -------------------------------------------------------------------------- */

export type CommitteeRank = "CHAIR" | "CO_CHAIR" | "DEPARTMENT_HEAD" | "MEMBER";

/** In hierarchy order, which is also the order the admin dropdown offers them. */
export const COMMITTEE_RANKS: readonly CommitteeRank[] = [
  "CHAIR",
  "CO_CHAIR",
  "DEPARTMENT_HEAD",
  "MEMBER",
] as const;

export const COMMITTEE_RANK_LABELS: Record<CommitteeRank, string> = {
  CHAIR: "Chair",
  CO_CHAIR: "Co-Chair",
  DEPARTMENT_HEAD: "Department head",
  MEMBER: "Member",
};

/** What the admin form says about where each rank will appear. */
export const COMMITTEE_RANK_HINTS: Record<CommitteeRank, string> = {
  CHAIR: "Top of the page, above the departments.",
  CO_CHAIR: "Beside the chair.",
  DEPARTMENT_HEAD: "Leads their department's section.",
  MEMBER: "Listed under their department.",
};

export function isCommitteeRank(value: unknown): value is CommitteeRank {
  return typeof value === "string" && (COMMITTEE_RANKS as readonly string[]).includes(value);
}

export function parseCommitteeRank(value: unknown): CommitteeRank {
  return isCommitteeRank(value) ? value : "MEMBER";
}

/** Lower sorts first. */
export function rankOrder(rank: string): number {
  const at = (COMMITTEE_RANKS as readonly string[]).indexOf(rank);
  // An unrecognised rank sorts last rather than first: it is a data problem,
  // and it must not put an unknown row above the chair.
  return at === -1 ? COMMITTEE_RANKS.length : at;
}

/**
 * Whether this rank sits above the departments.
 *
 * Rank decides, not the department field. A chair who has also been given a
 * department — which the admin form allows, because people do lead a
 * department as well as chair — still belongs at the top of the page, and
 * appearing twice would be worse than appearing once in the right place.
 */
export function isLeadership(rank: string): boolean {
  return rank === "CHAIR" || rank === "CO_CHAIR";
}

/* -------------------------------------------------------------------------- */
/* Grouping                                                                    */
/* -------------------------------------------------------------------------- */

export interface RosterMemberLike {
  id: string;
  name: string;
  rank: string;
  departmentId: string | null;
  sortOrder: number;
}

export interface RosterDepartmentLike {
  id: string;
  name: string;
  sortOrder: number;
}

export interface RosterGroup<D, M> {
  department: D;
  /** Usually one, but co-heads happen and the page should not have to guess. */
  heads: M[];
  members: M[];
}

export interface Roster<D, M> {
  leadership: M[];
  groups: RosterGroup<D, M>[];
  /**
   * People with no department, or whose department has been deleted.
   *
   * Never silently dropped. A committee page that quietly loses somebody
   * because a department was reorganised is worse than one with an "and also"
   * section, and on the admin screen this is the list that tells you there is
   * something to reassign.
   */
  unassigned: M[];
}

/** Within a rank: the order an admin set, then alphabetically as a tiebreak. */
function byRankThenOrder<M extends RosterMemberLike>(a: M, b: M): number {
  const rank = rankOrder(a.rank) - rankOrder(b.rank);
  if (rank !== 0) return rank;
  if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
  return a.name.localeCompare(b.name);
}

function byOrderThenName<D extends RosterDepartmentLike>(a: D, b: D): number {
  if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
  return a.name.localeCompare(b.name);
}

/**
 * Arranges departments and members into the shape the page renders.
 *
 * Empty departments are kept in the result rather than filtered out here: the
 * public page skips them, and the admin page needs to show them precisely
 * because they are empty and somebody has to fill them.
 */
export function buildRoster<D extends RosterDepartmentLike, M extends RosterMemberLike>(
  departments: readonly D[],
  members: readonly M[],
): Roster<D, M> {
  const known = new Set(departments.map((department) => department.id));

  const leadership: M[] = [];
  const unassigned: M[] = [];
  const byDepartment = new Map<string, M[]>();

  for (const member of members) {
    if (isLeadership(member.rank)) {
      leadership.push(member);
      continue;
    }

    // A departmentId pointing at something that no longer exists is treated the
    // same as none at all. The foreign key nulls it on delete, but a stale read
    // or an import could still produce one, and the person must still appear.
    if (!member.departmentId || !known.has(member.departmentId)) {
      unassigned.push(member);
      continue;
    }

    const bucket = byDepartment.get(member.departmentId);
    if (bucket) bucket.push(member);
    else byDepartment.set(member.departmentId, [member]);
  }

  const groups = [...departments].sort(byOrderThenName).map((department) => {
    const own = (byDepartment.get(department.id) ?? []).sort(byRankThenOrder);
    return {
      department,
      heads: own.filter((member) => member.rank === "DEPARTMENT_HEAD"),
      members: own.filter((member) => member.rank !== "DEPARTMENT_HEAD"),
    };
  });

  return {
    leadership: leadership.sort(byRankThenOrder),
    groups,
    unassigned: unassigned.sort(byRankThenOrder),
  };
}

/** How many people the roster actually shows, across every section. */
export function rosterSize<D, M>(roster: Roster<D, M>): number {
  return (
    roster.leadership.length +
    roster.unassigned.length +
    roster.groups.reduce((total, group) => total + group.heads.length + group.members.length, 0)
  );
}

/* -------------------------------------------------------------------------- */
/* Presentation                                                                */
/* -------------------------------------------------------------------------- */

/**
 * The letters shown when somebody has no portrait yet.
 *
 * Two at most, and taken from the first and last word, so "Hatem Al Muwadea"
 * gives HM rather than HAM. Falls back to a single character, and to "?" for a
 * name made entirely of punctuation, because the circle has to contain
 * something or the layout develops a hole.
 */
export function initials(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .map((word) => [...word].find((char) => /\p{L}|\p{N}/u.test(char)))
    .filter((char): char is string => Boolean(char));

  if (words.length === 0) return "?";
  if (words.length === 1) return words[0]!.toUpperCase();
  return `${words[0]}${words[words.length - 1]}`.toUpperCase();
}

/**
 * A safe storage key for a committee portrait.
 *
 * Same rules as the gallery's: nothing from the uploaded filename survives,
 * and the extension comes from the type the bytes were verified to be rather
 * than from anything the uploader wrote. The name is folded in only so a file
 * pulled out of the store months later can be recognised.
 */
export function portraitStorageKey(
  name: string,
  imageType: AllowedImageType,
  unique: string,
): string {
  const stem = slugify(name) || "member";
  return `team/${stem}-${unique}.${EXTENSION_FOR_IMAGE_TYPE[imageType]}`;
}
