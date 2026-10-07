-- CreateTable
CREATE TABLE "Stream" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Stream_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StreamSource" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "streamId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "calendarConnectionId" TEXT,

    CONSTRAINT "StreamSource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Stream_userId_position_idx" ON "Stream"("userId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "Stream_id_userId_key" ON "Stream"("id", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "StreamSource_calendarConnectionId_key" ON "StreamSource"("calendarConnectionId");

-- CreateIndex
CREATE INDEX "StreamSource_streamId_idx" ON "StreamSource"("streamId");

-- AddForeignKey
ALTER TABLE "Stream" ADD CONSTRAINT "Stream_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StreamSource" ADD CONSTRAINT "StreamSource_streamId_userId_fkey" FOREIGN KEY ("streamId", "userId") REFERENCES "Stream"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StreamSource" ADD CONSTRAINT "StreamSource_calendarConnectionId_userId_fkey" FOREIGN KEY ("calendarConnectionId", "userId") REFERENCES "CalendarConnection"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- A source's kind and its reference must match: a calendar source names a
-- calendar connection, and no other kind exists yet. A new kind extends this
-- check together with its own reference column.
ALTER TABLE "StreamSource" ADD CONSTRAINT "StreamSource_kind_reference_check"
  CHECK ("kind" IN ('calendar') AND (("kind" = 'calendar') = ("calendarConnectionId" IS NOT NULL)));
