-- db/migrations/0022_proposals_rls.sql
--
-- Apply role-aware Row Level Security to the public.proposals table.
--
-- Role matrix:
--   role_admin      : read/write all rows (unrestricted)
--   role_financeiro : read all rows, write none
--   role_office     : read all rows, write only rows they created (owner_user_id = current_user_id)
--   role_comercial  : read/write only rows they created (owner_user_id = current_user_id)
--
-- The owner identity column is owner_user_id, which is set to the Stack Auth
-- user ID of the user who created the proposal.
--
-- Helper functions used:
--   app.can_access_owner(text) → true if the current role can read a row with
--                                 the given owner_user_id (defined in 0018/0019)
--   app.can_write_owner(text)  → true if the current role can write a row with
--                                 the given owner_user_id (defined in 0018/0019)
--
-- Service bypass path:
--   The Neon connection role (neondb_owner) has the BYPASSRLS attribute and
--   automatically bypasses all RLS policies.  Internal service queries that use
--   db.sql directly (audit log, migrations) therefore see all rows without
--   needing an explicit bypass clause in the policies.
--
-- Safe to re-run:
--   - ALTER TABLE ... ENABLE/FORCE ROW LEVEL SECURITY is idempotent
--   - DROP POLICY IF EXISTS before CREATE POLICY
--
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposals FORCE ROW LEVEL SECURITY;

-- Drop any pre-existing policies so this migration is idempotent.
DROP POLICY IF EXISTS proposals_select_policy ON public.proposals;
DROP POLICY IF EXISTS proposals_insert_policy ON public.proposals;
DROP POLICY IF EXISTS proposals_update_policy ON public.proposals;
DROP POLICY IF EXISTS proposals_delete_policy ON public.proposals;
DROP POLICY IF EXISTS proposals_rls_policy    ON public.proposals;
DROP POLICY IF EXISTS proposals_rls           ON public.proposals;
DROP POLICY IF EXISTS proposals_all_policy    ON public.proposals;

-- ── SELECT ────────────────────────────────────────────────────────────────────
-- role_admin / role_financeiro / role_office → all rows
-- role_comercial → only rows where owner_user_id = current user
-- no context (NULL role/uid) → denied (fail-closed for user-issued queries;
--   service queries bypass via BYPASSRLS on the connection role)

CREATE POLICY proposals_select_policy
ON public.proposals
FOR SELECT
USING (
  app.can_access_owner(owner_user_id)
);

-- ── INSERT ────────────────────────────────────────────────────────────────────
-- role_admin  → any row
-- role_office / role_comercial → only rows they own (owner_user_id = current user)
-- role_financeiro → no inserts (can_write_owner returns false)

CREATE POLICY proposals_insert_policy
ON public.proposals
FOR INSERT
WITH CHECK (
  app.can_write_owner(owner_user_id)
);

-- ── UPDATE ────────────────────────────────────────────────────────────────────
-- USING selects which existing rows can be targeted.
-- WITH CHECK validates the new row state after the update.

CREATE POLICY proposals_update_policy
ON public.proposals
FOR UPDATE
USING (
  app.can_access_owner(owner_user_id)
)
WITH CHECK (
  app.can_write_owner(owner_user_id)
);

-- ── DELETE ────────────────────────────────────────────────────────────────────
-- role_admin  → any row
-- role_office / role_comercial → only rows they own
-- role_financeiro → no deletes

CREATE POLICY proposals_delete_policy
ON public.proposals
FOR DELETE
USING (
  app.can_write_owner(owner_user_id)
);

COMMIT;
