-- Migration: first-user bootstrap admin self-heal
--
-- If the app_user_access table exists but has NO approved admin rows, promote
-- the oldest authenticated user to admin.  This handles the scenario where the
-- JWT access token omitted the email claim (Stack Auth v2 behaviour) so the
-- server-side email check could not identify the bootstrap admin.
--
-- Idempotent: only runs when no admin exists; never demotes existing admins.

UPDATE public.app_user_access
SET
  role          = 'admin',
  access_status = 'approved',
  is_active     = true,
  can_access_app = true,
  approved_at   = COALESCE(approved_at, now()),
  updated_at    = now()
WHERE id = (
  -- Oldest row (first user to ever log in) when no admin exists yet
  SELECT id
  FROM public.app_user_access
  ORDER BY created_at ASC
  LIMIT 1
)
AND NOT EXISTS (
  SELECT 1
  FROM public.app_user_access
  WHERE access_status = 'approved'
    AND role = 'admin'
);
