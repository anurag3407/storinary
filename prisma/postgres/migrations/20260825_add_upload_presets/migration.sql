-- CreateTable
CREATE TABLE "UploadPreset" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "folder" TEXT NOT NULL DEFAULT '/',
    "tags" TEXT NOT NULL DEFAULT '',
    "compress" BOOLEAN NOT NULL DEFAULT true,
    "quality" INTEGER NOT NULL DEFAULT 80,
    "maxWidth" INTEGER NOT NULL DEFAULT 2048,
    "removeBg" BOOLEAN NOT NULL DEFAULT false,
    "moderate" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "unsigned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UploadPreset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UploadPreset_name_key" ON "UploadPreset"("name");

-- AlterTable
ALTER TABLE "ApiKey" ADD COLUMN "unsigned" BOOLEAN NOT NULL DEFAULT false;
