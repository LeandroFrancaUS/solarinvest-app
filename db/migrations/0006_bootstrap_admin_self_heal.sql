-- Migration: bootstrap admin self-heal
--
-- Purpose:
--   Ensure the bootstrap admin account (brsolarinvest@gmail.com)
--   has admin / approved / active access in public.app_user_access.
--
-- Why:
--   During an early deployment issue, the bootstrap admin row may have been
--   inserted with incomplete or incorrect access state (for example: pending,
--   inactive, or app access disabled).
--
-- Guarantees:
--   - Safe to run multiple times (idempotent)
--   - Never demotes any existing admin
--   - Only updates the bootstrap row if it is not already in the correct state
--   - Preserves existing approval timestamp if already present
--
-- Notes:
--   - This migration targets the known bootstrap admin email only
--   - Email match is case-insensitive
--   - It does not create a row; it only fixes an existing one

BEGIN;

UPDATE public.app_user_access
SET
  role           = 'admin',
  access_status  = 'approved',
  is_active      = true,
  can_access_app = true,
  approved_at    = COALESCE(approved_at, now()),
  approved_by    = COALESCE(approved_by, 'bootstrap_admin_self_heal'),
  updated_at     = now()
WHERE lower(email) = 'brsolarinvest@gmail.com'
  AND (
    COALESCE(role, '') <> 'admin'
    OR COALESCE(access_status, '') <> 'approved'
    OR COALESCE(is_active, false) = false
    OR COALESCE(can_access_app, false) = false
  );

COMMIT;
