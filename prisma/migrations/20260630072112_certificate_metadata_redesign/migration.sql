/*
  Warnings:

  - The primary key for the `certificates` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `certificate_type` on the `certificates` table. All the data in the column will be lost.
  - You are about to drop the column `document_hash` on the `certificates` table. All the data in the column will be lost.
  - You are about to drop the column `expired_at` on the `certificates` table. All the data in the column will be lost.
  - You are about to drop the column `file_size` on the `certificates` table. All the data in the column will be lost.
  - You are about to drop the column `issued_at` on the `certificates` table. All the data in the column will be lost.
  - You are about to drop the column `issuer_id` on the `certificates` table. All the data in the column will be lost.
  - You are about to drop the column `mime_type` on the `certificates` table. All the data in the column will be lost.
  - You are about to drop the column `previous_certificate_id` on the `certificates` table. All the data in the column will be lost.
  - You are about to drop the column `replacement_certificate_id` on the `certificates` table. All the data in the column will be lost.
  - You are about to drop the column `student_id_hash` on the `certificates` table. All the data in the column will be lost.
  - You are about to drop the column `title` on the `certificates` table. All the data in the column will be lost.
  - Added the required column `dean_name` to the `certificates` table without a default value. This is not possible if the table is not empty.
  - Added the required column `degree_abbreviation` to the `certificates` table without a default value. This is not possible if the table is not empty.
  - Added the required column `degree_level` to the `certificates` table without a default value. This is not possible if the table is not empty.
  - Added the required column `degree_name` to the `certificates` table without a default value. This is not possible if the table is not empty.
  - Added the required column `faculty` to the `certificates` table without a default value. This is not possible if the table is not empty.
  - Added the required column `graduation_date` to the `certificates` table without a default value. This is not possible if the table is not empty.
  - Added the required column `issue_date` to the `certificates` table without a default value. This is not possible if the table is not empty.
  - Added the required column `issuer` to the `certificates` table without a default value. This is not possible if the table is not empty.
  - Added the required column `program_accreditation_agency` to the `certificates` table without a default value. This is not possible if the table is not empty.
  - Added the required column `program_accreditation_number` to the `certificates` table without a default value. This is not possible if the table is not empty.
  - Added the required column `rector_name` to the `certificates` table without a default value. This is not possible if the table is not empty.
  - Added the required column `student_id` to the `certificates` table without a default value. This is not possible if the table is not empty.
  - Added the required column `student_name` to the `certificates` table without a default value. This is not possible if the table is not empty.
  - Added the required column `study_program` to the `certificates` table without a default value. This is not possible if the table is not empty.
  - Added the required column `university_accreditation_number` to the `certificates` table without a default value. This is not possible if the table is not empty.
  - Added the required column `university_name` to the `certificates` table without a default value. This is not possible if the table is not empty.
  - Made the column `file_name` on table `certificates` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "certificates" DROP CONSTRAINT "certificates_issuer_id_fkey";

-- DropIndex
DROP INDEX "certificates_issuer_id_idx";

-- AlterTable
ALTER TABLE "certificates" DROP CONSTRAINT "certificates_pkey",
DROP COLUMN "certificate_type",
DROP COLUMN "document_hash",
DROP COLUMN "expired_at",
DROP COLUMN "file_size",
DROP COLUMN "issued_at",
DROP COLUMN "issuer_id",
DROP COLUMN "mime_type",
DROP COLUMN "previous_certificate_id",
DROP COLUMN "replacement_certificate_id",
DROP COLUMN "student_id_hash",
DROP COLUMN "title",
ADD COLUMN     "dean_name" TEXT NOT NULL,
ADD COLUMN     "degree_abbreviation" TEXT NOT NULL,
ADD COLUMN     "degree_level" TEXT NOT NULL,
ADD COLUMN     "degree_name" TEXT NOT NULL,
ADD COLUMN     "faculty" TEXT NOT NULL,
ADD COLUMN     "graduation_date" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "issue_date" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "issuer" TEXT NOT NULL,
ADD COLUMN     "program_accreditation_agency" TEXT NOT NULL,
ADD COLUMN     "program_accreditation_number" TEXT NOT NULL,
ADD COLUMN     "rector_name" TEXT NOT NULL,
ADD COLUMN     "student_id" TEXT NOT NULL,
ADD COLUMN     "student_name" TEXT NOT NULL,
ADD COLUMN     "study_program" TEXT NOT NULL,
ADD COLUMN     "university_accreditation_number" TEXT NOT NULL,
ADD COLUMN     "university_name" TEXT NOT NULL,
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "file_name" SET NOT NULL,
ALTER COLUMN "ledger_tx_id" DROP NOT NULL,
ADD CONSTRAINT "certificates_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "certificates_id_seq";

-- CreateIndex
CREATE INDEX "certificates_issuer_idx" ON "certificates"("issuer");
