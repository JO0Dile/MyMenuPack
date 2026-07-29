-- AlterTable
ALTER TABLE "Major" ADD COLUMN     "freeElectiveSuggestions" JSONB;

-- AlterTable
ALTER TABLE "University" ADD COLUMN     "electivePool" JSONB;
