import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { exportTokenMatches } from "@/lib/export-token";
import {
  MEMBER_HEADERS,
  TEAM_HEADERS,
  memberRow,
  teamRow,
  toCsv,
} from "@/lib/csv";

/**
 * The registration data as CSV, current as of the moment it is asked for.
 *
 * Exists so a spreadsheet can keep itself up to date. Nothing can write into a
 * workbook sitting on someone's laptop, so the direction is reversed: Excel's
 * Power Query fetches this URL on a timer, and the sheet refreshes itself.
 *
 * Two audiences, one handler. An admin with a session gets it from a download
 * button on the Registrations page; Excel, which cannot hold a session, gets it
 * with ?token=. Keeping both on one route is what stops the two from drifting
 * into disagreeing about what a row contains.
 *
 * ?sheet=teams (default) is one row per team; ?sheet=members is one row per
 * person. Two sheets rather than one wide table because a team of three would
 * otherwise need nine repeated columns, and filtering people by university —
 * the thing this file actually gets used for — would be impossible.
 */

// Reads live rows and must never be cached: a stale export is worse than no
// export, because it looks exactly like a current one.
export const dynamic = "force-dynamic";

type Sheet = "teams" | "members";

function parseSheet(value: string | null): Sheet {
  return value === "members" ? "members" : "teams";
}

export async function GET(request: Request) {
  const url = new URL(request.url);

  // Either credential is enough, and the session is tried first so the admin
  // download button never needs to know the token exists.
  const admin = await requireAdminApi();
  const authorised =
    admin !== null ||
    exportTokenMatches(url.searchParams.get("token"), process.env.REGISTRATIONS_EXPORT_TOKEN);

  if (!authorised) {
    // 404 rather than 401: an unauthenticated caller learns nothing about
    // whether this route exists, and there is no realm to authenticate into.
    return new NextResponse("Not found", { status: 404 });
  }

  const sheet = parseSheet(url.searchParams.get("sheet"));

  // Two queries rather than one with a conditional `include`: the members are
  // only fetched for the sheet that needs them, and each branch has a type
  // that actually describes what came back.
  let csv: string;
  if (sheet === "members") {
    const registrations = await prisma.registration.findMany({
      orderBy: { createdAt: "asc" },
      include: { members: { orderBy: { order: "asc" } } },
    });
    csv = toCsv(
      MEMBER_HEADERS,
      registrations.flatMap((registration) =>
        registration.members.map((member) =>
          memberRow(registration.teamName, registration.status, member),
        ),
      ),
    );
  } else {
    const registrations = await prisma.registration.findMany({ orderBy: { createdAt: "asc" } });
    csv = toCsv(TEAM_HEADERS, registrations.map(teamRow));
  }

  return new NextResponse(csv, {
    headers: {
      // charset matters as much as the BOM the body carries: between them,
      // Excel opens an Arabic name as an Arabic name.
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="mmrc26-${sheet}.csv"`,
      // This is personal data behind a credential. It must not sit in a proxy,
      // a CDN, or the browser's disk cache once the tab is closed.
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
      // Keeps the token out of the referrer of anything the file might reach.
      "Referrer-Policy": "no-referrer",
      // Search engines cannot reach this without the token, but a token that
      // leaks into a crawler's queue should not become a cached page.
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
