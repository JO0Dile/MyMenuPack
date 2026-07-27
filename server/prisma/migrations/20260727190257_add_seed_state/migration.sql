-- CreateTable
CREATE TABLE "SeedState" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "fingerprint" TEXT NOT NULL,
    "seededAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeedState_pkey" PRIMARY KEY ("id")
);
