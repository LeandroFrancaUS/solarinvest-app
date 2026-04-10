-- db/migrations/0017_app_user_profiles.sql
--
-- Creates public.app_user_profiles, a local shadow of each user's primary
-- Stack Auth role.
--
-- Main use cases:
--   1. Fast local authorization lookup without calling Stack Auth on every request.
--   2. Support role-aware access decisions in Postgres / backend services.
--   3. Allow office/commercial/admin logic to reference a local role snapshot.
--
-- Sync strategy:
--   - Upsert on login
--   - Upsert after permission grant/revoke
--   - Optional periodic reconciliation job in the future
--
-- Safe to re-run:
--   - CREATE TABLE IF NOT EXISTS
--   - CREATE INDEX IF NOT EXISTS
--   - COMMENT ON is idempotent

BEGIN;

CREATE TABLE IF NOT EXISTS public.app_user_profiles (
  stack_user_id  TEXT PRIMARY KEY,
  primary_role   TEXT NOT NULL DEFAULT 'unknown',
  email          TEXT,
  display_name   TEXT,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Lookup by role (useful for joins / filtering)
CREATE INDEX IF NOT EXISTS idx_app_user_profiles_primary_role
  ON public.app_user_profiles (primary_role);

-- Optional: useful for ordering / reconciliation / stale-profile checks
CREATE INDEX IF NOT EXISTS idx_app_user_profiles_updated_at
  ON public.app_user_profiles (updated_at DESC);

COMMENT ON TABLE public.app_user_profiles IS
  'Local shadow of Stack Auth user roles. Synced on login and after permission changes.';

COMMENT ON COLUMN public.app_user_profiles.stack_user_id IS
  'Stack Auth user ID used as the stable local identity key.';

COMMENT ON COLUMN public.app_user_profiles.primary_role IS
  'Highest-priority role derived from Stack Auth permissions. Expected precedence: role_admin > role_financeiro > role_office > role_comercial > unknown.';

COMMENT ON COLUMN public.app_user_profiles.email IS
  'Cached user email from auth/profile source.';

COMMENT ON COLUMN public.app_user_profiles.display_name IS
  'Cached user display name from auth/profile source.';

COMMENT ON COLUMN public.app_user_profiles.updated_at IS
  'Timestamp of the last successful local sync for this profile.';

COMMIT;
