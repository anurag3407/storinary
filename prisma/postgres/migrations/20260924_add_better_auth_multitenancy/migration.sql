-- DropIndex
DROP INDEX "ImageVersion_storagePath_key";

-- DropIndex
DROP INDEX "Video_storagePath_key";

-- DropIndex
DROP INDEX "VideoClip_storagePath_key";

-- DropIndex
DROP INDEX "VideoVersion_storagePath_key";

-- DropIndex
DROP INDEX "VideoHlsPackage_masterPath_key";

-- DropIndex
DROP INDEX "VideoDashPackage_manifestPath_key";

-- DropIndex
DROP INDEX "VideoRendition_storagePath_key";

-- DropIndex
DROP INDEX "UploadPreset_name_key";

-- DropIndex
DROP INDEX "NamedTransformation_name_key";

-- DropIndex
DROP INDEX "Collection_name_key";

-- DropIndex
DROP INDEX "MetadataField_externalId_key";

-- AlterTable
ALTER TABLE "Image" ADD COLUMN     "organizationId" TEXT NOT NULL DEFAULT 'legacy';

-- AlterTable
ALTER TABLE "ImageVersion" ADD COLUMN     "organizationId" TEXT NOT NULL DEFAULT 'legacy';

-- AlterTable
ALTER TABLE "AiInsight" ADD COLUMN     "organizationId" TEXT NOT NULL DEFAULT 'legacy';

-- AlterTable
ALTER TABLE "ApiKey" ADD COLUMN     "organizationId" TEXT NOT NULL DEFAULT 'legacy';

-- AlterTable
ALTER TABLE "ApiKeyUsageEvent" ADD COLUMN     "organizationId" TEXT NOT NULL DEFAULT 'legacy';

-- AlterTable
ALTER TABLE "Video" ADD COLUMN     "organizationId" TEXT NOT NULL DEFAULT 'legacy';

-- AlterTable
ALTER TABLE "VideoClip" ADD COLUMN     "organizationId" TEXT NOT NULL DEFAULT 'legacy';

-- AlterTable
ALTER TABLE "VideoVersion" ADD COLUMN     "organizationId" TEXT NOT NULL DEFAULT 'legacy';

-- AlterTable
ALTER TABLE "VideoHlsPackage" ADD COLUMN     "organizationId" TEXT NOT NULL DEFAULT 'legacy';

-- AlterTable
ALTER TABLE "VideoDashPackage" ADD COLUMN     "organizationId" TEXT NOT NULL DEFAULT 'legacy';

-- AlterTable
ALTER TABLE "VideoRendition" ADD COLUMN     "organizationId" TEXT NOT NULL DEFAULT 'legacy';

-- AlterTable
ALTER TABLE "WebhookEndpoint" ADD COLUMN     "organizationId" TEXT NOT NULL DEFAULT 'legacy';

-- AlterTable
ALTER TABLE "WebhookDelivery" ADD COLUMN     "organizationId" TEXT NOT NULL DEFAULT 'legacy';

-- AlterTable
ALTER TABLE "UploadPreset" ADD COLUMN     "organizationId" TEXT NOT NULL DEFAULT 'legacy';

-- AlterTable
ALTER TABLE "NamedTransformation" ADD COLUMN     "organizationId" TEXT NOT NULL DEFAULT 'legacy';

-- AlterTable
ALTER TABLE "Collection" ADD COLUMN     "organizationId" TEXT NOT NULL DEFAULT 'legacy';

-- AlterTable
ALTER TABLE "CollectionItem" ADD COLUMN     "organizationId" TEXT NOT NULL DEFAULT 'legacy';

-- AlterTable
ALTER TABLE "DeliveryEvent" ADD COLUMN     "organizationId" TEXT NOT NULL DEFAULT 'legacy';

-- AlterTable
ALTER TABLE "MetadataField" ADD COLUMN     "organizationId" TEXT NOT NULL DEFAULT 'legacy';

-- AlterTable
ALTER TABLE "StructuredMetadata" ADD COLUMN     "organizationId" TEXT NOT NULL DEFAULT 'legacy';

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,
    "activeOrganizationId" TEXT,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "metadata" TEXT,

    CONSTRAINT "organization_pkey" PRIMARY KEY ("id")
);

-- Preserve all pre-tenant application data in a reserved organization.
INSERT INTO "organization" ("id", "name", "slug", "createdAt") VALUES ('legacy', 'Legacy workspace', 'legacy', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;


-- CreateTable
CREATE TABLE "member" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "inviterId" TEXT NOT NULL,

    CONSTRAINT "invitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "account"("userId");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "organization_slug_key" ON "organization"("slug");

-- CreateIndex
CREATE INDEX "member_organizationId_idx" ON "member"("organizationId");

-- CreateIndex
CREATE INDEX "member_userId_idx" ON "member"("userId");

-- CreateIndex
CREATE INDEX "invitation_organizationId_idx" ON "invitation"("organizationId");

-- CreateIndex
CREATE INDEX "invitation_email_idx" ON "invitation"("email");

-- CreateIndex
CREATE INDEX "Image_organizationId_idx" ON "Image"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Image_organizationId_storagePath_key" ON "Image"("organizationId", "storagePath");

-- CreateIndex
CREATE INDEX "ImageVersion_organizationId_idx" ON "ImageVersion"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "ImageVersion_organizationId_storagePath_key" ON "ImageVersion"("organizationId", "storagePath");

-- CreateIndex
CREATE UNIQUE INDEX "ImageVersion_organizationId_imageId_version_key" ON "ImageVersion"("organizationId", "imageId", "version");

-- CreateIndex
CREATE INDEX "AiInsight_organizationId_idx" ON "AiInsight"("organizationId");

-- CreateIndex
CREATE INDEX "ApiKey_organizationId_idx" ON "ApiKey"("organizationId");

-- CreateIndex
CREATE INDEX "ApiKeyUsageEvent_organizationId_idx" ON "ApiKeyUsageEvent"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKeyUsageEvent_organizationId_apiKeyId_periodStart_action_key" ON "ApiKeyUsageEvent"("organizationId", "apiKeyId", "periodStart", "action");

-- CreateIndex
CREATE INDEX "Video_organizationId_idx" ON "Video"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Video_organizationId_storagePath_key" ON "Video"("organizationId", "storagePath");

-- CreateIndex
CREATE INDEX "VideoClip_organizationId_idx" ON "VideoClip"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "VideoClip_organizationId_storagePath_key" ON "VideoClip"("organizationId", "storagePath");

-- CreateIndex
CREATE UNIQUE INDEX "VideoClip_organizationId_videoId_name_key" ON "VideoClip"("organizationId", "videoId", "name");

-- CreateIndex
CREATE INDEX "VideoVersion_organizationId_idx" ON "VideoVersion"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "VideoVersion_organizationId_storagePath_key" ON "VideoVersion"("organizationId", "storagePath");

-- CreateIndex
CREATE UNIQUE INDEX "VideoVersion_organizationId_videoId_version_key" ON "VideoVersion"("organizationId", "videoId", "version");

-- CreateIndex
CREATE INDEX "VideoHlsPackage_organizationId_idx" ON "VideoHlsPackage"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "VideoHlsPackage_organizationId_masterPath_key" ON "VideoHlsPackage"("organizationId", "masterPath");

-- CreateIndex
CREATE UNIQUE INDEX "VideoHlsPackage_organizationId_videoId_label_key" ON "VideoHlsPackage"("organizationId", "videoId", "label");

-- CreateIndex
CREATE INDEX "VideoDashPackage_organizationId_idx" ON "VideoDashPackage"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "VideoDashPackage_organizationId_manifestPath_key" ON "VideoDashPackage"("organizationId", "manifestPath");

-- CreateIndex
CREATE UNIQUE INDEX "VideoDashPackage_organizationId_videoId_label_key" ON "VideoDashPackage"("organizationId", "videoId", "label");

-- CreateIndex
CREATE INDEX "VideoRendition_organizationId_idx" ON "VideoRendition"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "VideoRendition_organizationId_storagePath_key" ON "VideoRendition"("organizationId", "storagePath");

-- CreateIndex
CREATE INDEX "WebhookEndpoint_organizationId_idx" ON "WebhookEndpoint"("organizationId");

-- CreateIndex
CREATE INDEX "WebhookDelivery_organizationId_idx" ON "WebhookDelivery"("organizationId");

-- CreateIndex
CREATE INDEX "UploadPreset_organizationId_idx" ON "UploadPreset"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "UploadPreset_organizationId_name_key" ON "UploadPreset"("organizationId", "name");

-- CreateIndex
CREATE INDEX "NamedTransformation_organizationId_idx" ON "NamedTransformation"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "NamedTransformation_organizationId_name_key" ON "NamedTransformation"("organizationId", "name");

-- CreateIndex
CREATE INDEX "Collection_organizationId_idx" ON "Collection"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Collection_organizationId_name_key" ON "Collection"("organizationId", "name");

-- CreateIndex
CREATE INDEX "CollectionItem_organizationId_idx" ON "CollectionItem"("organizationId");

-- CreateIndex
CREATE INDEX "DeliveryEvent_organizationId_idx" ON "DeliveryEvent"("organizationId");

-- CreateIndex
CREATE INDEX "MetadataField_organizationId_idx" ON "MetadataField"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "MetadataField_organizationId_externalId_key" ON "MetadataField"("organizationId", "externalId");

-- CreateIndex
CREATE INDEX "StructuredMetadata_organizationId_idx" ON "StructuredMetadata"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "StructuredMetadata_organizationId_fieldId_imageId_key" ON "StructuredMetadata"("organizationId", "fieldId", "imageId");

-- CreateIndex
CREATE UNIQUE INDEX "StructuredMetadata_organizationId_fieldId_videoId_key" ON "StructuredMetadata"("organizationId", "fieldId", "videoId");

-- AddForeignKey
ALTER TABLE "Image" ADD CONSTRAINT "Image_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImageVersion" ADD CONSTRAINT "ImageVersion_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiInsight" ADD CONSTRAINT "AiInsight_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKeyUsageEvent" ADD CONSTRAINT "ApiKeyUsageEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Video" ADD CONSTRAINT "Video_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoClip" ADD CONSTRAINT "VideoClip_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoVersion" ADD CONSTRAINT "VideoVersion_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoHlsPackage" ADD CONSTRAINT "VideoHlsPackage_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoDashPackage" ADD CONSTRAINT "VideoDashPackage_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoRendition" ADD CONSTRAINT "VideoRendition_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookEndpoint" ADD CONSTRAINT "WebhookEndpoint_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookDelivery" ADD CONSTRAINT "WebhookDelivery_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadPreset" ADD CONSTRAINT "UploadPreset_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NamedTransformation" ADD CONSTRAINT "NamedTransformation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Collection" ADD CONSTRAINT "Collection_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionItem" ADD CONSTRAINT "CollectionItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryEvent" ADD CONSTRAINT "DeliveryEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetadataField" ADD CONSTRAINT "MetadataField_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StructuredMetadata" ADD CONSTRAINT "StructuredMetadata_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member" ADD CONSTRAINT "member_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member" ADD CONSTRAINT "member_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

