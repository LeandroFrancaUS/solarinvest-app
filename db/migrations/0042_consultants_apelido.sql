-- Migration: 0042_consultants_apelido.sql
-- Adds an optional nickname (apelido) column to the consultants table.
-- When NULL or empty the UI falls back to full_name for display.
-- Default value at the application layer = first word of full_name.
--
-- Safe to re-run (idempotent via IF NOT EXISTS guard).

BEGIN;

ALTER TABLE public.consultants
  ADD COLUMN IF NOT EXISTS apelido TEXT;

COMMENT ON COLUMN public.consultants.apelido IS
  'Optional display nickname. When NULL or empty the full_name is used instead. '
  'Default at creation time = first word of full_name.';

COMMIT;
