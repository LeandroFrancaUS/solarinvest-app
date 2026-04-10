-- Migration: Enhance public.clients for offline-first + CPF deduplication
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

-- 2) Backfill ownership metadata from existing user_id
-- Only fills missing values; safe to re-run
UPDATE public.clients
SET owner_user_id = user_id
WHERE owner_user_id IS NULL
  AND user_id IS NOT NULL;

UPDATE public.clients
SET created_by_user_id = user_id
WHERE created_by_user_id IS NULL
  AND user_id IS NOT NULL;

-- 3) Backfill identity status for rows that already have a document
-- Only update rows still in the default pending state
UPDATE public.clients
SET identity_status = 'confirmed'
WHERE identity_status = 'pending_cpf'
  AND document IS NOT NULL
  AND btrim(document) <> '';

-- 4) Partial unique index for CPF deduplication
-- Only one active, non-merged client per cpf_normalized
CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_cpf_normalized
  ON public.clients (cpf_normalized)
  WHERE cpf_normalized IS NOT NULL
    AND deleted_at IS NULL
    AND merged_into_client_id IS NULL;

-- 5) Secondary indexes for common filters / sync / ownership lookups
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

CREATE INDEX IF NOT EXISTS idx_clients_city
  ON public.clients (city);

CREATE INDEX IF NOT EXISTS idx_clients_state
  ON public.clients (state);

COMMIT;
