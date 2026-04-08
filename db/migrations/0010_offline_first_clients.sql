-- Migration: Enhance clients table for offline-first + CPF deduplication
-- Adds: cpf_normalized, cpf_raw, identity_status, created_by_user_id, origin, last_synced_at, deleted_at, offline_origin_id

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS cpf_normalized   TEXT,
  ADD COLUMN IF NOT EXISTS cpf_raw          TEXT,
  ADD COLUMN IF NOT EXISTS identity_status  TEXT NOT NULL DEFAULT 'pending_cpf',
  ADD COLUMN IF NOT EXISTS merged_into_client_id BIGINT REFERENCES clients(id),
  ADD COLUMN IF NOT EXISTS created_by_user_id    TEXT,
  ADD COLUMN IF NOT EXISTS owner_user_id         TEXT,
  ADD COLUMN IF NOT EXISTS origin                TEXT NOT NULL DEFAULT 'online',
  ADD COLUMN IF NOT EXISTS last_synced_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_at            TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS offline_origin_id     TEXT,
  ADD COLUMN IF NOT EXISTS search_text           TEXT;

-- Backfill owner_user_id from user_id (existing column)
UPDATE clients SET owner_user_id = user_id WHERE owner_user_id IS NULL AND user_id IS NOT NULL;
UPDATE clients SET created_by_user_id = user_id WHERE created_by_user_id IS NULL AND user_id IS NOT NULL;

-- Update identity_status to 'confirmed' for rows that already have a document
UPDATE clients SET identity_status = 'confirmed' WHERE document IS NOT NULL AND document != '';

-- Partial unique index: cpf_normalized must be unique per non-deleted client
CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_cpf_normalized
  ON clients (cpf_normalized)
  WHERE cpf_normalized IS NOT NULL AND deleted_at IS NULL AND merged_into_client_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_clients_identity_status  ON clients (identity_status);
CREATE INDEX IF NOT EXISTS idx_clients_created_by       ON clients (created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_clients_owner_user_id    ON clients (owner_user_id);
CREATE INDEX IF NOT EXISTS idx_clients_deleted_at       ON clients (deleted_at);
CREATE INDEX IF NOT EXISTS idx_clients_offline_origin   ON clients (offline_origin_id);
CREATE INDEX IF NOT EXISTS idx_clients_city             ON clients (city);
CREATE INDEX IF NOT EXISTS idx_clients_state            ON clients (state);
