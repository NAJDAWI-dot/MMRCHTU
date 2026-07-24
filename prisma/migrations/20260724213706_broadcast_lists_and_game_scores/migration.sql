-- CreateTable
CREATE TABLE "BroadcastList" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'CUSTOM',
    "description" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "BroadcastContact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "listId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "addedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BroadcastContact_listId_fkey" FOREIGN KEY ("listId") REFERENCES "BroadcastList" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Broadcast" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "listId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "sentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Broadcast_listId_fkey" FOREIGN KEY ("listId") REFERENCES "BroadcastList" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GameScore" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "playerName" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "mode" TEXT NOT NULL DEFAULT 'classic',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

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
