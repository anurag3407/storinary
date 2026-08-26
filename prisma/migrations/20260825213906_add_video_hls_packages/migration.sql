-- CreateTable
CREATE TABLE "VideoHlsPackage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "videoId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "masterPath" TEXT NOT NULL,
    "publicUrl" TEXT NOT NULL,
    "variants" JSON NOT NULL,
    "segmentPaths" JSON NOT NULL,
    "totalFileSize" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ready',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VideoHlsPackage_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "VideoHlsPackage_masterPath_key" ON "VideoHlsPackage"("masterPath");

-- CreateIndex
CREATE INDEX "VideoHlsPackage_videoId_idx" ON "VideoHlsPackage"("videoId");

-- CreateIndex
CREATE UNIQUE INDEX "VideoHlsPackage_videoId_label_key" ON "VideoHlsPackage"("videoId", "label");

