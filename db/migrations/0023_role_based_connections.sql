-- db/migrations/0023_role_based_connections.sql
--
-- Enables the backend to connect directly as the role_admin PostgreSQL role
-- (using DATABASE_URL_ROLE_ADMIN) so that admin queries bypass the
-- sql.transaction() set_config wrapper that is not reliable when the pooler
-- endpoint is used with the Neon HTTP driver.
--
-- Changes:
--   1. GRANT necessary schema/table/sequence/function privileges to role_admin.
--   2. Update app.can_access_owner() and app.can_write_owner() to check
--      current_user = 'role_admin' as a fast path before reading session GUCs.
--      When the backend connects as role_admin directly, these functions return
--      true immediately without needing app.current_user_role to be set via
--      set_config, making transactions unnecessary.
--   3. Similar fast-path for app.can_access_owner to also check proposals.
--
-- Safe to re-run: all DDL uses CREATE OR REPLACE / IF NOT EXISTS / IF EXISTS.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── 1. Schema and table access for role_admin ─────────────────────────────────

GRANT USAGE ON SCHEMA public TO role_admin;
GRANT USAGE ON SCHEMA app    TO role_admin;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients          TO role_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.proposals        TO role_admin;
GRANT SELECT                          ON public.app_user_access TO role_admin;
GRANT SELECT                          ON public.app_user_profiles TO role_admin;
GRANT SELECT, INSERT                  ON public.client_audit_log TO role_admin;

-- Sequences (needed for GENERATED ALWAYS AS IDENTITY columns)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO role_admin;

-- Function execute
GRANT EXECUTE ON FUNCTION app.can_access_owner(text)  TO role_admin;
GRANT EXECUTE ON FUNCTION app.can_write_owner(text)   TO role_admin;
GRANT EXECUTE ON FUNCTION app.current_user_id()       TO role_admin;
GRANT EXECUTE ON FUNCTION app.current_user_role()     TO role_admin;

-- ── 2. Update app.can_access_owner() ─────────────────────────────────────────
--
-- When the backend connects as role_admin PostgreSQL role (DATABASE_URL_ROLE_ADMIN),
-- current_user = 'role_admin'. This fast-path lets us skip the set_config
-- transaction wrapper entirely for admin connections.
-- All other logic is unchanged.

CREATE OR REPLACE FUNCTION app.can_access_owner(owner_user_id text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_role text;
  v_uid  text;
BEGIN
  -- Fast path: connecting directly as the role_admin database role.
  -- The backend uses DATABASE_URL_ROLE_ADMIN for this purpose.
  IF current_user = 'role_admin' THEN
    RETURN true;
  END IF;

  v_role := app.current_user_role();
  v_uid  := app.current_user_id();

  -- Fail closed: if session context is missing, deny.
  IF v_role IS NULL OR v_uid IS NULL THEN
    RETURN false;
  END IF;

  IF v_role = 'role_admin'      THEN RETURN true; END IF;
  IF v_role = 'role_financeiro' THEN RETURN true; END IF;
  IF v_role = 'role_office'     THEN RETURN true; END IF;
  IF v_role = 'role_comercial'  THEN RETURN owner_user_id = v_uid; END IF;

  RETURN false;
END;
$$;

-- ── 3. Update app.can_write_owner() ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION app.can_write_owner(owner_user_id text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_role text;
  v_uid  text;
BEGIN
  -- Fast path: connecting directly as the role_admin database role.
  IF current_user = 'role_admin' THEN
    RETURN true;
  END IF;

  v_role := app.current_user_role();
  v_uid  := app.current_user_id();

  -- Fail closed: if session context is missing, deny.
  IF v_role IS NULL OR v_uid IS NULL THEN
    RETURN false;
  END IF;

  IF v_role = 'role_admin'      THEN RETURN true;                    END IF;
  IF v_role = 'role_financeiro' THEN RETURN false;                   END IF;
  IF v_role = 'role_office'     THEN RETURN owner_user_id = v_uid;   END IF;
  IF v_role = 'role_comercial'  THEN RETURN owner_user_id = v_uid;   END IF;

  RETURN false;
END;
$$;

COMMIT;
