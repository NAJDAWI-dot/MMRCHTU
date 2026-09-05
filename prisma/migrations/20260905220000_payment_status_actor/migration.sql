-- Who last set a payment's status, and when.
--
-- "paymentVerifiedBy" answers only "who confirmed the money arrived", and is
-- cleared the moment a verification is withdrawn. That leaves the commonest
-- reconciliation question unanswerable: a payment sitting at "Not matched"
-- carries no record of who decided that, or when. These two columns are
-- written on every transition and never cleared.
--
-- Additive and nullable, so existing rows are untouched; they simply have no
-- actor recorded until their status is next changed.
ALTER TABLE "Registration" ADD COLUMN "paymentStatusBy" TEXT;
ALTER TABLE "Registration" ADD COLUMN "paymentStatusAt" TIMESTAMP(3);
