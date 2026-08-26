-- CreateTable
CREATE TABLE "MetadataField" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "externalId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "required" BOOLEAN NOT NULL DEFAULT false,
  "allowedValues" TEXT NOT NULL DEFAULT '',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "StructuredMetadata" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "fieldId" TEXT NOT NULL,
  "value" TEXT NOT NULL DEFAULT '',
  "imageId" TEXT,
  "videoId" TEXT,
  CONSTRAINT "StructuredMetadata_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "MetadataField" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "StructuredMetadata_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "Image" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "StructuredMetadata_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "MetadataField_externalId_key" ON "MetadataField"("externalId");
CREATE UNIQUE INDEX "StructuredMetadata_fieldId_imageId_key" ON "StructuredMetadata"("fieldId", "imageId");
CREATE UNIQUE INDEX "StructuredMetadata_fieldId_videoId_key" ON "StructuredMetadata"("fieldId", "videoId");
CREATE INDEX "StructuredMetadata_imageId_idx" ON "StructuredMetadata"("imageId");
CREATE INDEX "StructuredMetadata_videoId_idx" ON "StructuredMetadata"("videoId");
