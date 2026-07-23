import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Live counters must never be served from Next's static route cache.
export const dynamic = "force-dynamic";

export async function GET() {
  const counters = await prisma.counter.findMany();
  const stats = Object.fromEntries(counters.map((c) => [c.key, c.value]));
  return NextResponse.json(stats);
}
