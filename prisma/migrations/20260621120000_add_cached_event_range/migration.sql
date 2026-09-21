-- CreateTable
CREATE TABLE "CachedEventRange" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "calendarId" TEXT NOT NULL,
    "rangeStart" TEXT NOT NULL,
    "rangeEnd" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eventsJson" TEXT NOT NULL,

    CONSTRAINT "CachedEventRange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CachedEventRange_userId_calendarId_rangeStart_rangeEnd_key" ON "CachedEventRange"("userId", "calendarId", "rangeStart", "rangeEnd");

-- AddForeignKey
ALTER TABLE "CachedEventRange" ADD CONSTRAINT "CachedEventRange_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
