-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "CertificateStatus" AS ENUM ('VALID', 'REVOKED');

-- CreateEnum
CREATE TYPE "IssuerStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "FabricTransactionStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "issuers" (
    "id" SERIAL NOT NULL,
    "issuer_id" TEXT NOT NULL,
    "organization_name" TEXT NOT NULL,
    "department_name" TEXT NOT NULL,
    "msp_id" TEXT NOT NULL,
    "status" "IssuerStatus" NOT NULL DEFAULT 'ACTIVE',
    "ledger_tx_id" TEXT,
    "registered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "issuers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certificates" (
    "id" SERIAL NOT NULL,
    "certificate_id" TEXT NOT NULL,
    "certificate_number" TEXT NOT NULL,
    "issuer_id" TEXT NOT NULL,
    "certificate_type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "student_id_hash" TEXT NOT NULL,
    "document_hash" TEXT NOT NULL,
    "ipfs_cid" TEXT NOT NULL,
    "file_name" TEXT,
    "mime_type" TEXT,
    "file_size" BIGINT,
    "ledger_tx_id" TEXT NOT NULL,
    "status" "CertificateStatus" NOT NULL DEFAULT 'VALID',
    "issued_at" TIMESTAMP(3) NOT NULL,
    "expired_at" TIMESTAMP(3),
    "previous_certificate_id" TEXT,
    "replacement_certificate_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "certificates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "revocations" (
    "id" SERIAL NOT NULL,
    "revocation_id" TEXT NOT NULL,
    "certificate_id" TEXT NOT NULL,
    "issuer_id" TEXT NOT NULL,
    "reason_hash" TEXT NOT NULL,
    "ledger_tx_id" TEXT NOT NULL,
    "revoked_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "revocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fabric_transactions" (
    "id" SERIAL NOT NULL,
    "tx_id" TEXT,
    "channel_name" TEXT NOT NULL,
    "chaincode_name" TEXT NOT NULL,
    "function_name" TEXT NOT NULL,
    "status" "FabricTransactionStatus" NOT NULL DEFAULT 'PENDING',
    "certificate_id" TEXT,
    "issuer_id" TEXT,
    "payload_json" JSONB,
    "result_json" JSONB,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fabric_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "issuers_issuer_id_key" ON "issuers"("issuer_id");

-- CreateIndex
CREATE UNIQUE INDEX "certificates_certificate_id_key" ON "certificates"("certificate_id");

-- CreateIndex
CREATE UNIQUE INDEX "certificates_certificate_number_key" ON "certificates"("certificate_number");

-- CreateIndex
CREATE INDEX "certificates_issuer_id_idx" ON "certificates"("issuer_id");

-- CreateIndex
CREATE INDEX "certificates_status_idx" ON "certificates"("status");

-- CreateIndex
CREATE INDEX "certificates_created_at_idx" ON "certificates"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "revocations_revocation_id_key" ON "revocations"("revocation_id");

-- CreateIndex
CREATE UNIQUE INDEX "revocations_certificate_id_key" ON "revocations"("certificate_id");

-- CreateIndex
CREATE INDEX "revocations_issuer_id_idx" ON "revocations"("issuer_id");

-- CreateIndex
CREATE UNIQUE INDEX "fabric_transactions_tx_id_key" ON "fabric_transactions"("tx_id");

-- CreateIndex
CREATE INDEX "fabric_transactions_certificate_id_idx" ON "fabric_transactions"("certificate_id");

-- CreateIndex
CREATE INDEX "fabric_transactions_issuer_id_idx" ON "fabric_transactions"("issuer_id");

-- CreateIndex
CREATE INDEX "fabric_transactions_status_idx" ON "fabric_transactions"("status");

-- CreateIndex
CREATE INDEX "fabric_transactions_created_at_idx" ON "fabric_transactions"("created_at");

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_issuer_id_fkey" FOREIGN KEY ("issuer_id") REFERENCES "issuers"("issuer_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revocations" ADD CONSTRAINT "revocations_certificate_id_fkey" FOREIGN KEY ("certificate_id") REFERENCES "certificates"("certificate_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revocations" ADD CONSTRAINT "revocations_issuer_id_fkey" FOREIGN KEY ("issuer_id") REFERENCES "issuers"("issuer_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fabric_transactions" ADD CONSTRAINT "fabric_transactions_certificate_id_fkey" FOREIGN KEY ("certificate_id") REFERENCES "certificates"("certificate_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fabric_transactions" ADD CONSTRAINT "fabric_transactions_issuer_id_fkey" FOREIGN KEY ("issuer_id") REFERENCES "issuers"("issuer_id") ON DELETE SET NULL ON UPDATE CASCADE;

