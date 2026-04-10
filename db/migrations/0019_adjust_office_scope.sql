-- db/migrations/0019_adjust_office_scope.sql
-- Align role access with the business matrix:
--   role_admin      : read/write all
--   role_financeiro : read all, write none
--   role_office     : read all, write own only
--   role_comercial  : read/write own only
--
-- IMPORTANT:
-- - Keep the existing input parameter name `owner_user_id` to avoid
--   PostgreSQL errors when using CREATE OR REPLACE FUNCTION.
-- - Fail closed: if role or user id is missing, deny access.

BEGIN;

CREATE OR REPLACE FUNCTION app.can_access_owner(owner_user_id text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_role text;
  v_uid  text;
BEGIN
  v_role := app.current_user_role();
  v_uid  := app.current_user_id();

  -- Fail closed: if session context is missing, deny.
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
AS $$
DECLARE
  v_role text;
  v_uid  text;
BEGIN
  v_role := app.current_user_role();
  v_uid  := app.current_user_id();

  -- Fail closed: if session context is missing, deny.
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

COMMIT;
