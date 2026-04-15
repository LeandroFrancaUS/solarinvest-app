-- 0028_clients_name_consumption_columns.sql
-- Additional clients schema updates: rename name and add consumption field.

BEGIN;

ALTER TABLE IF EXISTS public.clients
  RENAME COLUMN IF EXISTS name TO client_name;

ALTER TABLE IF EXISTS public.clients
  ADD COLUMN IF NOT EXISTS consumption_kwh_month NUMERIC;

COMMIT;
