-- CreateTable
CREATE TABLE "ApiKeyUsageEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "apiKeyId" TEXT NOT NULL,
    "periodStart" DATETIME NOT NULL,
    "action" TEXT NOT NULL,
    "requests" INTEGER NOT NULL DEFAULT 0,
    "assets" INTEGER NOT NULL DEFAULT 0,
    "errors" INTEGER NOT NULL DEFAULT 0,
    "bytes" BIGINT NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ApiKeyUsageEvent_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "ApiKey" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ApiKeyUsageEvent_apiKeyId_periodStart_action_key" ON "ApiKeyUsageEvent"("apiKeyId", "periodStart", "action");

-- CreateIndex
CREATE INDEX "ApiKeyUsageEvent_periodStart_idx" ON "ApiKeyUsageEvent"("periodStart");
