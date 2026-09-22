-- Competition day HQ: admin roles, day-site access, check-in, qualifying runs,
-- the knockout bracket, volunteers and the day guides.
--
-- Additive only. Every deploy, previews included, runs migrations against the
-- production database, so nothing here drops or rewrites existing data. The one
-- UPDATE makes every admin that already exists a Master, so adding roles takes
-- no screen away from anybody; roles are then trimmed on the Admins screen.

-- AlterTable
ALTER TABLE "AdminUser" ADD COLUMN     "roles" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "CompetitionDayConfig" ADD COLUMN     "dayAudience" TEXT NOT NULL DEFAULT 'PRIVATE',
ADD COLUMN     "dayViewerIds" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "matchDirection" TEXT NOT NULL DEFAULT 'HIGHER',
ADD COLUMN     "qualifyingDirection" TEXT NOT NULL DEFAULT 'HIGHER',
ADD COLUMN     "qualifyingNote" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "qualifyingStatus" TEXT NOT NULL DEFAULT 'NOT_SET';

-- CreateTable
CREATE TABLE "TeamDayStatus" (
    "registrationId" TEXT NOT NULL,
    "checkedInAt" TIMESTAMP(3),
    "checkedInBy" TEXT NOT NULL DEFAULT '',
    "inspection" TEXT NOT NULL DEFAULT 'PENDING',
    "inspectionNote" TEXT NOT NULL DEFAULT '',
    "robotName" TEXT NOT NULL DEFAULT '',
    "pit" TEXT NOT NULL DEFAULT '',
    "withdrawn" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamDayStatus_pkey" PRIMARY KEY ("registrationId")
);

-- CreateTable
CREATE TABLE "QualifyingRun" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "recordedBy" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QualifyingRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnockoutMatch" (
    "id" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "slot" INTEGER NOT NULL,
    "teamAId" TEXT,
    "teamBId" TEXT,
    "seedA" INTEGER,
    "seedB" INTEGER,
    "scoreA" DOUBLE PRECISION,
    "scoreB" DOUBLE PRECISION,
    "winnerId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "scheduledAt" TIMESTAMP(3),
    "arena" TEXT NOT NULL DEFAULT '',
    "updatedBy" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnockoutMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Volunteer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT '',
    "station" TEXT NOT NULL DEFAULT '',
    "shift" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Volunteer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DayGuide" (
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DayGuide_pkey" PRIMARY KEY ("slug")
);

-- CreateIndex
CREATE INDEX "QualifyingRun_registrationId_idx" ON "QualifyingRun"("registrationId");

-- CreateIndex
CREATE UNIQUE INDEX "KnockoutMatch_round_slot_key" ON "KnockoutMatch"("round", "slot");

-- CreateIndex
CREATE INDEX "Volunteer_isPublished_sortOrder_idx" ON "Volunteer"("isPublished", "sortOrder");

-- AddForeignKey
ALTER TABLE "TeamDayStatus" ADD CONSTRAINT "TeamDayStatus_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "Registration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualifyingRun" ADD CONSTRAINT "QualifyingRun_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "Registration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnockoutMatch" ADD CONSTRAINT "KnockoutMatch_teamAId_fkey" FOREIGN KEY ("teamAId") REFERENCES "Registration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnockoutMatch" ADD CONSTRAINT "KnockoutMatch_teamBId_fkey" FOREIGN KEY ("teamBId") REFERENCES "Registration"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Existing accounts keep full access.
UPDATE "AdminUser" SET "roles" = 'MASTER' WHERE "roles" = '';
