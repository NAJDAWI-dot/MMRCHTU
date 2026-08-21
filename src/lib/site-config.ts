import { prisma } from "@/lib/prisma";
import type { CompetitionDayConfig, RegisterFormConfig } from "@prisma/client";

/**
 * Read access to the two admin-editable singleton config rows.
 *
 * Pages used to call `upsert` to fetch these, which made every page view a
 * write and, on a database where the row did not exist yet, let two pages
 * rendering at the same time both try to insert it — the second failed with a
 * unique-constraint error and took the build down with it. Rendering a page is
 * a read; the row is created when an admin first saves, and until then these
 * fall back to the same defaults the schema declares.
 *
 * Keep the fallbacks in step with the @default values in prisma/schema.prisma,
 * or the page will change appearance the first time an admin presses Save.
 */

export const SINGLETON_ID = "singleton";

// updatedAt is the epoch rather than "now" so a row that has never been saved
// is not mistaken for one saved this instant.
const NEVER_SAVED = new Date(0);

const COMPETITION_DAY_FALLBACK: CompetitionDayConfig = {
  id: SINGLETON_ID,
  status: "COMING_SOON",
  headline: "Competition Day",
  intro: "Everything you need to know about the day itself.",
  comingSoonText: "Details will be released as soon as possible.",
  dateText: "",
  venue: "",
  details: "",
  eventDate: null,
  updatedAt: NEVER_SAVED,
};

const REGISTER_FORM_FALLBACK: RegisterFormConfig = {
  id: SINGLETON_ID,
  deadlineText: "Registration closes soon — check back for the exact date.",
  deadlineDate: null,
  feeInfoText: "35 JD (non-member) / 25 JD (IEEE member) / 15 JD (IEEE RAS member) per team.",
  isOpen: true,
  // Payment stays off until an admin fills the details in. There is no sensible
  // default for a CliQ alias, and a blank one would send transfers nowhere.
  paymentEnabled: false,
  cliqAlias: "",
  cliqAliasType: "ALIAS",
  cliqBankName: "",
  cliqAccountName: "",
  paymentNote: "",
  updatedAt: NEVER_SAVED,
};

export async function getCompetitionDayConfig(): Promise<CompetitionDayConfig> {
  const row = await prisma.competitionDayConfig.findUnique({ where: { id: SINGLETON_ID } });
  return row ?? COMPETITION_DAY_FALLBACK;
}

export async function getRegisterFormConfig(): Promise<RegisterFormConfig> {
  const row = await prisma.registerFormConfig.findUnique({ where: { id: SINGLETON_ID } });
  return row ?? REGISTER_FORM_FALLBACK;
}
