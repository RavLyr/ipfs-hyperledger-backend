/*
  Warnings:

  - You are about to drop the column `document_hash` on the `certificates` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "certificates" DROP COLUMN "document_hash";
