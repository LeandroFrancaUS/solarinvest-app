-- Migration: 0061_client_status_domain.sql
-- Adds status_comercial and status_cliente columns to the clients table.
--
-- Strategy:
--   - Additive only: ADD COLUMN IF NOT EXISTS, never drops or renames anything.
--   - Safe defaults: existing rows keep meaningful values without any backfill.
--   - CHECK constraints enforce the canonical value sets.
--
-- status_comercial — commercial pipeline state (before contract is signed).
--   Default 'LEAD' covers all existing rows that have no explicit pipeline state.
--
-- status_cliente — post-contract client state.
--   Default 'NAO_CLIENTE' is correct for leads/proposals that have no contract.
--
-- Safe to re-run (idempotent via IF NOT EXISTS and DO UPDATE guards).

BEGIN;

-- ─── 1) Add columns ───────────────────────────────────────────────────────────

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS status_comercial TEXT NOT NULL DEFAULT 'LEAD',
  ADD COLUMN IF NOT EXISTS status_cliente   TEXT NOT NULL DEFAULT 'NAO_CLIENTE';

-- ─── 2) Add CHECK constraints (guarded to stay idempotent) ───────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'clients_status_comercial_check'
      AND conrelid = 'public.clients'::regclass
  ) THEN
    ALTER TABLE public.clients
      ADD CONSTRAINT clients_status_comercial_check
      CHECK (status_comercial IN (
        'LEAD',
        'PROPOSTA_ENVIADA',
        'NEGOCIANDO',
        'CONTRATO_ENVIADO',
        'GANHO',
        'PERDIDO'
      ));
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'clients_status_cliente_check'
      AND conrelid = 'public.clients'::regclass
  ) THEN
    ALTER TABLE public.clients
      ADD CONSTRAINT clients_status_cliente_check
      CHECK (status_cliente IN (
        'NAO_CLIENTE',
        'ATIVO',
        'INATIVO',
        'CANCELADO',
        'FINALIZADO'
      ));
  END IF;
END;
$$;

-- ─── 3) Indexes for common filter patterns ────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_clients_status_comercial
  ON public.clients (status_comercial);

CREATE INDEX IF NOT EXISTS idx_clients_status_cliente
  ON public.clients (status_cliente);

-- ─── 4) Comments ─────────────────────────────────────────────────────────────

COMMENT ON COLUMN public.clients.status_comercial IS
  'Commercial pipeline state (before contract signed). '
  'Values: LEAD | PROPOSTA_ENVIADA | NEGOCIANDO | CONTRATO_ENVIADO | GANHO | PERDIDO. '
  'GANHO is set automatically when a contract is signed. '
  'Use this field to filter records shown in the Comercial area.';

COMMENT ON COLUMN public.clients.status_cliente IS
  'Post-contract client state. '
  'Values: NAO_CLIENTE | ATIVO | INATIVO | CANCELADO | FINALIZADO. '
  'ATIVO is set automatically when a contract is signed. '
  'Use this field to filter records shown in the Clientes area.';

COMMIT;
