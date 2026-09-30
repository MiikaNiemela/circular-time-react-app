-- CreateTable
CREATE TABLE "CalendarCredential" (
    "calendarConnectionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ciphertext" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarCredential_pkey" PRIMARY KEY ("calendarConnectionId")
);

-- CreateIndex
CREATE UNIQUE INDEX "CalendarCredential_calendarConnectionId_userId_key" ON "CalendarCredential"("calendarConnectionId", "userId");

-- AddForeignKey
ALTER TABLE "CalendarCredential" ADD CONSTRAINT "CalendarCredential_calendarConnectionId_userId_fkey" FOREIGN KEY ("calendarConnectionId", "userId") REFERENCES "CalendarConnection"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

