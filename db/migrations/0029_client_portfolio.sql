-- Migration: 0029_client_portfolio.sql
-- Creates the lifecycle and operational tables for the "Carteira de Clientes" feature.
--
-- New tables:
--   client_lifecycle      — marks a client as exported/converted to the portfolio
--   client_contracts      — operational contract data linked to a client
--   client_project_status — project / installation progress tracking
--   client_billing_profile — recurring billing configuration
--
-- Strategy:
--   - clients table is the identity source (never duplicated)
--   - proposals table is the commercial/financial source of truth
--   - new tables only store lifecycle/operational data not present elsewhere
--
-- RLS:
--   All new tables follow the same RLS pattern as clients:
--     role_admin / role_office / role_financeiro → read all
--     role_comercial → denied (portfolio is post-conversion, not for comercial)
--   Write access:
--     role_admin  → full write
--     role_office → write
--     role_financeiro → read-only (no write via RLS)
--     role_comercial → denied
--
-- Safe to re-run (idempotent).

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) client_lifecycle
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.client_lifecycle (
  id                          BIGSERIAL PRIMARY KEY,
  client_id                   BIGINT NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  lifecycle_status            TEXT    NOT NULL DEFAULT 'lead',
  is_converted_customer       BOOLEAN NOT NULL DEFAULT false,
  exported_to_portfolio_at    TIMESTAMPTZ,
  converted_from_lead_at      TIMESTAMPTZ,
  onboarding_status           TEXT,
  is_active_portfolio_client  BOOLEAN NOT NULL DEFAULT false,
  exported_by_user_id         TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT client_lifecycle_client_id_unique UNIQUE (client_id),
  CONSTRAINT client_lifecycle_status_check CHECK (
    lifecycle_status IN ('lead','contracted','active','implementation','billing','churned','cancelled')
  )
);

CREATE INDEX IF NOT EXISTS idx_client_lifecycle_client_id
  ON public.client_lifecycle (client_id);
CREATE INDEX IF NOT EXISTS idx_client_lifecycle_is_converted
  ON public.client_lifecycle (is_converted_customer)
  WHERE is_converted_customer = true;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) client_contracts
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.client_contracts (
  id                          BIGSERIAL PRIMARY KEY,
  client_id                   BIGINT NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  source_proposal_id          TEXT,   -- UUID of originating proposal (no FK → proposals may be text IDs)
  contract_type               TEXT    NOT NULL DEFAULT 'leasing',
  contract_status             TEXT    NOT NULL DEFAULT 'draft',
  contract_signed_at          TIMESTAMPTZ,
  contract_start_date         DATE,
  billing_start_date          DATE,
  expected_billing_end_date   DATE,
  contractual_term_months     INTEGER,
  buyout_eligible             BOOLEAN NOT NULL DEFAULT false,
  buyout_status               TEXT,
  buyout_date                 DATE,
  buyout_amount_reference     NUMERIC(14,2),
  notes                       TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT client_contracts_type_check CHECK (
    contract_type IN ('leasing','sale','buyout')
  ),
  CONSTRAINT client_contracts_status_check CHECK (
    contract_status IN ('draft','active','suspended','completed','cancelled')
  )
);

CREATE INDEX IF NOT EXISTS idx_client_contracts_client_id
  ON public.client_contracts (client_id);
CREATE INDEX IF NOT EXISTS idx_client_contracts_status
  ON public.client_contracts (contract_status);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) client_project_status
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.client_project_status (
  id                          BIGSERIAL PRIMARY KEY,
  client_id                   BIGINT NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  project_status              TEXT    NOT NULL DEFAULT 'pending',
  installation_status         TEXT,
  engineering_status          TEXT,
  homologation_status         TEXT,
  commissioning_status        TEXT,
  commissioning_date          DATE,
  first_injection_date        DATE,
  first_generation_date       DATE,
  expected_go_live_date       DATE,
  integrator_name             TEXT,
  engineer_name               TEXT,
  timeline_velocity_score     NUMERIC(5,2),
  notes                       TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT client_project_status_client_id_unique UNIQUE (client_id),
  CONSTRAINT client_project_status_check CHECK (
    project_status IN ('pending','engineering','installation','homologation','commissioned','active','issue')
  )
);

CREATE INDEX IF NOT EXISTS idx_client_project_status_client_id
  ON public.client_project_status (client_id);
CREATE INDEX IF NOT EXISTS idx_client_project_status_project
  ON public.client_project_status (project_status);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4) client_billing_profile
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.client_billing_profile (
  id                          BIGSERIAL PRIMARY KEY,
  client_id                   BIGINT NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  contract_id                 BIGINT REFERENCES public.client_contracts(id) ON DELETE SET NULL,
  due_day                     INTEGER,
  reading_day                 INTEGER,
  first_billing_date          DATE,
  expected_last_billing_date  DATE,
  recurrence_type             TEXT    NOT NULL DEFAULT 'monthly',
  payment_status              TEXT    NOT NULL DEFAULT 'pending',
  delinquency_status          TEXT,
  collection_stage            TEXT,
  auto_reminder_enabled       BOOLEAN NOT NULL DEFAULT true,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT client_billing_profile_client_id_unique UNIQUE (client_id),
  CONSTRAINT client_billing_recurrence_check CHECK (
    recurrence_type IN ('monthly','quarterly','annual','custom')
  ),
  CONSTRAINT client_billing_payment_status_check CHECK (
    payment_status IN ('pending','current','overdue','written_off','cancelled')
  )
);

CREATE INDEX IF NOT EXISTS idx_client_billing_profile_client_id
  ON public.client_billing_profile (client_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5) client_notes
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.client_notes (
  id                BIGSERIAL PRIMARY KEY,
  client_id         BIGINT NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  entry_type        TEXT    NOT NULL DEFAULT 'note',
  title             TEXT,
  content           TEXT    NOT NULL,
  created_by_user_id TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT client_notes_entry_type_check CHECK (
    entry_type IN ('note','observation','alert','milestone')
  )
);

CREATE INDEX IF NOT EXISTS idx_client_notes_client_id
  ON public.client_notes (client_id);
CREATE INDEX IF NOT EXISTS idx_client_notes_created_at
  ON public.client_notes (created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6) Enable RLS on all new tables
-- ─────────────────────────────────────────────────────────────────────────────
-- Helper function: returns true for roles that can read portfolio data
-- (admin, office, financeiro — NOT comercial).
CREATE OR REPLACE FUNCTION app.can_access_portfolio()
RETURNS boolean
LANGUAGE plpgsql
STABLE
PARALLEL SAFE
AS $$
DECLARE
  v_role text;
BEGIN
  v_role := app.current_user_role();
  IF v_role IS NULL THEN RETURN false; END IF;
  RETURN v_role IN ('role_admin', 'role_office', 'role_financeiro');
END;
$$;

-- Helper function: returns true for roles that can write portfolio data
-- (admin, office — NOT financeiro or comercial).
CREATE OR REPLACE FUNCTION app.can_write_portfolio()
RETURNS boolean
LANGUAGE plpgsql
STABLE
PARALLEL SAFE
AS $$
DECLARE
  v_role text;
BEGIN
  v_role := app.current_user_role();
  IF v_role IS NULL THEN RETURN false; END IF;
  RETURN v_role IN ('role_admin', 'role_office');
END;
$$;

-- ── client_lifecycle RLS ──────────────────────────────────────────────────────
ALTER TABLE public.client_lifecycle ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lifecycle_select ON public.client_lifecycle;
DROP POLICY IF EXISTS lifecycle_insert ON public.client_lifecycle;
DROP POLICY IF EXISTS lifecycle_update ON public.client_lifecycle;
DROP POLICY IF EXISTS lifecycle_delete ON public.client_lifecycle;

CREATE POLICY lifecycle_select ON public.client_lifecycle FOR SELECT USING (app.can_access_portfolio());
CREATE POLICY lifecycle_insert ON public.client_lifecycle FOR INSERT WITH CHECK (app.can_write_portfolio());
CREATE POLICY lifecycle_update ON public.client_lifecycle FOR UPDATE USING (app.can_access_portfolio()) WITH CHECK (app.can_write_portfolio());
CREATE POLICY lifecycle_delete ON public.client_lifecycle FOR DELETE USING (app.can_write_portfolio());

-- ── client_contracts RLS ─────────────────────────────────────────────────────
ALTER TABLE public.client_contracts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS contracts_select ON public.client_contracts;
DROP POLICY IF EXISTS contracts_insert ON public.client_contracts;
DROP POLICY IF EXISTS contracts_update ON public.client_contracts;
DROP POLICY IF EXISTS contracts_delete ON public.client_contracts;

CREATE POLICY contracts_select ON public.client_contracts FOR SELECT USING (app.can_access_portfolio());
CREATE POLICY contracts_insert ON public.client_contracts FOR INSERT WITH CHECK (app.can_write_portfolio());
CREATE POLICY contracts_update ON public.client_contracts FOR UPDATE USING (app.can_access_portfolio()) WITH CHECK (app.can_write_portfolio());
CREATE POLICY contracts_delete ON public.client_contracts FOR DELETE USING (app.can_write_portfolio());

-- ── client_project_status RLS ────────────────────────────────────────────────
ALTER TABLE public.client_project_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS project_select ON public.client_project_status;
DROP POLICY IF EXISTS project_insert ON public.client_project_status;
DROP POLICY IF EXISTS project_update ON public.client_project_status;
DROP POLICY IF EXISTS project_delete ON public.client_project_status;

CREATE POLICY project_select ON public.client_project_status FOR SELECT USING (app.can_access_portfolio());
CREATE POLICY project_insert ON public.client_project_status FOR INSERT WITH CHECK (app.can_write_portfolio());
CREATE POLICY project_update ON public.client_project_status FOR UPDATE USING (app.can_access_portfolio()) WITH CHECK (app.can_write_portfolio());
CREATE POLICY project_delete ON public.client_project_status FOR DELETE USING (app.can_write_portfolio());

-- ── client_billing_profile RLS ───────────────────────────────────────────────
ALTER TABLE public.client_billing_profile ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS billing_select ON public.client_billing_profile;
DROP POLICY IF EXISTS billing_insert ON public.client_billing_profile;
DROP POLICY IF EXISTS billing_update ON public.client_billing_profile;
DROP POLICY IF EXISTS billing_delete ON public.client_billing_profile;

CREATE POLICY billing_select ON public.client_billing_profile FOR SELECT USING (app.can_access_portfolio());
CREATE POLICY billing_insert ON public.client_billing_profile FOR INSERT WITH CHECK (app.can_write_portfolio());
CREATE POLICY billing_update ON public.client_billing_profile FOR UPDATE USING (app.can_access_portfolio()) WITH CHECK (app.can_write_portfolio());
CREATE POLICY billing_delete ON public.client_billing_profile FOR DELETE USING (app.can_write_portfolio());

-- ── client_notes RLS ─────────────────────────────────────────────────────────
ALTER TABLE public.client_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notes_select ON public.client_notes;
DROP POLICY IF EXISTS notes_insert ON public.client_notes;
DROP POLICY IF EXISTS notes_update ON public.client_notes;
DROP POLICY IF EXISTS notes_delete ON public.client_notes;

CREATE POLICY notes_select ON public.client_notes FOR SELECT USING (app.can_access_portfolio());
CREATE POLICY notes_insert ON public.client_notes FOR INSERT WITH CHECK (app.can_write_portfolio());
CREATE POLICY notes_update ON public.client_notes FOR UPDATE USING (app.can_access_portfolio()) WITH CHECK (app.can_write_portfolio());
CREATE POLICY notes_delete ON public.client_notes FOR DELETE USING (app.can_write_portfolio());

-- ─────────────────────────────────────────────────────────────────────────────
-- Comments
-- ─────────────────────────────────────────────────────────────────────────────
COMMENT ON TABLE public.client_lifecycle IS 'Tracks the portfolio lifecycle state of a client. One row per client. Created when a client is exported to Carteira de Clientes.';
COMMENT ON TABLE public.client_contracts IS 'Operational contract data for portfolio clients. May have multiple contracts per client (e.g. leasing + buyout).';
COMMENT ON TABLE public.client_project_status IS 'Project and installation tracking for portfolio clients. One row per client (latest status).';
COMMENT ON TABLE public.client_billing_profile IS 'Recurring billing configuration for portfolio clients. One row per client.';
COMMENT ON TABLE public.client_notes IS 'Internal notes and observations for portfolio clients.';

COMMIT;
