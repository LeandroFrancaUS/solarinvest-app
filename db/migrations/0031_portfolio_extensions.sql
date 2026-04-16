-- Migration: 0031_portfolio_extensions.sql
-- Adds missing columns to portfolio auxiliary tables for full data persistence.
--
-- 1. client_contracts: consultant tracking and contract file metadata.
-- 2. client_contracts: adds 'signed' to contract_status check constraint.
-- 3. client_billing_profile: valor_mensalidade and commissioning_date.
--
-- Safe to re-run (idempotent).

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) client_contracts — consultant + file columns
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.client_contracts
  ADD COLUMN IF NOT EXISTS consultant_id        TEXT,
  ADD COLUMN IF NOT EXISTS consultant_name      TEXT,
  ADD COLUMN IF NOT EXISTS contract_file_name   TEXT,
  ADD COLUMN IF NOT EXISTS contract_file_url    TEXT,
  ADD COLUMN IF NOT EXISTS contract_file_type   TEXT;

-- Fix contract_status CHECK to include 'signed' (used by frontend but missing
-- from the original migration 0029 constraint).
ALTER TABLE public.client_contracts DROP CONSTRAINT IF EXISTS client_contracts_status_check;
ALTER TABLE public.client_contracts
  ADD CONSTRAINT client_contracts_status_check CHECK (
    contract_status IN ('draft','active','signed','suspended','completed','cancelled')
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) client_billing_profile — valor_mensalidade + commissioning_date
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.client_billing_profile
  ADD COLUMN IF NOT EXISTS valor_mensalidade    NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS commissioning_date   DATE;

COMMIT;
