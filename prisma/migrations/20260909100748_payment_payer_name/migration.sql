-- AlterTable
ALTER TABLE "Registration" ADD COLUMN     "payerFirstName" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "payerLastName" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "payerSecondName" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "payerThirdName" TEXT NOT NULL DEFAULT '';
