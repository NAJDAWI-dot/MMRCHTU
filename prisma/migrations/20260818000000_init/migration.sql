-- CreateTable
CREATE TABLE "Registration" (
    "id" TEXT NOT NULL,
    "teamName" TEXT NOT NULL,
    "submitterEmail" TEXT NOT NULL,
    "memberCount" INTEGER NOT NULL DEFAULT 1,
    "technicalExperience" TEXT NOT NULL,
    "motivation" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Registration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamMember" (
    "id" TEXT NOT NULL,
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

    CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Counter" (
    "key" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Counter_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleEvent" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "location" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduleEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FaqEntry" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FaqEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FaqQuestion" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "askerEmail" TEXT,
    "reply" TEXT,
    "repliedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FaqQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BroadcastList" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'CUSTOM',
    "description" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BroadcastList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BroadcastContact" (
    "id" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BroadcastContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Broadcast" (
    "id" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Broadcast_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameScore" (
    "id" TEXT NOT NULL,
    "playerName" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "mode" TEXT NOT NULL DEFAULT 'classic',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetitionDayConfig" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "status" TEXT NOT NULL DEFAULT 'COMING_SOON',
    "headline" TEXT NOT NULL DEFAULT 'Competition Day',
    "intro" TEXT NOT NULL DEFAULT 'Everything you need to know about the day itself.',
    "comingSoonText" TEXT NOT NULL DEFAULT 'Details will be released as soon as possible.',
    "dateText" TEXT NOT NULL DEFAULT '',
    "venue" TEXT NOT NULL DEFAULT '',
    "details" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompetitionDayConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegisterFormConfig" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "deadlineText" TEXT NOT NULL DEFAULT 'Registration closes soon — check back for the exact date.',
    "deadlineDate" TIMESTAMP(3),
    "feeInfoText" TEXT NOT NULL DEFAULT '35 JD (non-member) / 25 JD (IEEE member) / 15 JD (IEEE RAS member) per team.',
    "isOpen" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegisterFormConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Registration_status_idx" ON "Registration"("status");

-- CreateIndex
CREATE INDEX "TeamMember_registrationId_idx" ON "TeamMember"("registrationId");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_username_key" ON "AdminUser"("username");

-- CreateIndex
CREATE INDEX "ScheduleEvent_startsAt_idx" ON "ScheduleEvent"("startsAt");

-- CreateIndex
CREATE INDEX "FaqQuestion_status_idx" ON "FaqQuestion"("status");

-- CreateIndex
CREATE INDEX "BroadcastList_kind_idx" ON "BroadcastList"("kind");

-- CreateIndex
CREATE INDEX "BroadcastContact_listId_idx" ON "BroadcastContact"("listId");

-- CreateIndex
CREATE UNIQUE INDEX "BroadcastContact_listId_email_key" ON "BroadcastContact"("listId", "email");

-- CreateIndex
CREATE INDEX "Broadcast_listId_idx" ON "Broadcast"("listId");

-- CreateIndex
CREATE INDEX "GameScore_mode_score_idx" ON "GameScore"("mode", "score");

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "Registration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BroadcastContact" ADD CONSTRAINT "BroadcastContact_listId_fkey" FOREIGN KEY ("listId") REFERENCES "BroadcastList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Broadcast" ADD CONSTRAINT "Broadcast_listId_fkey" FOREIGN KEY ("listId") REFERENCES "BroadcastList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

