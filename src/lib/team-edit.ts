// An admin's edit of a registered team: its details and its members, read from
// one form and turned into the writes that make the stored team match it.
//
// Pure, so it can be tested without a database. The action in
// src/app/admin/(protected)/registrations/actions.ts does the writing.

import { isIeeeStatus, type IeeeStatus } from "@/lib/ieee-status";
/**
 * The rules' team size, as MAX_TEAM_SIZE in src/lib/registration.ts. Repeated
 * rather than imported because that file is server-only and the editor that
 * uses this runs in the browser.
 */
export const MAX_MEMBERS = 3;

export interface MemberEdit {
  /** The stored member's id, or null for one added in this edit. */
  id: string | null;
  firstName: string;
  lastName: string;
  email: string;
  whatsapp: string;
  university: string;
  major: string;
  ieeeStatus: IeeeStatus;
  ieeeMembershipId: string;
}

export interface TeamEdit {
  teamName: string;
  submitterEmail: string;
  technicalExperience: string;
  motivation: string;
  members: MemberEdit[];
}

/** Error messages keyed by field name: "teamName", or "m.1.email" for the second member. */
export type TeamEditErrors = Record<string, string>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const text = (form: FormData, name: string) => String(form.get(name) ?? "").trim();

/**
 * Reads the form. Members arrive as m.0.firstName, m.1.firstName and so on, in
 * the order the admin left them; gaps (a row removed in the browser) are
 * skipped, and anything past the size limit is ignored rather than trusted.
 */
export function readTeamEdit(form: FormData): TeamEdit {
  const indexes = new Set<number>();
  for (const key of Array.from(form.keys())) {
    const match = /^m\.(\d+)\./.exec(key);
    if (match) indexes.add(Number(match[1]));
  }
  const members = Array.from(indexes)
    .sort((a, b) => a - b)
    .slice(0, MAX_MEMBERS + 1)
    .map((i): MemberEdit => {
      const status = text(form, `m.${i}.ieeeStatus`);
      return {
        id: text(form, `m.${i}.id`) || null,
        firstName: text(form, `m.${i}.firstName`),
        lastName: text(form, `m.${i}.lastName`),
        email: text(form, `m.${i}.email`),
        whatsapp: text(form, `m.${i}.whatsapp`),
        university: text(form, `m.${i}.university`),
        major: text(form, `m.${i}.major`),
        ieeeStatus: isIeeeStatus(status) ? status : "NON_MEMBER",
        ieeeMembershipId: text(form, `m.${i}.ieeeMembershipId`) || "Non-Member",
      };
    });

  return {
    teamName: text(form, "teamName"),
    submitterEmail: text(form, "submitterEmail"),
    technicalExperience: text(form, "technicalExperience"),
    motivation: text(form, "motivation"),
    members,
  };
}

/**
 * Looser than the register form on purpose. A team fills every field for
 * itself; an organiser adding a teammate at the desk may only have a name and
 * an email, and should not be kept from saving it for want of a major.
 */
export function validateTeamEdit(edit: TeamEdit): TeamEditErrors {
  const errors: TeamEditErrors = {};
  if (edit.teamName.length < 2) errors.teamName = "Team name must be at least 2 characters.";
  if (!EMAIL_RE.test(edit.submitterEmail)) errors.submitterEmail = "Enter a valid email address.";
  if (edit.members.length < 1) errors.members = "A team needs at least one member.";
  if (edit.members.length > MAX_MEMBERS) errors.members = `A team can have at most ${MAX_MEMBERS} members.`;

  edit.members.forEach((member, i) => {
    if (!member.firstName) errors[`m.${i}.firstName`] = "First name is required.";
    if (!member.lastName) errors[`m.${i}.lastName`] = "Last name is required.";
    if (!EMAIL_RE.test(member.email)) errors[`m.${i}.email`] = "Enter a valid email address.";
  });

  const ids = edit.members.map((m) => m.id).filter(Boolean);
  if (new Set(ids).size !== ids.length) errors.members = "The same member appears twice.";
  return errors;
}

export interface MemberPlan {
  remove: string[];
  update: { id: string; order: number; data: Omit<MemberEdit, "id"> }[];
  create: { order: number; data: Omit<MemberEdit, "id"> }[];
}

/**
 * The writes that turn the stored members into the edited list. Stored members
 * missing from the edit are removed; order is renumbered 1, 2, 3 from the edit,
 * so whoever is first is the team leader. Null when the edit names a member id
 * that is not this team's, which only a tampered form can do.
 */
export function planMembers(storedIds: readonly string[], members: readonly MemberEdit[]): MemberPlan | null {
  const stored = new Set(storedIds);
  if (members.some((m) => m.id !== null && !stored.has(m.id))) return null;

  const kept = new Set(members.map((m) => m.id).filter((id): id is string => id !== null));
  const plan: MemberPlan = { remove: storedIds.filter((id) => !kept.has(id)), update: [], create: [] };
  members.forEach(({ id, ...data }, i) => {
    if (id) plan.update.push({ id, order: i + 1, data });
    else plan.create.push({ order: i + 1, data });
  });
  return plan;
}

/**
 * The check-in desk's list of members who turned up, without the ones just
 * removed. Empty means "everyone" to the desk, so a list emptied by removals
 * stays empty and the desk shows the team as it now is.
 */
export function prunePresent(presentIds: string, removed: readonly string[]): string {
  if (!presentIds || removed.length === 0) return presentIds;
  const gone = new Set(removed);
  return presentIds
    .split(",")
    .filter((id) => id && !gone.has(id))
    .join(",");
}
