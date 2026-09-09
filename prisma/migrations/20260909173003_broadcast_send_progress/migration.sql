-- AlterTable
ALTER TABLE "Broadcast" ADD COLUMN     "failedEmails" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "recipients" TEXT NOT NULL DEFAULT '';
