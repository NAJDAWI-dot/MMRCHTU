import { NextResponse } from "next/server";
import { createRegistration, validateRegistration, hasFieldErrors } from "@/lib/registration";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const errors = validateRegistration(body);
  if (hasFieldErrors(errors)) {
    return NextResponse.json({ errors }, { status: 422 });
  }

  const registration = await createRegistration({
    teamName: body.teamName,
    submitterEmail: body.submitterEmail,
    memberCount: Number(body.memberCount),
    technicalExperience: body.technicalExperience,
    motivation: body.motivation,
    members: body.members,
  });

  return NextResponse.json({ registration }, { status: 201 });
}
