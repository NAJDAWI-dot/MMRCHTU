-- New default wording for the register page deadline text.
ALTER TABLE "RegisterFormConfig" ALTER COLUMN "deadlineText" SET DEFAULT 'Registration closes soon. Check back for the exact date.';

-- Only rows still showing the old default are updated; text an admin wrote is left alone.
UPDATE "RegisterFormConfig"
SET "deadlineText" = 'Registration closes soon. Check back for the exact date.'
WHERE "deadlineText" = 'Registration closes soon — check back for the exact date.';
