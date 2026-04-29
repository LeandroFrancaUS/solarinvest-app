-- 0045_add_usina_wifi_status.sql
-- Adds manual WiFi monitoring status for portfolio plants.
-- Future inverter/API integrations can update the same canonical field.

ALTER TABLE IF EXISTS public.client_usina_config
  ADD COLUMN IF NOT EXISTS wifi_status text;

ALTER TABLE IF EXISTS public.client_usina_config
  DROP CONSTRAINT IF EXISTS client_usina_config_wifi_status_check;

ALTER TABLE IF EXISTS public.client_usina_config
  ADD CONSTRAINT client_usina_config_wifi_status_check
  CHECK (wifi_status IS NULL OR wifi_status IN ('conectado', 'desconectado', 'falha'));

COMMENT ON COLUMN public.client_usina_config.wifi_status IS
  'Manual/API WiFi monitoring status for the PV system: conectado, desconectado, falha.';
