-- CreateTable
CREATE TABLE "CompetitionDayConfig" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "status" TEXT NOT NULL DEFAULT 'COMING_SOON',
    "headline" TEXT NOT NULL DEFAULT 'Competition Day',
    "intro" TEXT NOT NULL DEFAULT 'Everything you need to know about the day itself.',
    "comingSoonText" TEXT NOT NULL DEFAULT 'Details will be released as soon as possible.',
    "dateText" TEXT NOT NULL DEFAULT '',
    "venue" TEXT NOT NULL DEFAULT '',
    "details" TEXT NOT NULL DEFAULT '',
    "updatedAt" DATETIME NOT NULL
);
