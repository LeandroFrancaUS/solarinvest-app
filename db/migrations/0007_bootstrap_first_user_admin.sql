-- Migration: first-user bootstrap admin self-heal
--
-- Purpose:
--   If public.app_user_access exists but has NO approved admin rows,
--   promote the oldest eligible authenticated user to admin.
--
-- Why:
--   This handles bootstrap edge cases where the initial admin could not be
--   recognized automatically (for example, missing email claim in the auth token).
--
-- Rules:
--   - Idempotent: only runs when no approved admin exists
--   - Never demotes existing admins
--   - Promotes only one user: the oldest eligible row
--   - Does not overwrite approval metadata unnecessarily
--
-- Eligibility for bootstrap promotion:
--   - oldest row by created_at
--   - preferably active / app-enabled row
--   - not revoked
--
-- Safe to re-run

BEGIN;

WITH has_admin AS (
  SELECT 1
  FROM public.app_user_access
  WHERE access_status = 'approved'
    AND role = 'admin'
  LIMIT 1
),
bootstrap_candidate AS (
  SELECT id
  FROM public.app_user_access
  WHERE revoked_at IS NULL
  ORDER BY
    CASE
      WHEN can_access_app = true AND is_active = true THEN 0
      ELSE 1
    END,
    created_at ASC,
    id ASC
  LIMIT 1
)
UPDATE public.app_user_access aua
SET
  role           = 'admin',
  access_status  = 'approved',
  is_active      = true,
  can_access_app = true,
  approved_at    = COALESCE(aua.approved_at, now()),
  approved_by    = COALESCE(aua.approved_by, 'bootstrap_migration_automation'),
  updated_at     = now()
WHERE aua.id = (SELECT id FROM bootstrap_candidate)
  AND NOT EXISTS (SELECT 1 FROM has_admin);

COMMIT;
