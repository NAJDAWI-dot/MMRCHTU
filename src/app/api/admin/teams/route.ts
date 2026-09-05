import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Team lookup for the admin command palette.
 *
 * The palette's twelve page destinations are a fixed list it can hold in
 * memory. Teams are not — there will be a hundred of them and they change all
 * day — so this is the one thing it has to ask the server for.
 *
 * It returns a jumping-off point rather than a team record: the palette sends
 * the admin to `/admin/registrations?q=<team>`, which is the filter built for
 * exactly this, so nothing here needs to grow into a detail API.
 */

// Reads the session cookie, so it can never be statically rendered.
export const dynamic = "force-dynamic";

/** Enough to be a real query. One letter would return most of the table. */
const MIN_QUERY = 2;
const LIMIT = 6;

export async function GET(request: Request) {
  const admin = await requireAdminApi();
  if (!admin) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < MIN_QUERY) {
    return NextResponse.json({ teams: [] });
  }

  const teams = await prisma.registration.findMany({
    where: {
      OR: [
        { teamName: { contains: q, mode: "insensitive" } },
        { submitterEmail: { contains: q, mode: "insensitive" } },
      ],
    },
    // Only what the palette draws. A registration row carries payment
    // references and screenshot keys, and none of that belongs in a response
    // that exists to render two lines of text.
    select: { id: true, teamName: true, submitterEmail: true, paymentStatus: true },
    orderBy: { createdAt: "desc" },
    take: LIMIT,
  });

  return NextResponse.json({ teams });
}
