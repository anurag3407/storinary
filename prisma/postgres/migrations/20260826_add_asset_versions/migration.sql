-- CreateTable
CREATE TABLE "ImageVersion" (
  "id" TEXT NOT NULL,
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
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ImageVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VideoVersion" (
  "id" TEXT NOT NULL,
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
  "duration" DOUBLE PRECISION NOT NULL,
  "fileSize" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VideoVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ImageVersion_storagePath_key" ON "ImageVersion"("storagePath");
CREATE UNIQUE INDEX "ImageVersion_imageId_version_key" ON "ImageVersion"("imageId", "version");
CREATE INDEX "ImageVersion_imageId_createdAt_idx" ON "ImageVersion"("imageId", "createdAt");

-- AddForeignKey
ALTER TABLE "ImageVersion" ADD CONSTRAINT "ImageVersion_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "Image"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE UNIQUE INDEX "VideoVersion_storagePath_key" ON "VideoVersion"("storagePath");
CREATE UNIQUE INDEX "VideoVersion_videoId_version_key" ON "VideoVersion"("videoId", "version");
CREATE INDEX "VideoVersion_videoId_createdAt_idx" ON "VideoVersion"("videoId", "createdAt");

-- AddForeignKey
ALTER TABLE "VideoVersion" ADD CONSTRAINT "VideoVersion_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;
