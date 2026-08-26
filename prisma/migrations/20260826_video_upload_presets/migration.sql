-- AlterTable
ALTER TABLE "UploadPreset" ADD COLUMN "resourceType" TEXT NOT NULL DEFAULT 'image';
ALTER TABLE "UploadPreset" ADD COLUMN "renditions" BOOLEAN NOT NULL DEFAULT false;
