-- 0049_financial_import_schema.sql
-- Additive migration: Excel import infrastructure
--
-- Creates:
--   financial_projects             — new financial project entity (separate from `projects`)
--   project_power_plants           — 1:1 with financial_projects (usina data)
--   project_financial_summaries    — 1:1 with financial_projects (KPIs)
--   financial_item_templates       — reusable financial item templates
--   project_financial_items        — planned items per project
--   financial_receivable_plans     — payment/receivable plans
--   financial_receivable_plan_items
--   financial_import_batches       — audit trail for Excel imports
--   financial_import_items         — per-row import audit
--
-- Additive changes to existing tables:
--   proposals                      — ADD COLUMN client_id (nullable FK)
--   project_financial_snapshots    — ADD COLUMNS for import traceability
--
-- New enums (all idempotent via DO $$ blocks).
-- New view: vw_financial_projects_list.
--
-- NEVER drops or destructively alters existing columns.

BEGIN;

-- ── Extensions ──────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── Enums (idempotent) ──────────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'import_status_enum') THEN
    CREATE TYPE import_status_enum AS ENUM (
      'uploaded','parsed','previewed','processing','completed',
      'completed_with_warnings','failed','cancelled'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'import_item_status_enum') THEN
    CREATE TYPE import_item_status_enum AS ENUM (
      'detected','matched','created','updated','ignored','conflict','failed'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'match_type_enum') THEN
    CREATE TYPE match_type_enum AS ENUM ('exact','probable','weak','none');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'worksheet_type_enum') THEN
    CREATE TYPE worksheet_type_enum AS ENUM (
      'sale_project','leasing_project','fixed_costs','variable_costs',
      'buyout_project','financial_adjustment','unknown'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'fp_type_enum') THEN
    CREATE TYPE fp_type_enum AS ENUM ('sale','leasing','buyout','mixed');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'fp_status_enum') THEN
    CREATE TYPE fp_status_enum AS ENUM (
      'draft','active','paused','completed','cancelled','archived'
    );
  END IF;
END $$;

-- ── Add client_id (nullable FK) to proposals if not already present ──────────
-- proposals already uses UUID PK; clients uses BIGINT PK.
ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS client_id BIGINT REFERENCES public.clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_proposals_client_id ON public.proposals (client_id);

-- ── financial_projects ───────────────────────────────────────────────────────
-- This is a new entity that lives alongside the existing `projects` table.
-- `projects` represents the operational project lifecycle from client_contracts.
-- `financial_projects` represents the financial management view (can be imported).
CREATE TABLE IF NOT EXISTS public.financial_projects (
  id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id                     BIGINT NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  proposal_id                   UUID NULL REFERENCES public.proposals(id) ON DELETE SET NULL,
  project_type                  fp_type_enum NOT NULL DEFAULT 'sale',
  status                        fp_status_enum NOT NULL DEFAULT 'draft',
  project_code                  TEXT NULL,
  title                         TEXT NOT NULL DEFAULT '',
  city                          TEXT NULL,
  state                         CHAR(2) NULL,
  start_date                    DATE NULL,
  contract_date                 DATE NULL,
  activation_date               DATE NULL,
  source_import_batch_id        UUID NULL,
  source_import_item_id         UUID NULL,
  is_generated_from_proposal    BOOLEAN NOT NULL DEFAULT FALSE,
  notes                         TEXT NULL,
  metadata                      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id            TEXT NULL,
  updated_by_user_id            TEXT NULL,
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at                    TIMESTAMPTZ NULL,
  CONSTRAINT uq_fp_proposal_id UNIQUE (proposal_id)
);

CREATE INDEX IF NOT EXISTS idx_fp_client_id     ON public.financial_projects (client_id);
CREATE INDEX IF NOT EXISTS idx_fp_status        ON public.financial_projects (status);
CREATE INDEX IF NOT EXISTS idx_fp_project_type  ON public.financial_projects (project_type);
CREATE INDEX IF NOT EXISTS idx_fp_updated_at    ON public.financial_projects (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_fp_deleted_at    ON public.financial_projects (deleted_at);
CREATE INDEX IF NOT EXISTS idx_fp_batch_id      ON public.financial_projects (source_import_batch_id);

-- ── project_power_plants (1:1 with financial_projects) ──────────────────────
CREATE TABLE IF NOT EXISTS public.project_power_plants (
  project_id                    UUID PRIMARY KEY REFERENCES public.financial_projects(id) ON DELETE CASCADE,
  client_id                     BIGINT NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  proposal_id                   UUID NULL REFERENCES public.proposals(id) ON DELETE SET NULL,
  consumo_kwh_mes               NUMERIC(14,3) NULL,
  kwh_contratado                NUMERIC(14,3) NULL,
  geracao_estimada_kwh_mes      NUMERIC(14,3) NULL,
  potencia_instalada_kwp        NUMERIC(14,3) NULL,
  potencia_modulo_wp            NUMERIC(14,3) NULL,
  quantidade_modulos            INTEGER NULL,
  modelo_modulo                 TEXT NULL,
  modelo_inversor               TEXT NULL,
  estrutura_fixacao             TEXT NULL,
  tipo_instalacao               TEXT NULL,
  irradiacao                    NUMERIC(10,4) NULL,
  performance_ratio             NUMERIC(10,4) NULL,
  area_minima_m2                NUMERIC(14,3) NULL,
  tarifa_cheia_r_kwh            NUMERIC(14,6) NULL,
  monthly_generation_formula    TEXT NULL,
  technical_payload             JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── project_financial_summaries (1:1 with financial_projects) ───────────────
CREATE TABLE IF NOT EXISTS public.project_financial_summaries (
  project_id                    UUID PRIMARY KEY REFERENCES public.financial_projects(id) ON DELETE CASCADE,
  client_id                     BIGINT NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  proposal_id                   UUID NULL REFERENCES public.proposals(id) ON DELETE SET NULL,
  capex_total                   NUMERIC(16,2) NULL,
  custo_kit                     NUMERIC(16,2) NULL,
  frete                         NUMERIC(16,2) NULL,
  engineering_cost              NUMERIC(16,2) NULL,
  installation_cost             NUMERIC(16,2) NULL,
  insurance_amount              NUMERIC(16,2) NULL,
  taxes_amount                  NUMERIC(16,2) NULL,
  commission_amount             NUMERIC(16,2) NULL,
  monthly_revenue               NUMERIC(16,2) NULL,
  expected_total_revenue        NUMERIC(16,2) NULL,
  expected_profit               NUMERIC(16,2) NULL,
  roi_percent                   NUMERIC(10,4) NULL,
  payback_months                NUMERIC(10,2) NULL,
  irr_annual                    NUMERIC(10,4) NULL,
  irr_monthly                   NUMERIC(10,4) NULL,
  npv_amount                    NUMERIC(16,2) NULL,
  default_rate_percent          NUMERIC(10,4) NULL,
  healthy_minimum_price         NUMERIC(16,2) NULL,
  summary_payload               JSONB NOT NULL DEFAULT '{}'::jsonb,
  calculated_at                 TIMESTAMPTZ NULL,
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── financial_item_templates ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.financial_item_templates (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_type          fp_type_enum NULL,
  name                  TEXT NOT NULL,
  description           TEXT NULL,
  entry_type            TEXT NOT NULL CHECK (entry_type IN ('income','expense')),
  scope_type            TEXT NOT NULL DEFAULT 'project'
                          CHECK (scope_type IN ('company','project')),
  is_recurring          BOOLEAN NOT NULL DEFAULT FALSE,
  recurrence_frequency  TEXT NULL,
  default_amount        NUMERIC(16,2) NULL,
  sort_order            INTEGER NOT NULL DEFAULT 0,
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  metadata              JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── project_financial_items ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.project_financial_items (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id            UUID NOT NULL REFERENCES public.financial_projects(id) ON DELETE CASCADE,
  client_id             BIGINT NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  proposal_id           UUID NULL REFERENCES public.proposals(id) ON DELETE SET NULL,
  template_id           UUID NULL REFERENCES public.financial_item_templates(id) ON DELETE SET NULL,
  name                  TEXT NOT NULL,
  description           TEXT NULL,
  entry_type            TEXT NOT NULL CHECK (entry_type IN ('income','expense')),
  scope_type            TEXT NOT NULL DEFAULT 'project'
                          CHECK (scope_type IN ('company','project')),
  expected_amount       NUMERIC(16,2) NULL,
  actual_amount         NUMERIC(16,2) NULL,
  is_required           BOOLEAN NOT NULL DEFAULT FALSE,
  is_recurring          BOOLEAN NOT NULL DEFAULT FALSE,
  recurrence_frequency  TEXT NULL,
  due_day               INTEGER NULL,
  start_competence      DATE NULL,
  end_competence        DATE NULL,
  notes                 TEXT NULL,
  metadata              JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pfi_project_id ON public.project_financial_items (project_id);
CREATE INDEX IF NOT EXISTS idx_pfi_client_id  ON public.project_financial_items (client_id);

-- ── financial_receivable_plans ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.financial_receivable_plans (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id              UUID NULL REFERENCES public.financial_projects(id) ON DELETE CASCADE,
  client_id               BIGINT NULL REFERENCES public.clients(id) ON DELETE SET NULL,
  proposal_id             UUID NULL REFERENCES public.proposals(id) ON DELETE SET NULL,
  title                   TEXT NOT NULL,
  plan_type               TEXT NOT NULL,
  total_amount            NUMERIC(16,2) NOT NULL,
  entry_amount            NUMERIC(16,2) NULL,
  installments            INTEGER NOT NULL DEFAULT 1,
  start_date              DATE NULL,
  interest_rate_monthly   NUMERIC(10,6) NULL,
  interest_rate_annual    NUMERIC(10,6) NULL,
  metadata                JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_frp_project_id ON public.financial_receivable_plans (project_id);
CREATE INDEX IF NOT EXISTS idx_frp_client_id  ON public.financial_receivable_plans (client_id);

-- ── financial_receivable_plan_items ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.financial_receivable_plan_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id             UUID NOT NULL REFERENCES public.financial_receivable_plans(id) ON DELETE CASCADE,
  installment_number  INTEGER NOT NULL,
  due_date            DATE NULL,
  amount              NUMERIC(16,2) NOT NULL,
  status              TEXT NOT NULL DEFAULT 'planned'
                        CHECK (status IN ('planned','due','paid','received','cancelled','overdue')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_receivable_plan_installment UNIQUE (plan_id, installment_number)
);

-- ── financial_import_batches ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.financial_import_batches (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_file_name          TEXT NOT NULL,
  source_mime_type          TEXT NULL,
  source_file_size_bytes    BIGINT NULL,
  source_file_hash          TEXT NULL,
  import_type               TEXT NOT NULL DEFAULT 'financial_management',
  status                    import_status_enum NOT NULL DEFAULT 'uploaded',
  preview_only              BOOLEAN NOT NULL DEFAULT FALSE,
  merge_mode                BOOLEAN NOT NULL DEFAULT FALSE,
  total_worksheets          INTEGER NOT NULL DEFAULT 0,
  total_detected_items      INTEGER NOT NULL DEFAULT 0,
  total_created_clients     INTEGER NOT NULL DEFAULT 0,
  total_updated_clients     INTEGER NOT NULL DEFAULT 0,
  total_created_proposals   INTEGER NOT NULL DEFAULT 0,
  total_updated_proposals   INTEGER NOT NULL DEFAULT 0,
  total_created_projects    INTEGER NOT NULL DEFAULT 0,
  total_updated_projects    INTEGER NOT NULL DEFAULT 0,
  total_created_entries     INTEGER NOT NULL DEFAULT 0,
  total_ignored_items       INTEGER NOT NULL DEFAULT 0,
  total_conflicts           INTEGER NOT NULL DEFAULT 0,
  warnings_json             JSONB NOT NULL DEFAULT '[]'::jsonb,
  summary_json              JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id        TEXT NULL,
  started_at                TIMESTAMPTZ NULL,
  completed_at              TIMESTAMPTZ NULL,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fib_status       ON public.financial_import_batches (status);
CREATE INDEX IF NOT EXISTS idx_fib_created_at   ON public.financial_import_batches (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fib_created_by   ON public.financial_import_batches (created_by_user_id);

-- ── financial_import_items ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.financial_import_items (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id                UUID NOT NULL REFERENCES public.financial_import_batches(id) ON DELETE CASCADE,
  source_sheet_name       TEXT NOT NULL,
  worksheet_type          worksheet_type_enum NOT NULL DEFAULT 'unknown',
  source_row_start        INTEGER NULL,
  source_row_end          INTEGER NULL,
  detected_client_name    TEXT NULL,
  detected_uf             TEXT NULL,
  detected_project_type   fp_type_enum NULL,
  match_type              match_type_enum NOT NULL DEFAULT 'none',
  match_confidence        NUMERIC(5,4) NOT NULL DEFAULT 0,
  linked_client_id        BIGINT NULL REFERENCES public.clients(id) ON DELETE SET NULL,
  linked_proposal_id      UUID NULL REFERENCES public.proposals(id) ON DELETE SET NULL,
  linked_project_id       UUID NULL REFERENCES public.financial_projects(id) ON DELETE SET NULL,
  created_client_id       BIGINT NULL REFERENCES public.clients(id) ON DELETE SET NULL,
  created_proposal_id     UUID NULL REFERENCES public.proposals(id) ON DELETE SET NULL,
  created_project_id      UUID NULL REFERENCES public.financial_projects(id) ON DELETE SET NULL,
  status                  import_item_status_enum NOT NULL DEFAULT 'detected',
  raw_json                JSONB NOT NULL DEFAULT '{}'::jsonb,
  normalized_json         JSONB NOT NULL DEFAULT '{}'::jsonb,
  warnings_json           JSONB NOT NULL DEFAULT '[]'::jsonb,
  errors_json             JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fii_batch_id       ON public.financial_import_items (batch_id);
CREATE INDEX IF NOT EXISTS idx_fii_status         ON public.financial_import_items (status);
CREATE INDEX IF NOT EXISTS idx_fii_linked_client  ON public.financial_import_items (linked_client_id);
CREATE INDEX IF NOT EXISTS idx_fii_linked_project ON public.financial_import_items (linked_project_id);

-- ── Additive columns on project_financial_snapshots ─────────────────────────
ALTER TABLE public.project_financial_snapshots
  ADD COLUMN IF NOT EXISTS source_import_batch_id UUID NULL,
  ADD COLUMN IF NOT EXISTS source_import_item_id  UUID NULL,
  ADD COLUMN IF NOT EXISTS snapshot_type          TEXT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS reference_date         DATE NULL;

-- ── View: vw_financial_projects_list ────────────────────────────────────────
CREATE OR REPLACE VIEW public.vw_financial_projects_list AS
SELECT
  fp.id,
  fp.project_code,
  fp.project_type,
  fp.status,
  fp.title,
  fp.client_id,
  c.name         AS client_name,
  fp.city,
  fp.state,
  fp.proposal_id,
  p.proposal_code,
  p.status       AS proposal_status,
  fp.start_date,
  fp.contract_date,
  fp.activation_date,
  fp.source_import_batch_id,
  fp.updated_at
FROM public.financial_projects fp
JOIN public.clients c ON c.id = fp.client_id
LEFT JOIN public.proposals p ON p.id = fp.proposal_id
WHERE fp.deleted_at IS NULL;

COMMIT;
