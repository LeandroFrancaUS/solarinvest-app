-- Migration: Enhance public.clients for offline-first + CPF deduplication
--
-- Adds:
--   cpf_normalized, cpf_raw, identity_status, merged_into_client_id,
--   created_by_user_id, owner_user_id, origin, last_synced_at,
--   deleted_at, offline_origin_id, search_text
--
-- Goals:
--   1. Support offline-first sync flows
--   2. Support CPF normalization + deduplication
--   3. Preserve ownership / creator metadata
--   4. Allow soft delete and merge flows safely
--
-- Notes:
--   - Assumes public.clients already exists
--   - Safe to re-run
--   - Does not delete or rewrite historical data unnecessarily

BEGIN;

-- 1) Add new columns
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS cpf_normalized         TEXT,
  ADD COLUMN IF NOT EXISTS cpf_raw                TEXT,
  ADD COLUMN IF NOT EXISTS identity_status        TEXT NOT NULL DEFAULT 'pending_cpf',
  ADD COLUMN IF NOT EXISTS merged_into_client_id  BIGINT REFERENCES public.clients(id),
  ADD COLUMN IF NOT EXISTS created_by_user_id     TEXT,
  ADD COLUMN IF NOT EXISTS owner_user_id          TEXT,
  ADD COLUMN IF NOT EXISTS origin                 TEXT NOT NULL DEFAULT 'online',
  ADD COLUMN IF NOT EXISTS last_synced_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_at             TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS offline_origin_id      TEXT,
  ADD COLUMN IF NOT EXISTS search_text            TEXT;

-- 2) Optional consistency checks
-- Add only if they do not already exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'clients_identity_status_check'
  ) THEN
    ALTER TABLE public.clients
      ADD CONSTRAINT clients_identity_status_check
      CHECK (
        identity_status IN (
          'pending_cpf',
          'confirmed',
          'merged',
          'rejected',
          'conflict'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'clients_origin_check'
  ) THEN
    ALTER TABLE public.clients
      ADD CONSTRAINT clients_origin_check
      CHECK (
        origin IN (
          'online',
          'offline',
          'imported',
          'synced',
          'duplicated'
        )
      );
  END IF;
END
$$;

-- 3) Backfill ownership metadata from existing user_id
-- Only fills missing values; safe to re-run
UPDATE public.clients
SET owner_user_id = user_id
WHERE owner_user_id IS NULL
  AND user_id IS NOT NULL
  AND btrim(user_id) <> '';

UPDATE public.clients
SET created_by_user_id = user_id
WHERE created_by_user_id IS NULL
  AND user_id IS NOT NULL
  AND btrim(user_id) <> '';

-- 4) Backfill identity status for rows that already have a document
-- Only update rows still in the default pending state
UPDATE public.clients
SET identity_status = 'confirmed'
WHERE identity_status = 'pending_cpf'
  AND document IS NOT NULL
  AND btrim(document) <> '';

-- 5) Partial unique index for CPF deduplication
-- Only one active, non-merged client per cpf_normalized
CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_cpf_normalized
  ON public.clients (cpf_normalized)
  WHERE cpf_normalized IS NOT NULL
    AND deleted_at IS NULL
    AND merged_into_client_id IS NULL;

-- 6) Secondary indexes for common filters / sync / ownership lookups
CREATE INDEX IF NOT EXISTS idx_clients_identity_status
  ON public.clients (identity_status);

CREATE INDEX IF NOT EXISTS idx_clients_created_by
  ON public.clients (created_by_user_id);

CREATE INDEX IF NOT EXISTS idx_clients_owner_user_id
  ON public.clients (owner_user_id);

CREATE INDEX IF NOT EXISTS idx_clients_deleted_at
  ON public.clients (deleted_at);

CREATE INDEX IF NOT EXISTS idx_clients_offline_origin
  ON public.clients (offline_origin_id);

CREATE INDEX IF NOT EXISTS idx_clients_last_synced_at
  ON public.clients (last_synced_at DESC);

CREATE INDEX IF NOT EXISTS idx_clients_city
  ON public.clients (city);

CREATE INDEX IF NOT EXISTS idx_clients_state
  ON public.clients (state);

-- Helpful for active-client queries
CREATE INDEX IF NOT EXISTS idx_clients_active_not_deleted
  ON public.clients (owner_user_id, identity_status)
  WHERE deleted_at IS NULL
    AND merged_into_client_id IS NULL;

-- 7) Comments for maintainability
COMMENT ON COLUMN public.clients.cpf_normalized IS
  'Normalized CPF used for deduplication and uniqueness checks.';

COMMENT ON COLUMN public.clients.cpf_raw IS
  'Original CPF string as received from UI/import/external source before normalization.';

COMMENT ON COLUMN public.clients.identity_status IS
  'Identity/document verification lifecycle state for the client.';

COMMENT ON COLUMN public.clients.merged_into_client_id IS
  'If not null, this client was merged into another surviving client record.';

COMMENT ON COLUMN public.clients.created_by_user_id IS
  'User ID that originally created the client record.';

COMMENT ON COLUMN public.clients.owner_user_id IS
  'Current owner/responsible user ID for the client record.';

COMMENT ON COLUMN public.clients.origin IS
  'Source of creation/sync for the record: online, offline, imported, synced, duplicated.';

COMMENT ON COLUMN public.clients.last_synced_at IS
  'Timestamp of the last successful sync between local/offline state and server state.';

COMMENT ON COLUMN public.clients.deleted_at IS
  'Soft-delete timestamp. Null means active record.';

COMMENT ON COLUMN public.clients.offline_origin_id IS
  'Offline-generated identifier used for reconciliation during sync.';

COMMENT ON COLUMN public.clients.search_text IS
  'Optional denormalized search field for fast client lookup.';

COMMIT;
