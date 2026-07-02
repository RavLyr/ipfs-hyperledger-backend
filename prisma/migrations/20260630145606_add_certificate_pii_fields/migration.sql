-- Preserve existing certificate data while moving from the old minimal schema
-- to the PII fields expected by the current Prisma model.
ALTER TABLE "certificates" RENAME COLUMN "title" TO "degree_title";
ALTER TABLE "certificates" RENAME COLUMN "student_id_hash" TO "student_id";

ALTER TABLE "certificates"
ADD COLUMN "education_level" TEXT NOT NULL DEFAULT '',
ADD COLUMN "graduation_date" TIMESTAMP(3),
ADD COLUMN "student_name" TEXT NOT NULL DEFAULT '',
ADD COLUMN "study_program" TEXT NOT NULL DEFAULT '',
ADD COLUMN "university_name" TEXT NOT NULL DEFAULT '';

ALTER TABLE "certificates"
ALTER COLUMN "education_level" DROP DEFAULT,
ALTER COLUMN "student_name" DROP DEFAULT,
ALTER COLUMN "study_program" DROP DEFAULT,
ALTER COLUMN "university_name" DROP DEFAULT;
