/*
  Warnings:

  - You are about to drop the column `student_id_hash` on the `certificates` table. All the data in the column will be lost.
  - You are about to drop the column `title` on the `certificates` table. All the data in the column will be lost.
  - Added the required column `degree_title` to the `certificates` table without a default value. This is not possible if the table is not empty.
  - Added the required column `education_level` to the `certificates` table without a default value. This is not possible if the table is not empty.
  - Added the required column `student_id` to the `certificates` table without a default value. This is not possible if the table is not empty.
  - Added the required column `student_name` to the `certificates` table without a default value. This is not possible if the table is not empty.
  - Added the required column `study_program` to the `certificates` table without a default value. This is not possible if the table is not empty.
  - Added the required column `university_name` to the `certificates` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "certificates" DROP COLUMN "student_id_hash",
DROP COLUMN "title",
ADD COLUMN     "degree_title" TEXT NOT NULL,
ADD COLUMN     "education_level" TEXT NOT NULL,
ADD COLUMN     "graduation_date" TIMESTAMP(3),
ADD COLUMN     "student_id" TEXT NOT NULL,
ADD COLUMN     "student_name" TEXT NOT NULL,
ADD COLUMN     "study_program" TEXT NOT NULL,
ADD COLUMN     "university_name" TEXT NOT NULL;
