-- Migration: 0062_operations_domain.sql
-- Implements the Operação domain (post-contract operational management).
--
-- Tables created:
--   service_tickets    — support / service tickets
--   maintenance_jobs   — preventive and corrective maintenance records
--   cleaning_jobs      — panel-cleaning schedule / history
--   insurance_policies — insurance policies per installation
--   operation_events   — unified calendar / agenda for all operation entities
--
-- Strategy:
--   - Additive only: CREATE TABLE IF NOT EXISTS; never drops or renames anything.
--   - All new columns are optional where possible; required columns only for
--     business-critical identifiers (client_id, title, starts_at).
--   - RLS follows the same pattern as project_monthly_charges (0059):
--     access is controlled by checking app.can_access_owner /
--     app.can_write_owner on clients.owner_user_id through the client_id FK.
--   - All policies are guarded by IF NOT EXISTS to be idempotent.
--   - project_id is nullable — operations can be client-level without a project.
--
-- Safe to re-run.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) service_tickets
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.service_tickets (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id           BIGINT      NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  project_id          UUID        REFERENCES public.projects(id) ON DELETE SET NULL,
  ticket_type         TEXT,
  priority            TEXT        CHECK (priority IN ('baixa','media','alta','urgente')),
  status              TEXT        CHECK (status  IN ('aberto','em_andamento','aguardando_cliente','resolvido','cancelado')),
  title               TEXT        NOT NULL,
  description         TEXT,
  responsible_user_id TEXT,
  scheduled_at        TIMESTAMPTZ,
  resolved_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS service_tickets_client_id_idx  ON public.service_tickets(client_id);
CREATE INDEX IF NOT EXISTS service_tickets_project_id_idx ON public.service_tickets(project_id);
CREATE INDEX IF NOT EXISTS service_tickets_status_idx     ON public.service_tickets(status);
CREATE INDEX IF NOT EXISTS service_tickets_scheduled_at_idx ON public.service_tickets(scheduled_at);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) maintenance_jobs
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.maintenance_jobs (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id           BIGINT      NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  project_id          UUID        REFERENCES public.projects(id) ON DELETE SET NULL,
  maintenance_type    TEXT        CHECK (maintenance_type IN ('preventiva','corretiva')),
  status              TEXT        CHECK (status IN ('planejada','agendada','realizada','cancelada')),
  scheduled_date      DATE,
  completed_date      DATE,
  technician_name     TEXT,
  report              TEXT,
  cost                NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS maintenance_jobs_client_id_idx      ON public.maintenance_jobs(client_id);
CREATE INDEX IF NOT EXISTS maintenance_jobs_project_id_idx     ON public.maintenance_jobs(project_id);
CREATE INDEX IF NOT EXISTS maintenance_jobs_status_idx         ON public.maintenance_jobs(status);
CREATE INDEX IF NOT EXISTS maintenance_jobs_scheduled_date_idx ON public.maintenance_jobs(scheduled_date);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) cleaning_jobs
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.cleaning_jobs (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id           BIGINT      NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  project_id          UUID        REFERENCES public.projects(id) ON DELETE SET NULL,
  periodicity         TEXT,
  status              TEXT        CHECK (status IN ('planejada','agendada','realizada','cancelada')),
  scheduled_date      DATE,
  completed_date      DATE,
  responsible_name    TEXT,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cleaning_jobs_client_id_idx      ON public.cleaning_jobs(client_id);
CREATE INDEX IF NOT EXISTS cleaning_jobs_project_id_idx     ON public.cleaning_jobs(project_id);
CREATE INDEX IF NOT EXISTS cleaning_jobs_status_idx         ON public.cleaning_jobs(status);
CREATE INDEX IF NOT EXISTS cleaning_jobs_scheduled_date_idx ON public.cleaning_jobs(scheduled_date);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4) insurance_policies
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.insurance_policies (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id           BIGINT        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  project_id          UUID          REFERENCES public.projects(id) ON DELETE SET NULL,
  insurer             TEXT,
  policy_number       TEXT,
  coverage            TEXT,
  deductible          NUMERIC(14,2),
  start_date          DATE,
  end_date            DATE,
  status              TEXT          CHECK (status IN ('ativa','vencida','cancelada','pendente')),
  notes               TEXT,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS insurance_policies_client_id_idx  ON public.insurance_policies(client_id);
CREATE INDEX IF NOT EXISTS insurance_policies_project_id_idx ON public.insurance_policies(project_id);
CREATE INDEX IF NOT EXISTS insurance_policies_status_idx     ON public.insurance_policies(status);
CREATE INDEX IF NOT EXISTS insurance_policies_end_date_idx   ON public.insurance_policies(end_date);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5) operation_events (agenda / calendar)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.operation_events (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id           BIGINT      REFERENCES public.clients(id) ON DELETE CASCADE,
  project_id          UUID        REFERENCES public.projects(id) ON DELETE SET NULL,
  source_type         TEXT        CHECK (source_type IN ('ticket','maintenance','cleaning','insurance','manual')),
  source_id           UUID,
  title               TEXT        NOT NULL,
  event_type          TEXT,
  starts_at           TIMESTAMPTZ NOT NULL,
  ends_at             TIMESTAMPTZ,
  status              TEXT        CHECK (status IN ('agendado','concluido','cancelado')),
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS operation_events_client_id_idx  ON public.operation_events(client_id);
CREATE INDEX IF NOT EXISTS operation_events_project_id_idx ON public.operation_events(project_id);
CREATE INDEX IF NOT EXISTS operation_events_status_idx     ON public.operation_events(status);
CREATE INDEX IF NOT EXISTS operation_events_starts_at_idx  ON public.operation_events(starts_at);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6) RLS — all five tables
--    Policies join through clients and check app.can_access_owner /
--    app.can_write_owner on clients.owner_user_id (same pattern as 0059).
--    operation_events has a nullable client_id; rows without a client_id are
--    accessible to admins only (no matching client row → no owner → denied).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.service_tickets    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_jobs   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cleaning_jobs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insurance_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operation_events   ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN

  -- ── service_tickets ────────────────────────────────────────────────────────

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='service_tickets' AND policyname='service_tickets_select') THEN
    EXECUTE $p$
      CREATE POLICY service_tickets_select ON public.service_tickets FOR SELECT
        USING (EXISTS (
          SELECT 1 FROM public.clients c
          WHERE c.id = service_tickets.client_id
            AND c.deleted_at IS NULL
            AND app.can_access_owner(c.owner_user_id)
        ))
    $p$;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='service_tickets' AND policyname='service_tickets_insert') THEN
    EXECUTE $p$
      CREATE POLICY service_tickets_insert ON public.service_tickets FOR INSERT
        WITH CHECK (EXISTS (
          SELECT 1 FROM public.clients c
          WHERE c.id = service_tickets.client_id
            AND c.deleted_at IS NULL
            AND app.can_write_owner(c.owner_user_id)
        ))
    $p$;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='service_tickets' AND policyname='service_tickets_update') THEN
    EXECUTE $p$
      CREATE POLICY service_tickets_update ON public.service_tickets FOR UPDATE
        USING (EXISTS (
          SELECT 1 FROM public.clients c
          WHERE c.id = service_tickets.client_id
            AND c.deleted_at IS NULL
            AND app.can_write_owner(c.owner_user_id)
        ))
    $p$;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='service_tickets' AND policyname='service_tickets_delete') THEN
    EXECUTE $p$
      CREATE POLICY service_tickets_delete ON public.service_tickets FOR DELETE
        USING (EXISTS (
          SELECT 1 FROM public.clients c
          WHERE c.id = service_tickets.client_id
            AND c.deleted_at IS NULL
            AND app.can_write_owner(c.owner_user_id)
        ))
    $p$;
  END IF;

  -- ── maintenance_jobs ───────────────────────────────────────────────────────

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='maintenance_jobs' AND policyname='maintenance_jobs_select') THEN
    EXECUTE $p$
      CREATE POLICY maintenance_jobs_select ON public.maintenance_jobs FOR SELECT
        USING (EXISTS (
          SELECT 1 FROM public.clients c
          WHERE c.id = maintenance_jobs.client_id
            AND c.deleted_at IS NULL
            AND app.can_access_owner(c.owner_user_id)
        ))
    $p$;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='maintenance_jobs' AND policyname='maintenance_jobs_insert') THEN
    EXECUTE $p$
      CREATE POLICY maintenance_jobs_insert ON public.maintenance_jobs FOR INSERT
        WITH CHECK (EXISTS (
          SELECT 1 FROM public.clients c
          WHERE c.id = maintenance_jobs.client_id
            AND c.deleted_at IS NULL
            AND app.can_write_owner(c.owner_user_id)
        ))
    $p$;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='maintenance_jobs' AND policyname='maintenance_jobs_update') THEN
    EXECUTE $p$
      CREATE POLICY maintenance_jobs_update ON public.maintenance_jobs FOR UPDATE
        USING (EXISTS (
          SELECT 1 FROM public.clients c
          WHERE c.id = maintenance_jobs.client_id
            AND c.deleted_at IS NULL
            AND app.can_write_owner(c.owner_user_id)
        ))
    $p$;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='maintenance_jobs' AND policyname='maintenance_jobs_delete') THEN
    EXECUTE $p$
      CREATE POLICY maintenance_jobs_delete ON public.maintenance_jobs FOR DELETE
        USING (EXISTS (
          SELECT 1 FROM public.clients c
          WHERE c.id = maintenance_jobs.client_id
            AND c.deleted_at IS NULL
            AND app.can_write_owner(c.owner_user_id)
        ))
    $p$;
  END IF;

  -- ── cleaning_jobs ──────────────────────────────────────────────────────────

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='cleaning_jobs' AND policyname='cleaning_jobs_select') THEN
    EXECUTE $p$
      CREATE POLICY cleaning_jobs_select ON public.cleaning_jobs FOR SELECT
        USING (EXISTS (
          SELECT 1 FROM public.clients c
          WHERE c.id = cleaning_jobs.client_id
            AND c.deleted_at IS NULL
            AND app.can_access_owner(c.owner_user_id)
        ))
    $p$;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='cleaning_jobs' AND policyname='cleaning_jobs_insert') THEN
    EXECUTE $p$
      CREATE POLICY cleaning_jobs_insert ON public.cleaning_jobs FOR INSERT
        WITH CHECK (EXISTS (
          SELECT 1 FROM public.clients c
          WHERE c.id = cleaning_jobs.client_id
            AND c.deleted_at IS NULL
            AND app.can_write_owner(c.owner_user_id)
        ))
    $p$;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='cleaning_jobs' AND policyname='cleaning_jobs_update') THEN
    EXECUTE $p$
      CREATE POLICY cleaning_jobs_update ON public.cleaning_jobs FOR UPDATE
        USING (EXISTS (
          SELECT 1 FROM public.clients c
          WHERE c.id = cleaning_jobs.client_id
            AND c.deleted_at IS NULL
            AND app.can_write_owner(c.owner_user_id)
        ))
    $p$;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='cleaning_jobs' AND policyname='cleaning_jobs_delete') THEN
    EXECUTE $p$
      CREATE POLICY cleaning_jobs_delete ON public.cleaning_jobs FOR DELETE
        USING (EXISTS (
          SELECT 1 FROM public.clients c
          WHERE c.id = cleaning_jobs.client_id
            AND c.deleted_at IS NULL
            AND app.can_write_owner(c.owner_user_id)
        ))
    $p$;
  END IF;

  -- ── insurance_policies ─────────────────────────────────────────────────────

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='insurance_policies' AND policyname='insurance_policies_select') THEN
    EXECUTE $p$
      CREATE POLICY insurance_policies_select ON public.insurance_policies FOR SELECT
        USING (EXISTS (
          SELECT 1 FROM public.clients c
          WHERE c.id = insurance_policies.client_id
            AND c.deleted_at IS NULL
            AND app.can_access_owner(c.owner_user_id)
        ))
    $p$;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='insurance_policies' AND policyname='insurance_policies_insert') THEN
    EXECUTE $p$
      CREATE POLICY insurance_policies_insert ON public.insurance_policies FOR INSERT
        WITH CHECK (EXISTS (
          SELECT 1 FROM public.clients c
          WHERE c.id = insurance_policies.client_id
            AND c.deleted_at IS NULL
            AND app.can_write_owner(c.owner_user_id)
        ))
    $p$;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='insurance_policies' AND policyname='insurance_policies_update') THEN
    EXECUTE $p$
      CREATE POLICY insurance_policies_update ON public.insurance_policies FOR UPDATE
        USING (EXISTS (
          SELECT 1 FROM public.clients c
          WHERE c.id = insurance_policies.client_id
            AND c.deleted_at IS NULL
            AND app.can_write_owner(c.owner_user_id)
        ))
    $p$;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='insurance_policies' AND policyname='insurance_policies_delete') THEN
    EXECUTE $p$
      CREATE POLICY insurance_policies_delete ON public.insurance_policies FOR DELETE
        USING (EXISTS (
          SELECT 1 FROM public.clients c
          WHERE c.id = insurance_policies.client_id
            AND c.deleted_at IS NULL
            AND app.can_write_owner(c.owner_user_id)
        ))
    $p$;
  END IF;

  -- ── operation_events ───────────────────────────────────────────────────────

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='operation_events' AND policyname='operation_events_select') THEN
    EXECUTE $p$
      CREATE POLICY operation_events_select ON public.operation_events FOR SELECT
        USING (
          client_id IS NULL
          OR EXISTS (
            SELECT 1 FROM public.clients c
            WHERE c.id = operation_events.client_id
              AND c.deleted_at IS NULL
              AND app.can_access_owner(c.owner_user_id)
          )
        )
    $p$;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='operation_events' AND policyname='operation_events_insert') THEN
    EXECUTE $p$
      CREATE POLICY operation_events_insert ON public.operation_events FOR INSERT
        WITH CHECK (
          client_id IS NULL
          OR EXISTS (
            SELECT 1 FROM public.clients c
            WHERE c.id = operation_events.client_id
              AND c.deleted_at IS NULL
              AND app.can_write_owner(c.owner_user_id)
          )
        )
    $p$;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='operation_events' AND policyname='operation_events_update') THEN
    EXECUTE $p$
      CREATE POLICY operation_events_update ON public.operation_events FOR UPDATE
        USING (
          client_id IS NULL
          OR EXISTS (
            SELECT 1 FROM public.clients c
            WHERE c.id = operation_events.client_id
              AND c.deleted_at IS NULL
              AND app.can_write_owner(c.owner_user_id)
          )
        )
    $p$;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='operation_events' AND policyname='operation_events_delete') THEN
    EXECUTE $p$
      CREATE POLICY operation_events_delete ON public.operation_events FOR DELETE
        USING (
          client_id IS NULL
          OR EXISTS (
            SELECT 1 FROM public.clients c
            WHERE c.id = operation_events.client_id
              AND c.deleted_at IS NULL
              AND app.can_write_owner(c.owner_user_id)
          )
        )
    $p$;
  END IF;

END
$$;

COMMIT;
