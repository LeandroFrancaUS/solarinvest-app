-- ============================================================================
-- Migration 0052: vw_clients_listable + vw_proposals_listable
-- ============================================================================
--
-- Creates two read-only views that expose only the records that should appear
-- in the main list screens:
--
--   vw_clients_listable
--     Excludes deleted, merged, identity_status='merged', and pure-garbage rows
--     (no valid name anchor AND no CPF/CNPJ AND no valid email AND no valid phone).
--
--   vw_proposals_listable
--     Excludes deleted rows and pure-garbage draft rows (no proposal_code, no
--     client_id, no contact data, no consumption, no capex).
--
-- The application listClients() and listProposals() repository functions already
-- apply the same WHERE conditions directly, so these views are provided for:
--   - ad-hoc inspection in the Neon console
--   - future migrations / reports that need a clean base
--   - SELECT COUNT(*) health-check queries
--
-- Safe to re-run (CREATE OR REPLACE VIEW is idempotent).
-- ============================================================================

BEGIN;

-- ============================================================================
-- SECTION A — vw_clients_listable
-- ============================================================================

CREATE OR REPLACE VIEW public.vw_clients_listable AS
SELECT c.*
FROM public.clients c
WHERE c.deleted_at IS NULL
  AND c.merged_into_client_id IS NULL
  AND coalesce(c.identity_status, '') <> 'merged'
  -- Require at least one valid identity anchor so pure-placeholder rows are hidden.
  AND (
    (
      nullif(trim(coalesce(c.client_name, '')), '') IS NOT NULL
      AND lower(trim(coalesce(c.client_name, ''))) NOT IN
          ('0', 'null', 'undefined', '[object object]', '-', u&'\2014')
    )
    OR c.cpf_normalized IS NOT NULL
    OR c.cnpj_normalized IS NOT NULL
    OR (c.client_email IS NOT NULL AND position('@' IN c.client_email) > 0)
    OR length(regexp_replace(coalesce(c.client_phone, ''), '\D', '', 'g')) >= 10
  );

COMMENT ON VIEW public.vw_clients_listable IS
  'Active, non-merged clients that have at least one valid identity anchor '
  '(non-placeholder name, CPF/CNPJ, valid email, or valid phone). '
  'This is the recommended base for all list-screen queries.';

-- ============================================================================
-- SECTION B — vw_proposals_listable
-- ============================================================================

CREATE OR REPLACE VIEW public.vw_proposals_listable AS
SELECT p.*
FROM public.proposals p
WHERE p.deleted_at IS NULL
  -- Exclude pure garbage drafts: auto-saved placeholders with no meaningful data.
  AND NOT (
    coalesce(p.status, '') = 'draft'
    AND p.proposal_code IS NULL
    AND p.client_id IS NULL
    AND nullif(trim(coalesce(p.client_name,     '')), '') IS NULL
    AND nullif(trim(coalesce(p.client_document, '')), '') IS NULL
    AND nullif(trim(coalesce(p.client_email,    '')), '') IS NULL
    AND nullif(trim(coalesce(p.client_phone,    '')), '') IS NULL
    AND coalesce(p.consumption_kwh_month, 0) = 0
    AND p.capex_total IS NULL
  );

COMMENT ON VIEW public.vw_proposals_listable IS
  'Active proposals that have at least one meaningful field '
  '(proposal_code, client link, client contact data, or financial data). '
  'Excludes auto-saved empty drafts that were never filled in.';

-- ============================================================================

COMMIT;
