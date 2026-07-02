/*
  Warnings:

  - You are about to drop the column `last_login_at` on the `issuers` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "issuers" DROP COLUMN "last_login_at",
ADD COLUMN     "last_login" TIMESTAMP(3),
ALTER COLUMN "username" DROP NOT NULL,
ALTER COLUMN "email" DROP NOT NULL,
ALTER COLUMN "password_hash" DROP NOT NULL;
