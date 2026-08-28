-- Makes an admin session revocable.
--
-- Sessions are stateless HMAC tokens, so until now there was no way to end one
-- early: a stolen cookie stayed valid for its full seven days and changing the
-- password did nothing about it. The version is signed into each token and
-- compared on every request, so incrementing this column invalidates every
-- session that admin currently holds.
--
-- Defaults to 0, so existing rows need no backfill. Sessions issued before this
-- deploy carry no version at all and are refused by verifySessionSignature —
-- every signed-in admin is asked to sign in once more, which is the intended
-- behaviour for a change whose whole point is that an old token stops counting.

-- AlterTable
ALTER TABLE "AdminUser" ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0;
