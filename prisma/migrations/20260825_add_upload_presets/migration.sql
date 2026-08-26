-- CreateTable
CREATE TABLE "UploadPreset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL UNIQUE,
    "folder" TEXT NOT NULL DEFAULT '/',
    "tags" TEXT NOT NULL DEFAULT '',
    "compress" BOOLEAN NOT NULL DEFAULT true,
    "quality" INTEGER NOT NULL DEFAULT 80,
    "maxWidth" INTEGER NOT NULL DEFAULT 2048,
    "removeBg" BOOLEAN NOT NULL DEFAULT false,
    "moderate" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "unsigned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- AlterTable
ALTER TABLE "ApiKey" ADD COLUMN "unsigned" BOOLEAN NOT NULL DEFAULT false;
