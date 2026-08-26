-- CreateTable
CREATE TABLE "DeliveryEvent" (
    "id" TEXT NOT NULL,
    "imageId" TEXT,
    "videoId" TEXT,
    "rendition" TEXT,
    "kind" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL DEFAULT 0,
    "referer" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeliveryEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DeliveryEvent_createdAt_idx" ON "DeliveryEvent"("createdAt");
CREATE INDEX "DeliveryEvent_imageId_createdAt_idx" ON "DeliveryEvent"("imageId", "createdAt");
CREATE INDEX "DeliveryEvent_videoId_createdAt_idx" ON "DeliveryEvent"("videoId", "createdAt");
