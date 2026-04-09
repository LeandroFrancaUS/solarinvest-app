-- db/migrations/0014_owner_stack_user_id.sql
--
-- Add an explicit owner_stack_user_id column to the clients table.
--
-- Context:
--   The clients table already uses owner_user_id for row-level access
--   control, and that column contains the Stack Auth user sub (payload.sub).
--   This migration adds owner_stack_user_id as a clearly-named alias column
--   so that queries, logs, and external tooling can unambiguously identify
--   which identity system owns each row.
--
--   Both columns will contain the same value going forward.
--   The application continues to write owner_user_id; owner_stack_user_id
--   is back-filled from owner_user_id and kept in sync by the app layer.
--
-- Safe to re-run (all statements are idempotent via IF NOT EXISTS / ON CONFLICT).

-- 1. Add the column (nullable so existing rows are unaffected before back-fill)
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS owner_stack_user_id TEXT;

-- 2. Back-fill from owner_user_id where it is already populated
UPDATE clients
SET owner_stack_user_id = owner_user_id
WHERE owner_stack_user_id IS NULL
  AND owner_user_id IS NOT NULL;

-- 3. Index for fast lookups by Stack user ID
CREATE INDEX IF NOT EXISTS idx_clients_owner_stack_user_id
  ON clients (owner_stack_user_id);
