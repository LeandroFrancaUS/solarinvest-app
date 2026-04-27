-- 0059_project_monthly_charges.sql
-- Creates the project_monthly_charges table for tracking planned and actual
-- monthly billing installments per project.
--
-- Business rules at the schema level:
--   • Exactly one installment per project per installment number → UNIQUE (project_id, installment_num)
--   • status ∈ ('prevista','emitida','paga','vencida','cancelada')
--
-- This migration is 100% additive:
--   • Does NOT alter existing tables (clients, projects, client_invoices,
--     financial_receivable_plan_items, client_billing_profile, etc.)
--   • Does NOT touch mensalidadeEngine, monthlyEngine or billingDates.
--
-- RLS follows the same pattern as projects (0045): access is controlled by
-- joining through projects → clients and checking app.can_access_owner /
-- app.can_write_owner on clients.owner_user_id.

BEGIN;

-- ────────────────────────────────────────────────────────────────────────────
-- 1) project_monthly_charges
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.project_monthly_charges (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       UUID        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  client_id        BIGINT      REFERENCES public.clients(id) ON DELETE CASCADE,

  installment_num  INTEGER     NOT NULL,
  reference_month  DATE        NOT NULL,
  due_date         DATE        NOT NULL,

  valor_previsto   NUMERIC(14,2) NOT NULL DEFAULT 0,
  valor_cobrado    NUMERIC(14,2) NOT NULL DEFAULT 0,
  valor_pago       NUMERIC(14,2) NOT NULL DEFAULT 0,

  status           TEXT        NOT NULL,

  paid_at          TIMESTAMPTZ,
  receipt_number   TEXT,
  confirmed_by     TEXT,
  notes            TEXT,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT project_monthly_charges_status_check
    CHECK (status IN ('prevista','emitida','paga','vencida','cancelada'))
);

-- ────────────────────────────────────────────────────────────────────────────
-- 2) Indexes
-- ────────────────────────────────────────────────────────────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS project_monthly_charges_project_installment_uniq
  ON public.project_monthly_charges (project_id, installment_num);

CREATE INDEX IF NOT EXISTS project_monthly_charges_project_id_idx
  ON public.project_monthly_charges (project_id);

CREATE INDEX IF NOT EXISTS project_monthly_charges_client_id_idx
  ON public.project_monthly_charges (client_id);

CREATE INDEX IF NOT EXISTS project_monthly_charges_status_idx
  ON public.project_monthly_charges (status);

CREATE INDEX IF NOT EXISTS project_monthly_charges_due_date_idx
  ON public.project_monthly_charges (due_date);

CREATE INDEX IF NOT EXISTS project_monthly_charges_reference_month_idx
  ON public.project_monthly_charges (reference_month);

-- ────────────────────────────────────────────────────────────────────────────
-- 3) updated_at trigger
-- ────────────────────────────────────────────────────────────────────────────
-- set_updated_at_now() was created in migration 0045 — reuse it.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'project_monthly_charges_set_updated_at'
  ) THEN
    CREATE TRIGGER project_monthly_charges_set_updated_at
      BEFORE UPDATE ON public.project_monthly_charges
      FOR EACH ROW
      EXECUTE FUNCTION public.set_updated_at_now();
  END IF;
END
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 4) Comments
-- ────────────────────────────────────────────────────────────────────────────

COMMENT ON TABLE public.project_monthly_charges IS
  'Monthly billing installments for a project. Tracks planned, issued, and paid amounts per installment.';
COMMENT ON COLUMN public.project_monthly_charges.installment_num IS
  'Sequential installment number within the project (1-based).';
COMMENT ON COLUMN public.project_monthly_charges.reference_month IS
  'Competence month in YYYY-MM-01 format.';
COMMENT ON COLUMN public.project_monthly_charges.due_date IS
  'Due date for this installment.';
COMMENT ON COLUMN public.project_monthly_charges.valor_previsto IS
  'Amount calculated by the billing engine (mensalidadeEngine / monthlyEngine).';
COMMENT ON COLUMN public.project_monthly_charges.valor_cobrado IS
  'Amount actually billed/issued.';
COMMENT ON COLUMN public.project_monthly_charges.valor_pago IS
  'Amount confirmed as paid.';
COMMENT ON COLUMN public.project_monthly_charges.status IS
  'prevista | emitida | paga | vencida | cancelada';
COMMENT ON COLUMN public.project_monthly_charges.confirmed_by IS
  'User identifier (text) who confirmed the payment.';

-- ────────────────────────────────────────────────────────────────────────────
-- 5) RLS — piggybacked on projects → clients
--    app.can_access_owner / app.can_write_owner already exist (migration 0018/0019).
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.project_monthly_charges ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- SELECT ──────────────────────────────────────────────────────────────────
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'project_monthly_charges'
      AND policyname = 'project_monthly_charges_select'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY project_monthly_charges_select
        ON public.project_monthly_charges FOR SELECT
        USING (
          EXISTS (
            SELECT 1
            FROM   public.projects  p
            JOIN   public.clients   c ON c.id = p.client_id
            WHERE  p.id = project_monthly_charges.project_id
              AND  c.deleted_at IS NULL
              AND  app.can_access_owner(c.owner_user_id)
          )
        )
    $policy$;
  END IF;

  -- INSERT ──────────────────────────────────────────────────────────────────
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'project_monthly_charges'
      AND policyname = 'project_monthly_charges_insert'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY project_monthly_charges_insert
        ON public.project_monthly_charges FOR INSERT
        WITH CHECK (
          EXISTS (
            SELECT 1
            FROM   public.projects  p
            JOIN   public.clients   c ON c.id = p.client_id
            WHERE  p.id = project_monthly_charges.project_id
              AND  c.deleted_at IS NULL
              AND  app.can_write_owner(c.owner_user_id)
          )
        )
    $policy$;
  END IF;

  -- UPDATE ──────────────────────────────────────────────────────────────────
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'project_monthly_charges'
      AND policyname = 'project_monthly_charges_update'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY project_monthly_charges_update
        ON public.project_monthly_charges FOR UPDATE
        USING (
          EXISTS (
            SELECT 1
            FROM   public.projects  p
            JOIN   public.clients   c ON c.id = p.client_id
            WHERE  p.id = project_monthly_charges.project_id
              AND  c.deleted_at IS NULL
              AND  app.can_write_owner(c.owner_user_id)
          )
        )
    $policy$;
  END IF;

  -- DELETE ──────────────────────────────────────────────────────────────────
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'project_monthly_charges'
      AND policyname = 'project_monthly_charges_delete'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY project_monthly_charges_delete
        ON public.project_monthly_charges FOR DELETE
        USING (
          EXISTS (
            SELECT 1
            FROM   public.projects  p
            JOIN   public.clients   c ON c.id = p.client_id
            WHERE  p.id = project_monthly_charges.project_id
              AND  c.deleted_at IS NULL
              AND  app.can_write_owner(c.owner_user_id)
          )
        )
    $policy$;
  END IF;
END
$$;

COMMIT;
