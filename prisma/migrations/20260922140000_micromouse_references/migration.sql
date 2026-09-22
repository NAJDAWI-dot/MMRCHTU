-- The reading list at the foot of the build guide.
--
-- Additive, like every migration here: preview deployments and production run
-- against the same database, so a migration that dropped or rewrote anything
-- would take production with it the moment a branch was pushed.
CREATE TABLE "MicromouseReference" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'SITE',
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "author" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MicromouseReference_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MicromouseReference_isPublished_sortOrder_idx"
    ON "MicromouseReference"("isPublished", "sortOrder");

-- Seven starter links, every one checked to resolve on the day this was
-- written. They are here and not in prisma/seed.ts on purpose: the seed runs
-- on every deployment, so a starter link the committee removed would reappear
-- on the next push. A migration runs once per database, which is what makes
-- Remove mean removed.
INSERT INTO "MicromouseReference" ("id", "kind", "title", "url", "author", "note", "sortOrder", "updatedAt")
VALUES
  ('ref_seed_veritasium', 'VIDEO',
   'The Fastest Maze-Solving Competition On Earth',
   'https://www.youtube.com/watch?v=ZMQbHMgK2rw',
   'Veritasium',
   'Half an hour on where micromouse came from and why the fast mice look the way they do. Start here if you have never seen a run.',
   10, CURRENT_TIMESTAMP),
  ('ref_seed_software', 'VIDEO',
   'Micromouse Software Structure',
   'https://www.youtube.com/watch?v=-JdkK7H62AA',
   'Peter Harrison, Minos 2023',
   'How to lay the firmware out: what runs in the interrupt, what runs in the main loop, and why mixing the two is the bug you cannot find.',
   20, CURRENT_TIMESTAMP),
  ('ref_seed_search', 'VIDEO',
   'Maze Solving and Search Optimisation',
   'https://www.youtube.com/watch?v=zyIRLaSN3hI',
   'UKMARS, Minos 2020',
   'What to do once flood fill works and you want the search to stop wasting half your eight minutes.',
   30, CURRENT_TIMESTAMP),
  ('ref_seed_minos', 'PLAYLIST',
   'Minos: the UK micromouse conference talks',
   'https://www.youtube.com/playlist?list=PLMcEwKreLg4WXjbX-cvnXwzbbqfknWQWT',
   'MicroMouse channel',
   'Years of talks by people who build these for a living, on everything from motor choice to maze storage.',
   40, CURRENT_TIMESTAMP),
  ('ref_seed_mmonline', 'SITE',
   'Micromouse Online',
   'https://micromouseonline.com/',
   'Peter Harrison',
   'The deepest single archive on the subject: build logs, sensor design, control theory, and the arithmetic behind all of it.',
   50, CURRENT_TIMESTAMP),
  ('ref_seed_ukmars', 'SITE',
   'UKMARS',
   'https://ukmars.org/',
   'UK Micromouse and Robotics Society',
   'Contest rules, the UKMARSBOT design and a community that answers beginners properly.',
   60, CURRENT_TIMESTAMP),
  ('ref_seed_mms', 'SITE',
   'mms, a micromouse simulator',
   'https://github.com/mackorone/mms',
   'mackorone on GitHub',
   'Write and test your maze solving before the robot exists. Worth a weekend while you wait for parts to arrive.',
   70, CURRENT_TIMESTAMP);
