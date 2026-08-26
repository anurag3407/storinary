-- CreateTable
CREATE TABLE "ApiKeyUsageEvent" (
    "id" TEXT NOT NULL,
    "apiKeyId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "action" TEXT NOT NULL,
    "requests" INTEGER NOT NULL DEFAULT 0,
    "assets" INTEGER NOT NULL DEFAULT 0,
    "errors" INTEGER NOT NULL DEFAULT 0,
    "bytes" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApiKeyUsageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ApiKeyUsageEvent_apiKeyId_periodStart_action_key" ON "ApiKeyUsageEvent"("apiKeyId", "periodStart", "action");

-- CreateIndex
CREATE INDEX "ApiKeyUsageEvent_periodStart_idx" ON "ApiKeyUsageEvent"("periodStart");

-- AddForeignKey
ALTER TABLE "ApiKeyUsageEvent" ADD CONSTRAINT "ApiKeyUsageEvent_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "ApiKey"("id") ON DELETE CASCADE ON UPDATE CASCADE;
