-- Migration: Add CNPJ support to clients table
-- Mirrors the CPF implementation: normalized column, unique partial index,
-- document_type discriminator, and identity_status values for CNPJ.

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS cnpj_normalized TEXT,
  ADD COLUMN IF NOT EXISTS cnpj_raw        TEXT,
  ADD COLUMN IF NOT EXISTS document_type   TEXT;

-- Backfill document_type for existing rows that have cpf_normalized
UPDATE clients
SET document_type = 'cpf'
WHERE document_type IS NULL
  AND cpf_normalized IS NOT NULL;

-- Partial unique index: cnpj_normalized must be unique per non-deleted, non-merged client
CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_cnpj_normalized
  ON clients (cnpj_normalized)
  WHERE cnpj_normalized IS NOT NULL
    AND deleted_at IS NULL
    AND merged_into_client_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_clients_document_type ON clients (document_type);

-- identity_status CHECK constraint already exists as a default column — the new
-- 'pending_cnpj' value is added via ALTER TABLE if a CHECK constraint was
-- defined inline; since migration 0010 used a plain TEXT column with no CHECK,
-- no constraint change is needed. The application layer enforces the enum.
