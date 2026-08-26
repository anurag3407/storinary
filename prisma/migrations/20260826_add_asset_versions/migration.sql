-- CreateTable
CREATE TABLE "ImageVersion" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "imageId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "label" TEXT NOT NULL DEFAULT 'original',
  "originalName" TEXT NOT NULL,
  "storagePath" TEXT NOT NULL,
  "publicUrl" TEXT NOT NULL,
  "width" INTEGER NOT NULL,
  "height" INTEGER NOT NULL,
  "fileSize" INTEGER NOT NULL,
  "format" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ImageVersion_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "Image" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VideoVersion" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "videoId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "label" TEXT NOT NULL DEFAULT 'original',
  "originalName" TEXT NOT NULL,
  "storagePath" TEXT NOT NULL,
  "publicUrl" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "posterPath" TEXT,
  "format" TEXT NOT NULL,
  "width" INTEGER NOT NULL,
  "height" INTEGER NOT NULL,
  "duration" REAL NOT NULL,
  "fileSize" INTEGER NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VideoVersion_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ImageVersion_storagePath_key" ON "ImageVersion"("storagePath");
CREATE UNIQUE INDEX "ImageVersion_imageId_version_key" ON "ImageVersion"("imageId", "version");
CREATE INDEX "ImageVersion_imageId_createdAt_idx" ON "ImageVersion"("imageId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "VideoVersion_storagePath_key" ON "VideoVersion"("storagePath");
CREATE UNIQUE INDEX "VideoVersion_videoId_version_key" ON "VideoVersion"("videoId", "version");
CREATE INDEX "VideoVersion_videoId_createdAt_idx" ON "VideoVersion"("videoId", "createdAt");
