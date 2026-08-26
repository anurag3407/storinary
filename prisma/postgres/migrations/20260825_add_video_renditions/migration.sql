-- CreateTable
CREATE TABLE "VideoRendition" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "publicUrl" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "bitrateKbps" INTEGER NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ready',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VideoRendition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VideoRendition_storagePath_key" ON "VideoRendition"("storagePath");
CREATE INDEX "VideoRendition_videoId_idx" ON "VideoRendition"("videoId");
CREATE UNIQUE INDEX "VideoRendition_videoId_label_key" ON "VideoRendition"("videoId", "label");

-- AddForeignKey
ALTER TABLE "VideoRendition" ADD CONSTRAINT "VideoRendition_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;
