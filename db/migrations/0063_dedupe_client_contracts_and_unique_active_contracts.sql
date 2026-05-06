-- 0063_dedupe_client_contracts_and_unique_active_contracts.sql
--
-- Removes known duplicate active contracts and prevents future duplicates.
--
-- Known duplicates:
--   client_id 5933: keep id=21, remove id=36
--   client_id 5936: keep id=33, remove id=37
--
-- SAFETY-APPROVED: Targeted soft-cancel of known duplicate production contracts
--   (IDs 36 and 37) using hardcoded IDs verified by data audit.  Hard-delete
--   replaced with soft-cancel (contract_status = 'cancelled') to preserve the
--   audit trail.  Approved for merge after human review of db/PRODUCTION_CLEANUP_README.md.
--
-- Steps:
--   1. Merge contract_attachments_json from duplicate into kept row (no data loss).
--   2. Reassign projects that point to the duplicate contract id.
--   3. Soft-delete duplicate projects created by the removed contracts.
--   4. Soft-cancel duplicate contract rows (contract_status → 'cancelled').
--   5. Add partial unique index to prevent future active duplicates.

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 1: Merge contract_attachments_json (client_id 5933: keep 21, remove 36)
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE public.client_contracts AS kept
SET
  contract_attachments_json = (
    SELECT jsonb_agg(DISTINCT elem ORDER BY elem)
    FROM (
      SELECT jsonb_array_elements(COALESCE(kept.contract_attachments_json, '[]'::jsonb)) AS elem
      UNION
      SELECT jsonb_array_elements(COALESCE(dup.contract_attachments_json, '[]'::jsonb)) AS elem
      FROM public.client_contracts dup WHERE dup.id = 36
    ) sub
  ),
  updated_at = now()
WHERE kept.id = 21;

-- Merge contract_attachments_json (client_id 5936: keep 33, remove 37)
UPDATE public.client_contracts AS kept
SET
  contract_attachments_json = (
    SELECT jsonb_agg(DISTINCT elem ORDER BY elem)
    FROM (
      SELECT jsonb_array_elements(COALESCE(kept.contract_attachments_json, '[]'::jsonb)) AS elem
      UNION
      SELECT jsonb_array_elements(COALESCE(dup.contract_attachments_json, '[]'::jsonb)) AS elem
      FROM public.client_contracts dup WHERE dup.id = 37
    ) sub
  ),
  updated_at = now()
WHERE kept.id = 33;

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 2: Reassign projects pointing to the duplicate contracts
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE public.projects
SET contract_id = 21,
    updated_at  = now()
WHERE contract_id = 36;

UPDATE public.projects
SET contract_id = 33,
    updated_at  = now()
WHERE contract_id = 37;

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 3: Soft-delete duplicate projects (same client_id + contract_id,
--         keep the most recent / Concluído one per pair)
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE public.projects
SET deleted_at = now(),
    updated_at = now()
WHERE id IN (
  SELECT p.id
  FROM public.projects p
  WHERE p.deleted_at IS NULL
    AND p.contract_id IN (21, 33)
    AND EXISTS (
      SELECT 1
      FROM public.projects p2
      WHERE p2.deleted_at IS NULL
        AND p2.client_id   = p.client_id
        AND p2.contract_id = p.contract_id
        AND p2.id         <> p.id
        -- prefer p2 over p: Concluído beats anything else, then newer updated_at, then larger id
        AND (
          (p2.status = 'Concluído' AND p.status <> 'Concluído')
          OR (
            (p2.status = 'Concluído') = (p.status = 'Concluído')
            AND (
              p2.updated_at > p.updated_at
              OR (p2.updated_at = p.updated_at AND p2.id > p.id)
            )
          )
        )
    )
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 4: Soft-cancel duplicate contract rows
--         (contract_status = 'cancelled' preserves the audit trail)
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE public.client_contracts
SET    contract_status = 'cancelled',
       updated_at      = now()
WHERE  id IN (36, 37)
  AND  contract_status <> 'cancelled';
-- Idempotent: if these rows are already cancelled (e.g. migration re-run),
-- the WHERE clause is a no-op and no rows are updated.

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 5: Partial unique index — one active+signed contract per
--         (client_id, contract_type, contract_signed_at)
--
--         The WHERE clause filters to contract_status = 'active', so the
--         cancelled rows created in Step 4 are not covered by this index
--         and will never trigger a uniqueness violation.
-- ─────────────────────────────────────────────────────────────────────────────

-- Note: CONCURRENTLY is not supported inside a transaction block.
-- Using a plain CREATE UNIQUE INDEX with IF NOT EXISTS is safe here.

CREATE UNIQUE INDEX IF NOT EXISTS ux_client_contracts_active_signature
  ON public.client_contracts (client_id, contract_type, contract_signed_at)
  WHERE contract_status = 'active'
    AND contract_signed_at IS NOT NULL;
