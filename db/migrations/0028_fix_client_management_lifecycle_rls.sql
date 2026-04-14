-- Migration: Fix RLS INSERT/UPDATE policies for Gestão de Clientes tables
--
-- Problem
-- -------
-- Migration 0027 created the client_lifecycle (and all client-management)
-- tables with INSERT and UPDATE RLS policies that check:
--
--   app.can_write_owner(c.owner_user_id)
--
-- For role_office, can_write_owner() returns (owner_user_id = current_user_id),
-- which means office users can only write lifecycle records for clients THEY
-- own themselves.  This contradicts the Gestão de Clientes business rule that
-- office users should be able to manage the lifecycle of ANY client visible
-- to them (they can already read all clients via can_access_owner()).
--
-- As a result, when an office user clicks "Negócio Fechado" on a client whose
-- owner_user_id differs from their own (e.g. a client created by a comercial),
-- the INSERT into client_lifecycle is rejected by RLS with:
--   "new row violates row-level security policy for table client_lifecycle"
-- which surfaces on the frontend as: "Falha ao marcar negócio fechado:
-- Failed to update lifecycle".
--
-- Fix
-- ---
-- Replace can_write_owner with can_access_owner in the INSERT/UPDATE policies
-- for all client-management tables.  can_access_owner() returns TRUE for
-- role_admin, role_financeiro, and role_office, and owner_user_id = v_uid
-- for role_comercial — so office users can now write lifecycle data for any
-- client they can see.
--
-- Security notes:
-- * role_financeiro reaches can_access_owner() = TRUE, but the application
--   handler (handlePatchLifecycle, handlePatchContract, handlePatchProject)
--   rejects financeiro writes with HTTP 403 before the DB query is issued.
--   The RLS is defense-in-depth; the handler is the primary security gate.
-- * role_comercial is still restricted to their own clients by can_access_owner.
-- * Requires admin/office access to the Gestão de Clientes endpoints is
--   enforced by requireClientManagementAuth() in the handler layer.
--
-- Safe to re-run: all policy changes use DROP POLICY IF EXISTS before CREATE.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

DO $$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY[
    'client_lifecycle',
    'client_contracts',
    'client_project_status',
    'client_billing_profile',
    'client_billing_installments',
    'client_notes',
    'client_reminders',
    'client_financial_snapshots'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP

    -- ── DROP the old write policies ────────────────────────────────────────────
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_insert', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_update', tbl);

    -- ── INSERT — allow any user who can READ the parent client ─────────────────
    -- (can_access_owner = TRUE for admin, office, financeiro; owner-scoped for
    -- comercial)
    EXECUTE format($pol$
      CREATE POLICY %I
        ON public.%I
        FOR INSERT
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM public.clients c
            WHERE c.id = %I.client_id
              AND c.deleted_at IS NULL
              AND app.can_access_owner(c.owner_user_id)
          )
        )
    $pol$, tbl || '_insert', tbl, tbl);

    -- ── UPDATE — same read-based gate for the target row ──────────────────────
    EXECUTE format($pol$
      CREATE POLICY %I
        ON public.%I
        FOR UPDATE
        USING (
          EXISTS (
            SELECT 1 FROM public.clients c
            WHERE c.id = %I.client_id
              AND c.deleted_at IS NULL
              AND app.can_access_owner(c.owner_user_id)
          )
        )
    $pol$, tbl || '_update', tbl, tbl);

  END LOOP;
END
$$;

COMMIT;
