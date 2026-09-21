-- AlterTable
ALTER TABLE "GameScore" ADD COLUMN     "event" TEXT NOT NULL DEFAULT '';

-- CreateIndex
CREATE INDEX "GameScore_event_mode_score_idx" ON "GameScore"("event", "mode", "score");
