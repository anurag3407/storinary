-- CreateTable
CREATE TABLE "DeliveryEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "imageId" TEXT,
    "videoId" TEXT,
    "rendition" TEXT,
    "kind" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL DEFAULT 0,
    "referer" TEXT,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "DeliveryEvent_createdAt_idx" ON "DeliveryEvent"("createdAt");
CREATE INDEX "DeliveryEvent_imageId_createdAt_idx" ON "DeliveryEvent"("imageId", "createdAt");
CREATE INDEX "DeliveryEvent_videoId_createdAt_idx" ON "DeliveryEvent"("videoId", "createdAt");
