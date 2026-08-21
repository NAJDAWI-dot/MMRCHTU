import { NextResponse } from "next/server";
import { createRegistration, validateRegistration, hasFieldErrors } from "@/lib/registration";
import { clientKey, createRateLimiter } from "@/lib/rate-limit";
import { hasPaymentErrors, validatePayment } from "@/lib/payment";

/**
 * Module scope, so the counter survives between requests handled by the same
 * instance. See rate-limit.ts for what that does and does not buy on
 * serverless.
 *
 * Five in ten minutes: comfortably more than a team fixing a typo and
 * resubmitting, far less than a script filling the table.
 */
const limiter = createRateLimiter({ limit: 5, windowMs: 10 * 60 * 1000 });

export async function POST(request: Request) {
  const limit = limiter.check(clientKey(request.headers));
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many registration attempts. Please wait a few minutes and try again." },
      {
        status: 429,
        // Seconds, per the spec, rounded up — a client obeying it to the letter
        // should not retry a moment early and be refused again.
        headers: { "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)) },
      },
    );
  }

  const body = await request.json().catch(() => null);

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const errors = validateRegistration(body);
  if (hasFieldErrors(errors)) {
    return NextResponse.json({ errors }, { status: 422 });
  }

  // Reported separately from the registration fields because it is optional as
  // a whole: a team that leaves both boxes empty is registering now and paying
  // later, which is allowed. Only a half-filled report is an error.
  const paymentInput = {
    reference: typeof body.paymentReference === "string" ? body.paymentReference : "",
    amount: typeof body.paymentAmount === "string" ? body.paymentAmount : "",
  };
  const paymentErrors = validatePayment(paymentInput);
  if (hasPaymentErrors(paymentErrors)) {
    return NextResponse.json({ paymentErrors }, { status: 422 });
  }

  const registration = await createRegistration({
    teamName: body.teamName,
    submitterEmail: body.submitterEmail,
    memberCount: Number(body.memberCount),
    technicalExperience: body.technicalExperience,
    motivation: body.motivation,
    members: body.members,
    payment: paymentInput,
  });

  return NextResponse.json({ registration }, { status: 201 });
}
