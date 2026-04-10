-- db/migrations/0018_role_aware_rls.sql
--
-- Role-aware Row Level Security for the tables that currently exist
-- in this database:
--   - public.storage
--   - public.app_user_access
--
-- Goals:
--   1. Create a dedicated `app` schema with helper functions that read the
--      session settings set by the application layer.
--   2. Enforce role-aware RLS using helper functions.
--   3. Fail-closed: if role/user context is missing, deny by default.
--
-- Role matrix validated in production:
--   role_admin      : read/write all
--   role_financeiro : read all, write none
--   role_office     : read all, write own only
--   role_comercial  : read/write own only
--
-- IMPORTANT:
--   - This migration no longer targets clients/proposals because those
--     relations do not exist in the current database.
--   - app_user_access uses a different model:
--       * admin sees/writes all
--       * non-admin sees only their own row
--       * non-admin cannot write
--
-- Safe to re-run:
--   - CREATE SCHEMA IF NOT EXISTS
--   - CREATE OR REPLACE FUNCTION
--   - DROP POLICY IF EXISTS before CREATE POLICY
--
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── 0. App schema ─────────────────────────────────────────────────────────────

CREATE SCHEMA IF NOT EXISTS app;

-- Adjust role if your Neon project uses a different DB role.
GRANT USAGE ON SCHEMA app TO neondb_owner;

-- ── 1. Session-variable accessor functions ────────────────────────────────────

CREATE OR REPLACE FUNCTION app.current_user_id()
RETURNS text
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$
  SELECT nullif(current_setting('app.current_user_id', true), '');
$$;

CREATE OR REPLACE FUNCTION app.current_user_role()
RETURNS text
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$
  SELECT nullif(current_setting('app.current_user_role', true), '');
$$;

-- ── 2. Role-aware helper functions ────────────────────────────────────────────
--
-- Keep input parameter name as owner_user_id to avoid PostgreSQL
-- CREATE OR REPLACE FUNCTION rename-parameter errors.

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

  -- Fail closed if no session context is present.
  IF v_role IS NULL OR v_uid IS NULL THEN
    RETURN false;
  END IF;

  IF v_role = 'role_admin' THEN
    RETURN true;
  END IF;

  IF v_role = 'role_financeiro' THEN
    RETURN true;
  END IF;

  IF v_role = 'role_office' THEN
    RETURN true;
  END IF;

  IF v_role = 'role_comercial' THEN
    RETURN owner_user_id = v_uid;
  END IF;

  RETURN false;
END;
$$;

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

  -- Fail closed if no session context is present.
  IF v_role IS NULL OR v_uid IS NULL THEN
    RETURN false;
  END IF;

  IF v_role = 'role_admin' THEN
    RETURN true;
  END IF;

  IF v_role = 'role_financeiro' THEN
    RETURN false;
  END IF;

  IF v_role = 'role_office' THEN
    RETURN owner_user_id = v_uid;
  END IF;

  IF v_role = 'role_comercial' THEN
    RETURN owner_user_id = v_uid;
  END IF;

  RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION app.current_user_id()       TO neondb_owner;
GRANT EXECUTE ON FUNCTION app.current_user_role()     TO neondb_owner;
GRANT EXECUTE ON FUNCTION app.can_access_owner(text)  TO neondb_owner;
GRANT EXECUTE ON FUNCTION app.can_write_owner(text)   TO neondb_owner;

-- ── 3. storage table ──────────────────────────────────────────────────────────
--
-- storage owner column:
--   user_id
--
-- Validated design:
--   USING      -> app.can_access_owner(user_id)
--   WITH CHECK -> app.can_write_owner(user_id)
--                 AND admin can write anything
--                 AND non-admin can only write rows whose user_id matches current_user_id

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

-- ── 4. app_user_access table ──────────────────────────────────────────────────
--
-- app_user_access is administrative / access-governance data.
--
-- Rules:
--   - admin sees all
--   - non-admin sees only own row
--   - only admin can insert/update/delete
--
-- owner identity column:
--   auth_provider_user_id

ALTER TABLE public.app_user_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_user_access FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_user_access_select_policy ON public.app_user_access;
DROP POLICY IF EXISTS app_user_access_write_policy  ON public.app_user_access;

CREATE POLICY app_user_access_select_policy
ON public.app_user_access
FOR SELECT
USING (
  app.current_user_role() = 'role_admin'
  OR auth_provider_user_id = app.current_user_id()
);

CREATE POLICY app_user_access_write_policy
ON public.app_user_access
FOR ALL
USING (
  app.current_user_role() = 'role_admin'
)
WITH CHECK (
  app.current_user_role() = 'role_admin'
);

COMMIT;
