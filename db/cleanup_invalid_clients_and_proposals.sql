-- ============================================================================
-- CLEANUP SCRIPT: soft-delete invalid/placeholder clients and proposals,
--                 and backfill proposals.client_id for merged clients.
--
-- INSTRUCTIONS
-- ------------
-- This script is meant to be run MANUALLY in blocks, with inspection after
-- each block.  Do NOT run the full file at once without reviewing the SELECT
-- previews first.
--
-- Recommended sequence:
--   1. Run Block A  — preview counts, no writes.
--   2. Run Block B  — preview counts for proposals, no writes.
--   3. Run Block C  — backfill proposals.client_id (safe, idempotent UPDATE).
--   4. Run Block D  — soft-delete garbage clients inside a transaction.
--                     Test with ROLLBACK first; then re-run with COMMIT.
--   5. Run Block E  — soft-delete garbage draft proposals inside a transaction.
--                     Test with ROLLBACK first; then re-run with COMMIT.
--   6. Run Block F  — verification SELECTs.
--
-- Prerequisites: migration 0052 must be applied (vw_clients_listable exists).
-- ============================================================================

-- ============================================================================
-- BLOCK A — PREVIEW: identify garbage clients
-- ============================================================================

-- A.1  Clients that are deleted or merged but have no deleted_at / merged flag
--      set correctly (defense-in-depth check).
SELECT
  count(*) FILTER (WHERE deleted_at IS NOT NULL)              AS already_deleted,
  count(*) FILTER (WHERE merged_into_client_id IS NOT NULL)   AS already_merged,
  count(*) FILTER (WHERE identity_status = 'merged')          AS status_merged,
  count(*)                                                     AS total_active
FROM public.clients
WHERE deleted_at IS NULL;

-- A.2  Clients that would be hidden by vw_clients_listable (pure garbage).
SELECT count(*) AS garbage_clients_to_hide
FROM public.clients c
WHERE c.deleted_at IS NULL
  AND c.merged_into_client_id IS NULL
  AND coalesce(c.identity_status, '') <> 'merged'
  AND NOT (
    (
      nullif(trim(coalesce(c.client_name, '')), '') IS NOT NULL
      AND lower(trim(coalesce(c.client_name, ''))) NOT IN
          ('0', 'null', 'undefined', '[object object]', '-', '—')
    )
    OR c.cpf_normalized IS NOT NULL
    OR c.cnpj_normalized IS NOT NULL
    OR (c.client_email IS NOT NULL AND position('@' IN c.client_email) > 0)
    OR length(regexp_replace(coalesce(c.client_phone, ''), '\D', '', 'g')) >= 10
  );

-- A.3  Sample of those garbage clients (for manual review).
SELECT id, client_name, client_email, client_phone, cpf_normalized, cnpj_normalized,
       identity_status, merged_into_client_id, created_at
FROM public.clients c
WHERE c.deleted_at IS NULL
  AND c.merged_into_client_id IS NULL
  AND coalesce(c.identity_status, '') <> 'merged'
  AND NOT (
    (
      nullif(trim(coalesce(c.client_name, '')), '') IS NOT NULL
      AND lower(trim(coalesce(c.client_name, ''))) NOT IN
          ('0', 'null', 'undefined', '[object object]', '-', '—')
    )
    OR c.cpf_normalized IS NOT NULL
    OR c.cnpj_normalized IS NOT NULL
    OR (c.client_email IS NOT NULL AND position('@' IN c.client_email) > 0)
    OR length(regexp_replace(coalesce(c.client_phone, ''), '\D', '', 'g')) >= 10
  )
ORDER BY created_at DESC
LIMIT 50;

-- ============================================================================
-- BLOCK B — PREVIEW: identify garbage draft proposals
-- ============================================================================

-- B.1  Count of empty drafts that would be hidden by vw_proposals_listable.
SELECT count(*) AS garbage_draft_proposals
FROM public.proposals p
WHERE p.deleted_at IS NULL
  AND coalesce(p.status, '') = 'draft'
  AND p.proposal_code IS NULL
  AND p.client_id IS NULL
  AND nullif(trim(coalesce(p.client_name,     '')), '') IS NULL
  AND nullif(trim(coalesce(p.client_document, '')), '') IS NULL
  AND nullif(trim(coalesce(p.client_email,    '')), '') IS NULL
  AND nullif(trim(coalesce(p.client_phone,    '')), '') IS NULL
  AND coalesce(p.consumption_kwh_month, 0) = 0
  AND p.capex_total IS NULL;

-- B.2  Sample of those garbage drafts.
SELECT id, proposal_type, status, proposal_code, client_id,
       client_name, client_email, client_phone,
       consumption_kwh_month, capex_total, created_at
FROM public.proposals p
WHERE p.deleted_at IS NULL
  AND coalesce(p.status, '') = 'draft'
  AND p.proposal_code IS NULL
  AND p.client_id IS NULL
  AND nullif(trim(coalesce(p.client_name,     '')), '') IS NULL
  AND nullif(trim(coalesce(p.client_document, '')), '') IS NULL
  AND nullif(trim(coalesce(p.client_email,    '')), '') IS NULL
  AND nullif(trim(coalesce(p.client_phone,    '')), '') IS NULL
  AND coalesce(p.consumption_kwh_month, 0) = 0
  AND p.capex_total IS NULL
ORDER BY created_at DESC
LIMIT 50;

-- ============================================================================
-- BLOCK C — BACKFILL: update proposals.client_id for merged clients
--
-- When a client was merged into a canonical, proposals that still point to the
-- duplicate's id should be re-linked to the canonical.
-- This block is safe to re-run (idempotent — no row is touched twice).
-- ============================================================================

BEGIN;

UPDATE public.proposals p
SET    client_id  = c.merged_into_client_id,
       updated_at = now()
FROM   public.clients c
WHERE  p.client_id = c.id
  AND  c.merged_into_client_id IS NOT NULL
  AND  p.deleted_at IS NULL;

-- Show how many rows were updated.
-- (Comment out or remove after inspection.)
SELECT 'proposals backfilled' AS label, count(*) AS cnt
FROM   public.proposals
WHERE  client_id IN (
  SELECT merged_into_client_id FROM public.clients
  WHERE  merged_into_client_id IS NOT NULL
);

COMMIT;   -- ← change to ROLLBACK for a dry-run

-- ============================================================================
-- BLOCK D — CLEANUP: soft-delete garbage/placeholder clients
--
-- Only deletes clients that have:
--   • no CPF or CNPJ (no strong identity)
--   • no valid email (no @)
--   • no valid phone (< 10 digits)
--   • a name that is NULL, empty, or in the placeholder blocklist
--   • no active proposals
--   • no portfolio entry (in_portfolio = false / null)
--
-- Clients with any active proposal are excluded even if the name is garbage,
-- to avoid orphaning business-critical data.
-- ============================================================================

BEGIN;

-- D.1  Save a backup snapshot before soft-deleting.
CREATE TABLE IF NOT EXISTS public.data_hygiene_garbage_clients_backup AS
SELECT c.*, now() AS backed_up_at
FROM   public.clients c
WHERE  c.deleted_at IS NULL
  AND  c.merged_into_client_id IS NULL
  AND  coalesce(c.identity_status, '') <> 'merged'
  AND  c.cpf_normalized IS NULL
  AND  c.cnpj_normalized IS NULL
  AND  (c.client_email IS NULL OR position('@' IN c.client_email) = 0)
  AND  length(regexp_replace(coalesce(c.client_phone, ''), '\D', '', 'g')) < 10
  AND  (
    c.client_name IS NULL
    OR trim(c.client_name) = ''
    OR lower(trim(c.client_name)) IN
       ('0', 'null', 'undefined', '[object object]', '-', '—')
  )
  AND  NOT EXISTS (
    SELECT 1 FROM public.proposals p
    WHERE  p.client_id = c.id AND p.deleted_at IS NULL
  )
  AND  coalesce(c.in_portfolio, false) = false
WITH NO DATA;

INSERT INTO public.data_hygiene_garbage_clients_backup
SELECT c.*, now()
FROM   public.clients c
WHERE  c.deleted_at IS NULL
  AND  c.merged_into_client_id IS NULL
  AND  coalesce(c.identity_status, '') <> 'merged'
  AND  c.cpf_normalized IS NULL
  AND  c.cnpj_normalized IS NULL
  AND  (c.client_email IS NULL OR position('@' IN c.client_email) = 0)
  AND  length(regexp_replace(coalesce(c.client_phone, ''), '\D', '', 'g')) < 10
  AND  (
    c.client_name IS NULL
    OR trim(c.client_name) = ''
    OR lower(trim(c.client_name)) IN
       ('0', 'null', 'undefined', '[object object]', '-', '—')
  )
  AND  NOT EXISTS (
    SELECT 1 FROM public.proposals p
    WHERE  p.client_id = c.id AND p.deleted_at IS NULL
  )
  AND  coalesce(c.in_portfolio, false) = false
ON CONFLICT DO NOTHING;

-- D.2  Perform the soft-delete.
UPDATE public.clients c
SET    deleted_at = now(),
       updated_at = now()
WHERE  c.deleted_at IS NULL
  AND  c.merged_into_client_id IS NULL
  AND  coalesce(c.identity_status, '') <> 'merged'
  AND  c.cpf_normalized IS NULL
  AND  c.cnpj_normalized IS NULL
  AND  (c.client_email IS NULL OR position('@' IN c.client_email) = 0)
  AND  length(regexp_replace(coalesce(c.client_phone, ''), '\D', '', 'g')) < 10
  AND  (
    c.client_name IS NULL
    OR trim(c.client_name) = ''
    OR lower(trim(c.client_name)) IN
       ('0', 'null', 'undefined', '[object object]', '-', '—')
  )
  AND  NOT EXISTS (
    SELECT 1 FROM public.proposals p
    WHERE  p.client_id = c.id AND p.deleted_at IS NULL
  )
  AND  coalesce(c.in_portfolio, false) = false;

COMMIT;   -- ← change to ROLLBACK for a dry-run

-- ============================================================================
-- BLOCK E — CLEANUP: soft-delete garbage draft proposals
-- ============================================================================

BEGIN;

-- E.1  Backup snapshot.
CREATE TABLE IF NOT EXISTS public.data_hygiene_garbage_proposals_backup AS
SELECT p.*, now() AS backed_up_at
FROM   public.proposals p
WHERE  p.deleted_at IS NULL
  AND  coalesce(p.status, '') = 'draft'
  AND  p.proposal_code IS NULL
  AND  p.client_id IS NULL
  AND  nullif(trim(coalesce(p.client_name,     '')), '') IS NULL
  AND  nullif(trim(coalesce(p.client_document, '')), '') IS NULL
  AND  nullif(trim(coalesce(p.client_email,    '')), '') IS NULL
  AND  nullif(trim(coalesce(p.client_phone,    '')), '') IS NULL
  AND  coalesce(p.consumption_kwh_month, 0) = 0
  AND  p.capex_total IS NULL
WITH NO DATA;

INSERT INTO public.data_hygiene_garbage_proposals_backup
SELECT p.*, now()
FROM   public.proposals p
WHERE  p.deleted_at IS NULL
  AND  coalesce(p.status, '') = 'draft'
  AND  p.proposal_code IS NULL
  AND  p.client_id IS NULL
  AND  nullif(trim(coalesce(p.client_name,     '')), '') IS NULL
  AND  nullif(trim(coalesce(p.client_document, '')), '') IS NULL
  AND  nullif(trim(coalesce(p.client_email,    '')), '') IS NULL
  AND  nullif(trim(coalesce(p.client_phone,    '')), '') IS NULL
  AND  coalesce(p.consumption_kwh_month, 0) = 0
  AND  p.capex_total IS NULL
ON CONFLICT DO NOTHING;

-- E.2  Perform the soft-delete.
UPDATE public.proposals p
SET    deleted_at = now(),
       updated_at = now()
WHERE  p.deleted_at IS NULL
  AND  coalesce(p.status, '') = 'draft'
  AND  p.proposal_code IS NULL
  AND  p.client_id IS NULL
  AND  nullif(trim(coalesce(p.client_name,     '')), '') IS NULL
  AND  nullif(trim(coalesce(p.client_document, '')), '') IS NULL
  AND  nullif(trim(coalesce(p.client_email,    '')), '') IS NULL
  AND  nullif(trim(coalesce(p.client_phone,    '')), '') IS NULL
  AND  coalesce(p.consumption_kwh_month, 0) = 0
  AND  p.capex_total IS NULL;

COMMIT;   -- ← change to ROLLBACK for a dry-run

-- ============================================================================
-- BLOCK F — VERIFICATION
-- ============================================================================

-- F.1  Clients visible via the new view (should be << 1448).
SELECT count(*) AS listable_clients FROM public.vw_clients_listable;

-- F.2  Proposals visible via the new view.
SELECT count(*) AS listable_proposals FROM public.vw_proposals_listable;

-- F.3  Make sure no merged/deleted clients leaked into the listable view.
SELECT count(*) AS leaked_merged
FROM   public.vw_clients_listable
WHERE  deleted_at IS NOT NULL
   OR  merged_into_client_id IS NOT NULL
   OR  identity_status = 'merged';

-- F.4  Sanity-check: still-active client and proposal counts in raw tables.
SELECT
  count(*) FILTER (WHERE deleted_at IS NULL AND merged_into_client_id IS NULL) AS raw_active_clients,
  count(*) FILTER (WHERE deleted_at IS NOT NULL)                                AS soft_deleted_clients,
  count(*) FILTER (WHERE merged_into_client_id IS NOT NULL)                     AS merged_clients
FROM public.clients;
