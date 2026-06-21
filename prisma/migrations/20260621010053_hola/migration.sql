-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'analyst',
    "organization" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Check" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subjectName" TEXT NOT NULL,
    "subjectCurp" TEXT,
    "subjectRfc" TEXT,
    "subjectEmail" TEXT,
    "subjectPhone" TEXT,
    "subjectUsername" TEXT,
    "subjectAddress" TEXT,
    "includeGovernment" BOOLEAN NOT NULL DEFAULT true,
    "includeSanctions" BOOLEAN NOT NULL DEFAULT true,
    "includeDigital" BOOLEAN NOT NULL DEFAULT true,
    "includeRelationship" BOOLEAN NOT NULL DEFAULT true,
    "includeAiReport" BOOLEAN NOT NULL DEFAULT true,
    "curpValidation" TEXT,
    "rfcValidation" TEXT,
    "government" TEXT,
    "sanctions" TEXT,
    "digitalIdentity" TEXT,
    "digitalFootprint" TEXT,
    "relationshipGraph" TEXT,
    "trustScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "riskScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "identityConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "riskLevel" TEXT NOT NULL DEFAULT 'BAJO',
    "recommendation" TEXT NOT NULL DEFAULT 'APPROVE',
    "flags" TEXT,
    "breakdown" TEXT,
    "aiReport" TEXT,
    "sourcesConsulted" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Check_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- AddForeignKey
ALTER TABLE "Check" ADD CONSTRAINT "Check_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
