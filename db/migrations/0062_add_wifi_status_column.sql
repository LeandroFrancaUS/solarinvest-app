ALTER TABLE IF EXISTS public.client_usina_config
  ADD COLUMN IF NOT EXISTS wifi_status text;

ALTER TABLE IF EXISTS public.client_usina_config
  DROP CONSTRAINT IF EXISTS client_usina_config_wifi_status_check;

ALTER TABLE IF EXISTS public.client_usina_config
  ADD CONSTRAINT client_usina_config_wifi_status_check
  CHECK (wifi_status IS NULL OR wifi_status IN ('conectado', 'desconectado', 'falha'));
