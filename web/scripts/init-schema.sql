-- Outvoice schema — run in Neon SQL Editor if tables are missing.
-- Safe to run on empty DB. If you already have partial tables, use: npx drizzle-kit push
CREATE TABLE IF NOT EXISTS "users" (
  "id" text PRIMARY KEY NOT NULL,
  "email" varchar(255) NOT NULL,
  "ttsai_api_key" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "users_email_unique" UNIQUE ("email")
);

CREATE TABLE IF NOT EXISTS "login_codes" (
  "id" text PRIMARY KEY NOT NULL,
  "email" varchar(255) NOT NULL,
  "code_hash" text NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "consumed_at" timestamptz
);

CREATE TABLE IF NOT EXISTS "extension_pairing_codes" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "code_hash" text NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "used_at" timestamptz
);

CREATE TABLE IF NOT EXISTS "extension_tokens" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "token_hash" text NOT NULL,
  "label" varchar(128),
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "last_used_at" timestamptz
);

CREATE TABLE IF NOT EXISTS "meetings" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "title" varchar(512),
  "platform" varchar(32) DEFAULT 'unknown' NOT NULL,
  "status" varchar(32) DEFAULT 'recording' NOT NULL,
  "audio_mime" varchar(128),
  "transcript" text,
  "summary_json" text,
  "processing_error" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

DO $$
BEGIN
  ALTER TABLE "extension_pairing_codes"
    ADD CONSTRAINT "extension_pairing_codes_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users" ("id") ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "extension_tokens"
    ADD CONSTRAINT "extension_tokens_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users" ("id") ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "meetings"
    ADD CONSTRAINT "meetings_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users" ("id") ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Migrate older installs that still have openai_api_key instead of ttsai_api_key
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'openai_api_key'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'ttsai_api_key'
  ) THEN
    ALTER TABLE "users" RENAME COLUMN "openai_api_key" TO "ttsai_api_key";
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'ttsai_api_key'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'openai_api_key'
  ) THEN
    ALTER TABLE "users" ADD COLUMN "ttsai_api_key" text;
  END IF;
END $$;
