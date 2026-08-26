-- CreateTable
CREATE TABLE "AiInsight" (
  "id" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'openai-compatible',
  "model" TEXT NOT NULL,
  "tags" TEXT NOT NULL DEFAULT '',
  "altText" TEXT,
  "moderationScore" DOUBLE PRECISION,
  "isSafe" BOOLEAN,
  "rawMetadata" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "imageId" TEXT,

  CONSTRAINT "AiInsight_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiInsight_imageId_createdAt_idx" ON "AiInsight"("imageId", "createdAt");
CREATE INDEX "AiInsight_kind_createdAt_idx" ON "AiInsight"("kind", "createdAt");

-- AddForeignKey
ALTER TABLE "AiInsight" ADD CONSTRAINT "AiInsight_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "Image"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "AiInsight" ADD COLUMN "videoId" TEXT;

-- AlterTable
ALTER TABLE "Video" ADD COLUMN "aiModerated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "aiModerationScore" DOUBLE PRECISION;

-- CreateIndex
CREATE INDEX "AiInsight_videoId_createdAt_idx" ON "AiInsight"("videoId", "createdAt");

-- AddForeignKey
ALTER TABLE "AiInsight" ADD CONSTRAINT "AiInsight_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;
