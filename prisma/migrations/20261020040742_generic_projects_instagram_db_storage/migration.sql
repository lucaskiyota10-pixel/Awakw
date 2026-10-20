-- AlterTable
ALTER TABLE "FileAsset" ADD COLUMN     "data" BYTEA;

-- AlterTable
ALTER TABLE "InstagramProfile" ADD COLUMN     "avatarFit" TEXT NOT NULL DEFAULT 'cover',
ADD COLUMN     "followersMode" TEXT NOT NULL DEFAULT 'manual',
ADD COLUMN     "followersMonths" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "initialBudget" DOUBLE PRECISION NOT NULL DEFAULT 10000,
ADD COLUMN     "ticketValue" DOUBLE PRECISION NOT NULL DEFAULT 350;

-- AlterTable
ALTER TABLE "Publication" ADD COLUMN     "adCta" TEXT,
ADD COLUMN     "highlightId" TEXT,
ADD COLUMN     "isAd" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "location" TEXT;
