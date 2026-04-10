-- db/migrations/0016_enable_rls.sql
--
-- Enable Row Level Security (RLS) on user-scoped tables that currently exist
-- in this database.
--
-- Current known tables:
--   - public.storage
--   - public.storage_events
--
-- NOTE:
--   This migration no longer applies RLS to clients/proposals by default,
--   because those relations do not exist in the current validated database.
--
-- Design:
--   Policies rely on helper functions in schema app:
--     - app.current_user_id()
--     - app.current_user_role()
--     - app.can_access_owner(text)
--     - app.can_write_owner(text)
--
--   The application layer must set:
--     - app.current_user_id
--     - app.current_user_role
--   in the same transaction / connection before protected queries.
--
--   RLS is FORCEd so table owners do not bypass policies.
--
-- Safe to re-run:
--   - ALTER TABLE ... ENABLE/FORCE RLS is safe
--   - DROP POLICY IF EXISTS
--   - CREATE POLICY

BEGIN;

-- ── storage ───────────────────────────────────────────────────────────────────
--
-- Owner column:
--   user_id
--
-- Validated behavior:
--   role_admin      -> read/write all
--   role_financeiro -> read all, write none
--   role_office     -> read all, write own only
--   role_comercial  -> read/write own only

ALTER TABLE public.storage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storage FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS storage_rls_policy ON public.storage;

CREATE POLICY storage_rls_policy
ON public.storage
FOR ALL
USING (
  app.can_access_owner(user_id)
)
WITH CHECK (
  app.can_write_owner(user_id)
  AND (
    app.current_user_role() = 'role_admin'
    OR user_id = app.current_user_id()
  )
);

-- ── storage_events ────────────────────────────────────────────────────────────
--
-- Audit / append-only table
--
-- Rules:
--   role_admin      -> read all, insert all
--   role_financeiro -> read all, insert own only unless admin path
--   others          -> read own, insert own
--   no updates / deletes
--
-- Owner column:
--   user_id

ALTER TABLE public.storage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storage_events FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS storage_events_select_policy ON public.storage_events;
DROP POLICY IF EXISTS storage_events_insert_policy ON public.storage_events;
DROP POLICY IF EXISTS storage_events_update_policy ON public.storage_events;
DROP POLICY IF EXISTS storage_events_delete_policy ON public.storage_events;

CREATE POLICY storage_events_select_policy
ON public.storage_events
FOR SELECT
USING (
  app.current_user_role() IN ('role_admin', 'role_financeiro')
  OR user_id = app.current_user_id()
);

CREATE POLICY storage_events_insert_policy
ON public.storage_events
FOR INSERT
WITH CHECK (
  app.current_user_role() = 'role_admin'
  OR user_id = app.current_user_id()
);

CREATE POLICY storage_events_update_policy
ON public.storage_events
FOR UPDATE
USING (false);

CREATE POLICY storage_events_delete_policy
ON public.storage_events
FOR DELETE
USING (false);

COMMIT;
