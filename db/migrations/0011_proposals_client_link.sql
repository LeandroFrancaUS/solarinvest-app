-- Migration: Link proposals to clients + add offline-first fields

ALTER TABLE proposals
  ADD COLUMN IF NOT EXISTS client_id           BIGINT REFERENCES clients(id),
  ADD COLUMN IF NOT EXISTS offline_origin_id   TEXT,
  ADD COLUMN IF NOT EXISTS is_pending_sync     BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_conflicted       BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS conflict_reason     TEXT,
  ADD COLUMN IF NOT EXISTS synced_at           TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS uc_geradora_numero  TEXT,
  ADD COLUMN IF NOT EXISTS draft_source        TEXT;

-- Backfill client_id from existing denormalized data where possible (best-effort)
UPDATE proposals p
SET client_id = c.id
FROM clients c
WHERE p.client_id IS NULL
  AND p.client_document IS NOT NULL
  AND p.client_document != ''
  AND c.document = p.client_document
  AND c.deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_proposals_client_id       ON proposals (client_id);
CREATE INDEX IF NOT EXISTS idx_proposals_offline_origin  ON proposals (offline_origin_id);
CREATE INDEX IF NOT EXISTS idx_proposals_is_pending_sync ON proposals (is_pending_sync) WHERE is_pending_sync = TRUE;
CREATE INDEX IF NOT EXISTS idx_proposals_client_city     ON proposals (client_city);
CREATE INDEX IF NOT EXISTS idx_proposals_client_state    ON proposals (client_state);
CREATE INDEX IF NOT EXISTS idx_proposals_consumption     ON proposals (consumption_kwh_month);
CREATE INDEX IF NOT EXISTS idx_proposals_system_kwp      ON proposals (system_kwp);
