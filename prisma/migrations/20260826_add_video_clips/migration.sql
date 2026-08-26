-- CreateTable
CREATE TABLE "VideoClip" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "videoId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "storagePath" TEXT NOT NULL,
  "publicUrl" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL DEFAULT 'video/mp4',
  "startSeconds" REAL NOT NULL,
  "endSeconds" REAL NOT NULL,
  "muted" BOOLEAN NOT NULL DEFAULT false,
  "sourceLabel" TEXT,
  "fileSize" INTEGER NOT NULL DEFAULT 0,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "VideoClip_storagePath_key" ON "VideoClip"("storagePath");
CREATE UNIQUE INDEX "VideoClip_videoId_name_key" ON "VideoClip"("videoId", "name");
CREATE INDEX "VideoClip_videoId_createdAt_idx" ON "VideoClip"("videoId", "createdAt");

-- AddForeignKey
ALTER TABLE "VideoClip" ADD CONSTRAINT "VideoClip_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;
