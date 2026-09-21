-- Durable local sessions and browser-bound OAuth transactions.
CREATE TABLE "auth_sessions" (
    "id" VARCHAR(128) NOT NULL,
    "user_id" UUID NOT NULL,
    "csrf_token" VARCHAR(128) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMPTZ(3) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "absolute_expires_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "auth_sessions_user_id_idx" ON "auth_sessions"("user_id");
CREATE INDEX "auth_sessions_expires_at_idx" ON "auth_sessions"("expires_at");

ALTER TABLE "auth_sessions"
    ADD CONSTRAINT "auth_sessions_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "auth_oauth_transactions" (
    "state" VARCHAR(128) NOT NULL,
    "browser_binding" VARCHAR(128) NOT NULL,
    "nonce" VARCHAR(128) NOT NULL,
    "code_verifier" VARCHAR(128) NOT NULL,
    "return_to" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "auth_oauth_transactions_pkey" PRIMARY KEY ("state")
);

CREATE INDEX "auth_oauth_transactions_expires_at_idx"
    ON "auth_oauth_transactions"("expires_at");
