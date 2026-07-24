import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildIcsEvent, slugify } from "@/lib/ics";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const event = await prisma.scheduleEvent.findUnique({ where: { id: params.id } });
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  return new NextResponse(buildIcsEvent(event), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slugify(event.title)}.ics"`,
    },
  });
}
