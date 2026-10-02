-- Which maze each team runs on: in qualifying, and on each side of a knockout match.
ALTER TABLE "TeamDayStatus" ADD COLUMN "qualifyingMaze" TEXT NOT NULL DEFAULT '';
ALTER TABLE "KnockoutMatch" ADD COLUMN "mazeA" TEXT NOT NULL DEFAULT '';
ALTER TABLE "KnockoutMatch" ADD COLUMN "mazeB" TEXT NOT NULL DEFAULT '';

-- The mazes on the floor, and the judged awards.
ALTER TABLE "CompetitionDayConfig" ADD COLUMN "mazeNames" TEXT NOT NULL DEFAULT 'Maze A,Maze B';
ALTER TABLE "CompetitionDayConfig" ADD COLUMN "awardBestCode" TEXT NOT NULL DEFAULT '';
ALTER TABLE "CompetitionDayConfig" ADD COLUMN "awardBestCodeRunnerUp" TEXT NOT NULL DEFAULT '';
ALTER TABLE "CompetitionDayConfig" ADD COLUMN "awardBestDesign" TEXT NOT NULL DEFAULT '';
ALTER TABLE "CompetitionDayConfig" ADD COLUMN "awardBestDesignRunnerUp" TEXT NOT NULL DEFAULT '';
ALTER TABLE "CompetitionDayConfig" ADD COLUMN "awardsShown" BOOLEAN NOT NULL DEFAULT false;

-- The third place play-off (round 7) for a bracket drawn before it existed.
INSERT INTO "KnockoutMatch" ("id", "round", "slot", "updatedAt")
SELECT 'third-place', 7, 0, CURRENT_TIMESTAMP
WHERE EXISTS (SELECT 1 FROM "KnockoutMatch")
ON CONFLICT ("round", "slot") DO NOTHING;
