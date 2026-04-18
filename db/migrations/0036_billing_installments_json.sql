-- Migration: 0036_billing_installments_json.sql
-- Adds installments_json JSONB column to client_billing_profile for per-installment
-- payment tracking (status, timestamps, receipt/transaction numbers, confirmed_by).
-- Safe to re-run: uses ADD COLUMN IF NOT EXISTS.

BEGIN;

ALTER TABLE public.client_billing_profile
  ADD COLUMN IF NOT EXISTS installments_json JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.client_billing_profile.installments_json IS
  'Per-installment payment records: [{number, status, paid_at, receipt_number, transaction_number, attachment_url, confirmed_by}]';

COMMIT;
