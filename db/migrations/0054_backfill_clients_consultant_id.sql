-- db/migrations/0054_backfill_clients_consultant_id.sql
-- Backfill clients.consultant_id from metadata.consultor_id for rows where the canonical
-- FK is NULL but the legacy metadata field contains a valid consultant id.
--
-- This migration is idempotent: it only updates rows where consultant_id IS NULL
-- and metadata->'consultor_id' resolves to a valid consultants.id.
-- Non-numeric or invalid metadata.consultor_id values are silently skipped.
--
-- Run order: after 0040_consultants_engineers_installers.sql (which adds the column).

-- Step 1: Backfill consultant_id from metadata.consultor_id (validated by FK).
-- Guards:
--   • Only rows where consultant_id IS NULL
--   • Only rows with a non-empty metadata.consultor_id
--   • Only metadata.consultor_id values that are purely numeric (avoids bigint cast errors)
--   • Only valid consultant IDs that exist in the consultants table
UPDATE public.clients c
SET
  consultant_id = con.id,
  updated_at = now()
FROM public.consultants con
WHERE c.deleted_at IS NULL
  AND c.consultant_id IS NULL
  AND c.metadata ? 'consultor_id'
  AND trim(coalesce(c.metadata ->> 'consultor_id', '')) ~ '^[0-9]+$'
  AND con.id = trim(c.metadata ->> 'consultor_id')::bigint
  AND con.is_active = true;

-- Step 2: Ensure index exists (created in 0040, but guard with IF NOT EXISTS).
CREATE INDEX IF NOT EXISTS idx_clients_consultant_id
  ON public.clients (consultant_id)
  WHERE consultant_id IS NOT NULL;
