-- Migration: auto-approve all Stack Auth-authenticated users
--
-- Stack Auth is the identity source-of-truth.  Any user who has a row in
-- app_user_access has already authenticated via Stack Auth (Google OAuth,
-- password, etc.) and their email was verified by the identity provider.
-- Requiring a separate manual approval step just blocks legitimate users.
--
-- This migration promotes all existing 'pending' rows to 'approved' so that
-- users who logged in under the old behaviour are immediately unblocked.
--
-- Idempotent: only updates rows that are still 'pending'; never demotes rows
-- that have already been approved, revoked, or blocked.

UPDATE public.app_user_access
SET
  access_status  = 'approved',
  can_access_app = true,
  approved_at    = COALESCE(approved_at, now()),
  updated_at     = now()
WHERE access_status = 'pending';
