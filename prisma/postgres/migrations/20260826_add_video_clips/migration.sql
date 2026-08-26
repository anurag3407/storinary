-- CreateTable
CREATE TABLE "VideoClip" (
  "id" TEXT NOT NULL,
  "videoId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "storagePath" TEXT NOT NULL,
  "publicUrl" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL DEFAULT 'video/mp4',
  "startSeconds" DOUBLE PRECISION NOT NULL,
  "endSeconds" DOUBLE PRECISION NOT NULL,
  "muted" BOOLEAN NOT NULL DEFAULT false,
  "sourceLabel" TEXT,
  "fileSize" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "VideoClip_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VideoClip_storagePath_key" ON "VideoClip"("storagePath");
CREATE UNIQUE INDEX "VideoClip_videoId_name_key" ON "VideoClip"("videoId", "name");
CREATE INDEX "VideoClip_videoId_createdAt_idx" ON "VideoClip"("videoId", "createdAt");

-- AddForeignKey
ALTER TABLE "VideoClip" ADD CONSTRAINT "VideoClip_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;
