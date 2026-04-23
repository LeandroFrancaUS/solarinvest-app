-- Migration 0032: Create client_usina_config table
-- Moves usina (UFV configuration) fields from clients.metadata JSONB
-- to a dedicated structured table with proper types and constraints.
--
-- These 7 fields were previously stored in clients.metadata:
--   potencia_modulo_wp, numero_modulos, modelo_modulo,
--   modelo_inversor, tipo_instalacao, area_instalacao_m2, geracao_estimada_kwh

CREATE TABLE IF NOT EXISTS public.client_usina_config (
  id                    BIGSERIAL    PRIMARY KEY,
  client_id             BIGINT       NOT NULL UNIQUE REFERENCES public.clients(id) ON DELETE CASCADE,
  potencia_modulo_wp    NUMERIC,
  numero_modulos        INTEGER,
  modelo_modulo         TEXT,
  modelo_inversor       TEXT,
  tipo_instalacao       TEXT,
  area_instalacao_m2    NUMERIC,
  -- Monthly generation estimate in kWh/month.
  -- Note: the column name omits "_mes" for brevity, but the value is always per-month.
  geracao_estimada_kwh  NUMERIC,
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Index for the foreign key lookup
CREATE INDEX IF NOT EXISTS idx_client_usina_config_client_id
  ON public.client_usina_config (client_id);

-- Enable RLS using the same helper functions as other portfolio tables (migration 0029)
ALTER TABLE public.client_usina_config ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'client_usina_config' AND policyname = 'client_usina_config_read_policy'
  ) THEN
    EXECUTE 'CREATE POLICY client_usina_config_read_policy ON public.client_usina_config
      FOR SELECT USING (app.can_access_portfolio())';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'client_usina_config' AND policyname = 'client_usina_config_write_policy'
  ) THEN
    EXECUTE 'CREATE POLICY client_usina_config_write_policy ON public.client_usina_config
      FOR ALL USING (app.can_write_portfolio())';
  END IF;
END $$;
