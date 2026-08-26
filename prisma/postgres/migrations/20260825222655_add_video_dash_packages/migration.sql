-- CreateTable
CREATE TABLE "VideoDashPackage" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "manifestPath" TEXT NOT NULL,
    "publicUrl" TEXT NOT NULL,
    "variants" JSONB NOT NULL,
    "filePaths" JSONB NOT NULL,
    "totalFileSize" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ready',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VideoDashPackage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VideoDashPackage_manifestPath_key" ON "VideoDashPackage"("manifestPath");

-- CreateIndex
CREATE INDEX "VideoDashPackage_videoId_idx" ON "VideoDashPackage"("videoId");

-- CreateIndex
CREATE UNIQUE INDEX "VideoDashPackage_videoId_label_key" ON "VideoDashPackage"("videoId", "label");

-- AddForeignKey
ALTER TABLE "VideoDashPackage" ADD CONSTRAINT "VideoDashPackage_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;
