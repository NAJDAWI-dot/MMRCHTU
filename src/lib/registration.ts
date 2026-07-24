import { prisma } from "@/lib/prisma";

// SQLite has no native enum support (see prisma/schema.prisma) — these are the
// single source of truth for valid string-union values at the application layer.
export type RegistrationStatus = "PENDING" | "CONFIRMED" | "WAITLISTED" | "CANCELLED";
export type IeeeStatus = "IEEE_RAS_MEMBER" | "IEEE_MEMBER" | "NON_MEMBER";

export const IEEE_STATUS_OPTIONS: { value: IeeeStatus; label: string }[] = [
  { value: "IEEE_RAS_MEMBER", label: "IEEE Robotics and Automation Society (RAS) Member" },
  { value: "IEEE_MEMBER", label: "IEEE Member" },
  { value: "NON_MEMBER", label: "Non-Member" },
];

export interface TeamMemberInput {
  firstName: string;
  lastName: string;
  email: string;
  whatsapp: string;
  university: string;
  major: string;
  ieeeStatus: IeeeStatus;
  ieeeMembershipId: string;
}

export interface RegistrationInput {
  teamName: string;
  submitterEmail: string;
  memberCount: number;
  technicalExperience: string;
  motivation: string;
  members: TeamMemberInput[];
}

export interface TeamMemberFieldErrors {
  firstName?: string;
  lastName?: string;
  email?: string;
  whatsapp?: string;
  university?: string;
  major?: string;
  ieeeStatus?: string;
  ieeeMembershipId?: string;
}

export interface FieldErrors {
  teamName?: string;
  submitterEmail?: string;
  memberCount?: string;
  technicalExperience?: string;
  motivation?: string;
  members?: (TeamMemberFieldErrors | undefined)[];
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const IEEE_STATUS_VALUES: IeeeStatus[] = ["IEEE_RAS_MEMBER", "IEEE_MEMBER", "NON_MEMBER"];

function validateMember(member: Partial<TeamMemberInput> | undefined): TeamMemberFieldErrors | undefined {
  const errors: TeamMemberFieldErrors = {};

  if (!member?.firstName || member.firstName.trim().length < 1) {
    errors.firstName = "First name is required.";
  }
  if (!member?.lastName || member.lastName.trim().length < 1) {
    errors.lastName = "Last name is required.";
  }
  if (!member?.email || !EMAIL_RE.test(member.email)) {
    errors.email = "Enter a valid email address.";
  }
  if (!member?.whatsapp || member.whatsapp.trim().length < 6) {
    errors.whatsapp = "Enter a valid WhatsApp number.";
  }
  if (!member?.university || member.university.trim().length < 1) {
    errors.university = "Select a university.";
  }
  if (!member?.major || member.major.trim().length < 1) {
    errors.major = "Major is required.";
  }
  if (!member?.ieeeStatus || !IEEE_STATUS_VALUES.includes(member.ieeeStatus)) {
    errors.ieeeStatus = "Select an IEEE membership status.";
  }
  if (!member?.ieeeMembershipId || member.ieeeMembershipId.trim().length < 1) {
    errors.ieeeMembershipId = 'Enter your IEEE membership ID, or "Non-Member" if you have none.';
  }

  return Object.keys(errors).length > 0 ? errors : undefined;
}

export interface RegistrationValidationInput extends Omit<Partial<RegistrationInput>, "members"> {
  members?: Partial<TeamMemberInput>[];
}

export function validateRegistration(input: RegistrationValidationInput): FieldErrors {
  const errors: FieldErrors = {};

  if (!input.teamName || input.teamName.trim().length < 2) {
    errors.teamName = "Team name must be at least 2 characters.";
  }
  if (!input.submitterEmail || !EMAIL_RE.test(input.submitterEmail)) {
    errors.submitterEmail = "Enter a valid email address.";
  }
  if (
    input.memberCount === undefined ||
    !Number.isInteger(input.memberCount) ||
    input.memberCount < 1 ||
    input.memberCount > 3
  ) {
    errors.memberCount = "Team size must be 1, 2, or 3.";
  }
  if (!input.technicalExperience || input.technicalExperience.trim().length < 1) {
    errors.technicalExperience = "Briefly describe the technical experience of each member.";
  }
  if (!input.motivation || input.motivation.trim().length < 1) {
    errors.motivation = "Tell us your motivation to participate.";
  }

  const expectedCount =
    input.memberCount !== undefined && Number.isInteger(input.memberCount) ? input.memberCount : 0;
  const members = input.members ?? [];
  const memberErrors = Array.from({ length: expectedCount }, (_, i) => validateMember(members[i]));
  if (memberErrors.some(Boolean)) {
    errors.members = memberErrors;
  }

  return errors;
}

export function hasFieldErrors(errors: FieldErrors): boolean {
  return (
    Object.keys(errors).filter((k) => k !== "members").length > 0 ||
    (errors.members?.some(Boolean) ?? false)
  );
}

export async function createRegistration(input: RegistrationInput) {
  return prisma.$transaction(async (tx) => {
    const registration = await tx.registration.create({
      data: {
        teamName: input.teamName.trim(),
        submitterEmail: input.submitterEmail.trim(),
        memberCount: input.memberCount,
        technicalExperience: input.technicalExperience.trim(),
        motivation: input.motivation.trim(),
        members: {
          create: input.members.map((member, i) => ({
            order: i + 1,
            firstName: member.firstName.trim(),
            lastName: member.lastName.trim(),
            email: member.email.trim(),
            whatsapp: member.whatsapp.trim(),
            university: member.university.trim(),
            major: member.major.trim(),
            ieeeStatus: member.ieeeStatus,
            ieeeMembershipId: member.ieeeMembershipId.trim(),
          })),
        },
      },
      include: { members: true },
    });

    await tx.counter.upsert({
      where: { key: "registrations" },
      update: { value: { increment: 1 } },
      create: { key: "registrations", value: 1 },
    });

    return registration;
  });
}
