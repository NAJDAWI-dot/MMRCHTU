import { prisma } from "@/lib/prisma";

// SQLite has no native enum support (see prisma/schema.prisma) — this is the
// single source of truth for valid status values at the application layer.
export type RegistrationStatus = "PENDING" | "CONFIRMED" | "WAITLISTED" | "CANCELLED";

export interface RegistrationInput {
  teamName: string;
  contactName: string;
  email: string;
  memberCount: number;
}

export interface FieldErrors {
  teamName?: string;
  contactName?: string;
  email?: string;
  memberCount?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateRegistration(input: Partial<RegistrationInput>): FieldErrors {
  const errors: FieldErrors = {};

  if (!input.teamName || input.teamName.trim().length < 2) {
    errors.teamName = "Team name must be at least 2 characters.";
  }
  if (!input.contactName || input.contactName.trim().length < 2) {
    errors.contactName = "Contact name must be at least 2 characters.";
  }
  if (!input.email || !EMAIL_RE.test(input.email)) {
    errors.email = "Enter a valid email address.";
  }
  if (
    input.memberCount === undefined ||
    !Number.isInteger(input.memberCount) ||
    input.memberCount < 1 ||
    input.memberCount > 10
  ) {
    errors.memberCount = "Team size must be between 1 and 10.";
  }

  return errors;
}

export async function createRegistration(input: RegistrationInput) {
  return prisma.$transaction(async (tx) => {
    const registration = await tx.registration.create({
      data: {
        teamName: input.teamName.trim(),
        contactName: input.contactName.trim(),
        email: input.email.trim(),
        memberCount: input.memberCount,
      },
    });

    await tx.counter.upsert({
      where: { key: "registrations" },
      update: { value: { increment: 1 } },
      create: { key: "registrations", value: 1 },
    });

    return registration;
  });
}
