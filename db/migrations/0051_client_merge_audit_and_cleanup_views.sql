-- ============================================================================
-- Migration 0051: client_merge_audit table + vw_clients_cleanup_base view
--                 + preventive indexes for email and phone
-- ============================================================================
--
-- What this migration does (in order):
--
--   SECTION A — client_merge_audit table
--     Audit trail for every merge operation performed on the clients table.
--     Records which canonical absorbed which duplicate, under which rule, and
--     captures a before-snapshot of both rows for forensic purposes.
--
--   SECTION B — vw_clients_cleanup_base view
--     Normalised projection of the clients table used by cleanup scripts.
--     Exposes:
--       · name_norm   — trimmed, lowercased, invalid strings → NULL
--       · email_norm  — trimmed, lowercased, non-email values → NULL
--       · phone_digits — digits only, blanks / placeholders → NULL
--       · completeness_score — count of filled key fields (0–13)
--     Scope: only active, non-merged rows (merged_into_client_id IS NULL).
--
--   SECTION C — Preventive indexes for email and phone
--     Expression indexes on normalised email (lower) and normalised phone
--     (digits only), scoped to active non-merged rows.
--     The partial-unique indexes for cpf_normalized and cnpj_normalized
--     already exist from migrations 0010 and 0013, so they are not repeated.
--
-- Safe to re-run (CREATE TABLE IF NOT EXISTS, CREATE OR REPLACE VIEW,
-- CREATE INDEX IF NOT EXISTS).
-- ============================================================================

BEGIN;

-- ============================================================================
-- SECTION A — client_merge_audit
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.client_merge_audit (
  id                   BIGSERIAL    PRIMARY KEY,
  executed_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
  rule_name            TEXT         NOT NULL,
  canonical_client_id  BIGINT       NOT NULL,
  duplicate_client_id  BIGINT       NOT NULL,
  reason               TEXT,
  before_canonical     JSONB,
  before_duplicate     JSONB
);

COMMENT ON TABLE public.client_merge_audit IS
  'Audit trail for all client merge operations. '
  'Each row records one duplicate absorbed into one canonical client.';

COMMENT ON COLUMN public.client_merge_audit.rule_name IS
  'Label for the merge rule that triggered this entry '
  '(e.g. merge_by_cpf, merge_by_cnpj, merge_by_email, merge_by_phone).';

COMMENT ON COLUMN public.client_merge_audit.before_canonical IS
  'JSON snapshot of the canonical client row immediately before the merge.';

COMMENT ON COLUMN public.client_merge_audit.before_duplicate IS
  'JSON snapshot of the duplicate client row immediately before the merge.';

CREATE INDEX IF NOT EXISTS idx_client_merge_audit_canonical
  ON public.client_merge_audit (canonical_client_id);

CREATE INDEX IF NOT EXISTS idx_client_merge_audit_duplicate
  ON public.client_merge_audit (duplicate_client_id);

CREATE INDEX IF NOT EXISTS idx_client_merge_audit_executed_at
  ON public.client_merge_audit (executed_at DESC);

CREATE INDEX IF NOT EXISTS idx_client_merge_audit_rule_name
  ON public.client_merge_audit (rule_name);

-- ============================================================================
-- SECTION B — vw_clients_cleanup_base
-- ============================================================================
-- NOTE: References cep (the actual column name), NOT client_cep.
--       References uc_geradora and uc_beneficiaria as renamed in migration 0027.

CREATE OR REPLACE VIEW public.vw_clients_cleanup_base AS
SELECT
  id,
  deleted_at,
  merged_into_client_id,
  created_at,
  updated_at,
  client_name,
  client_email,
  client_phone,
  client_document,
  cpf_normalized,
  cnpj_normalized,
  owner_user_id,
  created_by_user_id,
  identity_status,
  in_portfolio,
  metadata,
  origin,

  -- name_norm: trimmed lowercase, invalid placeholder strings become NULL
  CASE
    WHEN client_name IS NULL THEN NULL
    WHEN btrim(client_name) = '' THEN NULL
    WHEN lower(btrim(client_name)) IN (
      '0','null','undefined','[object object]','nan','n/a','na','-','—','__','??'
    ) THEN NULL
    -- Latin/extended-Latin alphabet check. Consistent with dedup_clients_by_name.sql.
    -- Non-Latin scripts (Cyrillic, CJK, etc.) are not currently used in this system.
    WHEN NOT (client_name ~* '[A-Za-zÀ-ÖØ-öø-ÿ]') THEN NULL
    ELSE regexp_replace(lower(btrim(client_name)), '\s+', ' ', 'g')
  END AS name_norm,

  -- email_norm: trimmed lowercase, non-email values become NULL
  CASE
    WHEN client_email IS NULL THEN NULL
    WHEN btrim(client_email) = '' THEN NULL
    WHEN lower(btrim(client_email)) IN (
      'null','undefined','[object object]','0','-','—','n/a','na'
    ) THEN NULL
    WHEN position('@' IN btrim(client_email)) = 0 THEN NULL
    ELSE lower(btrim(client_email))
  END AS email_norm,

  -- phone_digits: digits only; short/placeholder values become NULL
  CASE
    WHEN client_phone IS NULL THEN NULL
    WHEN btrim(client_phone) = '' THEN NULL
    WHEN lower(btrim(client_phone)) IN (
      'null','undefined','[object object]','0','-','—','n/a','na'
    ) THEN NULL
    -- Minimum 10 digits: Brazil landline = 10 digits (DDD + 8), mobile = 11 digits (DDD + 9).
    -- Adjust threshold if international clients are added.
    WHEN length(regexp_replace(btrim(client_phone), '\D', '', 'g')) < 10 THEN NULL
    ELSE regexp_replace(client_phone, '\D', '', 'g')
  END AS phone_digits,

  -- completeness_score: count of filled key fields (maximum 13)
  (
    (CASE WHEN nullif(btrim(coalesce(client_name,   '')), '') IS NOT NULL THEN 1 ELSE 0 END)
  + (CASE WHEN nullif(btrim(coalesce(client_email,  '')), '') IS NOT NULL THEN 1 ELSE 0 END)
  + (CASE WHEN nullif(btrim(coalesce(client_phone,  '')), '') IS NOT NULL THEN 1 ELSE 0 END)
  + (CASE WHEN nullif(btrim(coalesce(client_address,'')), '') IS NOT NULL THEN 1 ELSE 0 END)
  + (CASE WHEN nullif(btrim(coalesce(client_city,   '')), '') IS NOT NULL THEN 1 ELSE 0 END)
  + (CASE WHEN nullif(btrim(coalesce(client_state,  '')), '') IS NOT NULL THEN 1 ELSE 0 END)
  + (CASE WHEN nullif(btrim(coalesce(cep,           '')), '') IS NOT NULL THEN 1 ELSE 0 END)
  + (CASE WHEN nullif(btrim(coalesce(uc_geradora,   '')), '') IS NOT NULL THEN 1 ELSE 0 END)
  + (CASE WHEN nullif(btrim(coalesce(uc_beneficiaria,'')), '') IS NOT NULL THEN 1 ELSE 0 END)
  + (CASE WHEN cpf_normalized       IS NOT NULL THEN 1 ELSE 0 END)
  + (CASE WHEN cnpj_normalized      IS NOT NULL THEN 1 ELSE 0 END)
  + (CASE WHEN consumption_kwh_month IS NOT NULL THEN 1 ELSE 0 END)
  + (CASE WHEN system_kwp            IS NOT NULL THEN 1 ELSE 0 END)
  ) AS completeness_score

FROM public.clients
WHERE merged_into_client_id IS NULL;

COMMENT ON VIEW public.vw_clients_cleanup_base IS
  'Normalised projection of active (non-merged) clients used by cleanup scripts. '
  'Exposes name_norm, email_norm, phone_digits, and completeness_score.';

-- ============================================================================
-- SECTION C — Preventive indexes for email and phone
-- ============================================================================
-- These expression indexes accelerate duplicate detection queries and are
-- a prerequisite for the cleanup operational scripts.
-- cpf/cnpj unique partial indexes already exist (migrations 0010 / 0013).

CREATE INDEX IF NOT EXISTS idx_clients_email_lower
  ON public.clients ((lower(btrim(client_email))))
  WHERE deleted_at IS NULL
    AND merged_into_client_id IS NULL
    AND client_email IS NOT NULL
    AND btrim(client_email) <> '';

CREATE INDEX IF NOT EXISTS idx_clients_phone_digits
  ON public.clients ((regexp_replace(client_phone, '\D', '', 'g')))
  WHERE deleted_at IS NULL
    AND merged_into_client_id IS NULL
    AND client_phone IS NOT NULL
    AND length(regexp_replace(client_phone, '\D', '', 'g')) >= 10;

-- ============================================================================

COMMIT;
