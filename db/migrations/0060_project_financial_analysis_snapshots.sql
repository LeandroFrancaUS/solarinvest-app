-- Migration 0060: project_financial_analysis_snapshots
-- Stores the Análise Financeira UI state (inputs + computed outputs) as a JSON
-- snapshot per project, used by the embedded AF view in the Central de Projetos.
--
-- One row per project (unique on project_id).
-- inputs_json : AfInputState fields (store state that can restore the AF UI).
-- outputs_json: AnaliseFinanceiraOutput (computed result from the AF engine).

CREATE TABLE IF NOT EXISTS project_financial_analysis_snapshots (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  TEXT        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  inputs_json  JSONB,
  outputs_json JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT project_financial_analysis_snapshots_project_id_key UNIQUE (project_id)
);

CREATE INDEX IF NOT EXISTS idx_project_financial_analysis_snapshots_project_id
  ON project_financial_analysis_snapshots (project_id);
