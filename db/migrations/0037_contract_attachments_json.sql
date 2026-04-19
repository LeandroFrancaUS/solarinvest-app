-- Migration: 0037_contract_attachments_json.sql
-- Adds contract_attachments_json JSONB column to client_contracts to support
-- multiple file attachments per contract (replaces/complements the single
-- contract_file_name / contract_file_url / contract_file_type columns).
-- Safe to re-run: uses ADD COLUMN IF NOT EXISTS.

BEGIN;

ALTER TABLE public.client_contracts
  ADD COLUMN IF NOT EXISTS contract_attachments_json JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.client_contracts.contract_attachments_json IS
  'Array of contract attachment records: [{id, fileName, mimeType, sizeBytes, url, storageKey, uploadedAt}]';

COMMIT;
