-- db/migrations/0024_clients_fix_rls_policies.sql
--
-- Remediation migration: add the missing SELECT, INSERT, and DELETE RLS
-- policies to public.clients and enable FORCE ROW LEVEL SECURITY.
--
-- Background
-- ----------
-- Production investigation (Apr 2026) confirmed that only a single
-- `clients_update_policy` (FOR UPDATE) existed on the table.  No SELECT
-- policy was present, so any user whose connection role had the BYPASSRLS
-- attribute (e.g. neondb_owner) or whose session SET app.current_user_role
-- did not propagate correctly could read every row regardless of ownership.
--
-- This migration:
--   1. Drops and recreates ALL four per-operation policies in a single
--      transaction so the table is never left in a partially-protected state.
--   2. Enables FORCE ROW LEVEL SECURITY so that even superuser/BYPASSRLS
--      connections (including neondb_owner) are subject to policies.
--      This is safe because:
--        a) The service-bypass path (migrations, CPF dedup, audit log) uses
--           plain pg/query() which runs as the connection role BEFORE RLS
--           is evaluated — those are DDL-level statements, not HTTP requests.
--        b) The application admin path uses createUserScopedSql with
--           role_admin context, which is whitelisted by can_access_owner().
--        c) The backend bypass check in the DELETE handler uses db.sql
--           only AFTER a failed userSql attempt, which is acceptable because
--           it is a read-only existence probe, not a data-exposure path.
--           NOTE: after enabling FORCE RLS, db.sql (neondb_owner) will still
--           bypass via BYPASSRLS *only if* that attribute is set.  To make
--           the probe work under FORCE RLS without BYPASSRLS, the query
--           must set the RLS context first, or a dedicated service role must
--           be used.  This migration does not change that pattern; it is
--           addressed in the handler directly.
--
-- Role matrix (unchanged from migration 0021):
--   role_admin      : read / write all rows
--   role_financeiro : read all rows, write none
--   role_office     : read all rows, write only own rows
--   role_comercial  : read / write only own rows (owner_user_id = current_user_id)
--   no context      : denied (fail-closed)
--
-- Safe to re-run: all DDL uses IF EXISTS / CREATE OR REPLACE patterns.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── 1. Enable FORCE ROW LEVEL SECURITY ───────────────────────────────────────
-- This ensures even the neondb_owner role (BYPASSRLS) is subject to policies,
-- removing reliance on the connection role's bypass attribute for data isolation.

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients FORCE ROW LEVEL SECURITY;

-- ── 2. Drop any pre-existing policies ─────────────────────────────────────────
-- Idempotent: covers names from migrations 0021 and any ad-hoc policies.

DROP POLICY IF EXISTS clients_select_policy ON public.clients;
DROP POLICY IF EXISTS clients_insert_policy ON public.clients;
DROP POLICY IF EXISTS clients_update_policy ON public.clients;
DROP POLICY IF EXISTS clients_delete_policy ON public.clients;
DROP POLICY IF EXISTS clients_rls_policy    ON public.clients;
DROP POLICY IF EXISTS clients_rls           ON public.clients;
DROP POLICY IF EXISTS clients_all_policy    ON public.clients;

-- ── 3. SELECT ─────────────────────────────────────────────────────────────────
-- role_admin / role_financeiro / role_office → all non-deleted rows
-- role_comercial → only rows where owner_user_id = current user
-- no context (NULL role/uid) → denied (fail-closed)

CREATE POLICY clients_select_policy
ON public.clients
FOR SELECT
USING (
  app.can_access_owner(owner_user_id)
);

-- ── 4. INSERT ─────────────────────────────────────────────────────────────────
-- role_admin            → any row
-- role_office           → only rows they own (owner_user_id = current user)
-- role_comercial        → only rows they own
-- role_financeiro       → no inserts (can_write_owner returns false)

CREATE POLICY clients_insert_policy
ON public.clients
FOR INSERT
WITH CHECK (
  app.can_write_owner(owner_user_id)
);

-- ── 5. UPDATE ─────────────────────────────────────────────────────────────────
-- USING selects which existing rows can be targeted.
-- WITH CHECK validates the new row state after the update.

CREATE POLICY clients_update_policy
ON public.clients
FOR UPDATE
USING (
  app.can_access_owner(owner_user_id)
)
WITH CHECK (
  app.can_write_owner(owner_user_id)
);

-- ── 6. DELETE ─────────────────────────────────────────────────────────────────
-- role_admin                     → any row
-- role_office / role_comercial   → only own rows
-- role_financeiro                → no deletes

CREATE POLICY clients_delete_policy
ON public.clients
FOR DELETE
USING (
  app.can_write_owner(owner_user_id)
);

COMMIT;
