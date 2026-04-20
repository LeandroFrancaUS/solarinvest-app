-- Migration: 0039_ensure_crm_columns_on_clients.sql
-- Ensures CRM-specific columns originally added in 0003_crm_schema.sql
-- are present in public.clients, regardless of whether migration 0003
-- was applied (it used ALTER TABLE clients without the public. prefix,
-- so it may have missed some environments).
--
-- Safe to re-run (uses ADD COLUMN IF NOT EXISTS).

BEGIN;

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS tipo                TEXT,
  ADD COLUMN IF NOT EXISTS nome_razao          TEXT,
  ADD COLUMN IF NOT EXISTS telefone_secundario TEXT,
  ADD COLUMN IF NOT EXISTS logradouro          TEXT,
  ADD COLUMN IF NOT EXISTS numero              TEXT,
  ADD COLUMN IF NOT EXISTS complemento         TEXT,
  ADD COLUMN IF NOT EXISTS bairro              TEXT,
  ADD COLUMN IF NOT EXISTS cep                 TEXT,
  ADD COLUMN IF NOT EXISTS origem              TEXT,
  ADD COLUMN IF NOT EXISTS observacoes         TEXT,
  ADD COLUMN IF NOT EXISTS responsavel_id      UUID;

COMMIT;
