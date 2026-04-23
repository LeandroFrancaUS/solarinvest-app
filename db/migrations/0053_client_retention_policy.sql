-- Migration: 0053_client_retention_policy.sql
-- Adds retention-policy columns to the clients table to support automated
-- soft-delete management and the scheduled purge cron job.
--
-- New columns:
--   deletion_policy           TEXT         — 'standard' (7 days) or 'business_closed' (60 days)
--   deletion_retention_days   INTEGER      — retention window in days (populated at soft-delete time)
--   deleted_by_user_id        TEXT         — Stack Auth user ID who triggered the soft-delete
--   deletion_reason           TEXT         — optional free-text reason for the deletion
--   purge_after               TIMESTAMPTZ  — computed timestamp after which the row is eligible for hard-delete
--   is_high_value_protected   BOOLEAN      — when true the row is never auto-purged regardless of purge_after
--
-- Safe to re-run (all ADD COLUMN IF NOT EXISTS).

BEGIN;

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS deletion_policy         TEXT,
  ADD COLUMN IF NOT EXISTS deletion_retention_days INTEGER,
  ADD COLUMN IF NOT EXISTS deleted_by_user_id      TEXT,
  ADD COLUMN IF NOT EXISTS deletion_reason         TEXT,
  ADD COLUMN IF NOT EXISTS purge_after             TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_high_value_protected BOOLEAN NOT NULL DEFAULT false;

-- Partial index speeds up the nightly purge cron: only soft-deleted rows with
-- a non-null purge_after timestamp need to be scanned.
CREATE INDEX IF NOT EXISTS idx_clients_purge_after
  ON public.clients (purge_after)
  WHERE deleted_at IS NOT NULL AND purge_after IS NOT NULL;

-- Backfill purge_after for rows that were soft-deleted before this migration.
-- Standard 7-day window is applied; rows already beyond the window will have
-- purge_after in the past and become candidates on the next cron run.
-- NOTE: The 7-day value mirrors RETENTION_STANDARD_DAYS in
-- server/clients/repository.js. If the application constant changes in the
-- future, a new migration should be created to update existing rows accordingly.
UPDATE public.clients
SET
  deletion_policy         = 'standard',
  deletion_retention_days = 7,
  purge_after             = deleted_at + INTERVAL '7 days'
WHERE deleted_at IS NOT NULL
  AND purge_after IS NULL;

COMMENT ON COLUMN public.clients.deletion_policy IS
  'Retention policy applied at soft-delete time. '
  '''standard'' = 7-day window; ''business_closed'' = 60-day window.';
COMMENT ON COLUMN public.clients.deletion_retention_days IS
  'Retention window in days set when the client was soft-deleted.';
COMMENT ON COLUMN public.clients.deleted_by_user_id IS
  'Stack Auth user ID that triggered the soft-delete.';
COMMENT ON COLUMN public.clients.deletion_reason IS
  'Optional human-readable reason for the deletion.';
COMMENT ON COLUMN public.clients.purge_after IS
  'Timestamp after which the client is eligible for physical (hard) deletion '
  'by the purge cron job. NULL means the row should not be auto-purged.';
COMMENT ON COLUMN public.clients.is_high_value_protected IS
  'When true the purge cron will never hard-delete this client row regardless '
  'of purge_after. Must be explicitly cleared before the client can be purged.';

COMMIT;
