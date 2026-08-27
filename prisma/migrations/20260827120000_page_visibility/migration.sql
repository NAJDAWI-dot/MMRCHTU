-- Admin-controlled page visibility: one row per page an admin has hidden or
-- explicitly un-hidden.
--
-- No seed rows and no backfill. A page with no row here is visible, which is
-- the state every page is in today, so this migration changes nothing about
-- what the site currently shows.

-- CreateTable
CREATE TABLE "PageVisibility" (
    "href" TEXT NOT NULL,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PageVisibility_pkey" PRIMARY KEY ("href")
);
