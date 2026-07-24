import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password";

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

  await prisma.registerFormConfig.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });

  const bootstrapUsername = process.env.ADMIN_BOOTSTRAP_USERNAME;
  const bootstrapPassword = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  if (bootstrapUsername && bootstrapPassword) {
    const existing = await prisma.adminUser.findUnique({ where: { username: bootstrapUsername } });
    if (!existing) {
      await prisma.adminUser.create({
        data: {
          username: bootstrapUsername,
          passwordHash: await hashPassword(bootstrapPassword),
        },
      });
      console.log(`Created bootstrap admin user "${bootstrapUsername}".`);
    }
  } else {
    console.warn(
      "ADMIN_BOOTSTRAP_USERNAME/ADMIN_BOOTSTRAP_PASSWORD not set — no admin user was seeded. Set them in .env and re-run `npm run prisma:seed` (or create one via a script) before using /admin.",
    );
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
