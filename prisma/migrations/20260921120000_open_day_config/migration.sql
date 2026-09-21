-- CreateTable
CREATE TABLE "OpenDayConfig" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "location" TEXT NOT NULL DEFAULT '',
    "showOnHome" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpenDayConfig_pkey" PRIMARY KEY ("id")
);

