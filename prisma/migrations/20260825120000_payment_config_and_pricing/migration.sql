-- Payment moves into registration as a second stage: teams are priced by one
-- team-wide tier, pay via CliQ, and upload a screenshot as proof.
--
-- Layered on top of 20260821174556_cliq_payment rather than rewriting it. That
-- migration is already committed and `vercel-build` runs `prisma migrate
-- deploy` on every push, previews included, so it may already be applied
-- somewhere; deleting its folder would leave _prisma_migrations pointing at a
-- migration that no longer exists.

-- AlterTable
ALTER TABLE "Registration" ADD COLUMN     "consentAcceptedAt" TIMESTAMP(3),
ADD COLUMN     "consentVersion" TEXT,
ADD COLUMN     "feeBaseFils" INTEGER,
ADD COLUMN     "feeDiscountFils" INTEGER,
ADD COLUMN     "feeDueFils" INTEGER,
ADD COLUMN     "feeTier" TEXT NOT NULL DEFAULT 'NON_MEMBER',
ADD COLUMN     "paymentScreenshotKey" TEXT,
ADD COLUMN     "paymentScreenshotUrl" TEXT,
ADD COLUMN     "resumeCode" TEXT;

-- AlterTable
-- CliQ configuration moves to the PaymentConfig singleton below, which is what
-- the new admin Payments tab edits.
ALTER TABLE "RegisterFormConfig" DROP COLUMN "cliqAccountName",
DROP COLUMN "cliqAlias",
DROP COLUMN "cliqAliasType",
DROP COLUMN "cliqBankName",
DROP COLUMN "paymentEnabled",
DROP COLUMN "paymentNote";

-- CreateTable
CREATE TABLE "PaymentConfig" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "paymentEnabled" BOOLEAN NOT NULL DEFAULT false,
    "cliqAlias" TEXT NOT NULL DEFAULT '',
    "cliqAliasType" TEXT NOT NULL DEFAULT 'ALIAS',
    "cliqBankName" TEXT NOT NULL DEFAULT '',
    "cliqAccountName" TEXT NOT NULL DEFAULT '',
    "paymentNote" TEXT NOT NULL DEFAULT '',
    "priceRasMemberFils" INTEGER NOT NULL DEFAULT 15000,
    "priceIeeeMemberFils" INTEGER NOT NULL DEFAULT 25000,
    "priceNonMemberFils" INTEGER NOT NULL DEFAULT 35000,
    "earlyBirdEnabled" BOOLEAN NOT NULL DEFAULT false,
    "earlyBirdPercent" INTEGER NOT NULL DEFAULT 0,
    "earlyBirdCutoff" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
-- Nullable unique: Postgres allows many NULLs under a unique constraint, so
-- registrations predating this flow keep no resume code without a backfill.
CREATE UNIQUE INDEX "Registration_resumeCode_key" ON "Registration"("resumeCode");
