-- Migration: heal approved rows where can_access_app or is_active are false
--
-- Root cause: public.app_user_access was created with `can_access_app BOOLEAN
-- NOT NULL DEFAULT false` and `is_active BOOLEAN NOT NULL DEFAULT true`.
-- In some code paths (e.g. direct SQL inserts, legacy bootstrap) a row can
-- end up with access_status = 'approved' while can_access_app remains false.
--
-- The application checks:
--   authorized = can_access_app AND access_status = 'approved' AND is_active
--
-- A row that is approved but has can_access_app = false produces
-- authorized = false, which causes the frontend to show "Acesso pendente"
-- even though the admin has approved the account.
--
-- This migration fixes all such inconsistent rows in one shot.
-- It is idempotent: it only touches rows that actually have the problem.

UPDATE public.app_user_access
SET
  can_access_app = true,
  is_active      = true,
  updated_at     = now()
WHERE access_status = 'approved'
  AND (can_access_app = false OR is_active = false);
