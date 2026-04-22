-- 0047_project_financial_profiles.sql
-- Creates the "project_financial_profiles" table, which stores the full
-- financial profile of a project (costs, revenues, KPIs) as an editable,
-- persistent record linked to a project row.
--
-- Business rules at the schema level:
--   • Exactly one financial profile per active project → UNIQUE (project_id)
--   • contract_type ∈ ('leasing','venda')
--   • status        ∈ ('draft','active','archived')
--
-- This migration is purely additive.

BEGIN;

-- ────────────────────────────────────────────────────────────────────────────
-- 1) project_financial_profiles
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.project_financial_profiles (
  id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  project_id                    UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  client_id                     BIGINT REFERENCES public.clients(id) ON DELETE SET NULL,

  -- Contract / form variant
  contract_type                 TEXT NOT NULL DEFAULT 'leasing',

  -- Profile lifecycle
  status                        TEXT NOT NULL DEFAULT 'draft',
  snapshot_source               TEXT NOT NULL DEFAULT 'manual',

  -- ── Technical reference fields ─────────────────────────────────────────
  consumo_kwh_mes               NUMERIC(12,2),
  potencia_instalada_kwp        NUMERIC(10,3),
  geracao_estimada_kwh_mes      NUMERIC(12,2),
  prazo_contratual_meses        INTEGER,

  -- ── Cost fields (all amounts in BRL) ─────────────────────────────────
  custo_equipamentos            NUMERIC(14,2),
  custo_instalacao              NUMERIC(14,2),
  custo_engenharia              NUMERIC(14,2),
  custo_homologacao             NUMERIC(14,2),
  custo_frete_logistica         NUMERIC(14,2),
  custo_comissao                NUMERIC(14,2),
  custo_impostos                NUMERIC(14,2),
  custo_diversos                NUMERIC(14,2),
  -- Derived: sum of all costs above (stored for performance / audit)
  custo_total_projeto           NUMERIC(14,2),

  -- ── Revenue / outcome fields ──────────────────────────────────────────
  receita_esperada              NUMERIC(14,2),
  lucro_esperado                NUMERIC(14,2),
  margem_esperada_pct           NUMERIC(8,4),

  -- ── Leasing-specific fields ───────────────────────────────────────────
  mensalidade_base              NUMERIC(14,2),
  desconto_percentual           NUMERIC(8,4),
  reajuste_anual_pct            NUMERIC(8,4),
  inadimplencia_pct             NUMERIC(8,4),
  opex_pct                      NUMERIC(8,4),
  custo_seguro                  NUMERIC(14,2),
  custo_manutencao              NUMERIC(14,2),

  -- ── Venda-specific fields ─────────────────────────────────────────────
  valor_venda                   NUMERIC(14,2),
  entrada_pct                   NUMERIC(8,4),
  parcelamento_meses            INTEGER,
  custo_financeiro_pct          NUMERIC(8,4),

  -- ── Derived KPIs (stored for display; recomputed on save) ────────────
  payback_meses                 NUMERIC(10,2),
  roi_pct                       NUMERIC(10,4),
  tir_pct                       NUMERIC(10,4),
  vpl                           NUMERIC(14,2),

  -- ── Control fields ───────────────────────────────────────────────────
  notas                         TEXT,
  last_calculated_at            TIMESTAMPTZ,

  created_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_user_id            TEXT,
  updated_by_user_id            TEXT,

  CONSTRAINT pfp_contract_type_check
    CHECK (contract_type IN ('leasing','venda')),
  CONSTRAINT pfp_status_check
    CHECK (status IN ('draft','active','archived'))
);

-- One active profile per project (unique constraint — enforced at table level)
ALTER TABLE public.project_financial_profiles
  ADD CONSTRAINT pfp_project_id_unique UNIQUE (project_id);

CREATE INDEX IF NOT EXISTS pfp_client_id_idx
  ON public.project_financial_profiles (client_id);
CREATE INDEX IF NOT EXISTS pfp_contract_type_idx
  ON public.project_financial_profiles (contract_type);
CREATE INDEX IF NOT EXISTS pfp_status_idx
  ON public.project_financial_profiles (status);
CREATE INDEX IF NOT EXISTS pfp_updated_at_idx
  ON public.project_financial_profiles (updated_at DESC);

COMMENT ON TABLE public.project_financial_profiles IS
  'Persistent financial profile for a project. Stores costs, revenues and KPIs editable in Financeiro section.';
COMMENT ON COLUMN public.project_financial_profiles.contract_type IS
  '"leasing" ou "venda" — resolved from client_contracts.contract_type.';
COMMENT ON COLUMN public.project_financial_profiles.snapshot_source IS
  '"manual" | "analysis_finance" | "proposal" — where the data was initially sourced from.';

-- ────────────────────────────────────────────────────────────────────────────
-- 2) updated_at trigger
-- ────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'pfp_set_updated_at'
  ) THEN
    CREATE TRIGGER pfp_set_updated_at
      BEFORE UPDATE ON public.project_financial_profiles
      FOR EACH ROW
      EXECUTE FUNCTION public.set_updated_at_now();
  END IF;
END
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 3) RLS — same pattern as projects table (migration 0045)
--    Read:  admin | office | financeiro (can_access_owner)
--    Write: admin | office (can_write_owner)
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.project_financial_profiles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'project_financial_profiles'
      AND policyname = 'pfp_select'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY pfp_select ON public.project_financial_profiles FOR SELECT
        USING (
          EXISTS (
            SELECT 1 FROM public.projects p
            JOIN public.clients c ON c.id = p.client_id
            WHERE p.id = project_financial_profiles.project_id
              AND c.deleted_at IS NULL
              AND app.can_access_owner(c.owner_user_id)
          )
        )
    $policy$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'project_financial_profiles'
      AND policyname = 'pfp_insert'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY pfp_insert ON public.project_financial_profiles FOR INSERT
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM public.projects p
            JOIN public.clients c ON c.id = p.client_id
            WHERE p.id = project_financial_profiles.project_id
              AND c.deleted_at IS NULL
              AND app.can_write_owner(c.owner_user_id)
          )
        )
    $policy$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'project_financial_profiles'
      AND policyname = 'pfp_update'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY pfp_update ON public.project_financial_profiles FOR UPDATE
        USING (
          EXISTS (
            SELECT 1 FROM public.projects p
            JOIN public.clients c ON c.id = p.client_id
            WHERE p.id = project_financial_profiles.project_id
              AND c.deleted_at IS NULL
              AND app.can_write_owner(c.owner_user_id)
          )
        )
    $policy$;
  END IF;
END
$$;

COMMIT;
