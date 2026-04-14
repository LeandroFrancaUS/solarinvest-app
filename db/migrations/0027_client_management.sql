-- Migration: Gestão de Clientes V2 — core tables for converted/contracted clients
--
-- Creates the following tables (all FK'd to public.clients):
--   client_lifecycle           – lifecycle / conversion status
--   client_contracts           – contract details (leasing or sale)
--   client_project_status      – installation / engineering / commissioning
--   client_billing_profile     – billing configuration
--   client_billing_installments– monthly billing records
--   client_notes               – notes and audit trail
--   client_reminders           – reminders and tasks
--   client_financial_snapshots – periodic financial snapshots (computed by backend)
--
-- RLS policies piggy-back on the existing clients table policies
-- (same can_access_owner / can_write_owner helpers introduced in migration 0018).

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. client_lifecycle
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.client_lifecycle (
  id                      BIGSERIAL PRIMARY KEY,
  client_id               BIGINT NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  lifecycle_status        TEXT NOT NULL DEFAULT 'lead'
                            CHECK (lifecycle_status IN (
                              'lead','negotiating','contracted','active',
                              'suspended','cancelled','completed'
                            )),
  is_converted_customer   BOOLEAN NOT NULL DEFAULT FALSE,
  converted_at            TIMESTAMPTZ,
  converted_from_lead_at  TIMESTAMPTZ,
  onboarding_status       TEXT DEFAULT 'pending'
                            CHECK (onboarding_status IN (
                              'pending','in_progress','completed','skipped'
                            )),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT client_lifecycle_client_id_unique UNIQUE (client_id)
);

CREATE INDEX IF NOT EXISTS idx_client_lifecycle_client_id
  ON public.client_lifecycle (client_id);
CREATE INDEX IF NOT EXISTS idx_client_lifecycle_status
  ON public.client_lifecycle (lifecycle_status)
  WHERE lifecycle_status IN ('contracted','active');

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. client_contracts
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.client_contracts (
  id                          BIGSERIAL PRIMARY KEY,
  client_id                   BIGINT NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  contract_type               TEXT NOT NULL DEFAULT 'leasing'
                                CHECK (contract_type IN ('leasing','sale')),
  contract_status             TEXT NOT NULL DEFAULT 'draft'
                                CHECK (contract_status IN (
                                  'draft','pending_signature','signed',
                                  'active','suspended','cancelled','completed'
                                )),
  contract_signed_at          TIMESTAMPTZ,
  contract_start_date         DATE,
  billing_start_date          DATE,
  expected_billing_end_date   DATE,
  contractual_term_months     INTEGER CHECK (contractual_term_months > 0),
  buyout_eligible             BOOLEAN NOT NULL DEFAULT FALSE,
  buyout_status               TEXT DEFAULT 'not_eligible'
                                CHECK (buyout_status IN (
                                  'not_eligible','eligible','requested',
                                  'negotiating','completed'
                                )),
  buyout_date                 DATE,
  buyout_amount_reference     NUMERIC(14, 2),
  notes                       TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_contracts_client_id
  ON public.client_contracts (client_id);
CREATE INDEX IF NOT EXISTS idx_client_contracts_status
  ON public.client_contracts (contract_status)
  WHERE contract_status IN ('signed','active');

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. client_project_status
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.client_project_status (
  id                       BIGSERIAL PRIMARY KEY,
  client_id                BIGINT NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  project_status           TEXT NOT NULL DEFAULT 'pending'
                             CHECK (project_status IN (
                               'pending','in_progress','completed',
                               'cancelled','on_hold'
                             )),
  installation_status      TEXT DEFAULT 'pending'
                             CHECK (installation_status IN (
                               'pending','scheduled','in_progress',
                               'completed','failed'
                             )),
  engineering_status       TEXT DEFAULT 'pending'
                             CHECK (engineering_status IN (
                               'pending','in_progress','approved','rejected'
                             )),
  homologation_status      TEXT DEFAULT 'pending'
                             CHECK (homologation_status IN (
                               'pending','submitted','approved','rejected'
                             )),
  commissioning_date       DATE,
  first_injection_date     DATE,
  first_generation_date    DATE,
  expected_go_live_date    DATE,
  integrator_name          TEXT,
  engineer_name            TEXT,
  notes                    TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT client_project_status_client_id_unique UNIQUE (client_id)
);

CREATE INDEX IF NOT EXISTS idx_client_project_status_client_id
  ON public.client_project_status (client_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. client_billing_profile
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.client_billing_profile (
  id                         BIGSERIAL PRIMARY KEY,
  client_id                  BIGINT NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  due_day                    SMALLINT CHECK (due_day BETWEEN 1 AND 31),
  reading_day                SMALLINT CHECK (reading_day BETWEEN 1 AND 31),
  first_billing_date         DATE,
  expected_last_billing_date DATE,
  recurrence_type            TEXT DEFAULT 'monthly'
                               CHECK (recurrence_type IN ('monthly','bimonthly','quarterly')),
  payment_status             TEXT DEFAULT 'pending'
                               CHECK (payment_status IN (
                                 'pending','up_to_date','overdue',
                                 'partially_paid','suspended'
                               )),
  delinquency_status         TEXT DEFAULT 'none'
                               CHECK (delinquency_status IN (
                                 'none','warning','delinquent','collection'
                               )),
  collection_stage           TEXT,
  auto_reminder_enabled      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT client_billing_profile_client_id_unique UNIQUE (client_id)
);

CREATE INDEX IF NOT EXISTS idx_client_billing_profile_client_id
  ON public.client_billing_profile (client_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. client_billing_installments
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.client_billing_installments (
  id                  BIGSERIAL PRIMARY KEY,
  client_id           BIGINT NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  contract_id         BIGINT REFERENCES public.client_contracts(id) ON DELETE SET NULL,
  installment_number  INTEGER NOT NULL,
  competence_month    TEXT,  -- 'YYYY-MM'
  due_date            DATE NOT NULL,
  amount_due          NUMERIC(14, 2) NOT NULL CHECK (amount_due >= 0),
  amount_paid         NUMERIC(14, 2) DEFAULT 0 CHECK (amount_paid >= 0),
  paid_at             TIMESTAMPTZ,
  payment_status      TEXT NOT NULL DEFAULT 'pending'
                        CHECK (payment_status IN (
                          'pending','paid','partial','overdue','cancelled'
                        )),
  payment_method      TEXT,
  late_fee_amount     NUMERIC(14, 2) DEFAULT 0,
  interest_amount     NUMERIC(14, 2) DEFAULT 0,
  discount_amount     NUMERIC(14, 2) DEFAULT 0,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_billing_installments_client_id
  ON public.client_billing_installments (client_id);
CREATE INDEX IF NOT EXISTS idx_client_billing_installments_due_date
  ON public.client_billing_installments (due_date);
CREATE INDEX IF NOT EXISTS idx_client_billing_installments_status
  ON public.client_billing_installments (payment_status)
  WHERE payment_status IN ('pending','overdue');

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. client_notes
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.client_notes (
  id                  BIGSERIAL PRIMARY KEY,
  client_id           BIGINT NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  entry_type          TEXT NOT NULL DEFAULT 'note'
                        CHECK (entry_type IN (
                          'note','call','email','visit','status_change',
                          'billing_event','contract_event','system'
                        )),
  title               TEXT,
  content             TEXT NOT NULL,
  created_by_user_id  TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_notes_client_id
  ON public.client_notes (client_id);
CREATE INDEX IF NOT EXISTS idx_client_notes_created_at
  ON public.client_notes (client_id, created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. client_reminders
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.client_reminders (
  id                   BIGSERIAL PRIMARY KEY,
  client_id            BIGINT NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  title                TEXT NOT NULL,
  reminder_type        TEXT DEFAULT 'general'
                         CHECK (reminder_type IN (
                           'general','billing','contract','visit',
                           'followup','document','system'
                         )),
  due_at               TIMESTAMPTZ NOT NULL,
  status               TEXT NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending','done','dismissed','overdue')),
  assigned_to_user_id  TEXT,
  notes                TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_reminders_client_id
  ON public.client_reminders (client_id);
CREATE INDEX IF NOT EXISTS idx_client_reminders_due_at
  ON public.client_reminders (due_at)
  WHERE status = 'pending';

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. client_financial_snapshots
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.client_financial_snapshots (
  id                          BIGSERIAL PRIMARY KEY,
  client_id                   BIGINT NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  snapshot_date               DATE NOT NULL DEFAULT CURRENT_DATE,
  projected_total_receivable  NUMERIC(16, 2),
  received_to_date            NUMERIC(16, 2),
  outstanding_balance         NUMERIC(16, 2),
  expected_future_cashflow    NUMERIC(16, 2),
  roi_reference               NUMERIC(8, 4),
  payback_reference           NUMERIC(8, 2),
  buyout_reference            NUMERIC(16, 2),
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_financial_snapshots_client_id
  ON public.client_financial_snapshots (client_id, snapshot_date DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. Enable RLS on all new tables — policies piggy-back on clients RLS
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.client_lifecycle            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_contracts            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_project_status       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_billing_profile      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_billing_installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_notes                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_reminders            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_financial_snapshots  ENABLE ROW LEVEL SECURITY;

-- Helper macro to create the standard 4 policies (SELECT/INSERT/UPDATE/DELETE)
-- for any table that has a client_id referencing public.clients.

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

    -- SELECT
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = tbl
        AND policyname = tbl || '_select'
    ) THEN
      EXECUTE format($pol$
        CREATE POLICY %I
          ON public.%I
          FOR SELECT
          USING (
            EXISTS (
              SELECT 1 FROM public.clients c
              WHERE c.id = %I.client_id
                AND c.deleted_at IS NULL
                AND app.can_access_owner(c.owner_user_id)
            )
          )
      $pol$, tbl || '_select', tbl, tbl);
    END IF;

    -- INSERT
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = tbl
        AND policyname = tbl || '_insert'
    ) THEN
      EXECUTE format($pol$
        CREATE POLICY %I
          ON public.%I
          FOR INSERT
          WITH CHECK (
            EXISTS (
              SELECT 1 FROM public.clients c
              WHERE c.id = %I.client_id
                AND c.deleted_at IS NULL
                AND app.can_write_owner(c.owner_user_id)
            )
          )
      $pol$, tbl || '_insert', tbl, tbl);
    END IF;

    -- UPDATE
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = tbl
        AND policyname = tbl || '_update'
    ) THEN
      EXECUTE format($pol$
        CREATE POLICY %I
          ON public.%I
          FOR UPDATE
          USING (
            EXISTS (
              SELECT 1 FROM public.clients c
              WHERE c.id = %I.client_id
                AND c.deleted_at IS NULL
                AND app.can_write_owner(c.owner_user_id)
            )
          )
      $pol$, tbl || '_update', tbl, tbl);
    END IF;

    -- DELETE (soft: only admin/office should hard-delete, so we allow it for now)
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = tbl
        AND policyname = tbl || '_delete'
    ) THEN
      EXECUTE format($pol$
        CREATE POLICY %I
          ON public.%I
          FOR DELETE
          USING (
            EXISTS (
              SELECT 1 FROM public.clients c
              WHERE c.id = %I.client_id
                AND c.deleted_at IS NULL
                AND app.can_write_owner(c.owner_user_id)
            )
          )
      $pol$, tbl || '_delete', tbl, tbl);
    END IF;

  END LOOP;
END
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. updated_at triggers (reuse pattern from existing tables)
-- ─────────────────────────────────────────────────────────────────────────────

-- Generic trigger function (create once, reuse)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  tbl TEXT;
  tables_with_updated_at TEXT[] := ARRAY[
    'client_lifecycle',
    'client_contracts',
    'client_project_status',
    'client_billing_profile',
    'client_billing_installments',
    'client_reminders'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables_with_updated_at LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger
      WHERE tgname = 'trg_' || tbl || '_updated_at'
        AND tgrelid = ('public.' || tbl)::regclass
    ) THEN
      EXECUTE format(
        $trig$
          CREATE TRIGGER %I
            BEFORE UPDATE ON public.%I
            FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()
        $trig$,
        'trg_' || tbl || '_updated_at',
        tbl
      );
    END IF;
  END LOOP;
END
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 11. Table comments
-- ─────────────────────────────────────────────────────────────────────────────

COMMENT ON TABLE public.client_lifecycle IS
  'Tracks lifecycle/conversion status for each client (lead → contracted → active, etc.)';
COMMENT ON TABLE public.client_contracts IS
  'Contract details for converted clients (leasing or sale modality).';
COMMENT ON TABLE public.client_project_status IS
  'Installation and engineering project status for each client.';
COMMENT ON TABLE public.client_billing_profile IS
  'Billing configuration for each client (due day, recurrence, collection status).';
COMMENT ON TABLE public.client_billing_installments IS
  'Individual monthly billing installments with payment tracking.';
COMMENT ON TABLE public.client_notes IS
  'Operational notes, call logs, and audit trail for client interactions.';
COMMENT ON TABLE public.client_reminders IS
  'Reminders and tasks associated with a client.';
COMMENT ON TABLE public.client_financial_snapshots IS
  'Periodic financial snapshots computed from engines for each client.';

COMMIT;
