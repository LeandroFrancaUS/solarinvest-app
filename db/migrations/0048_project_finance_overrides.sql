-- 0048_project_finance_overrides.sql
-- Adds override_payload_json to project_financial_profiles.
-- This column stores per-field manual overrides so that auto-computed KPIs
-- (payback, ROI, TIR, VPL, potência, geração) can be restored to "auto" at any time.
--
-- Also adds a technical_params_json column to persist optional system-sizing
-- parameters (irradiação, PR, potência do módulo) used by the shared engine.
--
-- This migration is purely additive.

BEGIN;

ALTER TABLE public.project_financial_profiles
  ADD COLUMN IF NOT EXISTS override_payload_json   JSONB,
  ADD COLUMN IF NOT EXISTS technical_params_json   JSONB;

COMMENT ON COLUMN public.project_financial_profiles.override_payload_json IS
  'Map of field-name → manual override value. When a field is present here its value takes precedence over the auto-computed result.';

COMMENT ON COLUMN public.project_financial_profiles.technical_params_json IS
  'Optional system-sizing parameters: irradiacao_kwh_m2_dia, performance_ratio, dias_mes, potencia_modulo_wp, taxa_desconto_aa_pct.';

COMMIT;
