-- 0065_client_projects.sql
--
-- Creates the public.client_projects table to support multiple projects/usinas
-- per client in the Carteira Ativa. Each row represents one solar project
-- (leasing, venda, or buyout) linked to a client.
--
-- This is an ADDITIVE migration: no existing columns are removed, and the
-- clients table is not modified.
--
-- Phase 1: create table + indices.
-- Phase 2: backfill one primary project per existing portfolio client.

-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 1: table
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.client_projects (
  id                      BIGSERIAL PRIMARY KEY,
  client_id               BIGINT       NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  project_name            TEXT         NULL,
  project_type            TEXT         NOT NULL DEFAULT 'leasing'
                            CHECK (project_type IN ('leasing', 'venda', 'buyout')),
  uc_geradora             TEXT         NULL,
  distribuidora           TEXT         NULL,
  consumption_kwh_month   NUMERIC      NULL,
  term_months             INTEGER      NULL,
  system_kwp              NUMERIC      NULL,
  status                  TEXT         NOT NULL DEFAULT 'active',
  is_primary              BOOLEAN      NOT NULL DEFAULT FALSE,
  origin                  TEXT         NOT NULL DEFAULT 'portfolio'
                            CHECK (origin IN ('portfolio', 'contract', 'lead', 'standalone', 'migration')),
  created_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  deleted_at              TIMESTAMPTZ  NULL
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Indices
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS client_projects_client_id_idx
  ON public.client_projects (client_id);

CREATE INDEX IF NOT EXISTS client_projects_active_idx
  ON public.client_projects (client_id, deleted_at);

-- Partial unique index: one project per UC per client (when UC is set and row is active)
CREATE UNIQUE INDEX IF NOT EXISTS client_projects_uc_unique_idx
  ON public.client_projects (client_id, uc_geradora)
  WHERE deleted_at IS NULL AND uc_geradora IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- updated_at trigger
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_client_projects_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_client_projects_updated_at ON public.client_projects;

CREATE TRIGGER trg_client_projects_updated_at
  BEFORE UPDATE ON public.client_projects
  FOR EACH ROW EXECUTE FUNCTION public.set_client_projects_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 2: backfill — create one primary project per existing portfolio client
-- that does not yet have any project row. Data is sourced from clients and
-- their most-recent contract (for project_type).
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.client_projects (
  client_id,
  project_name,
  project_type,
  uc_geradora,
  distribuidora,
  consumption_kwh_month,
  term_months,
  status,
  is_primary,
  origin
)
SELECT
  c.id,
  'Projeto principal',
  COALESCE(
    CASE
      WHEN cc.contract_type ILIKE '%venda%'  THEN 'venda'
      WHEN cc.contract_type ILIKE '%buy%'    THEN 'buyout'
      ELSE 'leasing'
    END,
    'leasing'
  ),
  c.uc_geradora,
  c.distribuidora,
  c.consumption_kwh_month,
  c.term_months,
  'active',
  TRUE,
  'migration'
FROM public.clients c
LEFT JOIN LATERAL (
  SELECT contract_type
  FROM   public.client_contracts cc2
  WHERE  cc2.client_id = c.id
  ORDER  BY cc2.updated_at DESC NULLS LAST, cc2.id DESC
  LIMIT  1
) cc ON TRUE
WHERE c.in_portfolio = TRUE
  AND c.deleted_at   IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM   public.client_projects cp
    WHERE  cp.client_id  = c.id
      AND  cp.deleted_at IS NULL
  );
