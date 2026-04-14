// server/client-management/schema.js
//
// Lazy, idempotent schema bootstrap for client-management tables.
//
// Why this exists
// ---------------
// Migrations 0025–0028 introduce client_energy_profile and the 8
// Gestão-de-Clientes tables (client_lifecycle, client_contracts, …).
// In production the migrations may not yet have been applied via the
// CI/CD migration runner (e.g. when the branch was first deployed before
// the runner was wired up).  Rather than crashing with 500 until someone
// runs `npm run db:migrate` by hand, this module recreates the tables on
// the first request that needs them.
//
// How it works
// ------------
// ensureClientManagementSchema() is called at the top of every
// client-management handler.  A module-level flag (_ensureAttempted)
// ensures the DDL runs at most once per server process.
//
// All DDL is sent as a SINGLE PostgreSQL DO $$ block — one HTTP round trip
// to the Neon database (~200 ms).  The previous implementation used 32+
// sequential calls (~6–8 s on Vercel) which exceeded the serverless timeout.
//
// Policy notes
// ------------
// INSERT/UPDATE policies use can_access_owner() (not can_write_owner()) for
// all 8 client-management tables, applying the fix from migration 0028.
// Policies are always DROP IF EXISTS + CREATE so stale policies are replaced.

import { getDatabaseClient } from '../database/neonClient.js'

let _ensureAttempted = false

/**
 * Ensures all client-management tables exist in the database.
 * Best-effort: logs errors and resets the flag so the next request retries.
 * Never throws to callers.
 * Runs at most once per server process (module-level flag).
 */
export async function ensureClientManagementSchema() {
  if (_ensureAttempted) return
  _ensureAttempted = true
  try {
    await _applySchema()
  } catch (err) {
    console.error(
      '[client-management][schema] lazy schema creation failed; will retry on next request:',
      err?.message ?? err
    )
    _ensureAttempted = false
  }
}

// ── Single combined DO block — one HTTP round trip ────────────────────────────

const SCHEMA_DDL = `
DO $$
DECLARE
  tbl TEXT;
  mgmt_tables TEXT[] := ARRAY[
    'client_lifecycle',
    'client_contracts',
    'client_project_status',
    'client_billing_profile',
    'client_billing_installments',
    'client_notes',
    'client_reminders',
    'client_financial_snapshots'
  ];
  trigger_tables TEXT[] := ARRAY[
    'client_lifecycle',
    'client_contracts',
    'client_project_status',
    'client_billing_profile',
    'client_billing_installments',
    'client_reminders'
  ];
BEGIN

  -- ── 0025 · client_energy_profile ─────────────────────────────────────────

  CREATE TABLE IF NOT EXISTS public.client_energy_profile (
    id                  BIGSERIAL PRIMARY KEY,
    client_id           BIGINT NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    kwh_contratado      NUMERIC(12, 2),
    potencia_kwp        NUMERIC(10, 3),
    tipo_rede           TEXT,
    tarifa_atual        NUMERIC(10, 6),
    desconto_percentual NUMERIC(5, 2),
    mensalidade         NUMERIC(12, 2),
    indicacao           TEXT,
    modalidade          TEXT,
    prazo_meses         INTEGER,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT client_energy_profile_client_id_unique UNIQUE (client_id)
  );

  CREATE INDEX IF NOT EXISTS idx_client_energy_profile_client_id
    ON public.client_energy_profile (client_id);

  CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_uc_unique
    ON public.clients (uc)
    WHERE uc IS NOT NULL
      AND btrim(uc) <> ''
      AND deleted_at IS NULL
      AND merged_into_client_id IS NULL;

  -- ── 0027 · core client-management tables ─────────────────────────────────

  -- 1. client_lifecycle
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

  -- 2. client_contracts
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

  -- 3. client_project_status
  CREATE TABLE IF NOT EXISTS public.client_project_status (
    id                       BIGSERIAL PRIMARY KEY,
    client_id                BIGINT NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    project_status           TEXT NOT NULL DEFAULT 'pending'
                               CHECK (project_status IN (
                                 'pending','in_progress','completed','cancelled','on_hold'
                               )),
    installation_status      TEXT DEFAULT 'pending'
                               CHECK (installation_status IN (
                                 'pending','scheduled','in_progress','completed','failed'
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

  -- 4. client_billing_profile
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
                                   'pending','up_to_date','overdue','partially_paid','suspended'
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

  -- 5. client_billing_installments
  CREATE TABLE IF NOT EXISTS public.client_billing_installments (
    id                  BIGSERIAL PRIMARY KEY,
    client_id           BIGINT NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    contract_id         BIGINT REFERENCES public.client_contracts(id) ON DELETE SET NULL,
    installment_number  INTEGER NOT NULL,
    competence_month    TEXT,
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

  -- 6. client_notes
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

  -- 7. client_reminders
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

  -- 8. client_financial_snapshots
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

  -- ── Enable RLS on all tables ──────────────────────────────────────────────

  ALTER TABLE public.client_energy_profile          ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.client_lifecycle               ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.client_contracts               ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.client_project_status          ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.client_billing_profile         ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.client_billing_installments    ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.client_notes                   ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.client_reminders               ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.client_financial_snapshots     ENABLE ROW LEVEL SECURITY;

  -- ── client_energy_profile policies ───────────────────────────────────────
  -- Uses can_write_owner for INSERT/UPDATE (original migration 0025 intent).

  DROP POLICY IF EXISTS energy_profile_select ON public.client_energy_profile;
  CREATE POLICY energy_profile_select ON public.client_energy_profile FOR SELECT
    USING (EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = client_energy_profile.client_id
        AND c.deleted_at IS NULL
        AND app.can_access_owner(c.owner_user_id)
    ));

  DROP POLICY IF EXISTS energy_profile_insert ON public.client_energy_profile;
  CREATE POLICY energy_profile_insert ON public.client_energy_profile FOR INSERT
    WITH CHECK (EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = client_energy_profile.client_id
        AND c.deleted_at IS NULL
        AND app.can_write_owner(c.owner_user_id)
    ));

  DROP POLICY IF EXISTS energy_profile_update ON public.client_energy_profile;
  CREATE POLICY energy_profile_update ON public.client_energy_profile FOR UPDATE
    USING (EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = client_energy_profile.client_id
        AND c.deleted_at IS NULL
        AND app.can_write_owner(c.owner_user_id)
    ));

  -- ── Management table policies (0028 fix: can_access_owner for INSERT/UPDATE) ─

  FOREACH tbl IN ARRAY mgmt_tables LOOP

    -- SELECT
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I',
      tbl || '_select', tbl
    );
    EXECUTE format(
      $p$CREATE POLICY %I ON public.%I FOR SELECT
         USING (EXISTS (
           SELECT 1 FROM public.clients c
           WHERE c.id = %I.client_id
             AND c.deleted_at IS NULL
             AND app.can_access_owner(c.owner_user_id)
         ))$p$,
      tbl || '_select', tbl, tbl
    );

    -- INSERT — can_access_owner (migration 0028 fix)
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I',
      tbl || '_insert', tbl
    );
    EXECUTE format(
      $p$CREATE POLICY %I ON public.%I FOR INSERT
         WITH CHECK (EXISTS (
           SELECT 1 FROM public.clients c
           WHERE c.id = %I.client_id
             AND c.deleted_at IS NULL
             AND app.can_access_owner(c.owner_user_id)
         ))$p$,
      tbl || '_insert', tbl, tbl
    );

    -- UPDATE — can_access_owner (migration 0028 fix)
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I',
      tbl || '_update', tbl
    );
    EXECUTE format(
      $p$CREATE POLICY %I ON public.%I FOR UPDATE
         USING (EXISTS (
           SELECT 1 FROM public.clients c
           WHERE c.id = %I.client_id
             AND c.deleted_at IS NULL
             AND app.can_access_owner(c.owner_user_id)
         ))$p$,
      tbl || '_update', tbl, tbl
    );

    -- DELETE — can_write_owner (stricter; only owner/admin can hard-delete)
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I',
      tbl || '_delete', tbl
    );
    EXECUTE format(
      $p$CREATE POLICY %I ON public.%I FOR DELETE
         USING (EXISTS (
           SELECT 1 FROM public.clients c
           WHERE c.id = %I.client_id
             AND c.deleted_at IS NULL
             AND app.can_write_owner(c.owner_user_id)
         ))$p$,
      tbl || '_delete', tbl, tbl
    );

  END LOOP;

  -- ── set_updated_at trigger function ──────────────────────────────────────

  CREATE OR REPLACE FUNCTION public.set_updated_at()
  RETURNS TRIGGER LANGUAGE plpgsql AS
  $fn$
  BEGIN
    NEW.updated_at = now();
    RETURN NEW;
  END;
  $fn$;

  -- ── Triggers ─────────────────────────────────────────────────────────────

  FOREACH tbl IN ARRAY trigger_tables LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger
      WHERE tgname = 'trg_' || tbl || '_updated_at'
        AND tgrelid = ('public.' || tbl)::regclass
    ) THEN
      EXECUTE format(
        $t$CREATE TRIGGER %I
           BEFORE UPDATE ON public.%I
           FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()$t$,
        'trg_' || tbl || '_updated_at',
        tbl
      );
    END IF;
  END LOOP;

END
$$
`

async function _applySchema() {
  const db = getDatabaseClient()
  if (!db) return
  // Single HTTP round trip: the entire DDL is one DO $$ block.
  await db.sql(SCHEMA_DDL, [])
  console.log('[client-management][schema] schema bootstrap complete')
}
