-- Migration 0034: Clean usina fields from clients.metadata
-- After migration 0033 copied these values into client_usina_config,
-- remove the redundant keys from the JSONB metadata column.
-- This is idempotent — it is safe to run even if keys have already been removed.

UPDATE public.clients
SET metadata = metadata
  - 'potencia_modulo_wp'
  - 'numero_modulos'
  - 'modelo_modulo'
  - 'modelo_inversor'
  - 'tipo_instalacao'
  - 'area_instalacao_m2'
  - 'geracao_estimada_kwh'
WHERE metadata IS NOT NULL
  AND (
    metadata ? 'potencia_modulo_wp'
    OR metadata ? 'numero_modulos'
    OR metadata ? 'modelo_modulo'
    OR metadata ? 'modelo_inversor'
    OR metadata ? 'tipo_instalacao'
    OR metadata ? 'area_instalacao_m2'
    OR metadata ? 'geracao_estimada_kwh'
  );
