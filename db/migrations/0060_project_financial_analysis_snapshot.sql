-- 0060_project_financial_analysis_snapshot.sql
-- Adds inputs_json and outputs_json JSONB columns to project_financial_profiles.
--
-- These columns store the full Análise Financeira snapshot (inputs + computed
-- outputs) when the AF screen operates in embedded mode inside the Central de
-- Projetos.  They are separate from the individual typed columns so that:
--   • The AF engine can persist its entire payload without per-field mapping.
--   • Historical snapshots are preserved even when engine field names evolve.
--   • The existing individual-column workflow (/finance) is not disrupted.
--
-- This migration is purely additive.

BEGIN;

ALTER TABLE public.project_financial_profiles
  ADD COLUMN IF NOT EXISTS inputs_json   JSONB,
  ADD COLUMN IF NOT EXISTS outputs_json  JSONB;

COMMENT ON COLUMN public.project_financial_profiles.inputs_json IS
  'Full Análise Financeira input payload serialised by the embedded AF engine (mode: embedded).';
COMMENT ON COLUMN public.project_financial_profiles.outputs_json IS
  'Full Análise Financeira computed outputs serialised by the embedded AF engine (mode: embedded).';

COMMIT;
