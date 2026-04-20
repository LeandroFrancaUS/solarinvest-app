-- 0043_financial_management.sql
-- Creates tables for the Financial Management area:
--   financial_categories  — configurable categories for entries
--   financial_entries     — all income/expense records (company or project level)
--   project_financial_snapshots — consolidated financial snapshot per project

-- ────────────────────────────────────────────────────────────────────────────
-- financial_categories
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS financial_categories (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  type            TEXT NOT NULL CHECK (type IN ('income', 'expense', 'both')),
  scope           TEXT NOT NULL DEFAULT 'both' CHECK (scope IN ('company', 'project', 'both')),
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT financial_categories_name_type_unique UNIQUE (name, type)
);

-- Seed with default categories
INSERT INTO financial_categories (name, type, scope, sort_order) VALUES
  ('Kit',                   'expense', 'project', 10),
  ('Frete',                 'expense', 'project', 20),
  ('Descarregamento',       'expense', 'project', 30),
  ('Projeto',               'expense', 'project', 40),
  ('Instalação',            'expense', 'project', 50),
  ('Material CA',           'expense', 'project', 60),
  ('CREA / ART',            'expense', 'project', 70),
  ('Placa',                 'expense', 'project', 80),
  ('Combustível',           'expense', 'both',    90),
  ('Hotel/Pousada',         'expense', 'both',    100),
  ('Comissão',              'expense', 'both',    110),
  ('Seguro',                'expense', 'both',    120),
  ('Marketing',             'expense', 'company', 130),
  ('Software/Ferramentas',  'expense', 'company', 140),
  ('Jurídico',              'expense', 'company', 150),
  ('Administrativo',        'expense', 'company', 160),
  ('Salários e Prestadores','expense', 'company', 170),
  ('Impostos',              'expense', 'both',    180),
  ('Aluguel',               'expense', 'company', 190),
  ('Outros',                'expense', 'both',    200),
  ('Mensalidade Leasing',   'income',  'project', 10),
  ('Venda de Sistema',      'income',  'project', 20),
  ('Receita Diversa',       'income',  'both',    30)
ON CONFLICT (name, type) DO NOTHING;

-- ────────────────────────────────────────────────────────────────────────────
-- financial_entries
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS financial_entries (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_type            TEXT NOT NULL CHECK (entry_type IN ('income', 'expense')),
  scope_type            TEXT NOT NULL DEFAULT 'company' CHECK (scope_type IN ('company', 'project')),
  category              TEXT,
  subcategory           TEXT,
  description           TEXT,
  amount                NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency              TEXT NOT NULL DEFAULT 'BRL',
  competence_date       DATE,
  payment_date          DATE,
  status                TEXT NOT NULL DEFAULT 'planned'
                          CHECK (status IN ('planned', 'due', 'paid', 'received', 'cancelled')),
  is_recurring          BOOLEAN NOT NULL DEFAULT FALSE,
  recurrence_frequency  TEXT CHECK (recurrence_frequency IN ('monthly', 'quarterly', 'yearly', 'custom')),
  project_kind          TEXT CHECK (project_kind IN ('leasing', 'sale', 'buyout')),
  project_id            UUID,
  proposal_id           UUID,
  client_id             UUID,
  consultant_id         UUID,
  notes                 TEXT,
  created_by_user_id    TEXT,
  updated_by_user_id    TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at            TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS financial_entries_entry_type_idx    ON financial_entries (entry_type);
CREATE INDEX IF NOT EXISTS financial_entries_scope_type_idx    ON financial_entries (scope_type);
CREATE INDEX IF NOT EXISTS financial_entries_status_idx        ON financial_entries (status);
CREATE INDEX IF NOT EXISTS financial_entries_competence_idx    ON financial_entries (competence_date);
CREATE INDEX IF NOT EXISTS financial_entries_project_id_idx    ON financial_entries (project_id);
CREATE INDEX IF NOT EXISTS financial_entries_proposal_id_idx   ON financial_entries (proposal_id);
CREATE INDEX IF NOT EXISTS financial_entries_client_id_idx     ON financial_entries (client_id);
CREATE INDEX IF NOT EXISTS financial_entries_deleted_at_idx    ON financial_entries (deleted_at);

-- ────────────────────────────────────────────────────────────────────────────
-- project_financial_snapshots
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS project_financial_snapshots (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_kind                TEXT NOT NULL CHECK (project_kind IN ('leasing', 'sale', 'buyout')),
  proposal_id                 UUID,
  client_id                   UUID,
  project_id                  UUID,
  source_version              TEXT,
  -- Revenue / Cost
  capex_total                 NUMERIC(14,2),
  contract_value              NUMERIC(14,2),
  monthly_revenue             NUMERIC(14,2),
  projected_revenue_total     NUMERIC(14,2),
  projected_net_revenue       NUMERIC(14,2),
  projected_profit            NUMERIC(14,2),
  -- Indicators
  roi_percent                 NUMERIC(10,4),
  payback_months              NUMERIC(10,2),
  irr_annual                  NUMERIC(10,6),
  irr_monthly                 NUMERIC(10,6),
  default_rate_percent        NUMERIC(10,4),
  operational_cost_percent    NUMERIC(10,4),
  -- Costs breakdown
  commission_amount           NUMERIC(14,2),
  insurance_amount            NUMERIC(14,2),
  kit_cost                    NUMERIC(14,2),
  installation_cost           NUMERIC(14,2),
  engineering_cost            NUMERIC(14,2),
  tax_amount                  NUMERIC(14,2),
  healthy_minimum_price       NUMERIC(14,2),
  -- Raw snapshot for future migrations
  snapshot_payload_json       JSONB,
  -- Metadata
  status                      TEXT,
  uf                          TEXT,
  consultant_id               UUID,
  created_by_user_id          TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS pfs_proposal_id_idx  ON project_financial_snapshots (proposal_id);
CREATE INDEX IF NOT EXISTS pfs_client_id_idx    ON project_financial_snapshots (client_id);
CREATE INDEX IF NOT EXISTS pfs_project_kind_idx ON project_financial_snapshots (project_kind);
CREATE INDEX IF NOT EXISTS pfs_created_at_idx   ON project_financial_snapshots (created_at);
