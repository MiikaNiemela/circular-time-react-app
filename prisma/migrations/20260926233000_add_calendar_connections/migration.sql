-- CreateTable
CREATE TABLE "CalendarConnection" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerUserId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CalendarConnection_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "CachedEventRange" ADD COLUMN "calendarConnectionId" TEXT;

-- Backfill the explicit calendar connection from the legacy connected state.
INSERT INTO "CalendarConnection" ("id", "provider", "providerUserId", "userId", "createdAt")
SELECT "id", "provider", "providerUserId", "userId", "createdAt"
FROM "ProviderAccount"
WHERE "calendarConnected" = true;

-- Preserve caches that were authorized by a legacy connected provider.
UPDATE "CachedEventRange" AS cache
SET "calendarConnectionId" = connection."id"
FROM "CalendarConnection" AS connection
WHERE cache."userId" = connection."userId"
  AND cache."calendarId" = connection."provider";

-- The explicit CalendarConnection replaces the legacy boolean state.
ALTER TABLE "ProviderAccount" DROP COLUMN "calendarConnected";

-- CreateIndex
CREATE UNIQUE INDEX "CalendarConnection_provider_providerUserId_key" ON "CalendarConnection"("provider", "providerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarConnection_userId_provider_key" ON "CalendarConnection"("userId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarConnection_id_userId_key" ON "CalendarConnection"("id", "userId");

-- CreateIndex
CREATE INDEX "CachedEventRange_calendarConnectionId_idx" ON "CachedEventRange"("calendarConnectionId");

-- AddForeignKey
ALTER TABLE "CalendarConnection" ADD CONSTRAINT "CalendarConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CachedEventRange" ADD CONSTRAINT "CachedEventRange_calendarConnectionId_userId_fkey" FOREIGN KEY ("calendarConnectionId", "userId") REFERENCES "CalendarConnection"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;
