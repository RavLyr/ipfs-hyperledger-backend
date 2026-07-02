ALTER TABLE "issuers"
ADD COLUMN "username" TEXT,
ADD COLUMN "email" TEXT,
ADD COLUMN "password_hash" TEXT,
ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "last_login_at" TIMESTAMP(3);

UPDATE "issuers"
SET
  "username" = COALESCE(NULLIF(LOWER(REGEXP_REPLACE("issuer_id", '[^a-zA-Z0-9]+', '', 'g')), ''), 'issuer_' || "id"::text),
  "email" = COALESCE(NULLIF(LOWER(REGEXP_REPLACE("issuer_id", '[^a-zA-Z0-9]+', '', 'g')), ''), 'issuer' || "id"::text) || '@example.com',
  "password_hash" = '$2b$10$7EqJtq98hPqEX7fNZaFWoOHiJqP3rYpN96CB2A6qsYqS2Q6D6nM4K'
WHERE "username" IS NULL OR "email" IS NULL OR "password_hash" IS NULL;

ALTER TABLE "issuers"
ALTER COLUMN "username" SET NOT NULL,
ALTER COLUMN "email" SET NOT NULL,
ALTER COLUMN "password_hash" SET NOT NULL;

CREATE UNIQUE INDEX "issuers_username_key" ON "issuers"("username");
CREATE UNIQUE INDEX "issuers_email_key" ON "issuers"("email");

ALTER TABLE "certificates" RENAME COLUMN "university_name" TO "organization_name";
