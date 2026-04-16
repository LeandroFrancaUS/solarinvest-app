-- Migration 0033: Migrate usina fields from clients.metadata to client_usina_config
-- This is a one-time data migration. It copies metadata values into the new
-- structured table, skipping clients that already have a row in client_usina_config.

INSERT INTO public.client_usina_config (
  client_id,
  potencia_modulo_wp,
  numero_modulos,
  modelo_modulo,
  modelo_inversor,
  tipo_instalacao,
  area_instalacao_m2,
  geracao_estimada_kwh
)
SELECT
  c.id,
  (c.metadata->>'potencia_modulo_wp')::NUMERIC,
  (c.metadata->>'numero_modulos')::INTEGER,
  c.metadata->>'modelo_modulo',
  c.metadata->>'modelo_inversor',
  c.metadata->>'tipo_instalacao',
  (c.metadata->>'area_instalacao_m2')::NUMERIC,
  (c.metadata->>'geracao_estimada_kwh')::NUMERIC
FROM public.clients c
WHERE c.metadata IS NOT NULL
  AND c.deleted_at IS NULL
  AND (
    c.metadata->>'potencia_modulo_wp' IS NOT NULL
    OR c.metadata->>'numero_modulos' IS NOT NULL
    OR c.metadata->>'modelo_modulo' IS NOT NULL
    OR c.metadata->>'modelo_inversor' IS NOT NULL
    OR c.metadata->>'tipo_instalacao' IS NOT NULL
    OR c.metadata->>'area_instalacao_m2' IS NOT NULL
    OR c.metadata->>'geracao_estimada_kwh' IS NOT NULL
  )
ON CONFLICT (client_id) DO NOTHING;
