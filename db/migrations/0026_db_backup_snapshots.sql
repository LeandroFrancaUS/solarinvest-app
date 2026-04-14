-- db/migrations/0026_db_backup_snapshots.sql
--
-- Creates the db_backup_snapshots table used by the database backup/restore
-- feature to keep an immutable audit trail of every export and import action.
--
-- Without this migration the table was created on-demand at runtime via
-- CREATE TABLE IF NOT EXISTS, which requires the connected role to hold the
-- CREATE privilege on the public schema.  That privilege is typically not
-- granted to the application role in production Neon projects, causing an
-- unhandled error (and HTTP 500) on the first backup or restore call.
--
-- Safe to re-run (all statements are idempotent via IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS public.db_backup_snapshots (
  id               BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_user_id    TEXT        NOT NULL,
  actor_email      TEXT,
  destination      TEXT        NOT NULL,   -- 'local' | 'cloud' | 'platform' | 'import'
  checksum_sha256  TEXT        NOT NULL,
  backup_payload   JSONB       NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_db_backup_snapshots_actor_user_id
  ON public.db_backup_snapshots (actor_user_id);

CREATE INDEX IF NOT EXISTS idx_db_backup_snapshots_created_at
  ON public.db_backup_snapshots (created_at DESC);
