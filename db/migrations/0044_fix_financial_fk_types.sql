-- 0044_fix_financial_fk_types.sql
--
-- Corrective migration: the columns client_id and consultant_id in
-- financial_entries and project_financial_snapshots were created as UUID
-- in migration 0043, but the canonical PKs they reference are BIGINT:
--
--   clients.id     → BIGSERIAL (bigint)
--   consultants.id → BIGSERIAL (bigint)
--
-- Attempting any JOIN between these tables produced:
--   ERROR: operator does not exist: bigint = uuid
--
-- Fix strategy (safe for tables with no significant production data yet):
--   1. Drop the dependent indices.
--   2. Drop the incorrectly-typed columns.
--   3. Re-add them with the correct type (BIGINT).
--   4. Re-create the indices.
--
-- Columns that REMAIN unchanged (correct type):
--   financial_entries.proposal_id                  → UUID  ✅
--   project_financial_snapshots.proposal_id        → UUID  ✅
--
-- Columns corrected by this migration:
--   financial_entries.client_id                    UUID → BIGINT
--   financial_entries.consultant_id                UUID → BIGINT
--   project_financial_snapshots.client_id          UUID → BIGINT
--   project_financial_snapshots.consultant_id      UUID → BIGINT

-- ────────────────────────────────────────────────────────────────────────────
-- financial_entries — client_id
-- ────────────────────────────────────────────────────────────────────────────

DROP INDEX IF EXISTS financial_entries_client_id_idx;

ALTER TABLE financial_entries DROP COLUMN IF EXISTS client_id;
ALTER TABLE financial_entries ADD COLUMN client_id BIGINT REFERENCES public.clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS financial_entries_client_id_idx ON financial_entries (client_id);

-- ────────────────────────────────────────────────────────────────────────────
-- financial_entries — consultant_id
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE financial_entries DROP COLUMN IF EXISTS consultant_id;
ALTER TABLE financial_entries ADD COLUMN consultant_id BIGINT REFERENCES public.consultants(id) ON DELETE SET NULL;

-- ────────────────────────────────────────────────────────────────────────────
-- project_financial_snapshots — client_id
-- ────────────────────────────────────────────────────────────────────────────

DROP INDEX IF EXISTS pfs_client_id_idx;

ALTER TABLE project_financial_snapshots DROP COLUMN IF EXISTS client_id;
ALTER TABLE project_financial_snapshots ADD COLUMN client_id BIGINT REFERENCES public.clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS pfs_client_id_idx ON project_financial_snapshots (client_id);

-- ────────────────────────────────────────────────────────────────────────────
-- project_financial_snapshots — consultant_id
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE project_financial_snapshots DROP COLUMN IF EXISTS consultant_id;
ALTER TABLE project_financial_snapshots ADD COLUMN consultant_id BIGINT REFERENCES public.consultants(id) ON DELETE SET NULL;
