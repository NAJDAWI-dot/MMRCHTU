-- AlterTable
ALTER TABLE "Registration" ADD COLUMN     "ambassadorId" TEXT,
ADD COLUMN     "referralCode" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "Ambassador" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "university" TEXT NOT NULL DEFAULT '',
    "code" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ambassador_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Ambassador_code_key" ON "Ambassador"("code");

-- CreateIndex
CREATE INDEX "Registration_ambassadorId_idx" ON "Registration"("ambassadorId");

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_ambassadorId_fkey" FOREIGN KEY ("ambassadorId") REFERENCES "Ambassador"("id") ON DELETE SET NULL ON UPDATE CASCADE;
