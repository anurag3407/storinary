-- CreateTable
CREATE TABLE "Video" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "originalName" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "publicUrl" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "duration" REAL NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "folder" TEXT NOT NULL DEFAULT '/',
    "tags" TEXT NOT NULL DEFAULT '',
    "altText" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'ready',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Video_storagePath_key" ON "Video"("storagePath");

CREATE INDEX "Video_folder_idx" ON "Video"("folder");
CREATE INDEX "Video_createdAt_idx" ON "Video"("createdAt");
CREATE INDEX "Video_originalName_idx" ON "Video"("originalName");
