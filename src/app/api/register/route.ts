import { NextResponse } from "next/server";
import { createRegistration, validateRegistration } from "@/lib/registration";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const errors = validateRegistration(body);
  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ errors }, { status: 422 });
  }

  const registration = await createRegistration({
    teamName: body.teamName,
    contactName: body.contactName,
    email: body.email,
    memberCount: Number(body.memberCount),
  });

  return NextResponse.json({ registration }, { status: 201 });
}
