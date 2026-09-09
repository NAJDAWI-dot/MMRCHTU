-- AlterTable
ALTER TABLE "Broadcast" ADD COLUMN     "bcc" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "bodyHtml" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "buttons" TEXT NOT NULL DEFAULT '[]',
ADD COLUMN     "cc" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "footerNote" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "greeting" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "name" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "signOff" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'SENT',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "listId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "BroadcastAttachment" (
    "id" TEXT NOT NULL,
    "broadcastId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BroadcastAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BroadcastAttachment_broadcastId_idx" ON "BroadcastAttachment"("broadcastId");

-- CreateIndex
CREATE INDEX "Broadcast_status_idx" ON "Broadcast"("status");

-- AddForeignKey
ALTER TABLE "BroadcastAttachment" ADD CONSTRAINT "BroadcastAttachment_broadcastId_fkey" FOREIGN KEY ("broadcastId") REFERENCES "Broadcast"("id") ON DELETE CASCADE ON UPDATE CASCADE;
