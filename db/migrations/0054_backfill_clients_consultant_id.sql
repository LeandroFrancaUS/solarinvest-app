-- db/migrations/0054_backfill_clients_consultant_id.sql
-- Backfill clients.consultant_id from metadata.consultor_id for rows where the canonical
-- FK is NULL but the legacy metadata field contains a valid consultant id.
--
-- This migration is idempotent: it only updates rows where consultant_id IS NULL
-- and metadata->'consultor_id' resolves to a valid consultants.id.
--
-- Run order: after 0040_consultants_engineers_installers.sql (which adds the column).

-- Step 1: Backfill consultant_id from metadata.consultor_id (cast to BIGINT, validated by FK).
-- We use a sub-select to ensure only valid consultant IDs are written.
UPDATE public.clients c
SET
  consultant_id = (
    SELECT con.id
    FROM public.consultants con
    WHERE con.id = NULLIF(trim(c.metadata ->> 'consultor_id'), '')::bigint
    LIMIT 1
  ),
  updated_at = now()
WHERE c.deleted_at IS NULL
  AND c.consultant_id IS NULL
  AND c.metadata ? 'consultor_id'
  AND NULLIF(trim(c.metadata ->> 'consultor_id'), '') IS NOT NULL
  AND NULLIF(trim(c.metadata ->> 'consultor_id'), '')::bigint IN (
    SELECT id FROM public.consultants WHERE is_active = true
  );

-- Step 2: Ensure index exists (created in 0040, but guard with IF NOT EXISTS).
CREATE INDEX IF NOT EXISTS idx_clients_consultant_id
  ON public.clients (consultant_id)
  WHERE consultant_id IS NOT NULL;
