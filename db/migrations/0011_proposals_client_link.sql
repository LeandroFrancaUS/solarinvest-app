-- Migration: Enhance public.proposals with client linkage + offline-first fields
--
-- Purpose:
--   1. Link proposals to clients through client_id
--   2. Support offline-first sync flows
--   3. Track conflict / sync state
--   4. Preserve generator UC number and draft provenance
--
-- Notes:
--   - Safe to re-run
--   - Assumes public.proposals already exists
--   - Assumes public.clients already exists
--   - Backfill is best-effort only

BEGIN;

ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS client_id          BIGINT REFERENCES public.clients(id),
  ADD COLUMN IF NOT EXISTS offline_origin_id  TEXT,
  ADD COLUMN IF NOT EXISTS is_pending_sync    BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_conflicted      BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS conflict_reason    TEXT,
  ADD COLUMN IF NOT EXISTS synced_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS uc_geradora_numero TEXT,
  ADD COLUMN IF NOT EXISTS draft_source       TEXT;

-- Best-effort backfill:
-- link proposals to clients by matching denormalized client_document
-- only for active (non-deleted) clients
UPDATE public.proposals p
SET client_id = c.id
FROM public.clients c
WHERE p.client_id IS NULL
  AND p.client_document IS NOT NULL
  AND btrim(p.client_document) <> ''
  AND c.document = p.client_document
  AND c.deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_proposals_client_id
  ON public.proposals (client_id);

CREATE INDEX IF NOT EXISTS idx_proposals_offline_origin
  ON public.proposals (offline_origin_id);

CREATE INDEX IF NOT EXISTS idx_proposals_is_pending_sync
  ON public.proposals (is_pending_sync)
  WHERE is_pending_sync = TRUE;

CREATE INDEX IF NOT EXISTS idx_proposals_is_conflicted
  ON public.proposals (is_conflicted)
  WHERE is_conflicted = TRUE;

CREATE INDEX IF NOT EXISTS idx_proposals_client_city
  ON public.proposals (client_city);

CREATE INDEX IF NOT EXISTS idx_proposals_client_state
  ON public.proposals (client_state);

CREATE INDEX IF NOT EXISTS idx_proposals_consumption
  ON public.proposals (consumption_kwh_month);

CREATE INDEX IF NOT EXISTS idx_proposals_system_kwp
  ON public.proposals (system_kwp);

CREATE INDEX IF NOT EXISTS idx_proposals_synced_at
  ON public.proposals (synced_at DESC);

COMMENT ON COLUMN public.proposals.client_id IS
  'Normalized link to public.clients.id when a proposal is associated with a client record.';

COMMENT ON COLUMN public.proposals.offline_origin_id IS
  'Client-generated offline identifier used for sync reconciliation.';

COMMENT ON COLUMN public.proposals.is_pending_sync IS
  'True when the proposal still needs to be synchronized from offline/local state to the server.';

COMMENT ON COLUMN public.proposals.is_conflicted IS
  'True when the proposal encountered a sync or merge conflict requiring resolution.';

COMMENT ON COLUMN public.proposals.conflict_reason IS
  'Human-readable explanation of the detected sync/merge conflict.';

COMMENT ON COLUMN public.proposals.synced_at IS
  'Timestamp of the last successful synchronization.';

COMMENT ON COLUMN public.proposals.uc_geradora_numero IS
  'Número da UC geradora associated with the proposal, when applicable.';

COMMENT ON COLUMN public.proposals.draft_source IS
  'Indicates where the draft originated (e.g. online, offline, imported, duplicated).';

COMMIT;
