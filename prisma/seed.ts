import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const INITIAL_COUNTERS = ["registrations", "submissions", "game_plays"];

async function main() {
  for (const key of INITIAL_COUNTERS) {
    await prisma.counter.upsert({
      where: { key },
      update: {},
      create: { key, value: 0 },
    });
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
