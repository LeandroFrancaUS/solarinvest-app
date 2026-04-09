-- db/migrations/0017_app_user_profiles.sql
--
-- Creates the app_user_profiles table which acts as a local shadow of each
-- user's primary Stack Auth role.
--
-- This table is used by:
--   1. role_office queries: office users can read/write their own records AND
--      records belonging to users with primary_role = 'role_comercial'.
--   2. /api/authz/me: fast lookup of the user's primary role without an extra
--      Stack Auth API call on every request.
--
-- The table is synced:
--   - On login (currentAppUser.js: upserts on every successful auth)
--   - On permission grant/revoke (adminUsers.js: updates after Stack API call)
--
-- Safe to re-run: uses IF NOT EXISTS and ON CONFLICT DO UPDATE.

CREATE TABLE IF NOT EXISTS public.app_user_profiles (
  stack_user_id   TEXT        PRIMARY KEY,
  primary_role    TEXT        NOT NULL DEFAULT 'unknown',
  email           TEXT,
  display_name    TEXT,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for JOIN lookups from clients/proposals by owner_user_id
CREATE INDEX IF NOT EXISTS idx_app_user_profiles_primary_role
  ON public.app_user_profiles (primary_role);

COMMENT ON TABLE public.app_user_profiles IS
  'Local shadow of Stack Auth user roles. Synced on login and on permission changes.';
COMMENT ON COLUMN public.app_user_profiles.primary_role IS
  'Highest-priority role derived from Stack Auth permissions: '
  'role_admin > role_financeiro > role_office > role_comercial > unknown';
