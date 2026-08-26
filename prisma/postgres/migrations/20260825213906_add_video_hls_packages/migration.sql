-- CreateTable
CREATE TABLE "VideoHlsPackage" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "masterPath" TEXT NOT NULL,
    "publicUrl" TEXT NOT NULL,
    "variants" JSONB NOT NULL,
    "segmentPaths" JSONB NOT NULL,
    "totalFileSize" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ready',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VideoHlsPackage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VideoHlsPackage_masterPath_key" ON "VideoHlsPackage"("masterPath");

-- CreateTable
CREATE INDEX "VideoHlsPackage_videoId_idx" ON "VideoHlsPackage"("videoId");

-- CreateTable
CREATE UNIQUE INDEX "VideoHlsPackage_videoId_label_key" ON "VideoHlsPackage"("videoId", "label");

-- AddForeignKey
ALTER TABLE "VideoHlsPackage" ADD CONSTRAINT "VideoHlsPackage_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;
