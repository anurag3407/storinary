-- CreateTable
CREATE TABLE "NamedTransformation" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "params" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NamedTransformation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NamedTransformation_name_key" ON "NamedTransformation"("name");
