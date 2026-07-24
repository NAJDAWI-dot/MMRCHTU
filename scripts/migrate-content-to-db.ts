// One-time migration: ports the old file-based schedule.json and faq.mdx
// content into the new ScheduleEvent/FaqEntry tables. Safe to re-run — it
// skips seeding if rows already exist, so it won't duplicate on a second run.
import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";

const prisma = new PrismaClient();

interface ScheduleItem {
  date: string;
  title: string;
  description: string;
}

function parseFaqMdx(source: string): { question: string; answer: string }[] {
  const sections = source.split(/^## /m).filter((s) => s.trim().length > 0);
  return sections.map((section) => {
    const [firstLine, ...rest] = section.split("\n");
    return {
      question: (firstLine ?? "").trim(),
      answer: rest.join("\n").trim(),
    };
  });
}

async function main() {
  const existingEvents = await prisma.scheduleEvent.count();
  if (existingEvents === 0) {
    const schedulePath = path.join(__dirname, "../content/schedule/schedule.json");
    const items = JSON.parse(fs.readFileSync(schedulePath, "utf8")) as ScheduleItem[];
    for (const [i, item] of items.entries()) {
      await prisma.scheduleEvent.create({
        data: {
          title: item.title,
          description: item.description,
          startsAt: new Date(`${item.date}T00:00:00.000Z`),
          sortOrder: i,
        },
      });
    }
    console.log(`Migrated ${items.length} schedule events.`);
  } else {
    console.log("ScheduleEvent already has rows — skipping schedule migration.");
  }

  const existingFaq = await prisma.faqEntry.count();
  if (existingFaq === 0) {
    const faqPath = path.join(__dirname, "../content/faq/faq.mdx");
    const entries = parseFaqMdx(fs.readFileSync(faqPath, "utf8"));
    for (const [i, entry] of entries.entries()) {
      await prisma.faqEntry.create({
        data: { question: entry.question, answer: entry.answer, sortOrder: i },
      });
    }
    console.log(`Migrated ${entries.length} FAQ entries.`);
  } else {
    console.log("FaqEntry already has rows — skipping FAQ migration.");
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
