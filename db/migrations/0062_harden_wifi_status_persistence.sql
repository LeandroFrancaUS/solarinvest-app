-- 0062_harden_wifi_status_persistence.sql
-- Hardens WiFi persistence for Usina monitoring.
-- The UI may issue multiple saves while editing the Usina tab. This migration
-- guarantees the canonical value survives metadata rewrites and can be queried
-- from client_usina_config.wifi_status.

ALTER TABLE IF EXISTS public.client_usina_config
  ADD COLUMN IF NOT EXISTS wifi_status text;

ALTER TABLE IF EXISTS public.client_usina_config
  DROP CONSTRAINT IF EXISTS client_usina_config_wifi_status_check;

ALTER TABLE IF EXISTS public.client_usina_config
  ADD CONSTRAINT client_usina_config_wifi_status_check
  CHECK (wifi_status IS NULL OR wifi_status IN ('conectado', 'desconectado', 'falha'));

CREATE OR REPLACE FUNCTION public.sync_client_wifi_status_to_usina_config()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  next_wifi_status text;
BEGIN
  next_wifi_status := NULLIF(NEW.metadata ->> 'wifi_status', '');

  -- Do not erase the canonical Usina value when a later save rewrites metadata
  -- without wifi_status. Other Usina saves may omit the field.
  IF next_wifi_status IS NULL THEN
    RETURN NEW;
  END IF;

  IF next_wifi_status NOT IN ('conectado', 'desconectado', 'falha') THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.client_usina_config (client_id, wifi_status, updated_at)
  VALUES (NEW.id, next_wifi_status, now())
  ON CONFLICT (client_id) DO UPDATE
    SET wifi_status = EXCLUDED.wifi_status,
        updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_client_wifi_status_to_usina_config ON public.clients;

CREATE TRIGGER trg_sync_client_wifi_status_to_usina_config
AFTER INSERT OR UPDATE OF metadata ON public.clients
FOR EACH ROW
EXECUTE FUNCTION public.sync_client_wifi_status_to_usina_config();

-- Backfill from metadata into canonical table.
INSERT INTO public.client_usina_config (client_id, wifi_status, updated_at)
SELECT
  c.id,
  NULLIF(c.metadata ->> 'wifi_status', '') AS wifi_status,
  now()
FROM public.clients c
WHERE NULLIF(c.metadata ->> 'wifi_status', '') IN ('conectado', 'desconectado', 'falha')
ON CONFLICT (client_id) DO UPDATE
  SET wifi_status = EXCLUDED.wifi_status,
      updated_at = now();

-- Backfill metadata from canonical table so frontend fallback also sees it.
UPDATE public.clients c
SET metadata = COALESCE(c.metadata, '{}'::jsonb) || jsonb_build_object('wifi_status', cu.wifi_status),
    updated_at = now()
FROM public.client_usina_config cu
WHERE cu.client_id = c.id
  AND cu.wifi_status IN ('conectado', 'desconectado', 'falha');
