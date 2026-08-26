-- CreateTable
CREATE TABLE "AiInsight" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "kind" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'openai-compatible',
  "model" TEXT NOT NULL,
  "tags" TEXT NOT NULL DEFAULT '',
  "altText" TEXT,
  "moderationScore" REAL,
  "isSafe" BOOLEAN,
  "rawMetadata" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "imageId" TEXT,
  CONSTRAINT "AiInsight_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "Image" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AiInsight_imageId_createdAt_idx" ON "AiInsight"("imageId", "createdAt");
CREATE INDEX "AiInsight_kind_createdAt_idx" ON "AiInsight"("kind", "createdAt");

-- AlterTable
ALTER TABLE "AiInsight" ADD COLUMN "videoId" TEXT;

-- AlterTable
ALTER TABLE "Video"
  ADD COLUMN "aiModerated" BOOLEAN NOT NULL DEFAULT 0;
ALTER TABLE "Video" ADD COLUMN "aiModerationScore" REAL;

-- CreateIndex
CREATE INDEX "AiInsight_videoId_createdAt_idx" ON "AiInsight"("videoId", "createdAt");

-- AddForeignKey
-- SQLite does not support adding a foreign key after table creation.
-- Recreate AiInsight with the complete video relation.

CREATE TABLE "AiInsight_new" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "kind" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'openai-compatible',
  "model" TEXT NOT NULL,
  "tags" TEXT NOT NULL DEFAULT '',
  "altText" TEXT,
  "moderationScore" REAL,
  "isSafe" BOOLEAN,
  "rawMetadata" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "imageId" TEXT,
  "videoId" TEXT,
  CONSTRAINT "AiInsight_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "Image" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AiInsight_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "AiInsight_new" (
  "id", "kind", "provider", "model", "tags", "altText", "moderationScore",
  "isSafe", "rawMetadata", "createdAt", "imageId", "videoId"
)
SELECT
  "id", "kind", "provider", "model", "tags", "altText", "moderationScore",
  "isSafe", "rawMetadata", "createdAt", "imageId", "videoId"
FROM "AiInsight";

DROP TABLE "AiInsight";
ALTER TABLE "AiInsight_new" RENAME TO "AiInsight";

CREATE INDEX "AiInsight_videoId_createdAt_idx" ON "AiInsight"("videoId", "createdAt");
