-- db/migrations/0038_create_storage_table.sql
--
-- Purpose:
--   Formally create public.storage as a migration-managed table.
--   This table was previously auto-created at runtime by StorageService, which
--   fails in restricted-privilege environments (e.g. Vercel + Neon where the
--   app DB role cannot CREATE TABLE in the public schema).
--
-- The migration is idempotent:
--   - CREATE TABLE IF NOT EXISTS
--   - ALTER TABLE ... ENABLE/FORCE ROW LEVEL SECURITY (safe to re-run)
--   - DROP POLICY IF EXISTS + CREATE POLICY (safe to re-run)
--   - GRANT ... IF EXISTS wrappers for optional roles (role_admin may not exist in all envs)
--
-- After applying this migration, StorageService.ensureInitialized() will find
-- the table via to_regclass() and skip the CREATE TABLE attempt, allowing
-- storage to work even when the connecting role has no DDL privileges.
--
-- Safe to re-run: all DDL is wrapped in IF NOT EXISTS / IF EXISTS / REPLACE.

BEGIN;

-- ── 1. Table ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.storage (
  id         INTEGER      PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id    TEXT         NOT NULL,
  "key"      TEXT         NOT NULL,
  value      JSONB,
  created_at TIMESTAMP    NOT NULL DEFAULT now(),
  updated_at TIMESTAMP    NOT NULL DEFAULT now(),
  UNIQUE (user_id, "key")
);

-- ── 2. Indexes ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_storage_user_id
  ON public.storage (user_id);

CREATE INDEX IF NOT EXISTS idx_storage_updated_at
  ON public.storage (updated_at DESC);

-- ── 3. Row-Level Security ─────────────────────────────────────────────────────
--
-- Policies mirror those created by migrations 0016 and 0018 so that re-running
-- this migration on an existing database is safe (DROP IF EXISTS guards).

ALTER TABLE public.storage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storage FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS storage_rls_policy ON public.storage;

CREATE POLICY storage_rls_policy
ON public.storage
FOR ALL
USING (
  app.can_access_owner(user_id)
)
WITH CHECK (
  app.can_write_owner(user_id)
  AND (
    app.current_user_role() = 'role_admin'
    OR user_id = app.current_user_id()
  )
);

-- ── 4. Grants ─────────────────────────────────────────────────────────────────
--
-- Grant DML to role_admin (the privileged application role used by
-- DATABASE_URL_ROLE_ADMIN) if it exists.  Wrapped in a DO block so the
-- migration does not fail on databases where role_admin has not been created.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'role_admin') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.storage TO role_admin;
    -- Sequence grant for the GENERATED ALWAYS AS IDENTITY column.
    -- Migration 0023 already covers all sequences via
    -- "GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO role_admin"
    -- but this explicit grant makes the dependency explicit if 0023 has not run.
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO role_admin;
  END IF;
END
$$;

COMMIT;
