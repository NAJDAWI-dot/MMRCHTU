-- Records which admin confirmed each payment.
--
-- The username is snapshotted rather than referenced. Who accepted a team's
-- money is a record of a decision already taken, like feeDueFils recording what
-- a team was quoted rather than what the price list says today. A foreign key
-- with ON DELETE SET NULL would erase that record at exactly the moment it
-- becomes worth having, when the account is removed; ON DELETE RESTRICT would
-- mean an admin who has ever approved a payment can never be deleted. Deleting
-- an admin therefore leaves every approval they made intact and readable.
--
-- Nullable, with no backfill. Rows verified before this deploy genuinely have
-- no answer, and the Payments tab says "not recorded" rather than inventing
-- one. The column is written and cleared in lockstep with paymentVerifiedAt, so
-- a name never outlives the verification it attests to.

-- AlterTable
ALTER TABLE "Registration" ADD COLUMN "paymentVerifiedBy" TEXT;
