-- 0061_sync_wifi_status_to_usina_config.sql
-- Ensures WiFi status saved through clients.metadata is mirrored into
-- client_usina_config.wifi_status, the canonical Usina monitoring field.

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

-- Backfill existing metadata values into the canonical table.
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
