-- Migration: Create public.storage_events (audit / logging table)
--
-- Purpose:
--   Store immutable audit events for storage operations.
--
-- Notes:
--   - Append-only table (no updates expected)
--   - RLS enforced (user sees own events, admin sees all)
--   - Safe to re-run

BEGIN;

-- 1) Create table
CREATE TABLE IF NOT EXISTS public.storage_events (
  id BIGSERIAL PRIMARY KEY,

  user_id TEXT NOT NULL,           -- owner / actor (Stack Auth ID)
  file_key TEXT NOT NULL,          -- reference to storage.key

  action TEXT NOT NULL,            -- e.g. 'upload', 'delete', 'update'
  metadata JSONB,                  -- arbitrary structured data

  ip_address TEXT,                 -- optional audit
  user_agent TEXT,                 -- optional audit

  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2) Basic indexes
CREATE INDEX IF NOT EXISTS idx_storage_events_file_key
  ON public.storage_events (file_key);

CREATE INDEX IF NOT EXISTS idx_storage_events_user_id
  ON public.storage_events (user_id);

CREATE INDEX IF NOT EXISTS idx_storage_events_received_at
  ON public.storage_events (received_at DESC);

-- Optional: GIN index for metadata queries
CREATE INDEX IF NOT EXISTS idx_storage_events_metadata
  ON public.storage_events
  USING GIN (metadata);

-- ─────────────────────────────────────────────────────────
-- 3) Enable RLS
-- ─────────────────────────────────────────────────────────

ALTER TABLE public.storage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storage_events FORCE ROW LEVEL SECURITY;

-- Drop old policies (safe re-run)
DROP POLICY IF EXISTS storage_events_select_policy ON public.storage_events;
DROP POLICY IF EXISTS storage_events_insert_policy ON public.storage_events;

-- ─────────────────────────────────────────────────────────
-- 4) SELECT policy
-- ─────────────────────────────────────────────────────────
--
-- Rules:
--   role_admin      → sees all
--   role_financeiro → sees all (audit)
--   others          → see only own events

CREATE POLICY storage_events_select_policy
ON public.storage_events
FOR SELECT
USING (
  app.current_user_role() IN ('role_admin', 'role_financeiro')
  OR user_id = app.current_user_id()
);

-- ─────────────────────────────────────────────────────────
-- 5) INSERT policy
-- ─────────────────────────────────────────────────────────
--
-- Only allow inserting events for yourself (or admin)

CREATE POLICY storage_events_insert_policy
ON public.storage_events
FOR INSERT
WITH CHECK (
  app.current_user_role() = 'role_admin'
  OR user_id = app.current_user_id()
);

-- ─────────────────────────────────────────────────────────
-- 6) No UPDATE / DELETE (audit table)
-- ─────────────────────────────────────────────────────────

-- Explicitly block updates and deletes
DROP POLICY IF EXISTS storage_events_update_policy ON public.storage_events;
DROP POLICY IF EXISTS storage_events_delete_policy ON public.storage_events;

CREATE POLICY storage_events_update_policy
ON public.storage_events
FOR UPDATE
USING (false);

CREATE POLICY storage_events_delete_policy
ON public.storage_events
FOR DELETE
USING (false);

COMMIT;
