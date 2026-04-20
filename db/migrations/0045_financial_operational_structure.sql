-- 0045_financial_operational_structure.sql
--
-- Evolves the Financial Management area from a simple ledger into an
-- operational per-project control mirroring the SolarInvest spreadsheet:
--
--   1. financial_item_templates           — reusable item catalog (system + user)
--   2. project_financial_items            — planned composition per project
--   3. financial_receivable_plans         — installment / monthly schedules
--   4. financial_receivable_plan_items    — individual installments
--   5. financial_entries                  — extended with planned-vs-realized fields
--
-- Notes on FK types (validated against migrations 0002, 0009, 0011, 0044):
--   • clients.id      → BIGINT  ⇒ all client_id columns are BIGINT
--   • proposals.id    → UUID    ⇒ all proposal_id columns are UUID
--   • consultants.id  → BIGINT  ⇒ all consultant_id columns are BIGINT
--
-- Idempotent: uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS.

-- ────────────────────────────────────────────────────────────────────────────
-- 1) financial_item_templates
--    Catalog of reusable items: system defaults + user-customised ones.
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS financial_item_templates (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  TEXT NOT NULL,
  normalized_name       TEXT NOT NULL,
  nature                TEXT NOT NULL CHECK (nature IN ('income', 'expense')),
  scope                 TEXT NOT NULL DEFAULT 'project'
                          CHECK (scope IN ('project', 'company', 'both')),
  project_kind          TEXT NOT NULL DEFAULT 'both'
                          CHECK (project_kind IN ('leasing', 'sale', 'buyout', 'both')),
  value_mode            TEXT NOT NULL DEFAULT 'manual'
                          CHECK (value_mode IN ('fixed', 'variable', 'formula', 'manual')),
  default_amount        NUMERIC(14,2),
  default_unit          TEXT DEFAULT 'un',
  formula_code          TEXT,
  formula_config_json   JSONB,
  category              TEXT,
  is_system             BOOLEAN NOT NULL DEFAULT FALSE,
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  can_user_edit         BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order            INTEGER NOT NULL DEFAULT 0,
  created_by_user_id    TEXT,
  updated_by_user_id    TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at            TIMESTAMPTZ,
  CONSTRAINT financial_item_templates_normalized_unique
    UNIQUE (normalized_name, nature, project_kind)
);

CREATE INDEX IF NOT EXISTS financial_item_templates_active_idx
  ON financial_item_templates (is_active);
CREATE INDEX IF NOT EXISTS financial_item_templates_scope_idx
  ON financial_item_templates (scope);
CREATE INDEX IF NOT EXISTS financial_item_templates_nature_idx
  ON financial_item_templates (nature);
CREATE INDEX IF NOT EXISTS financial_item_templates_project_kind_idx
  ON financial_item_templates (project_kind);

-- Seed system defaults (matches the catalog in the operational spec)
INSERT INTO financial_item_templates
  (name, normalized_name, nature, scope, project_kind, value_mode,
   default_amount, category, is_system, can_user_edit, sort_order)
VALUES
  -- Expense — both leasing & sale
  ('Kit',                  'kit',               'expense', 'project', 'both',    'variable', NULL, 'Kit',          TRUE, TRUE,  10),
  ('Frete',                'frete',             'expense', 'project', 'both',    'variable', NULL, 'Frete',        TRUE, TRUE,  20),
  ('Descarregamento',      'descarregamento',   'expense', 'project', 'both',    'variable', NULL, 'Descarregamento', TRUE, TRUE, 30),
  ('Projeto',              'projeto',           'expense', 'project', 'both',    'variable', NULL, 'Projeto',      TRUE, TRUE,  40),
  ('Instalação',           'instalacao',        'expense', 'project', 'both',    'variable', NULL, 'Instalação',   TRUE, TRUE,  50),
  ('Material CA',          'material_ca',       'expense', 'project', 'both',    'variable', NULL, 'Material CA',  TRUE, TRUE,  60),
  ('CREA / ART',           'crea_art',          'expense', 'project', 'both',    'fixed',    NULL, 'CREA / ART',   TRUE, TRUE,  70),
  ('Placa',                'placa',             'expense', 'project', 'both',    'fixed',    18,   'Placa',        TRUE, TRUE,  80),
  ('Combustível',          'combustivel',       'expense', 'project', 'both',    'variable', NULL, 'Combustível',  TRUE, TRUE,  90),
  ('Hotel/Pousada',        'hotel_pousada',     'expense', 'project', 'both',    'variable', NULL, 'Hotel/Pousada',TRUE, TRUE,  100),
  ('Comissão',             'comissao',          'expense', 'project', 'both',    'formula',  NULL, 'Comissão',     TRUE, TRUE,  110),
  ('Seguro',               'seguro',            'expense', 'project', 'both',    'formula',  NULL, 'Seguro',       TRUE, TRUE,  120),
  ('Impostos',             'impostos',          'expense', 'project', 'both',    'formula',  NULL, 'Impostos',     TRUE, TRUE,  130),
  ('Outros',               'outros',            'expense', 'project', 'both',    'manual',   NULL, 'Outros',       TRUE, TRUE,  900),
  -- Income — leasing
  ('Mensalidade Leasing',  'mensalidade_leasing','income', 'project', 'leasing', 'formula',  NULL, 'Mensalidade Leasing', TRUE, TRUE, 10),
  ('Buyout',               'buyout',            'income',  'project', 'leasing', 'manual',   NULL, 'Buyout',       TRUE, TRUE,  20),
  ('Reajuste',             'reajuste',          'income',  'project', 'leasing', 'manual',   NULL, 'Reajuste',     TRUE, TRUE,  30),
  -- Income — sale
  ('Venda de Sistema',     'venda_de_sistema',  'income',  'project', 'sale',    'manual',   NULL, 'Venda de Sistema', TRUE, TRUE, 10),
  ('Entrada',              'entrada',           'income',  'project', 'sale',    'manual',   NULL, 'Entrada',      TRUE, TRUE,  20),
  ('Parcela',              'parcela',           'income',  'project', 'sale',    'manual',   NULL, 'Parcela',      TRUE, TRUE,  30),
  ('Bonificação',          'bonificacao',       'income',  'project', 'sale',    'manual',   NULL, 'Bonificação',  TRUE, TRUE,  40),
  ('Ajuste Comercial',     'ajuste_comercial',  'income',  'project', 'sale',    'manual',   NULL, 'Ajuste Comercial', TRUE, TRUE, 50)
ON CONFLICT (normalized_name, nature, project_kind) DO NOTHING;

-- ────────────────────────────────────────────────────────────────────────────
-- 2) project_financial_items
--    Planned (previsto) financial composition per project / proposal.
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS project_financial_items (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id           UUID,
  client_id             BIGINT REFERENCES public.clients(id) ON DELETE SET NULL,
  project_kind          TEXT NOT NULL CHECK (project_kind IN ('leasing', 'sale', 'buyout')),
  template_id           UUID REFERENCES financial_item_templates(id) ON DELETE SET NULL,
  item_name             TEXT NOT NULL,
  item_code             TEXT,
  nature                TEXT NOT NULL CHECK (nature IN ('income', 'expense')),
  category              TEXT NOT NULL,
  subcategory           TEXT,
  value_mode            TEXT NOT NULL DEFAULT 'manual'
                          CHECK (value_mode IN ('fixed', 'variable', 'formula', 'manual')),
  expected_amount       NUMERIC(14,2),
  expected_quantity     NUMERIC(14,4),
  expected_total        NUMERIC(14,2),
  pricing_source        TEXT,
  formula_snapshot_json JSONB,
  is_required           BOOLEAN NOT NULL DEFAULT FALSE,
  is_system_generated   BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order            INTEGER NOT NULL DEFAULT 0,
  notes                 TEXT,
  created_by_user_id    TEXT,
  updated_by_user_id    TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at            TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS project_financial_items_proposal_id_idx
  ON project_financial_items (proposal_id);
CREATE INDEX IF NOT EXISTS project_financial_items_client_id_idx
  ON project_financial_items (client_id);
CREATE INDEX IF NOT EXISTS project_financial_items_project_kind_idx
  ON project_financial_items (project_kind);
CREATE INDEX IF NOT EXISTS project_financial_items_deleted_at_idx
  ON project_financial_items (deleted_at);

-- ────────────────────────────────────────────────────────────────────────────
-- 3) financial_entries — planned vs realized extension
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE financial_entries
  ADD COLUMN IF NOT EXISTS expected_amount   NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS realized_amount   NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS due_date          DATE,
  ADD COLUMN IF NOT EXISTS receipt_date      DATE,
  ADD COLUMN IF NOT EXISTS installment_number INTEGER,
  ADD COLUMN IF NOT EXISTS installment_total  INTEGER,
  ADD COLUMN IF NOT EXISTS origin_source     TEXT,
  ADD COLUMN IF NOT EXISTS project_financial_item_id UUID
                            REFERENCES project_financial_items(id) ON DELETE SET NULL;

-- Allow 'partial' as a status value (existing CHECK only allows 5 values).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'financial_entries'
      AND constraint_name = 'financial_entries_status_check'
  ) THEN
    ALTER TABLE financial_entries DROP CONSTRAINT financial_entries_status_check;
  END IF;
END $$;

ALTER TABLE financial_entries
  ADD CONSTRAINT financial_entries_status_check
  CHECK (status IN ('planned', 'due', 'paid', 'received', 'partial', 'cancelled'));

CREATE INDEX IF NOT EXISTS financial_entries_due_date_idx
  ON financial_entries (due_date);
CREATE INDEX IF NOT EXISTS financial_entries_receipt_date_idx
  ON financial_entries (receipt_date);
CREATE INDEX IF NOT EXISTS financial_entries_project_kind_idx
  ON financial_entries (project_kind);
CREATE INDEX IF NOT EXISTS financial_entries_payment_date_idx
  ON financial_entries (payment_date);
CREATE INDEX IF NOT EXISTS financial_entries_project_financial_item_id_idx
  ON financial_entries (project_financial_item_id);

-- ────────────────────────────────────────────────────────────────────────────
-- 4) financial_receivable_plans + items
--    Installment plans (e.g. monthly leasing schedule, sale installments).
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS financial_receivable_plans (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id           UUID,
  client_id             BIGINT REFERENCES public.clients(id) ON DELETE SET NULL,
  project_kind          TEXT NOT NULL CHECK (project_kind IN ('leasing', 'sale', 'buyout')),
  plan_name             TEXT NOT NULL,
  total_contract_value  NUMERIC(14,2) NOT NULL DEFAULT 0,
  installment_count     INTEGER NOT NULL DEFAULT 0,
  first_due_date        DATE,
  recurrence_type       TEXT,
  status                TEXT NOT NULL DEFAULT 'active',
  created_by_user_id    TEXT,
  updated_by_user_id    TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at            TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS financial_receivable_plans_proposal_id_idx
  ON financial_receivable_plans (proposal_id);
CREATE INDEX IF NOT EXISTS financial_receivable_plans_client_id_idx
  ON financial_receivable_plans (client_id);
CREATE INDEX IF NOT EXISTS financial_receivable_plans_project_kind_idx
  ON financial_receivable_plans (project_kind);

CREATE TABLE IF NOT EXISTS financial_receivable_plan_items (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id               UUID NOT NULL REFERENCES financial_receivable_plans(id) ON DELETE CASCADE,
  installment_number    INTEGER NOT NULL,
  expected_amount       NUMERIC(14,2) NOT NULL,
  realized_amount       NUMERIC(14,2),
  due_date              DATE,
  receipt_date          DATE,
  expected_status       TEXT,
  linked_entry_id       UUID REFERENCES financial_entries(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at            TIMESTAMPTZ,
  CONSTRAINT financial_receivable_plan_items_unique
    UNIQUE (plan_id, installment_number)
);

CREATE INDEX IF NOT EXISTS financial_receivable_plan_items_plan_idx
  ON financial_receivable_plan_items (plan_id);
CREATE INDEX IF NOT EXISTS financial_receivable_plan_items_due_date_idx
  ON financial_receivable_plan_items (due_date);
