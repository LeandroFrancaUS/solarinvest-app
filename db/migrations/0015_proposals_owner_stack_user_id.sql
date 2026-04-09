-- db/migrations/0015_proposals_owner_stack_user_id.sql
--
-- Add owner_stack_user_id to the proposals table so that ownership is
-- explicitly tied to a Stack Auth user sub.
--
-- Context:
--   Proposals already have owner_user_id (TEXT NOT NULL) which stores the
--   Stack Auth user sub.  This migration adds owner_stack_user_id as an
--   unambiguous alias so queries, logs, and external tooling can clearly
--   identify the identity system that owns each row.
--
--   Both columns will contain the same value going forward.
--   Existing rows are back-filled from owner_user_id.
--
-- Safe to re-run (all statements are idempotent via IF NOT EXISTS / ON CONFLICT).

-- 1. Add the column (nullable so existing rows are unaffected before back-fill)
ALTER TABLE proposals
  ADD COLUMN IF NOT EXISTS owner_stack_user_id TEXT;

-- 2. Back-fill from owner_user_id where already populated
UPDATE proposals
SET owner_stack_user_id = owner_user_id
WHERE owner_stack_user_id IS NULL
  AND owner_user_id IS NOT NULL;

-- 3. Ensure all rows have a value (owner_user_id is NOT NULL, so this is safe)
UPDATE proposals
SET owner_stack_user_id = owner_user_id
WHERE owner_stack_user_id IS NULL;

-- 4. Index for fast lookups by Stack user ID
CREATE INDEX IF NOT EXISTS idx_proposals_owner_stack_user_id
  ON proposals (owner_stack_user_id);

