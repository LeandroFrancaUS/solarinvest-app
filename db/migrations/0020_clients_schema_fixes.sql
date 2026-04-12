-- db/migrations/0020_clients_schema_fixes.sql
--
-- Adds columns and constraints that were missing from the clients table,
-- causing 500 errors in DELETE and upsert routes.
--
-- Problems fixed:
--   1. softDeleteClient sets updated_by_user_id but the column never existed
--      in the clients table (it was only defined on proposals). This caused
--      DELETE /api/clients/:id → 500.
--
--   2. Ensures origin column default and related constraints are consistent
--      with the code that writes 'offline' as origin for offline-synced clients.
--
-- Safe to re-run (all statements are idempotent via IF NOT EXISTS / DO blocks).

-- 1. Add updated_by_user_id to clients (mirrors proposals schema)
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS updated_by_user_id TEXT;

-- 2. Backfill updated_by_user_id from created_by_user_id for existing rows
UPDATE clients
SET updated_by_user_id = created_by_user_id
WHERE updated_by_user_id IS NULL
  AND created_by_user_id IS NOT NULL;

-- 3. Index for audit / ownership queries
CREATE INDEX IF NOT EXISTS idx_clients_updated_by_user_id
  ON clients (updated_by_user_id);

COMMENT ON COLUMN public.clients.updated_by_user_id IS
  'User ID of the actor who last updated this client record (mirrors proposals.updated_by_user_id).';
