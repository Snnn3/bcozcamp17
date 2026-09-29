CREATE TABLE "supabase_auth_identity_mappings" (
  "supabase_user_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "supabase_auth_identity_mappings_pkey" PRIMARY KEY ("supabase_user_id"),
  CONSTRAINT "supabase_auth_identity_mappings_user_id_key" UNIQUE ("user_id"),
  CONSTRAINT "supabase_auth_identity_mappings_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "login_rate_limit_buckets" (
  "key" VARCHAR(64) NOT NULL,
  "window_started_at" TIMESTAMPTZ(3) NOT NULL,
  "request_count" INTEGER NOT NULL,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "login_rate_limit_buckets_pkey" PRIMARY KEY ("key"),
  CONSTRAINT "login_rate_limit_buckets_request_count_check" CHECK ("request_count" > 0)
);

ALTER TABLE "supabase_auth_identity_mappings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "login_rate_limit_buckets" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON TABLE "supabase_auth_identity_mappings" FROM anon';
    EXECUTE 'REVOKE ALL ON TABLE "login_rate_limit_buckets" FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON TABLE "supabase_auth_identity_mappings" FROM authenticated';
    EXECUTE 'REVOKE ALL ON TABLE "login_rate_limit_buckets" FROM authenticated';
  END IF;
END $$;
