-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "expiresAt" DATETIME NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,
    "activeOrganizationId" TEXT,
    CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" DATETIME,
    "refreshTokenExpiresAt" DATETIME,
    "scope" TEXT,
    "password" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "organization" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logo" TEXT,
    "createdAt" DATETIME NOT NULL,
    "metadata" TEXT
);

-- Preserve all pre-tenant application data in a reserved organization.
INSERT INTO "organization" ("id", "name", "slug", "createdAt") VALUES ('legacy', 'Legacy workspace', 'legacy', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;


-- CreateTable
CREATE TABLE "member" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "createdAt" DATETIME NOT NULL,
    CONSTRAINT "member_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "member_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "invitation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "inviterId" TEXT NOT NULL,
    CONSTRAINT "invitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "invitation_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Image" (
    "organizationId" TEXT NOT NULL DEFAULT 'legacy',
    "id" TEXT NOT NULL PRIMARY KEY,
    "originalName" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "publicUrl" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "format" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "folder" TEXT NOT NULL DEFAULT '/',
    "tags" TEXT NOT NULL DEFAULT '',
    "altText" TEXT NOT NULL DEFAULT '',
    "bgRemoved" BOOLEAN NOT NULL DEFAULT false,
    "compressed" BOOLEAN NOT NULL DEFAULT false,
    "aiModerated" BOOLEAN NOT NULL DEFAULT false,
    "aiModerationScore" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Image_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Image" ("aiModerated", "aiModerationScore", "altText", "bgRemoved", "compressed", "createdAt", "fileSize", "folder", "format", "height", "id", "mimeType", "originalName", "publicUrl", "storagePath", "tags", "updatedAt", "width") SELECT "aiModerated", "aiModerationScore", "altText", "bgRemoved", "compressed", "createdAt", "fileSize", "folder", "format", "height", "id", "mimeType", "originalName", "publicUrl", "storagePath", "tags", "updatedAt", "width" FROM "Image";
DROP TABLE "Image";
ALTER TABLE "new_Image" RENAME TO "Image";
CREATE UNIQUE INDEX "Image_storagePath_key" ON "Image"("storagePath");
CREATE INDEX "Image_folder_idx" ON "Image"("folder");
CREATE INDEX "Image_createdAt_idx" ON "Image"("createdAt");
CREATE INDEX "Image_originalName_idx" ON "Image"("originalName");
CREATE INDEX "Image_organizationId_idx" ON "Image"("organizationId");
CREATE UNIQUE INDEX "Image_organizationId_storagePath_key" ON "Image"("organizationId", "storagePath");
CREATE TABLE "new_ImageVersion" (
    "organizationId" TEXT NOT NULL DEFAULT 'legacy',
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
    CONSTRAINT "ImageVersion_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ImageVersion_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "Image" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ImageVersion" ("createdAt", "fileSize", "format", "height", "id", "imageId", "label", "mimeType", "originalName", "publicUrl", "storagePath", "version", "width") SELECT "createdAt", "fileSize", "format", "height", "id", "imageId", "label", "mimeType", "originalName", "publicUrl", "storagePath", "version", "width" FROM "ImageVersion";
DROP TABLE "ImageVersion";
ALTER TABLE "new_ImageVersion" RENAME TO "ImageVersion";
CREATE INDEX "ImageVersion_imageId_createdAt_idx" ON "ImageVersion"("imageId", "createdAt");
CREATE INDEX "ImageVersion_organizationId_idx" ON "ImageVersion"("organizationId");
CREATE UNIQUE INDEX "ImageVersion_imageId_version_key" ON "ImageVersion"("imageId", "version");
CREATE UNIQUE INDEX "ImageVersion_organizationId_storagePath_key" ON "ImageVersion"("organizationId", "storagePath");
CREATE UNIQUE INDEX "ImageVersion_organizationId_imageId_version_key" ON "ImageVersion"("organizationId", "imageId", "version");
CREATE TABLE "new_AiInsight" (
    "organizationId" TEXT NOT NULL DEFAULT 'legacy',
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
    CONSTRAINT "AiInsight_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AiInsight_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "Image" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AiInsight_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_AiInsight" ("altText", "createdAt", "id", "imageId", "isSafe", "kind", "model", "moderationScore", "provider", "rawMetadata", "tags", "videoId") SELECT "altText", "createdAt", "id", "imageId", "isSafe", "kind", "model", "moderationScore", "provider", "rawMetadata", "tags", "videoId" FROM "AiInsight";
DROP TABLE "AiInsight";
ALTER TABLE "new_AiInsight" RENAME TO "AiInsight";
CREATE INDEX "AiInsight_imageId_createdAt_idx" ON "AiInsight"("imageId", "createdAt");
CREATE INDEX "AiInsight_kind_createdAt_idx" ON "AiInsight"("kind", "createdAt");
CREATE INDEX "AiInsight_organizationId_idx" ON "AiInsight"("organizationId");
CREATE TABLE "new_ApiKey" (
    "organizationId" TEXT NOT NULL DEFAULT 'legacy',
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "hashedKey" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "lastFour" TEXT NOT NULL,
    "scopes" TEXT NOT NULL DEFAULT 'upload,read',
    "unsigned" BOOLEAN NOT NULL DEFAULT false,
    "lastUsedAt" DATETIME,
    "revokedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ApiKey_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ApiKey" ("createdAt", "hashedKey", "id", "keyPrefix", "lastFour", "lastUsedAt", "name", "revokedAt", "scopes", "unsigned", "updatedAt") SELECT "createdAt", "hashedKey", "id", "keyPrefix", "lastFour", "lastUsedAt", "name", "revokedAt", "scopes", "unsigned", "updatedAt" FROM "ApiKey";
DROP TABLE "ApiKey";
ALTER TABLE "new_ApiKey" RENAME TO "ApiKey";
CREATE UNIQUE INDEX "ApiKey_hashedKey_key" ON "ApiKey"("hashedKey");
CREATE INDEX "ApiKey_keyPrefix_idx" ON "ApiKey"("keyPrefix");
CREATE INDEX "ApiKey_organizationId_idx" ON "ApiKey"("organizationId");
CREATE TABLE "new_ApiKeyUsageEvent" (
    "organizationId" TEXT NOT NULL DEFAULT 'legacy',
    "id" TEXT NOT NULL PRIMARY KEY,
    "apiKeyId" TEXT NOT NULL,
    "periodStart" DATETIME NOT NULL,
    "action" TEXT NOT NULL,
    "requests" INTEGER NOT NULL DEFAULT 0,
    "assets" INTEGER NOT NULL DEFAULT 0,
    "errors" INTEGER NOT NULL DEFAULT 0,
    "bytes" BIGINT NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ApiKeyUsageEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ApiKeyUsageEvent_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "ApiKey" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ApiKeyUsageEvent" ("action", "apiKeyId", "assets", "bytes", "createdAt", "errors", "id", "periodStart", "requests", "updatedAt") SELECT "action", "apiKeyId", "assets", "bytes", "createdAt", "errors", "id", "periodStart", "requests", "updatedAt" FROM "ApiKeyUsageEvent";
DROP TABLE "ApiKeyUsageEvent";
ALTER TABLE "new_ApiKeyUsageEvent" RENAME TO "ApiKeyUsageEvent";
CREATE INDEX "ApiKeyUsageEvent_periodStart_idx" ON "ApiKeyUsageEvent"("periodStart");
CREATE INDEX "ApiKeyUsageEvent_organizationId_idx" ON "ApiKeyUsageEvent"("organizationId");
CREATE UNIQUE INDEX "ApiKeyUsageEvent_apiKeyId_periodStart_action_key" ON "ApiKeyUsageEvent"("apiKeyId", "periodStart", "action");
CREATE UNIQUE INDEX "ApiKeyUsageEvent_organizationId_apiKeyId_periodStart_action_key" ON "ApiKeyUsageEvent"("organizationId", "apiKeyId", "periodStart", "action");
CREATE TABLE "new_Video" (
    "organizationId" TEXT NOT NULL DEFAULT 'legacy',
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "folder" TEXT NOT NULL DEFAULT '/',
    "tags" TEXT NOT NULL DEFAULT '',
    "altText" TEXT NOT NULL DEFAULT '',
    "aiModerated" BOOLEAN NOT NULL DEFAULT false,
    "aiModerationScore" REAL,
    "status" TEXT NOT NULL DEFAULT 'ready',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Video_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Video" ("aiModerated", "aiModerationScore", "altText", "createdAt", "duration", "fileSize", "folder", "format", "height", "id", "mimeType", "originalName", "posterPath", "publicUrl", "status", "storagePath", "tags", "updatedAt", "width") SELECT "aiModerated", "aiModerationScore", "altText", "createdAt", "duration", "fileSize", "folder", "format", "height", "id", "mimeType", "originalName", "posterPath", "publicUrl", "status", "storagePath", "tags", "updatedAt", "width" FROM "Video";
DROP TABLE "Video";
ALTER TABLE "new_Video" RENAME TO "Video";
CREATE INDEX "Video_folder_idx" ON "Video"("folder");
CREATE INDEX "Video_createdAt_idx" ON "Video"("createdAt");
CREATE INDEX "Video_originalName_idx" ON "Video"("originalName");
CREATE INDEX "Video_organizationId_idx" ON "Video"("organizationId");
CREATE UNIQUE INDEX "Video_organizationId_storagePath_key" ON "Video"("organizationId", "storagePath");
CREATE TABLE "new_VideoClip" (
    "organizationId" TEXT NOT NULL DEFAULT 'legacy',
    "id" TEXT NOT NULL PRIMARY KEY,
    "videoId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "publicUrl" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'video/mp4',
    "startSeconds" REAL NOT NULL,
    "endSeconds" REAL NOT NULL,
    "muted" BOOLEAN NOT NULL DEFAULT false,
    "sourceLabel" TEXT,
    "fileSize" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VideoClip_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "VideoClip_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_VideoClip" ("createdAt", "endSeconds", "fileSize", "id", "mimeType", "muted", "name", "publicUrl", "sourceLabel", "startSeconds", "storagePath", "updatedAt", "videoId") SELECT "createdAt", "endSeconds", "fileSize", "id", "mimeType", "muted", "name", "publicUrl", "sourceLabel", "startSeconds", "storagePath", "updatedAt", "videoId" FROM "VideoClip";
DROP TABLE "VideoClip";
ALTER TABLE "new_VideoClip" RENAME TO "VideoClip";
CREATE INDEX "VideoClip_videoId_createdAt_idx" ON "VideoClip"("videoId", "createdAt");
CREATE INDEX "VideoClip_organizationId_idx" ON "VideoClip"("organizationId");
CREATE UNIQUE INDEX "VideoClip_videoId_name_key" ON "VideoClip"("videoId", "name");
CREATE UNIQUE INDEX "VideoClip_organizationId_storagePath_key" ON "VideoClip"("organizationId", "storagePath");
CREATE UNIQUE INDEX "VideoClip_organizationId_videoId_name_key" ON "VideoClip"("organizationId", "videoId", "name");
CREATE TABLE "new_VideoVersion" (
    "organizationId" TEXT NOT NULL DEFAULT 'legacy',
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
    CONSTRAINT "VideoVersion_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "VideoVersion_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_VideoVersion" ("createdAt", "duration", "fileSize", "format", "height", "id", "label", "mimeType", "originalName", "posterPath", "publicUrl", "storagePath", "version", "videoId", "width") SELECT "createdAt", "duration", "fileSize", "format", "height", "id", "label", "mimeType", "originalName", "posterPath", "publicUrl", "storagePath", "version", "videoId", "width" FROM "VideoVersion";
DROP TABLE "VideoVersion";
ALTER TABLE "new_VideoVersion" RENAME TO "VideoVersion";
CREATE INDEX "VideoVersion_videoId_createdAt_idx" ON "VideoVersion"("videoId", "createdAt");
CREATE INDEX "VideoVersion_organizationId_idx" ON "VideoVersion"("organizationId");
CREATE UNIQUE INDEX "VideoVersion_videoId_version_key" ON "VideoVersion"("videoId", "version");
CREATE UNIQUE INDEX "VideoVersion_organizationId_storagePath_key" ON "VideoVersion"("organizationId", "storagePath");
CREATE UNIQUE INDEX "VideoVersion_organizationId_videoId_version_key" ON "VideoVersion"("organizationId", "videoId", "version");
CREATE TABLE "new_VideoHlsPackage" (
    "organizationId" TEXT NOT NULL DEFAULT 'legacy',
    "id" TEXT NOT NULL PRIMARY KEY,
    "videoId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "masterPath" TEXT NOT NULL,
    "publicUrl" TEXT NOT NULL,
    "variants" JSONB NOT NULL,
    "segmentPaths" JSONB NOT NULL,
    "totalFileSize" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ready',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VideoHlsPackage_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "VideoHlsPackage_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_VideoHlsPackage" ("createdAt", "id", "label", "masterPath", "publicUrl", "segmentPaths", "status", "totalFileSize", "updatedAt", "variants", "videoId") SELECT "createdAt", "id", "label", "masterPath", "publicUrl", "segmentPaths", "status", "totalFileSize", "updatedAt", "variants", "videoId" FROM "VideoHlsPackage";
DROP TABLE "VideoHlsPackage";
ALTER TABLE "new_VideoHlsPackage" RENAME TO "VideoHlsPackage";
CREATE INDEX "VideoHlsPackage_videoId_idx" ON "VideoHlsPackage"("videoId");
CREATE INDEX "VideoHlsPackage_organizationId_idx" ON "VideoHlsPackage"("organizationId");
CREATE UNIQUE INDEX "VideoHlsPackage_videoId_label_key" ON "VideoHlsPackage"("videoId", "label");
CREATE UNIQUE INDEX "VideoHlsPackage_organizationId_masterPath_key" ON "VideoHlsPackage"("organizationId", "masterPath");
CREATE UNIQUE INDEX "VideoHlsPackage_organizationId_videoId_label_key" ON "VideoHlsPackage"("organizationId", "videoId", "label");
CREATE TABLE "new_VideoDashPackage" (
    "organizationId" TEXT NOT NULL DEFAULT 'legacy',
    "id" TEXT NOT NULL PRIMARY KEY,
    "videoId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "manifestPath" TEXT NOT NULL,
    "publicUrl" TEXT NOT NULL,
    "variants" JSONB NOT NULL,
    "filePaths" JSONB NOT NULL,
    "totalFileSize" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ready',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VideoDashPackage_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "VideoDashPackage_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_VideoDashPackage" ("createdAt", "filePaths", "id", "label", "manifestPath", "publicUrl", "status", "totalFileSize", "updatedAt", "variants", "videoId") SELECT "createdAt", "filePaths", "id", "label", "manifestPath", "publicUrl", "status", "totalFileSize", "updatedAt", "variants", "videoId" FROM "VideoDashPackage";
DROP TABLE "VideoDashPackage";
ALTER TABLE "new_VideoDashPackage" RENAME TO "VideoDashPackage";
CREATE INDEX "VideoDashPackage_videoId_idx" ON "VideoDashPackage"("videoId");
CREATE INDEX "VideoDashPackage_organizationId_idx" ON "VideoDashPackage"("organizationId");
CREATE UNIQUE INDEX "VideoDashPackage_videoId_label_key" ON "VideoDashPackage"("videoId", "label");
CREATE UNIQUE INDEX "VideoDashPackage_organizationId_manifestPath_key" ON "VideoDashPackage"("organizationId", "manifestPath");
CREATE UNIQUE INDEX "VideoDashPackage_organizationId_videoId_label_key" ON "VideoDashPackage"("organizationId", "videoId", "label");
CREATE TABLE "new_VideoRendition" (
    "organizationId" TEXT NOT NULL DEFAULT 'legacy',
    "id" TEXT NOT NULL PRIMARY KEY,
    "videoId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "publicUrl" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "bitrateKbps" INTEGER NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ready',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VideoRendition_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "VideoRendition_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_VideoRendition" ("bitrateKbps", "createdAt", "fileSize", "height", "id", "label", "publicUrl", "status", "storagePath", "updatedAt", "videoId", "width") SELECT "bitrateKbps", "createdAt", "fileSize", "height", "id", "label", "publicUrl", "status", "storagePath", "updatedAt", "videoId", "width" FROM "VideoRendition";
DROP TABLE "VideoRendition";
ALTER TABLE "new_VideoRendition" RENAME TO "VideoRendition";
CREATE INDEX "VideoRendition_videoId_idx" ON "VideoRendition"("videoId");
CREATE INDEX "VideoRendition_organizationId_idx" ON "VideoRendition"("organizationId");
CREATE UNIQUE INDEX "VideoRendition_videoId_label_key" ON "VideoRendition"("videoId", "label");
CREATE UNIQUE INDEX "VideoRendition_organizationId_storagePath_key" ON "VideoRendition"("organizationId", "storagePath");
CREATE TABLE "new_WebhookEndpoint" (
    "organizationId" TEXT NOT NULL DEFAULT 'legacy',
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WebhookEndpoint_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_WebhookEndpoint" ("active", "createdAt", "id", "name", "secret", "updatedAt", "url") SELECT "active", "createdAt", "id", "name", "secret", "updatedAt", "url" FROM "WebhookEndpoint";
DROP TABLE "WebhookEndpoint";
ALTER TABLE "new_WebhookEndpoint" RENAME TO "WebhookEndpoint";
CREATE INDEX "WebhookEndpoint_active_idx" ON "WebhookEndpoint"("active");
CREATE INDEX "WebhookEndpoint_organizationId_idx" ON "WebhookEndpoint"("organizationId");
CREATE TABLE "new_WebhookDelivery" (
    "organizationId" TEXT NOT NULL DEFAULT 'legacy',
    "id" TEXT NOT NULL PRIMARY KEY,
    "endpointId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "responseCode" INTEGER,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "nextAttemptAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WebhookDelivery_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WebhookDelivery_endpointId_fkey" FOREIGN KEY ("endpointId") REFERENCES "WebhookEndpoint" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_WebhookDelivery" ("attempts", "createdAt", "deliveredAt", "endpointId", "error", "eventType", "id", "nextAttemptAt", "payload", "responseCode", "status", "updatedAt") SELECT "attempts", "createdAt", "deliveredAt", "endpointId", "error", "eventType", "id", "nextAttemptAt", "payload", "responseCode", "status", "updatedAt" FROM "WebhookDelivery";
DROP TABLE "WebhookDelivery";
ALTER TABLE "new_WebhookDelivery" RENAME TO "WebhookDelivery";
CREATE INDEX "WebhookDelivery_endpointId_createdAt_idx" ON "WebhookDelivery"("endpointId", "createdAt");
CREATE INDEX "WebhookDelivery_status_nextAttemptAt_idx" ON "WebhookDelivery"("status", "nextAttemptAt");
CREATE INDEX "WebhookDelivery_organizationId_idx" ON "WebhookDelivery"("organizationId");
CREATE TABLE "new_UploadPreset" (
    "organizationId" TEXT NOT NULL DEFAULT 'legacy',
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL DEFAULT 'image',
    "folder" TEXT NOT NULL DEFAULT '/',
    "tags" TEXT NOT NULL DEFAULT '',
    "compress" BOOLEAN NOT NULL DEFAULT true,
    "quality" INTEGER NOT NULL DEFAULT 80,
    "maxWidth" INTEGER NOT NULL DEFAULT 2048,
    "removeBg" BOOLEAN NOT NULL DEFAULT false,
    "moderate" BOOLEAN NOT NULL DEFAULT false,
    "renditions" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "unsigned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UploadPreset_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_UploadPreset" ("active", "compress", "createdAt", "folder", "id", "maxWidth", "moderate", "name", "quality", "removeBg", "renditions", "resourceType", "tags", "unsigned", "updatedAt") SELECT "active", "compress", "createdAt", "folder", "id", "maxWidth", "moderate", "name", "quality", "removeBg", "renditions", "resourceType", "tags", "unsigned", "updatedAt" FROM "UploadPreset";
DROP TABLE "UploadPreset";
ALTER TABLE "new_UploadPreset" RENAME TO "UploadPreset";
CREATE INDEX "UploadPreset_organizationId_idx" ON "UploadPreset"("organizationId");
CREATE UNIQUE INDEX "UploadPreset_organizationId_name_key" ON "UploadPreset"("organizationId", "name");
CREATE TABLE "new_NamedTransformation" (
    "organizationId" TEXT NOT NULL DEFAULT 'legacy',
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "params" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "NamedTransformation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_NamedTransformation" ("active", "createdAt", "id", "name", "params", "updatedAt") SELECT "active", "createdAt", "id", "name", "params", "updatedAt" FROM "NamedTransformation";
DROP TABLE "NamedTransformation";
ALTER TABLE "new_NamedTransformation" RENAME TO "NamedTransformation";
CREATE INDEX "NamedTransformation_organizationId_idx" ON "NamedTransformation"("organizationId");
CREATE UNIQUE INDEX "NamedTransformation_organizationId_name_key" ON "NamedTransformation"("organizationId", "name");
CREATE TABLE "new_Collection" (
    "organizationId" TEXT NOT NULL DEFAULT 'legacy',
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Collection_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Collection" ("createdAt", "description", "id", "name", "updatedAt") SELECT "createdAt", "description", "id", "name", "updatedAt" FROM "Collection";
DROP TABLE "Collection";
ALTER TABLE "new_Collection" RENAME TO "Collection";
CREATE INDEX "Collection_organizationId_idx" ON "Collection"("organizationId");
CREATE UNIQUE INDEX "Collection_name_key" ON "Collection"("name");
CREATE UNIQUE INDEX "Collection_organizationId_name_key" ON "Collection"("organizationId", "name");
CREATE TABLE "new_CollectionItem" (
    "organizationId" TEXT NOT NULL DEFAULT 'legacy',
    "id" TEXT NOT NULL PRIMARY KEY,
    "collectionId" TEXT NOT NULL,
    "imageId" TEXT,
    "videoId" TEXT,
    CONSTRAINT "CollectionItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CollectionItem_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CollectionItem_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "Image" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CollectionItem_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CollectionItem" ("collectionId", "id", "imageId", "videoId") SELECT "collectionId", "id", "imageId", "videoId" FROM "CollectionItem";
DROP TABLE "CollectionItem";
ALTER TABLE "new_CollectionItem" RENAME TO "CollectionItem";
CREATE INDEX "CollectionItem_collectionId_idx" ON "CollectionItem"("collectionId");
CREATE INDEX "CollectionItem_organizationId_idx" ON "CollectionItem"("organizationId");
CREATE TABLE "new_DeliveryEvent" (
    "organizationId" TEXT NOT NULL DEFAULT 'legacy',
    "id" TEXT NOT NULL PRIMARY KEY,
    "imageId" TEXT,
    "videoId" TEXT,
    "rendition" TEXT,
    "kind" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL DEFAULT 0,
    "referer" TEXT,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DeliveryEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DeliveryEvent_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "Image" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "DeliveryEvent_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_DeliveryEvent" ("bytes", "createdAt", "id", "imageId", "kind", "referer", "rendition", "userAgent", "videoId") SELECT "bytes", "createdAt", "id", "imageId", "kind", "referer", "rendition", "userAgent", "videoId" FROM "DeliveryEvent";
DROP TABLE "DeliveryEvent";
ALTER TABLE "new_DeliveryEvent" RENAME TO "DeliveryEvent";
CREATE INDEX "DeliveryEvent_createdAt_idx" ON "DeliveryEvent"("createdAt");
CREATE INDEX "DeliveryEvent_imageId_createdAt_idx" ON "DeliveryEvent"("imageId", "createdAt");
CREATE INDEX "DeliveryEvent_videoId_createdAt_idx" ON "DeliveryEvent"("videoId", "createdAt");
CREATE INDEX "DeliveryEvent_organizationId_idx" ON "DeliveryEvent"("organizationId");
CREATE TABLE "new_MetadataField" (
    "organizationId" TEXT NOT NULL DEFAULT 'legacy',
    "id" TEXT NOT NULL PRIMARY KEY,
    "externalId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "allowedValues" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MetadataField_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_MetadataField" ("active", "allowedValues", "createdAt", "externalId", "id", "label", "required", "type", "updatedAt") SELECT "active", "allowedValues", "createdAt", "externalId", "id", "label", "required", "type", "updatedAt" FROM "MetadataField";
DROP TABLE "MetadataField";
ALTER TABLE "new_MetadataField" RENAME TO "MetadataField";
CREATE INDEX "MetadataField_organizationId_idx" ON "MetadataField"("organizationId");
CREATE UNIQUE INDEX "MetadataField_organizationId_externalId_key" ON "MetadataField"("organizationId", "externalId");
CREATE TABLE "new_StructuredMetadata" (
    "organizationId" TEXT NOT NULL DEFAULT 'legacy',
    "id" TEXT NOT NULL PRIMARY KEY,
    "fieldId" TEXT NOT NULL,
    "value" TEXT NOT NULL DEFAULT '',
    "imageId" TEXT,
    "videoId" TEXT,
    CONSTRAINT "StructuredMetadata_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StructuredMetadata_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "MetadataField" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StructuredMetadata_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "Image" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StructuredMetadata_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_StructuredMetadata" ("fieldId", "id", "imageId", "value", "videoId") SELECT "fieldId", "id", "imageId", "value", "videoId" FROM "StructuredMetadata";
DROP TABLE "StructuredMetadata";
ALTER TABLE "new_StructuredMetadata" RENAME TO "StructuredMetadata";
CREATE INDEX "StructuredMetadata_imageId_idx" ON "StructuredMetadata"("imageId");
CREATE INDEX "StructuredMetadata_videoId_idx" ON "StructuredMetadata"("videoId");
CREATE INDEX "StructuredMetadata_organizationId_idx" ON "StructuredMetadata"("organizationId");
CREATE UNIQUE INDEX "StructuredMetadata_fieldId_imageId_key" ON "StructuredMetadata"("fieldId", "imageId");
CREATE UNIQUE INDEX "StructuredMetadata_fieldId_videoId_key" ON "StructuredMetadata"("fieldId", "videoId");
CREATE UNIQUE INDEX "StructuredMetadata_organizationId_fieldId_imageId_key" ON "StructuredMetadata"("organizationId", "fieldId", "imageId");
CREATE UNIQUE INDEX "StructuredMetadata_organizationId_fieldId_videoId_key" ON "StructuredMetadata"("organizationId", "fieldId", "videoId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

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

