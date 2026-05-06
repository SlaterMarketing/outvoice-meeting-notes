-- Fixes HTTP 500 on GET /extension/connect after Chrome "Sign in with browser".
-- Run once in Neon SQL Editor (or use: cd web && npm run db:push with production DATABASE_URL).

CREATE TABLE IF NOT EXISTS "extension_chrome_auth_codes" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "code" text NOT NULL UNIQUE,
  "expires_at" timestamptz NOT NULL,
  "consumed_at" timestamptz
);

DO $$
BEGIN
  ALTER TABLE "extension_chrome_auth_codes"
    ADD CONSTRAINT "extension_chrome_auth_codes_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users" ("id") ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
