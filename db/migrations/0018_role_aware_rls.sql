-- db/migrations/0018_role_aware_rls.sql
--
-- Role-aware Row Level Security for clients and proposals tables.
--
-- Goals:
--   1. Create a dedicated `app` schema with helper functions that read the
--      session settings set by the Node application layer.
--   2. Replace the previous "no-context bypass" single-policy model with
--      role-specific USING / WITH CHECK policies for each DML command.
--   3. Fail-closed: when a user role context IS set, the policy is evaluated
--      strictly.  Only when NO context is set (service / admin DB calls) does
--      the policy allow all rows — preserving backward compat for internal
--      queries (migrations, audit log writes, etc.) that use db.sql directly.
--
-- Role hierarchy (highest → lowest privilege):
--   role_admin      > role_financeiro > role_office > role_comercial
--
-- Access rules:
--   role_admin      — read + write everything
--   role_financeiro — read everything, no write (WITH CHECK false)
--   role_office     — read + write own rows AND rows of role_comercial owners
--   role_comercial  — read + write own rows only
--
-- How context is set (Node side):
--   createUserScopedSql(sql, { userId, role }) batches two set_config() calls
--   with is_local=true before every authenticated query, scoped to the
--   current transaction.
--
-- Safe to re-run: uses CREATE SCHEMA IF NOT EXISTS, CREATE OR REPLACE FUNCTION,
--   and DROP POLICY IF EXISTS before each CREATE POLICY.
--
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 0. App schema ─────────────────────────────────────────────────────────────

CREATE SCHEMA IF NOT EXISTS app;

-- Grant usage so the DB role used by the app can call the functions.
-- Adjust 'neondb_owner' if your Neon project uses a different role.
GRANT USAGE ON SCHEMA app TO neondb_owner;

-- ── 1. Session-variable accessor functions ────────────────────────────────────

-- app.current_user_id()
-- Returns the Stack Auth user ID set by the application for this transaction,
-- or NULL when no context has been set (service/admin bypass path).
CREATE OR REPLACE FUNCTION app.current_user_id()
  RETURNS text
  LANGUAGE sql
  STABLE
  PARALLEL SAFE
AS $$
  SELECT nullif(current_setting('app.current_user_id', true), '');
$$;

-- app.current_user_role()
-- Returns the resolved role string set by the application, or NULL.
-- Expected values: 'role_admin' | 'role_financeiro' | 'role_office' | 'role_comercial'
CREATE OR REPLACE FUNCTION app.current_user_role()
  RETURNS text
  LANGUAGE sql
  STABLE
  PARALLEL SAFE
AS $$
  SELECT nullif(current_setting('app.current_user_role', true), '');
$$;

-- ── 2. Row-access decision functions ─────────────────────────────────────────

-- app.can_access_owner(owner_user_id text) → boolean
--
-- READ / SELECT gate.  Determines whether the current session actor may see
-- rows owned by `owner_user_id`.
--
-- No-context bypass: when app.current_user_role() IS NULL the function returns
-- true, allowing internal service queries (db.sql direct) to see all rows.
-- This mirrors the previous policy design and is required for migrations,
-- audit-log writes, and other privileged-path calls that deliberately skip RLS.
CREATE OR REPLACE FUNCTION app.can_access_owner(owner_user_id text)
  RETURNS boolean
  LANGUAGE plpgsql
  STABLE
  PARALLEL SAFE
AS $$
DECLARE
  v_role text;
  v_uid  text;
BEGIN
  v_role := app.current_user_role();
  v_uid  := app.current_user_id();

  -- No role context → service/admin bypass (createUserScopedSql not used).
  IF v_role IS NULL THEN
    RETURN true;
  END IF;

  -- role_admin: unrestricted read access.
  IF v_role = 'role_admin' THEN
    RETURN true;
  END IF;

  -- role_financeiro: read-only access to all rows.
  -- Write is blocked separately by app.can_write_owner().
  IF v_role = 'role_financeiro' THEN
    RETURN true;
  END IF;

  -- role_office: own rows OR rows belonging to role_comercial users.
  IF v_role = 'role_office' THEN
    RETURN (
      owner_user_id = v_uid
      OR EXISTS (
        SELECT 1
        FROM public.app_user_profiles
        WHERE stack_user_id = owner_user_id
          AND primary_role = 'role_comercial'
      )
    );
  END IF;

  -- role_comercial: own rows only.
  IF v_role = 'role_comercial' THEN
    RETURN owner_user_id = v_uid;
  END IF;

  -- Unknown or unrecognized role → fail closed.
  RETURN false;
END;
$$;

-- app.can_write_owner(owner_user_id text) → boolean
--
-- WRITE / INSERT / UPDATE / DELETE gate.  Same hierarchy but role_financeiro
-- is always blocked from mutating data.
CREATE OR REPLACE FUNCTION app.can_write_owner(owner_user_id text)
  RETURNS boolean
  LANGUAGE plpgsql
  STABLE
  PARALLEL SAFE
AS $$
DECLARE
  v_role text;
  v_uid  text;
BEGIN
  v_role := app.current_user_role();
  v_uid  := app.current_user_id();

  -- No role context → service/admin bypass.
  IF v_role IS NULL THEN
    RETURN true;
  END IF;

  -- role_admin: unrestricted write access.
  IF v_role = 'role_admin' THEN
    RETURN true;
  END IF;

  -- role_financeiro: read-only role — all writes blocked.
  IF v_role = 'role_financeiro' THEN
    RETURN false;
  END IF;

  -- role_office: write own rows OR rows belonging to role_comercial users.
  IF v_role = 'role_office' THEN
    RETURN (
      owner_user_id = v_uid
      OR EXISTS (
        SELECT 1
        FROM public.app_user_profiles
        WHERE stack_user_id = owner_user_id
          AND primary_role = 'role_comercial'
      )
    );
  END IF;

  -- role_comercial: own rows only.
  IF v_role = 'role_comercial' THEN
    RETURN owner_user_id = v_uid;
  END IF;

  -- Unknown role → fail closed.
  RETURN false;
END;
$$;

-- Grant execute to the application DB role.
GRANT EXECUTE ON FUNCTION app.current_user_id()             TO neondb_owner;
GRANT EXECUTE ON FUNCTION app.current_user_role()           TO neondb_owner;
GRANT EXECUTE ON FUNCTION app.can_access_owner(text)        TO neondb_owner;
GRANT EXECUTE ON FUNCTION app.can_write_owner(text)         TO neondb_owner;

-- ── 3. clients table: role-aware policies ─────────────────────────────────────
--
-- Replaces the previous single-command "clients_rls_policy" that used a
-- no-context bypass for all operations.  The new design uses separate policies
-- per DML command so that WITH CHECK (write gate) can be enforced independently
-- of USING (read gate) — required to block role_financeiro writes while allowing
-- their reads.
--
-- RLS and FORCE RLS are already enabled (migration 0016). We only need to drop
-- the old catch-all policy and create the new per-command ones.

DROP POLICY IF EXISTS clients_rls_policy   ON clients;
DROP POLICY IF EXISTS clients_rls_read     ON clients;
DROP POLICY IF EXISTS clients_rls_insert   ON clients;
DROP POLICY IF EXISTS clients_rls_update   ON clients;
DROP POLICY IF EXISTS clients_rls_delete   ON clients;

-- SELECT: role_admin and role_financeiro see all; role_office sees own + comercial;
--         role_comercial sees own; no context → all rows (service bypass).
CREATE POLICY clients_rls_read ON clients
  FOR SELECT
  USING (app.can_access_owner(owner_user_id));

-- INSERT: role_financeiro blocked; others constrained by can_write_owner on the
--         new row's owner_user_id.
CREATE POLICY clients_rls_insert ON clients
  FOR INSERT
  WITH CHECK (app.can_write_owner(owner_user_id));

-- UPDATE: must be able to READ the old row (USING) AND write the new state (WITH CHECK).
CREATE POLICY clients_rls_update ON clients
  FOR UPDATE
  USING     (app.can_access_owner(owner_user_id))
  WITH CHECK (app.can_write_owner(owner_user_id));

-- DELETE: must be able to write the row to delete it (same gate as update write).
CREATE POLICY clients_rls_delete ON clients
  FOR DELETE
  USING (app.can_write_owner(owner_user_id));

-- ── 4. proposals table: role-aware policies ───────────────────────────────────
--
-- Same design as clients above.

DROP POLICY IF EXISTS proposals_rls_policy  ON proposals;
DROP POLICY IF EXISTS proposals_rls_read    ON proposals;
DROP POLICY IF EXISTS proposals_rls_insert  ON proposals;
DROP POLICY IF EXISTS proposals_rls_update  ON proposals;
DROP POLICY IF EXISTS proposals_rls_delete  ON proposals;

CREATE POLICY proposals_rls_read ON proposals
  FOR SELECT
  USING (app.can_access_owner(owner_user_id));

CREATE POLICY proposals_rls_insert ON proposals
  FOR INSERT
  WITH CHECK (app.can_write_owner(owner_user_id));

CREATE POLICY proposals_rls_update ON proposals
  FOR UPDATE
  USING     (app.can_access_owner(owner_user_id))
  WITH CHECK (app.can_write_owner(owner_user_id));

CREATE POLICY proposals_rls_delete ON proposals
  FOR DELETE
  USING (app.can_write_owner(owner_user_id));

-- ── 5. Smoke-test assertions (run during migration to validate) ───────────────
--
-- Set a fake user context and call the functions directly to validate logic.
-- These are read-only assertions inside a DO block; they roll back nothing.

DO $$
DECLARE
  v_pass boolean;
BEGIN
  -- Test 1: no context → bypass (true)
  PERFORM set_config('app.current_user_role', '', true);
  PERFORM set_config('app.current_user_id',   '', true);
  v_pass := app.can_access_owner('any-user');
  IF NOT v_pass THEN RAISE EXCEPTION 'Migration assertion failed: no-context should bypass'; END IF;

  -- Test 2: role_admin → always true
  PERFORM set_config('app.current_user_role', 'role_admin', true);
  PERFORM set_config('app.current_user_id',   'admin-uid',  true);
  v_pass := app.can_access_owner('other-user-uid');
  IF NOT v_pass THEN RAISE EXCEPTION 'Migration assertion failed: role_admin should see all'; END IF;

  -- Test 3: role_financeiro read → true, write → false
  PERFORM set_config('app.current_user_role', 'role_financeiro', true);
  PERFORM set_config('app.current_user_id',   'fin-uid',         true);
  v_pass := app.can_access_owner('other-user-uid');
  IF NOT v_pass THEN RAISE EXCEPTION 'Migration assertion failed: role_financeiro should read all'; END IF;
  v_pass := app.can_write_owner('other-user-uid');
  IF v_pass THEN RAISE EXCEPTION 'Migration assertion failed: role_financeiro must not write'; END IF;

  -- Test 4: role_comercial — own row → true, other → false
  PERFORM set_config('app.current_user_role', 'role_comercial', true);
  PERFORM set_config('app.current_user_id',   'com-uid',        true);
  v_pass := app.can_access_owner('com-uid');
  IF NOT v_pass THEN RAISE EXCEPTION 'Migration assertion failed: role_comercial should see own'; END IF;
  v_pass := app.can_access_owner('other-uid');
  IF v_pass THEN RAISE EXCEPTION 'Migration assertion failed: role_comercial must not see other'; END IF;

  -- Test 5: unknown role → false
  PERFORM set_config('app.current_user_role', 'role_unknown', true);
  PERFORM set_config('app.current_user_id',   'x-uid',        true);
  v_pass := app.can_access_owner('x-uid');
  IF v_pass THEN RAISE EXCEPTION 'Migration assertion failed: unknown role should fail closed'; END IF;

  RAISE NOTICE 'Migration 0018: all assertions passed.';
END;
$$;
