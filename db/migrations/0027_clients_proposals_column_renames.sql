-- 0027_clients_proposals_column_renames.sql
-- Align clients/proposals schema with the latest naming used by the app.

BEGIN;

ALTER TABLE IF EXISTS public.proposals
  RENAME COLUMN IF EXISTS uc_geradora_numero TO uc_geradora_nm;

ALTER TABLE IF EXISTS public.proposals
  ADD COLUMN IF NOT EXISTS uc_beneficiaria TEXT;

ALTER TABLE IF EXISTS public.clients
  RENAME COLUMN IF EXISTS document TO client_document;

ALTER TABLE IF EXISTS public.clients
  RENAME COLUMN IF EXISTS email TO client_email;

ALTER TABLE IF EXISTS public.clients
  RENAME COLUMN IF EXISTS phone TO client_phone;

ALTER TABLE IF EXISTS public.clients
  RENAME COLUMN IF EXISTS city TO client_city;

ALTER TABLE IF EXISTS public.clients
  RENAME COLUMN IF EXISTS state TO client_state;

ALTER TABLE IF EXISTS public.clients
  RENAME COLUMN IF EXISTS address TO client_address;

ALTER TABLE IF EXISTS public.clients
  RENAME COLUMN IF EXISTS uc TO uc_geradora;

ALTER TABLE IF EXISTS public.clients
  ADD COLUMN IF NOT EXISTS uc_beneficiaria TEXT;

ALTER TABLE IF EXISTS public.clients
  ADD COLUMN IF NOT EXISTS system_kwp NUMERIC;

ALTER TABLE IF EXISTS public.clients
  ADD COLUMN IF NOT EXISTS term_months TEXT;

COMMIT;
