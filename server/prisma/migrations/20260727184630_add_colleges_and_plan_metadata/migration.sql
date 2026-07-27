-- AlterTable
ALTER TABLE "Major" ADD COLUMN     "bio" TEXT,
ADD COLUMN     "bioAr" TEXT,
ADD COLUMN     "collegeId" TEXT,
ADD COLUMN     "icon" TEXT,
ADD COLUMN     "subtitle" TEXT,
ADD COLUMN     "subtitleAr" TEXT,
ALTER COLUMN "degreeHours" DROP NOT NULL;

-- AlterTable
ALTER TABLE "University" ADD COLUMN     "icon" TEXT,
ADD COLUMN     "shortName" TEXT;

-- CreateTable
CREATE TABLE "College" (
    "id" TEXT NOT NULL,
    "universityId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "icon" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "College_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "College_universityId_idx" ON "College"("universityId");

-- CreateIndex
CREATE UNIQUE INDEX "College_universityId_slug_key" ON "College"("universityId", "slug");

-- AddForeignKey
ALTER TABLE "College" ADD CONSTRAINT "College_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "University"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Major" ADD CONSTRAINT "Major_collegeId_fkey" FOREIGN KEY ("collegeId") REFERENCES "College"("id") ON DELETE SET NULL ON UPDATE CASCADE;
