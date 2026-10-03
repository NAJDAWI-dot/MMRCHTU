-- The tile behind a sponsor's logo: WHITE (as before) or DARK for a light logo.
ALTER TABLE "Sponsor" ADD COLUMN "logoBackground" TEXT NOT NULL DEFAULT 'WHITE';
