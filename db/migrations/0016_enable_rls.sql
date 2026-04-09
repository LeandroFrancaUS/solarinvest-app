-- db/migrations/0016_enable_rls.sql
--
-- Enable Row Level Security (RLS) on all user-owned data tables.
--
-- Design:
--   Policies use the session setting app.current_user_id to identify the
--   requesting user.  When that setting is absent or empty the policy
--   bypasses isolation, preserving full backwards compatibility for admin /
--   service queries that do not set a user context.  When a non-empty value
--   IS present, the policy restricts rows to those owned by that user.
--
--   The application layer sets this context via createUserScopedSql() (see
--   server/database/withRLSContext.js) before data queries that belong to a
--   specific user, providing defense-in-depth on top of the existing
--   WHERE-clause enforcement in repository functions.
--
-- FORCE ROW LEVEL SECURITY ensures policies are evaluated even when the
-- connection role is the table owner.  PostgreSQL superusers (SUPERUSER
-- attribute) still bypass RLS regardless of this flag.
--
-- Safe to re-run: every statement uses DROP IF EXISTS / IF NOT EXISTS.

-- ── storage ───────────────────────────────────────────────────────────────────

ALTER TABLE storage ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS storage_rls_policy ON storage;
CREATE POLICY storage_rls_policy ON storage
  USING (
    nullif(current_setting('app.current_user_id', true), '') IS NULL
    OR user_id = current_setting('app.current_user_id', true)
  )
  WITH CHECK (
    nullif(current_setting('app.current_user_id', true), '') IS NULL
    OR user_id = current_setting('app.current_user_id', true)
  );

-- ── storage_events ────────────────────────────────────────────────────────────

ALTER TABLE storage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage_events FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS storage_events_rls_policy ON storage_events;
CREATE POLICY storage_events_rls_policy ON storage_events
  USING (
    nullif(current_setting('app.current_user_id', true), '') IS NULL
    OR user_id = current_setting('app.current_user_id', true)
  )
  WITH CHECK (
    nullif(current_setting('app.current_user_id', true), '') IS NULL
    OR user_id = current_setting('app.current_user_id', true)
  );

-- ── clients ───────────────────────────────────────────────────────────────────

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS clients_rls_policy ON clients;
CREATE POLICY clients_rls_policy ON clients
  USING (
    nullif(current_setting('app.current_user_id', true), '') IS NULL
    OR owner_user_id = current_setting('app.current_user_id', true)
  )
  WITH CHECK (
    nullif(current_setting('app.current_user_id', true), '') IS NULL
    OR owner_user_id = current_setting('app.current_user_id', true)
  );

-- ── proposals ─────────────────────────────────────────────────────────────────

ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposals FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS proposals_rls_policy ON proposals;
CREATE POLICY proposals_rls_policy ON proposals
  USING (
    nullif(current_setting('app.current_user_id', true), '') IS NULL
    OR owner_user_id = current_setting('app.current_user_id', true)
  )
  WITH CHECK (
    nullif(current_setting('app.current_user_id', true), '') IS NULL
    OR owner_user_id = current_setting('app.current_user_id', true)
  );
