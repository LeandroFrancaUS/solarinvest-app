-- 0045_projects.sql
-- Creates the "Projeto" operational entity that links a plan (client_contracts
-- row) to a financial project managed under Gestão Financeira > Projetos.
--
-- Business rules implemented at the schema level:
--   • Exactly one project per plan         → UNIQUE (plan_id)
--   • Exactly one project per contract     → UNIQUE (contract_id) WHERE deleted_at IS NULL
--   • project_type                         ∈ ('leasing','venda')
--   • status                               ∈ ('Aguardando','Em andamento','Concluído')
--
-- This migration is purely additive: it does NOT alter existing tables.
-- Read-only access for portfolio-enabled roles, piggy-backed on clients RLS.

BEGIN;

-- ────────────────────────────────────────────────────────────────────────────
-- 1) projects
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.projects (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  client_id                 BIGINT NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,

  -- Stable string identifier for the plan that originated this project.
  -- For the legacy model a plan is one row in client_contracts, so plan_id
  -- is derived as the contract_id serialised to text. Kept as TEXT to stay
  -- future-proof for a dedicated "plans" table.
  plan_id                   TEXT NOT NULL,

  -- Optional link to the concrete contract row. When provided, it is used
  -- for the canonical dedup index (a contract can never originate two
  -- active projects).
  contract_id               BIGINT REFERENCES public.client_contracts(id) ON DELETE SET NULL,

  -- Optional originating proposal UUID (proposals may be text-id based,
  -- hence no FK — mirrors client_contracts.source_proposal_id).
  proposal_id               UUID,

  project_type              TEXT NOT NULL,
  status                    TEXT NOT NULL DEFAULT 'Aguardando',

  -- Snapshots for listing/performance (kept in sync on upsert).
  client_name_snapshot      TEXT,
  cpf_cnpj_snapshot         TEXT,
  city_snapshot             TEXT,
  state_snapshot            TEXT,

  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_user_id        TEXT,
  updated_by_user_id        TEXT,
  deleted_at                TIMESTAMPTZ,

  CONSTRAINT projects_project_type_check
    CHECK (project_type IN ('leasing','venda')),
  CONSTRAINT projects_status_check
    CHECK (status IN ('Aguardando','Em andamento','Concluído'))
);

-- Exactly one project per plan (stable requirement from the spec).
CREATE UNIQUE INDEX IF NOT EXISTS projects_plan_id_unique_idx
  ON public.projects (plan_id)
  WHERE deleted_at IS NULL;

-- One active project per contract (belt-and-suspenders — since plan_id is
-- derived from contract_id in the current model, these are equivalent).
CREATE UNIQUE INDEX IF NOT EXISTS projects_contract_id_unique_idx
  ON public.projects (contract_id)
  WHERE contract_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS projects_client_id_idx
  ON public.projects (client_id);
CREATE INDEX IF NOT EXISTS projects_status_idx
  ON public.projects (status);
CREATE INDEX IF NOT EXISTS projects_project_type_idx
  ON public.projects (project_type);
CREATE INDEX IF NOT EXISTS projects_updated_at_idx
  ON public.projects (updated_at DESC);
CREATE INDEX IF NOT EXISTS projects_deleted_at_idx
  ON public.projects (deleted_at);

COMMENT ON TABLE public.projects IS
  'Operational project created when a plan is effectivated. 1:1 with plans.';
COMMENT ON COLUMN public.projects.plan_id IS
  'Stable TEXT identifier of the originating plan. Currently derived from client_contracts.id.';
COMMENT ON COLUMN public.projects.project_type IS
  '"leasing" ou "venda" — mapeado a partir do contract_type do plano.';
COMMENT ON COLUMN public.projects.status IS
  'Aguardando | Em andamento | Concluído — único conjunto aceito.';

-- ────────────────────────────────────────────────────────────────────────────
-- 2) project_pv_data — dados técnicos da Usina Fotovoltaica (1-1 com project)
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.project_pv_data (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id                  UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,

  consumo_kwh_mes             NUMERIC(12,2),
  potencia_modulo_wp          NUMERIC(10,2),
  numero_modulos              INTEGER,
  tipo_rede                   TEXT,
  potencia_sistema_kwp        NUMERIC(10,3),
  geracao_estimada_kwh_mes    NUMERIC(12,2),
  area_utilizada_m2           NUMERIC(10,2),
  modelo_modulo               TEXT,
  modelo_inversor             TEXT,

  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT project_pv_data_project_id_unique UNIQUE (project_id)
);

CREATE INDEX IF NOT EXISTS project_pv_data_project_id_idx
  ON public.project_pv_data (project_id);

COMMENT ON TABLE public.project_pv_data IS
  'Dados técnicos da usina fotovoltaica do projeto. Espelhados em Carteira de Clientes.';

-- ────────────────────────────────────────────────────────────────────────────
-- 3) project_financial_link — vínculo com registros financeiros existentes
--    (project_financial_snapshots já implementa o motor financeiro; este
--    vínculo evita duplicar fórmulas.)
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.project_financial_link (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id                  UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  snapshot_id                 UUID REFERENCES public.project_financial_snapshots(id) ON DELETE SET NULL,
  energy_profile_id           BIGINT REFERENCES public.client_energy_profile(id) ON DELETE SET NULL,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT project_financial_link_project_id_unique UNIQUE (project_id)
);

CREATE INDEX IF NOT EXISTS project_financial_link_snapshot_idx
  ON public.project_financial_link (snapshot_id);
CREATE INDEX IF NOT EXISTS project_financial_link_energy_profile_idx
  ON public.project_financial_link (energy_profile_id);

COMMENT ON TABLE public.project_financial_link IS
  'Liga o projeto ao snapshot/engine financeiro já existente sem duplicar fórmulas.';

-- ────────────────────────────────────────────────────────────────────────────
-- 4) updated_at triggers
-- ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at_now()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'projects_set_updated_at'
  ) THEN
    CREATE TRIGGER projects_set_updated_at
      BEFORE UPDATE ON public.projects
      FOR EACH ROW
      EXECUTE FUNCTION public.set_updated_at_now();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'project_pv_data_set_updated_at'
  ) THEN
    CREATE TRIGGER project_pv_data_set_updated_at
      BEFORE UPDATE ON public.project_pv_data
      FOR EACH ROW
      EXECUTE FUNCTION public.set_updated_at_now();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'project_financial_link_set_updated_at'
  ) THEN
    CREATE TRIGGER project_financial_link_set_updated_at
      BEFORE UPDATE ON public.project_financial_link
      FOR EACH ROW
      EXECUTE FUNCTION public.set_updated_at_now();
  END IF;
END
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 5) RLS — piggy-back on clients (admin|office|financeiro podem ler; escrita
--    restrita a admin|office — igual ao resto da Carteira de Clientes).
--    app.can_access_portfolio()  already exists (migration 0029).
--    app.can_access_owner / app.can_write_owner also exist (0025).
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.projects              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_pv_data       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_financial_link ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- projects ────────────────────────────────────────────────────────────────
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'projects' AND policyname = 'projects_select'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY projects_select ON public.projects FOR SELECT
        USING (
          EXISTS (
            SELECT 1 FROM public.clients c
            WHERE c.id = projects.client_id
              AND c.deleted_at IS NULL
              AND app.can_access_owner(c.owner_user_id)
          )
        )
    $policy$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'projects' AND policyname = 'projects_insert'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY projects_insert ON public.projects FOR INSERT
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM public.clients c
            WHERE c.id = projects.client_id
              AND c.deleted_at IS NULL
              AND app.can_write_owner(c.owner_user_id)
          )
        )
    $policy$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'projects' AND policyname = 'projects_update'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY projects_update ON public.projects FOR UPDATE
        USING (
          EXISTS (
            SELECT 1 FROM public.clients c
            WHERE c.id = projects.client_id
              AND c.deleted_at IS NULL
              AND app.can_write_owner(c.owner_user_id)
          )
        )
    $policy$;
  END IF;

  -- project_pv_data ────────────────────────────────────────────────────────
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'project_pv_data' AND policyname = 'project_pv_data_select'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY project_pv_data_select ON public.project_pv_data FOR SELECT
        USING (
          EXISTS (
            SELECT 1 FROM public.projects p
            JOIN public.clients c ON c.id = p.client_id
            WHERE p.id = project_pv_data.project_id
              AND c.deleted_at IS NULL
              AND app.can_access_owner(c.owner_user_id)
          )
        )
    $policy$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'project_pv_data' AND policyname = 'project_pv_data_insert'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY project_pv_data_insert ON public.project_pv_data FOR INSERT
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM public.projects p
            JOIN public.clients c ON c.id = p.client_id
            WHERE p.id = project_pv_data.project_id
              AND c.deleted_at IS NULL
              AND app.can_write_owner(c.owner_user_id)
          )
        )
    $policy$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'project_pv_data' AND policyname = 'project_pv_data_update'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY project_pv_data_update ON public.project_pv_data FOR UPDATE
        USING (
          EXISTS (
            SELECT 1 FROM public.projects p
            JOIN public.clients c ON c.id = p.client_id
            WHERE p.id = project_pv_data.project_id
              AND c.deleted_at IS NULL
              AND app.can_write_owner(c.owner_user_id)
          )
        )
    $policy$;
  END IF;

  -- project_financial_link ─────────────────────────────────────────────────
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'project_financial_link' AND policyname = 'project_financial_link_select'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY project_financial_link_select ON public.project_financial_link FOR SELECT
        USING (
          EXISTS (
            SELECT 1 FROM public.projects p
            JOIN public.clients c ON c.id = p.client_id
            WHERE p.id = project_financial_link.project_id
              AND c.deleted_at IS NULL
              AND app.can_access_owner(c.owner_user_id)
          )
        )
    $policy$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'project_financial_link' AND policyname = 'project_financial_link_insert'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY project_financial_link_insert ON public.project_financial_link FOR INSERT
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM public.projects p
            JOIN public.clients c ON c.id = p.client_id
            WHERE p.id = project_financial_link.project_id
              AND c.deleted_at IS NULL
              AND app.can_write_owner(c.owner_user_id)
          )
        )
    $policy$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'project_financial_link' AND policyname = 'project_financial_link_update'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY project_financial_link_update ON public.project_financial_link FOR UPDATE
        USING (
          EXISTS (
            SELECT 1 FROM public.projects p
            JOIN public.clients c ON c.id = p.client_id
            WHERE p.id = project_financial_link.project_id
              AND c.deleted_at IS NULL
              AND app.can_write_owner(c.owner_user_id)
          )
        )
    $policy$;
  END IF;
END
$$;

COMMIT;
