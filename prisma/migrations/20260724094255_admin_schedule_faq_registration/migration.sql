/*
  Warnings:

  - You are about to drop the column `contactName` on the `Registration` table. All the data in the column will be lost.
  - You are about to drop the column `email` on the `Registration` table. All the data in the column will be lost.
  - Added the required column `motivation` to the `Registration` table without a default value. This is not possible if the table is not empty.
  - Added the required column `submitterEmail` to the `Registration` table without a default value. This is not possible if the table is not empty.
  - Added the required column `technicalExperience` to the `Registration` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "TeamMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "registrationId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "whatsapp" TEXT NOT NULL,
    "university" TEXT NOT NULL,
    "major" TEXT NOT NULL,
    "ieeeStatus" TEXT NOT NULL,
    "ieeeMembershipId" TEXT NOT NULL,
    CONSTRAINT "TeamMember_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "Registration" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLoginAt" DATETIME
);

-- CreateTable
CREATE TABLE "ScheduleEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "startsAt" DATETIME NOT NULL,
    "endsAt" DATETIME,
    "location" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "FaqEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "FaqQuestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "question" TEXT NOT NULL,
    "askerEmail" TEXT,
    "reply" TEXT,
    "repliedAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "RegisterFormConfig" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "deadlineText" TEXT NOT NULL DEFAULT 'Registration closes soon — check back for the exact date.',
    "deadlineDate" DATETIME,
    "feeInfoText" TEXT NOT NULL DEFAULT '35 JD (non-member) / 25 JD (IEEE member) / 15 JD (IEEE RAS member) per team.',
    "isOpen" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Registration" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teamName" TEXT NOT NULL,
    "submitterEmail" TEXT NOT NULL,
    "memberCount" INTEGER NOT NULL DEFAULT 1,
    "technicalExperience" TEXT NOT NULL,
    "motivation" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Registration" ("createdAt", "id", "memberCount", "status", "teamName") SELECT "createdAt", "id", "memberCount", "status", "teamName" FROM "Registration";
DROP TABLE "Registration";
ALTER TABLE "new_Registration" RENAME TO "Registration";
CREATE INDEX "Registration_status_idx" ON "Registration"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "TeamMember_registrationId_idx" ON "TeamMember"("registrationId");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_username_key" ON "AdminUser"("username");

-- CreateIndex
CREATE INDEX "ScheduleEvent_startsAt_idx" ON "ScheduleEvent"("startsAt");

-- CreateIndex
CREATE INDEX "FaqQuestion_status_idx" ON "FaqQuestion"("status");
