-- Migration: bootstrap admin self-heal
-- One-time idempotent fix: ensure the bootstrap admin account (brsolarinvest@gmail.com)
-- has admin/approved access status.
--
-- This migration is safe to run multiple times (idempotent). It only promotes rows
-- that are NOT already in the correct state; it never demotes an existing admin user.
--
-- Why this is needed:
--   During an early deployment the JWT verification was rejecting all tokens (wrong
--   algorithm check). If a request somehow reached the DB layer before that was fixed,
--   provisionNewUser() could have created a 'pending' row for the bootstrap admin.
--   This migration ensures any such row is corrected without requiring a manual DB edit.

UPDATE public.app_user_access
SET
  role         = 'admin',
  access_status = 'approved',
  is_active    = true,
  can_access_app = true,
  approved_at  = COALESCE(approved_at, now()),
  updated_at   = now()
WHERE lower(email) = 'brsolarinvest@gmail.com'
  AND (
    role != 'admin'
    OR access_status != 'approved'
    OR is_active = false
    OR can_access_app = false
  );
