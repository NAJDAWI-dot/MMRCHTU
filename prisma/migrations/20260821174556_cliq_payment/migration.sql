-- AlterTable
ALTER TABLE "RegisterFormConfig" ADD COLUMN     "cliqAccountName" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "cliqAlias" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "cliqAliasType" TEXT NOT NULL DEFAULT 'ALIAS',
ADD COLUMN     "cliqBankName" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "paymentEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "paymentNote" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Registration" ADD COLUMN     "paymentAmountFils" INTEGER,
ADD COLUMN     "paymentNote" TEXT,
ADD COLUMN     "paymentReference" TEXT,
ADD COLUMN     "paymentStatus" TEXT NOT NULL DEFAULT 'UNPAID',
ADD COLUMN     "paymentSubmittedAt" TIMESTAMP(3),
ADD COLUMN     "paymentVerifiedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Registration_paymentStatus_idx" ON "Registration"("paymentStatus");
