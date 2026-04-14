-- Migration: Add marca_inversor column to client_energy_profile
-- Stores the inverter brand/model collected during manual save or bulk import.

BEGIN;

ALTER TABLE public.client_energy_profile
  ADD COLUMN IF NOT EXISTS marca_inversor TEXT;

COMMENT ON COLUMN public.client_energy_profile.marca_inversor IS
  'Inverter brand/model (e.g. Fronius, SMA, Growatt).';

COMMIT;
