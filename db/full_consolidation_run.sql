-- ============================================================================
-- SOLARINVEST — CONSOLIDAÇÃO COMPLETA DO BANCO DE CLIENTES E PROPOSTAS
-- ============================================================================
--
-- OBJETIVO
-- --------
-- Script único, automatizado e atômico que executa TODOS os passos de limpeza
-- e deduplicação de clientes em uma única transação:
--
--   FASE 0  — Schema de segurança (data_hygiene) + backup de todos os afetados
--   FASE 1  — Deduplicação por CPF    (merge + migração de FKs)
--   FASE 2  — Deduplicação por CNPJ   (merge + migração de FKs)
--   FASE 3  — Deduplicação por e-mail (merge, sem conflito de documento)
--   FASE 4  — Deduplicação por telefone + documento coincidente
--   FASE 5  — Deduplicação por nome normalizado (merge de nome idêntico)
--   FASE 6  — Soft-delete de clientes inválidos sem vínculo relevante
--   FASE 7  — Soft-delete de propostas rascunho vazias
--   FASE 8  — Backfill proposals.client_id para clientes já mesclados
--   FASE 9  — Verificação final (SELECTs de diagnóstico)
--
-- PRÉ-REQUISITOS
-- --------------
--   • Migration 0051 aplicada (cria client_merge_audit, vw_clients_cleanup_base)
--   • Migration 0052 aplicada (cria vw_clients_listable, vw_proposals_listable)
--   • pg_dump completo feito ANTES de rodar em produção
--
-- COMO USAR
-- ---------
--   1. Fazer pg_dump do banco.
--   2. Executar FASE 0 (fora de transação) para criar backups.
--   3. Executar FASE 1 a FASE 8 como uma única transação (BEGIN … COMMIT).
--      Para simular sem gravar: trocar COMMIT por ROLLBACK no final.
--   4. Executar FASE 9 para verificar o resultado.
--
-- SEGURANÇA
-- ---------
--   • Nunca soft-deleta o canônico de um grupo de duplicados.
--   • Nunca apaga/merge clientes em portfólio (in_portfolio = true).
--   • Nunca apaga clientes com contrato ativo, billing ativo ou proposta ativa.
--   • Todo merge é auditado em public.client_merge_audit.
--   • Backup salvo em data_hygiene.* antes de qualquer alteração.
--   • Script é idempotente: se executado duas vezes, a segunda rodada encontra
--     os mapas de merge vazios e produz zero operações adicionais.
--
-- ============================================================================


-- ============================================================================
-- FASE 0 — SCHEMA DE BACKUP + SNAPSHOTS (EXECUTAR FORA DA TRANSAÇÃO PRINCIPAL)
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS data_hygiene;

-- 0a) Backup de todos os clientes afetados por qualquer fase ----------------

CREATE TABLE IF NOT EXISTS data_hygiene.full_consolidation_clients_backup
  AS TABLE public.clients WITH NO DATA;

ALTER TABLE data_hygiene.full_consolidation_clients_backup
  ADD COLUMN IF NOT EXISTS backed_up_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS backup_reason TEXT;

INSERT INTO data_hygiene.full_consolidation_clients_backup
SELECT c.*, now(),
  CASE
    WHEN c.cpf_normalized IS NOT NULL
      AND c.cpf_normalized IN (
        SELECT cpf_normalized FROM public.clients
        WHERE deleted_at IS NULL AND merged_into_client_id IS NULL AND cpf_normalized IS NOT NULL
        GROUP BY cpf_normalized HAVING COUNT(*) > 1
      ) THEN 'cpf_duplicate'
    WHEN c.cnpj_normalized IS NOT NULL
      AND c.cnpj_normalized IN (
        SELECT cnpj_normalized FROM public.clients
        WHERE deleted_at IS NULL AND merged_into_client_id IS NULL AND cnpj_normalized IS NOT NULL
        GROUP BY cnpj_normalized HAVING COUNT(*) > 1
      ) THEN 'cnpj_duplicate'
    WHEN c.client_email IS NOT NULL
      AND position('@' IN btrim(c.client_email)) > 0
      AND lower(btrim(c.client_email)) IN (
        SELECT lower(btrim(client_email))
        FROM public.clients
        WHERE deleted_at IS NULL AND merged_into_client_id IS NULL
          AND client_email IS NOT NULL AND btrim(client_email) <> ''
          AND position('@' IN btrim(client_email)) > 0
        GROUP BY 1 HAVING COUNT(*) > 1
      ) THEN 'email_duplicate'
    WHEN NOT (coalesce(c.client_name, '') ~* '[A-Za-zÀ-ÖØ-öø-ÿ]') THEN 'invalid_name'
    WHEN c.cpf_normalized IS NULL AND c.cnpj_normalized IS NULL
      AND (c.client_email IS NULL OR position('@' IN c.client_email) = 0)
      AND length(regexp_replace(coalesce(c.client_phone, ''), '\D', '', 'g')) < 10 THEN 'no_valid_anchor'
    ELSE 'duplicate_name'
  END AS backup_reason
FROM public.clients c
WHERE c.deleted_at IS NULL
  AND (
    -- CPF/CNPJ duplicates
    (c.cpf_normalized IS NOT NULL AND c.cpf_normalized IN (
      SELECT cpf_normalized FROM public.clients
      WHERE deleted_at IS NULL AND merged_into_client_id IS NULL AND cpf_normalized IS NOT NULL
      GROUP BY cpf_normalized HAVING COUNT(*) > 1))
    OR (c.cnpj_normalized IS NOT NULL AND c.cnpj_normalized IN (
      SELECT cnpj_normalized FROM public.clients
      WHERE deleted_at IS NULL AND merged_into_client_id IS NULL AND cnpj_normalized IS NOT NULL
      GROUP BY cnpj_normalized HAVING COUNT(*) > 1))
    -- Email duplicates
    OR (c.client_email IS NOT NULL AND position('@' IN btrim(c.client_email)) > 0
      AND lower(btrim(c.client_email)) IN (
        SELECT lower(btrim(client_email))
        FROM public.clients
        WHERE deleted_at IS NULL AND merged_into_client_id IS NULL
          AND client_email IS NOT NULL AND btrim(client_email) <> ''
          AND position('@' IN btrim(client_email)) > 0
        GROUP BY 1 HAVING COUNT(*) > 1))
    -- Name duplicates (valid name, exact normalized match, 2+ copies)
    OR (coalesce(c.client_name, '') ~* '[A-Za-zÀ-ÖØ-öø-ÿ]'
      AND lower(regexp_replace(btrim(c.client_name), '\s+', ' ', 'g')) IN (
        SELECT lower(regexp_replace(btrim(client_name), '\s+', ' ', 'g'))
        FROM public.clients
        WHERE deleted_at IS NULL AND merged_into_client_id IS NULL
          AND coalesce(client_name, '') ~* '[A-Za-zÀ-ÖØ-öø-ÿ]'
        GROUP BY 1 HAVING COUNT(*) > 1))
    -- Invalid name (no letters)
    OR NOT (coalesce(c.client_name, '') ~* '[A-Za-zÀ-ÖØ-öø-ÿ]')
    -- No valid anchor at all
    OR (c.cpf_normalized IS NULL AND c.cnpj_normalized IS NULL
      AND (c.client_email IS NULL OR position('@' IN c.client_email) = 0)
      AND length(regexp_replace(coalesce(c.client_phone, ''), '\D', '', 'g')) < 10)
  )
ON CONFLICT DO NOTHING;

-- 0b) Backup de proposals afetadas -----------------------------------------

CREATE TABLE IF NOT EXISTS data_hygiene.full_consolidation_proposals_backup
  AS TABLE public.proposals WITH NO DATA;

ALTER TABLE data_hygiene.full_consolidation_proposals_backup
  ADD COLUMN IF NOT EXISTS backed_up_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS backup_reason TEXT;

INSERT INTO data_hygiene.full_consolidation_proposals_backup
SELECT p.*, now(), 'client_affected_by_consolidation'
FROM public.proposals p
WHERE p.client_id IN (SELECT id FROM data_hygiene.full_consolidation_clients_backup)
   OR (
      -- Empty draft proposals about to be soft-deleted
      p.deleted_at IS NULL
      AND coalesce(p.status, '') = 'draft'
      AND p.proposal_code IS NULL
      AND p.client_id IS NULL
      AND nullif(trim(coalesce(p.client_name,     '')), '') IS NULL
      AND nullif(trim(coalesce(p.client_document, '')), '') IS NULL
      AND nullif(trim(coalesce(p.client_email,    '')), '') IS NULL
      AND nullif(trim(coalesce(p.client_phone,    '')), '') IS NULL
      AND coalesce(p.consumption_kwh_month, 0) = 0
      AND p.capex_total IS NULL
   )
ON CONFLICT DO NOTHING;

-- 0c) Confirmar volumes de backup ------------------------------------------

SELECT
  'Clientes salvos no backup' AS label,
  backup_reason,
  COUNT(*)                    AS linhas
FROM data_hygiene.full_consolidation_clients_backup
GROUP BY backup_reason
ORDER BY linhas DESC;

SELECT
  'Propostas salvas no backup' AS label,
  COUNT(*)                     AS linhas
FROM data_hygiene.full_consolidation_proposals_backup;


-- ============================================================================
-- FASES 1–8 — TRANSAÇÃO PRINCIPAL
-- ============================================================================
-- Para dry-run: substituir COMMIT por ROLLBACK no final deste bloco.
-- ============================================================================

BEGIN;

-- Dropar tabelas temporárias de execuções anteriores (idempotente):
DROP TABLE IF EXISTS data_hygiene._merge_map;
DROP TABLE IF EXISTS data_hygiene._dedup_scores;
DROP TABLE IF EXISTS data_hygiene._name_scores;
DROP TABLE IF EXISTS data_hygiene._name_map;


-- ============================================================================
-- FASE 1 — CPF DUPLICADO
-- ============================================================================

-- 1a) Tabela de scores por cliente com CPF
CREATE TABLE data_hygiene._dedup_scores AS
SELECT
  c.id                                                            AS client_id,
  c.cpf_normalized,
  c.cnpj_normalized,
  coalesce(c.cpf_normalized, c.cnpj_normalized)                  AS doc_norm,
  vw.completeness_score,
  CASE WHEN c.identity_status = 'confirmed' THEN 0 ELSE 1 END    AS identity_rank,
  CASE WHEN c.deleted_at IS NULL            THEN 0 ELSE 1 END    AS deleted_rank,
  c.created_at,
  c.id                                                            AS id_for_sort
FROM public.clients c
JOIN public.vw_clients_cleanup_base vw ON vw.id = c.id
WHERE coalesce(c.cpf_normalized, c.cnpj_normalized) IS NOT NULL;

CREATE INDEX ON data_hygiene._dedup_scores (cpf_normalized, completeness_score DESC, identity_rank, deleted_rank, created_at, id_for_sort);
CREATE INDEX ON data_hygiene._dedup_scores (cnpj_normalized, completeness_score DESC, identity_rank, deleted_rank, created_at, id_for_sort);

-- 1b) Mapa canônico ↔ duplicado para CPF
CREATE TABLE data_hygiene._merge_map AS
WITH ranked AS (
  SELECT
    client_id,
    cpf_normalized   AS key_value,
    'cpf'::text      AS merge_rule,
    completeness_score, identity_rank, deleted_rank, created_at, id_for_sort,
    ROW_NUMBER() OVER (
      PARTITION BY cpf_normalized
      ORDER BY completeness_score DESC, identity_rank, deleted_rank, created_at, id_for_sort
    ) AS rn
  FROM data_hygiene._dedup_scores
  WHERE cpf_normalized IS NOT NULL
    AND cpf_normalized IN (
      SELECT cpf_normalized FROM data_hygiene._dedup_scores
      WHERE cpf_normalized IS NOT NULL
      GROUP BY cpf_normalized HAVING COUNT(*) > 1
    )
)
SELECT
  canon.client_id AS canonical_id,
  dup.client_id   AS duplicate_id,
  dup.merge_rule,
  dup.key_value
FROM ranked dup
JOIN ranked canon ON canon.key_value = dup.key_value AND canon.rn = 1
WHERE dup.rn > 1;

-- ============================================================================
-- FASE 2 — CNPJ DUPLICADO
-- ============================================================================

INSERT INTO data_hygiene._merge_map
WITH ranked AS (
  SELECT
    client_id,
    cnpj_normalized AS key_value,
    'cnpj'::text    AS merge_rule,
    completeness_score, identity_rank, deleted_rank, created_at, id_for_sort,
    ROW_NUMBER() OVER (
      PARTITION BY cnpj_normalized
      ORDER BY completeness_score DESC, identity_rank, deleted_rank, created_at, id_for_sort
    ) AS rn
  FROM data_hygiene._dedup_scores
  WHERE cnpj_normalized IS NOT NULL
    AND cnpj_normalized IN (
      SELECT cnpj_normalized FROM data_hygiene._dedup_scores
      WHERE cnpj_normalized IS NOT NULL
      GROUP BY cnpj_normalized HAVING COUNT(*) > 1
    )
)
SELECT
  canon.client_id, dup.client_id, dup.merge_rule, dup.key_value
FROM ranked dup
JOIN ranked canon ON canon.key_value = dup.key_value AND canon.rn = 1
WHERE dup.rn > 1
  AND NOT EXISTS (
    SELECT 1 FROM data_hygiene._merge_map ex
    WHERE ex.canonical_id = canon.client_id AND ex.duplicate_id = dup.client_id
  );

CREATE INDEX ON data_hygiene._merge_map (canonical_id);
CREATE INDEX ON data_hygiene._merge_map (duplicate_id);

-- ============================================================================
-- FASE 3 — E-MAIL DUPLICADO (sem conflito de documento)
-- ============================================================================

WITH email_pairs AS (
  SELECT
    a.id AS id_a, b.id AS id_b,
    lower(btrim(a.client_email)) AS email_norm,
    vw_a.completeness_score AS score_a,
    vw_b.completeness_score AS score_b
  FROM public.clients a
  JOIN public.clients b
    ON lower(btrim(b.client_email)) = lower(btrim(a.client_email))
   AND a.id < b.id
   AND b.deleted_at IS NULL
   AND b.merged_into_client_id IS NULL
  JOIN public.vw_clients_cleanup_base vw_a ON vw_a.id = a.id
  JOIN public.vw_clients_cleanup_base vw_b ON vw_b.id = b.id
  WHERE a.deleted_at IS NULL
    AND a.merged_into_client_id IS NULL
    AND a.client_email IS NOT NULL
    AND btrim(a.client_email) <> ''
    AND lower(btrim(a.client_email)) NOT IN ('null','undefined','[object object]','0','-',u&'\2014','n/a','na')
    AND position('@' IN btrim(a.client_email)) > 0
    -- Not already handled by CPF/CNPJ merge
    AND NOT EXISTS (
      SELECT 1 FROM data_hygiene._merge_map dm
      WHERE (dm.canonical_id = a.id AND dm.duplicate_id = b.id)
         OR (dm.canonical_id = b.id AND dm.duplicate_id = a.id)
    )
    -- No document conflict
    AND NOT (a.cpf_normalized  IS NOT NULL AND b.cpf_normalized  IS NOT NULL AND a.cpf_normalized  <> b.cpf_normalized)
    AND NOT (a.cnpj_normalized IS NOT NULL AND b.cnpj_normalized IS NOT NULL AND a.cnpj_normalized <> b.cnpj_normalized)
),
ranked AS (
  SELECT
    unnested.client_id,
    ep.email_norm,
    vw.completeness_score,
    CASE WHEN c.identity_status = 'confirmed' THEN 0 ELSE 1 END AS identity_rank,
    CASE WHEN c.deleted_at IS NULL            THEN 0 ELSE 1 END AS deleted_rank,
    c.created_at,
    c.id AS id_for_sort,
    ROW_NUMBER() OVER (
      PARTITION BY ep.email_norm
      ORDER BY vw.completeness_score DESC,
               (CASE WHEN c.identity_status = 'confirmed' THEN 0 ELSE 1 END),
               (CASE WHEN c.deleted_at IS NULL THEN 0 ELSE 1 END),
               c.created_at, c.id
    ) AS rn
  FROM (SELECT DISTINCT email_norm FROM email_pairs) ep
  CROSS JOIN LATERAL (
    SELECT DISTINCT unnest(ARRAY[id_a, id_b]) AS client_id
    FROM email_pairs ep2 WHERE ep2.email_norm = ep.email_norm
  ) unnested
  JOIN public.clients c ON c.id = unnested.client_id
  JOIN public.vw_clients_cleanup_base vw ON vw.id = unnested.client_id
)
INSERT INTO data_hygiene._merge_map (canonical_id, duplicate_id, merge_rule, key_value)
SELECT
  canon.client_id, dup.client_id, 'email', dup.email_norm
FROM ranked dup
JOIN ranked canon ON canon.email_norm = dup.email_norm AND canon.rn = 1
WHERE dup.rn > 1
  AND NOT EXISTS (
    SELECT 1 FROM data_hygiene._merge_map ex
    WHERE (ex.canonical_id = canon.client_id AND ex.duplicate_id = dup.client_id)
       OR (ex.canonical_id = dup.client_id  AND ex.duplicate_id = canon.client_id)
  );

-- ============================================================================
-- FASE 4 — TELEFONE + DOCUMENTO COINCIDENTE
-- ============================================================================

WITH phone_pairs AS (
  SELECT
    a.id AS id_a, b.id AS id_b,
    regexp_replace(a.client_phone, '\D', '', 'g') AS phone_digits
  FROM public.clients a
  JOIN public.clients b
    ON regexp_replace(b.client_phone, '\D', '', 'g') = regexp_replace(a.client_phone, '\D', '', 'g')
   AND a.id < b.id
   AND b.deleted_at IS NULL
   AND b.merged_into_client_id IS NULL
  JOIN public.vw_clients_cleanup_base vw_a ON vw_a.id = a.id
  JOIN public.vw_clients_cleanup_base vw_b ON vw_b.id = b.id
  WHERE a.deleted_at IS NULL
    AND a.merged_into_client_id IS NULL
    AND a.client_phone IS NOT NULL
    AND length(regexp_replace(a.client_phone, '\D', '', 'g')) >= 10
    -- Document confirmation required
    AND (
      (a.cpf_normalized  IS NOT NULL AND b.cpf_normalized  IS NOT NULL AND a.cpf_normalized  = b.cpf_normalized)
      OR (a.cnpj_normalized IS NOT NULL AND b.cnpj_normalized IS NOT NULL AND a.cnpj_normalized = b.cnpj_normalized)
    )
    AND NOT EXISTS (
      SELECT 1 FROM data_hygiene._merge_map dm
      WHERE (dm.canonical_id = a.id AND dm.duplicate_id = b.id)
         OR (dm.canonical_id = b.id AND dm.duplicate_id = a.id)
    )
),
ranked AS (
  SELECT
    unnested.client_id,
    pp.phone_digits,
    vw.completeness_score,
    CASE WHEN c.identity_status = 'confirmed' THEN 0 ELSE 1 END AS identity_rank,
    CASE WHEN c.deleted_at IS NULL            THEN 0 ELSE 1 END AS deleted_rank,
    c.created_at,
    c.id AS id_for_sort,
    ROW_NUMBER() OVER (
      PARTITION BY pp.phone_digits
      ORDER BY vw.completeness_score DESC,
               (CASE WHEN c.identity_status = 'confirmed' THEN 0 ELSE 1 END),
               (CASE WHEN c.deleted_at IS NULL THEN 0 ELSE 1 END),
               c.created_at, c.id
    ) AS rn
  FROM (SELECT DISTINCT phone_digits FROM phone_pairs) pp
  CROSS JOIN LATERAL (
    SELECT DISTINCT unnest(ARRAY[id_a, id_b]) AS client_id
    FROM phone_pairs pp2 WHERE pp2.phone_digits = pp.phone_digits
  ) unnested
  JOIN public.clients c ON c.id = unnested.client_id
  JOIN public.vw_clients_cleanup_base vw ON vw.id = unnested.client_id
)
INSERT INTO data_hygiene._merge_map (canonical_id, duplicate_id, merge_rule, key_value)
SELECT
  canon.client_id, dup.client_id, 'phone', dup.phone_digits
FROM ranked dup
JOIN ranked canon ON canon.phone_digits = dup.phone_digits AND canon.rn = 1
WHERE dup.rn > 1
  AND NOT EXISTS (
    SELECT 1 FROM data_hygiene._merge_map ex
    WHERE (ex.canonical_id = canon.client_id AND ex.duplicate_id = dup.client_id)
       OR (ex.canonical_id = dup.client_id  AND ex.duplicate_id = canon.client_id)
  );

-- ============================================================================
-- FASE 5 — NOME NORMALIZADO DUPLICADO
-- ============================================================================

CREATE TABLE data_hygiene._name_scores AS
WITH valid_dup_names AS (
  SELECT lower(regexp_replace(btrim(client_name), '\s+', ' ', 'g')) AS normalized_name
  FROM public.clients
  WHERE deleted_at IS NULL
    AND merged_into_client_id IS NULL
    AND coalesce(client_name, '') ~* '[A-Za-zÀ-ÖØ-öø-ÿ]'
    -- Already handled by doc/email/phone: skip clients already in _merge_map
    AND id NOT IN (
      SELECT duplicate_id FROM data_hygiene._merge_map
      UNION
      SELECT canonical_id FROM data_hygiene._merge_map
    )
  GROUP BY 1
  HAVING COUNT(*) > 1
)
SELECT
  c.id AS client_id,
  lower(regexp_replace(btrim(c.client_name), '\s+', ' ', 'g')) AS normalized_name,
  (
    CASE WHEN c.in_portfolio THEN 50 ELSE 0 END
    + CASE WHEN EXISTS(SELECT 1 FROM public.client_contracts cc WHERE cc.client_id = c.id AND cc.contract_status IN ('active','signed','suspended')) THEN 40 ELSE 0 END
    + CASE WHEN EXISTS(SELECT 1 FROM public.client_billing_profile bp WHERE bp.client_id = c.id AND bp.payment_status NOT IN ('cancelled','written_off')) THEN 30 ELSE 0 END
    + CASE WHEN EXISTS(SELECT 1 FROM public.proposals p WHERE p.client_id = c.id AND p.deleted_at IS NULL AND p.status NOT IN ('cancelled','rejected')) THEN 20 ELSE 0 END
    + CASE WHEN c.client_document IS NOT NULL AND btrim(c.client_document) <> '' THEN  5 ELSE 0 END
    + CASE WHEN c.client_email IS NOT NULL AND c.client_email LIKE '%@%.%'       THEN  3 ELSE 0 END
    + CASE WHEN c.client_phone IS NOT NULL AND length(regexp_replace(c.client_phone, '[^0-9]', '', 'g')) >= 10 THEN 2 ELSE 0 END
  ) AS strength_score,
  c.updated_at,
  c.created_at
FROM public.clients c
JOIN valid_dup_names vn ON vn.normalized_name = lower(regexp_replace(btrim(c.client_name), '\s+', ' ', 'g'))
WHERE c.deleted_at IS NULL
  AND c.merged_into_client_id IS NULL;

CREATE INDEX ON data_hygiene._name_scores (normalized_name, strength_score DESC, updated_at DESC, created_at DESC, client_id DESC);

CREATE TABLE data_hygiene._name_map AS
WITH ranked AS (
  SELECT
    client_id,
    normalized_name,
    strength_score,
    updated_at,
    created_at,
    ROW_NUMBER() OVER (
      PARTITION BY normalized_name
      ORDER BY strength_score DESC, updated_at DESC NULLS LAST, created_at DESC NULLS LAST, client_id DESC
    ) AS rn
  FROM data_hygiene._name_scores
)
SELECT
  ranked.normalized_name,
  canon.client_id AS canonical_id,
  ranked.client_id AS duplicate_id
FROM ranked
JOIN (SELECT normalized_name, client_id FROM ranked WHERE rn = 1) AS canon
  ON canon.normalized_name = ranked.normalized_name
WHERE ranked.rn > 1;

CREATE INDEX ON data_hygiene._name_map (canonical_id);
CREATE INDEX ON data_hygiene._name_map (duplicate_id);

-- ============================================================================
-- ENRIQUECIMENTO DOS CANÔNICOS (todas as fases conjuntas)
-- Preenche campos vazios do canônico com o melhor valor dos duplicados.
-- Regra: nunca sobrescrever dado existente com NULL/vazio.
-- ============================================================================

-- ── Enriquecimento via _merge_map (CPF/CNPJ/email/phone) ──────────────────

WITH best AS (
  SELECT
    mm.canonical_id,
    (array_agg(d.client_name     ORDER BY vw.completeness_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.client_name IS NOT NULL AND btrim(d.client_name) <> '' AND d.client_name ~* '[A-Za-zÀ-ÖØ-öø-ÿ]'))[1] AS best_name,
    (array_agg(d.client_document ORDER BY vw.completeness_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.client_document IS NOT NULL AND btrim(d.client_document) <> ''))[1]                                    AS best_document,
    (array_agg(d.cpf_normalized  ORDER BY vw.completeness_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.cpf_normalized IS NOT NULL))[1]                                                                        AS best_cpf_normalized,
    (array_agg(d.cpf_raw         ORDER BY vw.completeness_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.cpf_raw IS NOT NULL AND btrim(d.cpf_raw) <> ''))[1]                                                    AS best_cpf_raw,
    (array_agg(d.cnpj_normalized ORDER BY vw.completeness_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.cnpj_normalized IS NOT NULL))[1]                                                                       AS best_cnpj_normalized,
    (array_agg(d.cnpj_raw        ORDER BY vw.completeness_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.cnpj_raw IS NOT NULL AND btrim(d.cnpj_raw) <> ''))[1]                                                  AS best_cnpj_raw,
    (array_agg(d.document_type   ORDER BY vw.completeness_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.document_type IS NOT NULL AND btrim(d.document_type) <> ''))[1]                                        AS best_document_type,
    (array_agg(d.client_email    ORDER BY vw.completeness_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.client_email IS NOT NULL AND d.client_email LIKE '%@%.%'))[1]                                          AS best_email,
    (array_agg(d.client_phone    ORDER BY vw.completeness_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.client_phone IS NOT NULL AND length(regexp_replace(d.client_phone, '[^0-9]', '', 'g')) >= 10))[1]     AS best_phone,
    (array_agg(d.client_city     ORDER BY vw.completeness_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.client_city IS NOT NULL AND btrim(d.client_city) <> ''))[1]                                            AS best_city,
    (array_agg(d.client_state    ORDER BY vw.completeness_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.client_state IS NOT NULL AND btrim(d.client_state) <> ''))[1]                                          AS best_state,
    (array_agg(d.client_address  ORDER BY vw.completeness_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.client_address IS NOT NULL AND btrim(d.client_address) <> ''))[1]                                      AS best_address,
    (array_agg(d.cep             ORDER BY vw.completeness_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.cep IS NOT NULL AND btrim(d.cep) <> ''))[1]                                                            AS best_cep,
    (array_agg(d.uc_geradora     ORDER BY vw.completeness_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.uc_geradora IS NOT NULL AND btrim(d.uc_geradora) <> ''))[1]                                            AS best_uc_geradora,
    (array_agg(d.uc_beneficiaria ORDER BY vw.completeness_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.uc_beneficiaria IS NOT NULL AND btrim(d.uc_beneficiaria) <> ''))[1]                                    AS best_uc_beneficiaria,
    (array_agg(d.distribuidora   ORDER BY vw.completeness_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.distribuidora IS NOT NULL AND btrim(d.distribuidora) <> ''))[1]                                        AS best_distribuidora,
    (array_agg(d.consumption_kwh_month ORDER BY vw.completeness_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.consumption_kwh_month IS NOT NULL AND d.consumption_kwh_month > 0))[1]                                 AS best_consumption_kwh_month,
    (array_agg(d.system_kwp      ORDER BY vw.completeness_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.system_kwp IS NOT NULL AND d.system_kwp > 0))[1]                                                       AS best_system_kwp,
    (array_agg(d.term_months     ORDER BY vw.completeness_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.term_months IS NOT NULL AND btrim(d.term_months) <> ''))[1]                                            AS best_term_months,
    (array_agg(d.nome_razao      ORDER BY vw.completeness_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.nome_razao IS NOT NULL AND btrim(d.nome_razao) <> ''))[1]                                              AS best_nome_razao,
    (array_agg(d.logradouro      ORDER BY vw.completeness_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.logradouro IS NOT NULL AND btrim(d.logradouro) <> ''))[1]                                              AS best_logradouro,
    (array_agg(d.numero          ORDER BY vw.completeness_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.numero IS NOT NULL AND btrim(d.numero) <> ''))[1]                                                      AS best_numero,
    (array_agg(d.complemento     ORDER BY vw.completeness_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.complemento IS NOT NULL AND btrim(d.complemento) <> ''))[1]                                            AS best_complemento,
    (array_agg(d.bairro          ORDER BY vw.completeness_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.bairro IS NOT NULL AND btrim(d.bairro) <> ''))[1]                                                      AS best_bairro,
    (array_agg(d.telefone_secundario ORDER BY vw.completeness_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.telefone_secundario IS NOT NULL AND length(regexp_replace(d.telefone_secundario, '[^0-9]', '', 'g')) >= 10))[1] AS best_telefone_secundario,
    (array_agg(d.observacoes     ORDER BY vw.completeness_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.observacoes IS NOT NULL AND btrim(d.observacoes) <> ''))[1]                                            AS best_observacoes
  FROM data_hygiene._merge_map mm
  JOIN public.clients d ON d.id = mm.duplicate_id
  JOIN public.vw_clients_cleanup_base vw ON vw.id = mm.duplicate_id
  GROUP BY mm.canonical_id
)
UPDATE public.clients c
SET
  client_name           = COALESCE(c.client_name,           best.best_name),
  client_document       = COALESCE(c.client_document,       best.best_document),
  cpf_normalized        = COALESCE(c.cpf_normalized,        best.best_cpf_normalized),
  cpf_raw               = COALESCE(c.cpf_raw,               best.best_cpf_raw),
  cnpj_normalized       = COALESCE(c.cnpj_normalized,       best.best_cnpj_normalized),
  cnpj_raw              = COALESCE(c.cnpj_raw,              best.best_cnpj_raw),
  document_type         = COALESCE(c.document_type,         best.best_document_type),
  client_email          = COALESCE(c.client_email,          best.best_email),
  client_phone          = COALESCE(c.client_phone,          best.best_phone),
  client_city           = COALESCE(c.client_city,           best.best_city),
  client_state          = COALESCE(c.client_state,          best.best_state),
  client_address        = COALESCE(c.client_address,        best.best_address),
  cep                   = COALESCE(c.cep,                   best.best_cep),
  uc_geradora           = COALESCE(c.uc_geradora,           best.best_uc_geradora),
  uc_beneficiaria       = COALESCE(c.uc_beneficiaria,       best.best_uc_beneficiaria),
  distribuidora         = COALESCE(c.distribuidora,         best.best_distribuidora),
  consumption_kwh_month = COALESCE(c.consumption_kwh_month, best.best_consumption_kwh_month),
  system_kwp            = COALESCE(c.system_kwp,            best.best_system_kwp),
  term_months           = COALESCE(c.term_months,           best.best_term_months),
  nome_razao            = COALESCE(c.nome_razao,            best.best_nome_razao),
  logradouro            = COALESCE(c.logradouro,            best.best_logradouro),
  numero                = COALESCE(c.numero,                best.best_numero),
  complemento           = COALESCE(c.complemento,           best.best_complemento),
  bairro                = COALESCE(c.bairro,                best.best_bairro),
  telefone_secundario   = COALESCE(c.telefone_secundario,   best.best_telefone_secundario),
  observacoes           = COALESCE(c.observacoes,           best.best_observacoes),
  identity_status       = CASE
                            WHEN c.identity_status = 'pending_cpf'
                             AND COALESCE(c.cpf_normalized, best.best_cpf_normalized) IS NOT NULL
                            THEN 'confirmed'
                            ELSE c.identity_status
                          END,
  updated_at            = now()
FROM best
WHERE c.id = best.canonical_id;

-- ── Enriquecimento via _name_map ───────────────────────────────────────────

WITH best AS (
  SELECT
    nm.canonical_id,
    (array_agg(d.client_document   ORDER BY ns.strength_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.client_document IS NOT NULL AND btrim(d.client_document) <> ''))[1] AS best_document,
    (array_agg(d.cpf_normalized    ORDER BY ns.strength_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.cpf_normalized IS NOT NULL))[1]                                      AS best_cpf_normalized,
    (array_agg(d.cpf_raw           ORDER BY ns.strength_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.cpf_raw IS NOT NULL AND btrim(d.cpf_raw) <> ''))[1]                  AS best_cpf_raw,
    (array_agg(d.cnpj_normalized   ORDER BY ns.strength_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.cnpj_normalized IS NOT NULL))[1]                                     AS best_cnpj_normalized,
    (array_agg(d.cnpj_raw          ORDER BY ns.strength_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.cnpj_raw IS NOT NULL AND btrim(d.cnpj_raw) <> ''))[1]                AS best_cnpj_raw,
    (array_agg(d.document_type     ORDER BY ns.strength_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.document_type IS NOT NULL AND btrim(d.document_type) <> ''))[1]      AS best_document_type,
    (array_agg(d.client_email      ORDER BY ns.strength_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.client_email IS NOT NULL AND d.client_email LIKE '%@%.%'))[1]        AS best_email,
    (array_agg(d.client_phone      ORDER BY ns.strength_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.client_phone IS NOT NULL AND length(regexp_replace(d.client_phone, '[^0-9]', '', 'g')) >= 10))[1] AS best_phone,
    (array_agg(d.client_city       ORDER BY ns.strength_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.client_city IS NOT NULL AND btrim(d.client_city) <> ''))[1]          AS best_city,
    (array_agg(d.client_state      ORDER BY ns.strength_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.client_state IS NOT NULL AND btrim(d.client_state) <> ''))[1]        AS best_state,
    (array_agg(d.client_address    ORDER BY ns.strength_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.client_address IS NOT NULL AND btrim(d.client_address) <> ''))[1]    AS best_address,
    (array_agg(d.cep               ORDER BY ns.strength_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.cep IS NOT NULL AND btrim(d.cep) <> ''))[1]                          AS best_cep,
    (array_agg(d.uc_geradora       ORDER BY ns.strength_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.uc_geradora IS NOT NULL AND btrim(d.uc_geradora) <> ''))[1]          AS best_uc_geradora,
    (array_agg(d.uc_beneficiaria   ORDER BY ns.strength_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.uc_beneficiaria IS NOT NULL AND btrim(d.uc_beneficiaria) <> ''))[1]  AS best_uc_beneficiaria,
    (array_agg(d.distribuidora     ORDER BY ns.strength_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.distribuidora IS NOT NULL AND btrim(d.distribuidora) <> ''))[1]      AS best_distribuidora,
    (array_agg(d.consumption_kwh_month ORDER BY ns.strength_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.consumption_kwh_month IS NOT NULL AND d.consumption_kwh_month > 0))[1] AS best_consumption_kwh_month,
    (array_agg(d.system_kwp        ORDER BY ns.strength_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.system_kwp IS NOT NULL AND d.system_kwp > 0))[1]                    AS best_system_kwp,
    (array_agg(d.logradouro        ORDER BY ns.strength_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.logradouro IS NOT NULL AND btrim(d.logradouro) <> ''))[1]            AS best_logradouro,
    (array_agg(d.bairro            ORDER BY ns.strength_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.bairro IS NOT NULL AND btrim(d.bairro) <> ''))[1]                    AS best_bairro,
    (array_agg(d.observacoes       ORDER BY ns.strength_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.observacoes IS NOT NULL AND btrim(d.observacoes) <> ''))[1]          AS best_observacoes
  FROM data_hygiene._name_map nm
  JOIN public.clients d ON d.id = nm.duplicate_id
  JOIN data_hygiene._name_scores ns ON ns.client_id = nm.duplicate_id
  GROUP BY nm.canonical_id
)
UPDATE public.clients c
SET
  client_document       = COALESCE(c.client_document,       best.best_document),
  cpf_normalized        = COALESCE(c.cpf_normalized,        best.best_cpf_normalized),
  cpf_raw               = COALESCE(c.cpf_raw,               best.best_cpf_raw),
  cnpj_normalized       = COALESCE(c.cnpj_normalized,       best.best_cnpj_normalized),
  cnpj_raw              = COALESCE(c.cnpj_raw,              best.best_cnpj_raw),
  document_type         = COALESCE(c.document_type,         best.best_document_type),
  client_email          = COALESCE(c.client_email,          best.best_email),
  client_phone          = COALESCE(c.client_phone,          best.best_phone),
  client_city           = COALESCE(c.client_city,           best.best_city),
  client_state          = COALESCE(c.client_state,          best.best_state),
  client_address        = COALESCE(c.client_address,        best.best_address),
  cep                   = COALESCE(c.cep,                   best.best_cep),
  uc_geradora           = COALESCE(c.uc_geradora,           best.best_uc_geradora),
  uc_beneficiaria       = COALESCE(c.uc_beneficiaria,       best.best_uc_beneficiaria),
  distribuidora         = COALESCE(c.distribuidora,         best.best_distribuidora),
  consumption_kwh_month = COALESCE(c.consumption_kwh_month, best.best_consumption_kwh_month),
  system_kwp            = COALESCE(c.system_kwp,            best.best_system_kwp),
  logradouro            = COALESCE(c.logradouro,            best.best_logradouro),
  bairro                = COALESCE(c.bairro,                best.best_bairro),
  observacoes           = COALESCE(c.observacoes,           best.best_observacoes),
  identity_status       = CASE
                            WHEN c.identity_status = 'pending_cpf'
                             AND COALESCE(c.cpf_normalized, best.best_cpf_normalized) IS NOT NULL
                            THEN 'confirmed'
                            ELSE c.identity_status
                          END,
  updated_at            = now()
FROM best
WHERE c.id = best.canonical_id
  AND (
    (c.client_document IS NULL    AND best.best_document IS NOT NULL)
    OR (c.cpf_normalized IS NULL  AND best.best_cpf_normalized IS NOT NULL)
    OR (c.cnpj_normalized IS NULL AND best.best_cnpj_normalized IS NOT NULL)
    OR (c.client_email IS NULL    AND best.best_email IS NOT NULL)
    OR (c.client_phone IS NULL    AND best.best_phone IS NOT NULL)
    OR (c.client_city IS NULL     AND best.best_city IS NOT NULL)
  );

-- ============================================================================
-- MIGRAÇÃO DE VÍNCULOS (FK redirect: duplicate → canonical)
-- Aplicado aos dois mapas juntos (_merge_map + _name_map) como combined_map.
-- ============================================================================

-- Criar visão combinada dos dois mapas para reutilização:
-- (usamos CTE com UNION ALL inline em cada UPDATE)

-- proposals
UPDATE public.proposals p
SET   client_id = cm.canonical_id, updated_at = now()
FROM (
  SELECT duplicate_id, canonical_id FROM data_hygiene._merge_map
  UNION ALL
  SELECT duplicate_id, canonical_id FROM data_hygiene._name_map
) cm
WHERE p.client_id = cm.duplicate_id AND p.deleted_at IS NULL;

-- client_contracts
UPDATE public.client_contracts cc
SET   client_id = cm.canonical_id, updated_at = now()
FROM (
  SELECT duplicate_id, canonical_id FROM data_hygiene._merge_map
  UNION ALL
  SELECT duplicate_id, canonical_id FROM data_hygiene._name_map
) cm
WHERE cc.client_id = cm.duplicate_id;

-- client_notes
UPDATE public.client_notes cn
SET   client_id = cm.canonical_id
FROM (
  SELECT duplicate_id, canonical_id FROM data_hygiene._merge_map
  UNION ALL
  SELECT duplicate_id, canonical_id FROM data_hygiene._name_map
) cm
WHERE cn.client_id = cm.duplicate_id;

-- contacts (CRM)
UPDATE public.contacts ct
SET   client_id = cm.canonical_id, updated_at = now()
FROM (
  SELECT duplicate_id, canonical_id FROM data_hygiene._merge_map
  UNION ALL
  SELECT duplicate_id, canonical_id FROM data_hygiene._name_map
) cm
WHERE ct.client_id = cm.duplicate_id;

-- deals (CRM)
UPDATE public.deals dl
SET   client_id = cm.canonical_id, updated_at = now()
FROM (
  SELECT duplicate_id, canonical_id FROM data_hygiene._merge_map
  UNION ALL
  SELECT duplicate_id, canonical_id FROM data_hygiene._name_map
) cm
WHERE dl.client_id = cm.duplicate_id;

-- activities (CRM)
UPDATE public.activities ac
SET   client_id = cm.canonical_id, updated_at = now()
FROM (
  SELECT duplicate_id, canonical_id FROM data_hygiene._merge_map
  UNION ALL
  SELECT duplicate_id, canonical_id FROM data_hygiene._name_map
) cm
WHERE ac.client_id = cm.duplicate_id;

-- notes / CRM notes
UPDATE public.notes n
SET   client_id = cm.canonical_id, updated_at = now()
FROM (
  SELECT duplicate_id, canonical_id FROM data_hygiene._merge_map
  UNION ALL
  SELECT duplicate_id, canonical_id FROM data_hygiene._name_map
) cm
WHERE n.client_id = cm.duplicate_id;

-- ── client_billing_profile (UNIQUE constraint → merge + redirect + delete) ─

-- Passo 1: mesclar billing do duplicado NO canônico (onde ambos existem)
UPDATE public.client_billing_profile bp_canon
SET
  due_day                    = COALESCE(bp_canon.due_day,                   bp_dup.due_day),
  reading_day                = COALESCE(bp_canon.reading_day,               bp_dup.reading_day),
  first_billing_date         = COALESCE(bp_canon.first_billing_date,        bp_dup.first_billing_date),
  expected_last_billing_date = COALESCE(bp_canon.expected_last_billing_date,bp_dup.expected_last_billing_date),
  recurrence_type            = COALESCE(bp_canon.recurrence_type,           bp_dup.recurrence_type),
  payment_status             = CASE
                                 WHEN bp_canon.payment_status IN ('overdue','written_off') THEN bp_canon.payment_status
                                 WHEN bp_dup.payment_status   IN ('overdue','written_off') THEN bp_dup.payment_status
                                 WHEN bp_canon.payment_status = 'current'                 THEN bp_canon.payment_status
                                 WHEN bp_dup.payment_status   = 'current'                 THEN bp_dup.payment_status
                                 ELSE COALESCE(bp_canon.payment_status, bp_dup.payment_status)
                               END,
  delinquency_status         = COALESCE(bp_canon.delinquency_status,        bp_dup.delinquency_status),
  valor_mensalidade          = COALESCE(bp_canon.valor_mensalidade,         bp_dup.valor_mensalidade),
  installments_json          = CASE
                                 WHEN bp_canon.installments_json IS NULL OR bp_canon.installments_json = '[]'::jsonb
                                 THEN COALESCE(bp_dup.installments_json, '[]'::jsonb)
                                 WHEN bp_dup.installments_json IS NULL OR bp_dup.installments_json = '[]'::jsonb
                                 THEN bp_canon.installments_json
                                 ELSE bp_canon.installments_json || bp_dup.installments_json
                               END,
  updated_at                 = now()
FROM (
  SELECT duplicate_id, canonical_id FROM data_hygiene._merge_map
  UNION ALL
  SELECT duplicate_id, canonical_id FROM data_hygiene._name_map
) cm
JOIN public.client_billing_profile bp_dup ON bp_dup.client_id = cm.duplicate_id
WHERE bp_canon.client_id = cm.canonical_id;

-- Passo 2: transferir billing do duplicado quando canônico não tem
UPDATE public.client_billing_profile bp
SET   client_id = cm.canonical_id, updated_at = now()
FROM (
  SELECT duplicate_id, canonical_id FROM data_hygiene._merge_map
  UNION ALL
  SELECT duplicate_id, canonical_id FROM data_hygiene._name_map
) cm
WHERE bp.client_id = cm.duplicate_id
  AND NOT EXISTS (SELECT 1 FROM public.client_billing_profile WHERE client_id = cm.canonical_id);

-- Passo 3: excluir billing do duplicado (canônico já tem o dele)
DELETE FROM public.client_billing_profile
WHERE client_id IN (
  SELECT cm.duplicate_id
  FROM (
    SELECT duplicate_id, canonical_id FROM data_hygiene._merge_map
    UNION ALL
    SELECT duplicate_id, canonical_id FROM data_hygiene._name_map
  ) cm
  WHERE EXISTS (SELECT 1 FROM public.client_billing_profile WHERE client_id = cm.canonical_id)
);

-- ── client_usina_config (UNIQUE) ───────────────────────────────────────────

UPDATE public.client_usina_config uc_canon
SET
  potencia_modulo_wp   = COALESCE(uc_canon.potencia_modulo_wp,  uc_dup.potencia_modulo_wp),
  numero_modulos       = COALESCE(uc_canon.numero_modulos,      uc_dup.numero_modulos),
  modelo_modulo        = COALESCE(uc_canon.modelo_modulo,       uc_dup.modelo_modulo),
  modelo_inversor      = COALESCE(uc_canon.modelo_inversor,     uc_dup.modelo_inversor),
  tipo_instalacao      = COALESCE(uc_canon.tipo_instalacao,     uc_dup.tipo_instalacao),
  area_instalacao_m2   = COALESCE(uc_canon.area_instalacao_m2,  uc_dup.area_instalacao_m2),
  geracao_estimada_kwh = COALESCE(uc_canon.geracao_estimada_kwh,uc_dup.geracao_estimada_kwh),
  updated_at           = now()
FROM (
  SELECT duplicate_id, canonical_id FROM data_hygiene._merge_map
  UNION ALL
  SELECT duplicate_id, canonical_id FROM data_hygiene._name_map
) cm
JOIN public.client_usina_config uc_dup ON uc_dup.client_id = cm.duplicate_id
WHERE uc_canon.client_id = cm.canonical_id;

UPDATE public.client_usina_config uc
SET   client_id = cm.canonical_id, updated_at = now()
FROM (
  SELECT duplicate_id, canonical_id FROM data_hygiene._merge_map
  UNION ALL
  SELECT duplicate_id, canonical_id FROM data_hygiene._name_map
) cm
WHERE uc.client_id = cm.duplicate_id
  AND NOT EXISTS (SELECT 1 FROM public.client_usina_config WHERE client_id = cm.canonical_id);

DELETE FROM public.client_usina_config
WHERE client_id IN (
  SELECT cm.duplicate_id
  FROM (
    SELECT duplicate_id, canonical_id FROM data_hygiene._merge_map
    UNION ALL
    SELECT duplicate_id, canonical_id FROM data_hygiene._name_map
  ) cm
  WHERE EXISTS (SELECT 1 FROM public.client_usina_config WHERE client_id = cm.canonical_id)
);

-- ── client_lifecycle (UNIQUE) ──────────────────────────────────────────────

UPDATE public.client_lifecycle lc_canon
SET
  lifecycle_status            = CASE
                                  WHEN lc_canon.lifecycle_status = 'billing'    THEN lc_canon.lifecycle_status
                                  WHEN lc_dup.lifecycle_status   = 'billing'    THEN lc_dup.lifecycle_status
                                  WHEN lc_canon.lifecycle_status = 'active'     THEN lc_canon.lifecycle_status
                                  WHEN lc_dup.lifecycle_status   = 'active'     THEN lc_dup.lifecycle_status
                                  WHEN lc_canon.lifecycle_status = 'contracted' THEN lc_canon.lifecycle_status
                                  WHEN lc_dup.lifecycle_status   = 'contracted' THEN lc_dup.lifecycle_status
                                  ELSE COALESCE(lc_canon.lifecycle_status, lc_dup.lifecycle_status)
                                END,
  is_converted_customer       = (lc_canon.is_converted_customer OR lc_dup.is_converted_customer),
  is_active_portfolio_client  = (lc_canon.is_active_portfolio_client OR lc_dup.is_active_portfolio_client),
  exported_to_portfolio_at    = COALESCE(lc_canon.exported_to_portfolio_at,  lc_dup.exported_to_portfolio_at),
  converted_from_lead_at      = COALESCE(lc_canon.converted_from_lead_at,   lc_dup.converted_from_lead_at),
  onboarding_status           = COALESCE(lc_canon.onboarding_status,         lc_dup.onboarding_status),
  exported_by_user_id         = COALESCE(lc_canon.exported_by_user_id,       lc_dup.exported_by_user_id),
  updated_at                  = now()
FROM (
  SELECT duplicate_id, canonical_id FROM data_hygiene._merge_map
  UNION ALL
  SELECT duplicate_id, canonical_id FROM data_hygiene._name_map
) cm
JOIN public.client_lifecycle lc_dup ON lc_dup.client_id = cm.duplicate_id
WHERE lc_canon.client_id = cm.canonical_id;

UPDATE public.client_lifecycle lc
SET   client_id = cm.canonical_id, updated_at = now()
FROM (
  SELECT duplicate_id, canonical_id FROM data_hygiene._merge_map
  UNION ALL
  SELECT duplicate_id, canonical_id FROM data_hygiene._name_map
) cm
WHERE lc.client_id = cm.duplicate_id
  AND NOT EXISTS (SELECT 1 FROM public.client_lifecycle WHERE client_id = cm.canonical_id);

DELETE FROM public.client_lifecycle
WHERE client_id IN (
  SELECT cm.duplicate_id
  FROM (
    SELECT duplicate_id, canonical_id FROM data_hygiene._merge_map
    UNION ALL
    SELECT duplicate_id, canonical_id FROM data_hygiene._name_map
  ) cm
  WHERE EXISTS (SELECT 1 FROM public.client_lifecycle WHERE client_id = cm.canonical_id)
);

-- ── client_project_status (UNIQUE) ────────────────────────────────────────

UPDATE public.client_project_status ps_canon
SET
  installation_status    = COALESCE(ps_canon.installation_status,   ps_dup.installation_status),
  engineering_status     = COALESCE(ps_canon.engineering_status,    ps_dup.engineering_status),
  homologation_status    = COALESCE(ps_canon.homologation_status,   ps_dup.homologation_status),
  commissioning_status   = COALESCE(ps_canon.commissioning_status,  ps_dup.commissioning_status),
  commissioning_date     = COALESCE(ps_canon.commissioning_date,    ps_dup.commissioning_date),
  first_injection_date   = COALESCE(ps_canon.first_injection_date,  ps_dup.first_injection_date),
  first_generation_date  = COALESCE(ps_canon.first_generation_date, ps_dup.first_generation_date),
  expected_go_live_date  = COALESCE(ps_canon.expected_go_live_date, ps_dup.expected_go_live_date),
  integrator_name        = COALESCE(ps_canon.integrator_name,       ps_dup.integrator_name),
  engineer_name          = COALESCE(ps_canon.engineer_name,         ps_dup.engineer_name),
  notes                  = CASE
                             WHEN ps_canon.notes IS NULL THEN ps_dup.notes
                             WHEN ps_dup.notes   IS NULL THEN ps_canon.notes
                             ELSE ps_canon.notes || E'\n---\n' || ps_dup.notes
                           END,
  updated_at             = now()
FROM (
  SELECT duplicate_id, canonical_id FROM data_hygiene._merge_map
  UNION ALL
  SELECT duplicate_id, canonical_id FROM data_hygiene._name_map
) cm
JOIN public.client_project_status ps_dup ON ps_dup.client_id = cm.duplicate_id
WHERE ps_canon.client_id = cm.canonical_id;

UPDATE public.client_project_status ps
SET   client_id = cm.canonical_id, updated_at = now()
FROM (
  SELECT duplicate_id, canonical_id FROM data_hygiene._merge_map
  UNION ALL
  SELECT duplicate_id, canonical_id FROM data_hygiene._name_map
) cm
WHERE ps.client_id = cm.duplicate_id
  AND NOT EXISTS (SELECT 1 FROM public.client_project_status WHERE client_id = cm.canonical_id);

DELETE FROM public.client_project_status
WHERE client_id IN (
  SELECT cm.duplicate_id
  FROM (
    SELECT duplicate_id, canonical_id FROM data_hygiene._merge_map
    UNION ALL
    SELECT duplicate_id, canonical_id FROM data_hygiene._name_map
  ) cm
  WHERE EXISTS (SELECT 1 FROM public.client_project_status WHERE client_id = cm.canonical_id)
);

-- ── client_energy_profile (UNIQUE) ────────────────────────────────────────

UPDATE public.client_energy_profile ep_canon
SET
  kwh_contratado      = COALESCE(ep_canon.kwh_contratado,      ep_dup.kwh_contratado),
  potencia_kwp        = COALESCE(ep_canon.potencia_kwp,        ep_dup.potencia_kwp),
  tipo_rede           = COALESCE(ep_canon.tipo_rede,           ep_dup.tipo_rede),
  tarifa_atual        = COALESCE(ep_canon.tarifa_atual,        ep_dup.tarifa_atual),
  desconto_percentual = COALESCE(ep_canon.desconto_percentual, ep_dup.desconto_percentual),
  mensalidade         = COALESCE(ep_canon.mensalidade,         ep_dup.mensalidade),
  indicacao           = COALESCE(ep_canon.indicacao,           ep_dup.indicacao),
  modalidade          = COALESCE(ep_canon.modalidade,          ep_dup.modalidade),
  prazo_meses         = COALESCE(ep_canon.prazo_meses,         ep_dup.prazo_meses),
  marca_inversor      = COALESCE(ep_canon.marca_inversor,      ep_dup.marca_inversor),
  updated_at          = now()
FROM (
  SELECT duplicate_id, canonical_id FROM data_hygiene._merge_map
  UNION ALL
  SELECT duplicate_id, canonical_id FROM data_hygiene._name_map
) cm
JOIN public.client_energy_profile ep_dup ON ep_dup.client_id = cm.duplicate_id
WHERE ep_canon.client_id = cm.canonical_id;

UPDATE public.client_energy_profile ep
SET   client_id = cm.canonical_id, updated_at = now()
FROM (
  SELECT duplicate_id, canonical_id FROM data_hygiene._merge_map
  UNION ALL
  SELECT duplicate_id, canonical_id FROM data_hygiene._name_map
) cm
WHERE ep.client_id = cm.duplicate_id
  AND NOT EXISTS (SELECT 1 FROM public.client_energy_profile WHERE client_id = cm.canonical_id);

DELETE FROM public.client_energy_profile
WHERE client_id IN (
  SELECT cm.duplicate_id
  FROM (
    SELECT duplicate_id, canonical_id FROM data_hygiene._merge_map
    UNION ALL
    SELECT duplicate_id, canonical_id FROM data_hygiene._name_map
  ) cm
  WHERE EXISTS (SELECT 1 FROM public.client_energy_profile WHERE client_id = cm.canonical_id)
);

-- ============================================================================
-- SOFT-DELETE DOS DUPLICADOS + AUDITORIA
-- ============================================================================

-- Audit log (ambos os mapas)
INSERT INTO public.client_merge_audit (
  rule_name,
  canonical_client_id,
  duplicate_client_id,
  reason,
  before_canonical,
  before_duplicate
)
SELECT
  cm.merge_rule,
  cm.canonical_id,
  cm.duplicate_id,
  'deduplicação automática por ' || cm.merge_rule,
  to_jsonb(canon.*),
  to_jsonb(dup.*)
FROM (
  SELECT duplicate_id, canonical_id, merge_rule, key_value FROM data_hygiene._merge_map
  UNION ALL
  SELECT duplicate_id, canonical_id, normalized_name AS key_value, 'name' AS merge_rule FROM data_hygiene._name_map
) cm
JOIN public.clients canon ON canon.id = cm.canonical_id
JOIN public.clients dup   ON dup.id   = cm.duplicate_id
WHERE dup.deleted_at IS NULL
  AND dup.id <> cm.canonical_id;

-- Soft-delete dos duplicados (sem vínculo crítico residual)
UPDATE public.clients c
SET
  merged_into_client_id = cm.canonical_id,
  identity_status       = 'merged',
  deleted_at            = COALESCE(c.deleted_at, now()),
  updated_at            = now()
FROM (
  SELECT duplicate_id, canonical_id FROM data_hygiene._merge_map
  UNION ALL
  SELECT duplicate_id, canonical_id FROM data_hygiene._name_map
) cm
WHERE c.id = cm.duplicate_id
  AND c.id <> cm.canonical_id
  AND c.in_portfolio = false
  AND NOT EXISTS (
    SELECT 1 FROM public.client_contracts cc
    WHERE cc.client_id = c.id AND cc.contract_status IN ('active','signed','suspended')
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.client_billing_profile bp
    WHERE bp.client_id = c.id AND bp.payment_status NOT IN ('cancelled','written_off')
  );

-- ============================================================================
-- FASE 6 — SOFT-DELETE DE CLIENTES INVÁLIDOS SEM VÍNCULO
-- ============================================================================

-- 6a) Redirecionar vínculos de clientes com nome inválido para o canônico se CPF/CNPJ coincidir
UPDATE public.proposals p
SET   client_id = valid_c.id, updated_at = now()
FROM public.clients inval
JOIN public.clients valid_c ON (
  (valid_c.cpf_normalized  IS NOT NULL AND valid_c.cpf_normalized  = inval.cpf_normalized)
  OR (valid_c.cnpj_normalized IS NOT NULL AND valid_c.cnpj_normalized = inval.cnpj_normalized)
)
WHERE p.client_id = inval.id AND p.deleted_at IS NULL
  AND NOT (coalesce(inval.client_name, '') ~* '[A-Za-zÀ-ÖØ-öø-ÿ]')
  AND inval.deleted_at IS NULL
  AND valid_c.deleted_at IS NULL
  AND valid_c.id <> inval.id
  AND coalesce(valid_c.client_name, '') ~* '[A-Za-zÀ-ÖØ-öø-ÿ]';

-- 6b) Soft-delete: clientes sem nome válido, sem CPF/CNPJ, sem email válido,
--     sem telefone válido, sem proposta/contrato/billing/portfólio ativo
UPDATE public.clients c
SET   deleted_at = now(), identity_status = 'rejected', updated_at = now()
WHERE c.deleted_at IS NULL
  AND c.in_portfolio = false
  AND c.cpf_normalized IS NULL
  AND c.cnpj_normalized IS NULL
  AND (c.client_email IS NULL OR position('@' IN c.client_email) = 0)
  AND length(regexp_replace(coalesce(c.client_phone, ''), '\D', '', 'g')) < 10
  AND NOT (coalesce(c.client_name, '') ~* '[A-Za-zÀ-ÖØ-öø-ÿ]')
  AND NOT EXISTS (SELECT 1 FROM public.client_contracts    cc WHERE cc.client_id = c.id AND cc.contract_status IN ('active','signed','suspended'))
  AND NOT EXISTS (SELECT 1 FROM public.client_billing_profile bp WHERE bp.client_id = c.id AND bp.payment_status NOT IN ('cancelled','written_off'))
  AND NOT EXISTS (SELECT 1 FROM public.proposals             p  WHERE p.client_id  = c.id AND p.deleted_at IS NULL AND p.status NOT IN ('cancelled','rejected'));

-- 6c) Soft-delete: clientes com nome placeholder e sem nenhum anchor real
--     (apenas se não tiver portfólio/contrato/billing/proposta ativa)
UPDATE public.clients c
SET   deleted_at = now(), updated_at = now()
WHERE c.deleted_at IS NULL
  AND c.merged_into_client_id IS NULL
  AND c.in_portfolio = false
  AND c.cpf_normalized IS NULL
  AND c.cnpj_normalized IS NULL
  AND (c.client_email IS NULL OR position('@' IN c.client_email) = 0)
  AND length(regexp_replace(coalesce(c.client_phone, ''), '\D', '', 'g')) < 10
  AND lower(trim(coalesce(c.client_name, ''))) IN
      ('0', 'null', 'undefined', '[object object]', '-', u&'\2014',
       'junior', 'nelson', 'ronaldo', 'teste', 'test', 'user', 'cliente')
  AND NOT EXISTS (SELECT 1 FROM public.client_contracts    cc WHERE cc.client_id = c.id AND cc.contract_status IN ('active','signed','suspended'))
  AND NOT EXISTS (SELECT 1 FROM public.client_billing_profile bp WHERE bp.client_id = c.id AND bp.payment_status NOT IN ('cancelled','written_off'))
  AND NOT EXISTS (SELECT 1 FROM public.proposals             p  WHERE p.client_id  = c.id AND p.deleted_at IS NULL AND p.status NOT IN ('cancelled','rejected'));

-- ============================================================================
-- FASE 7 — SOFT-DELETE DE PROPOSTAS RASCUNHO VAZIAS
-- ============================================================================

UPDATE public.proposals p
SET   deleted_at = now(), updated_at = now()
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

-- ============================================================================
-- FASE 8 — BACKFILL proposals.client_id PARA CLIENTES AINDA MERGED
-- ============================================================================
-- Redirecionar proposals que ainda apontam para um duplicado (merged) cujo
-- merged_into_client_id aponta para o canônico válido.

UPDATE public.proposals p
SET   client_id = c.merged_into_client_id, updated_at = now()
FROM  public.clients c
WHERE p.client_id = c.id
  AND c.merged_into_client_id IS NOT NULL
  AND p.deleted_at IS NULL;

COMMIT;  -- ← trocar por ROLLBACK para dry-run


-- ============================================================================
-- FASE 9 — VERIFICAÇÃO FINAL
-- ============================================================================
-- Executar APÓS o COMMIT acima para confirmar o estado do banco.
-- ============================================================================

-- 9a) Contagem listável: deve ser muito menor que antes
SELECT count(*) AS listable_clients  FROM public.vw_clients_listable;
SELECT count(*) AS listable_proposals FROM public.vw_proposals_listable;

-- 9b) Confirmação: zero registros vazaram para a view
SELECT count(*) AS leaked_merged_or_deleted
FROM public.vw_clients_listable
WHERE deleted_at IS NOT NULL
   OR merged_into_client_id IS NOT NULL
   OR identity_status = 'merged';

-- 9c) Snapshot geral do banco
SELECT
  count(*)                                                              AS total_clients_raw,
  count(*) FILTER (WHERE deleted_at IS NULL AND merged_into_client_id IS NULL) AS active_clean,
  count(*) FILTER (WHERE deleted_at IS NOT NULL)                        AS soft_deleted,
  count(*) FILTER (WHERE merged_into_client_id IS NOT NULL)             AS merged
FROM public.clients;

-- 9d) Auditoria de merges executados nesta rodada
SELECT
  rule_name,
  count(*) AS merges_executados
FROM public.client_merge_audit
WHERE merged_at >= now() - interval '10 minutes'
GROUP BY rule_name
ORDER BY merges_executados DESC;

-- 9e) Duplicados CPF ainda existentes (devem ser zero)
SELECT count(*) AS cpf_dup_restantes
FROM (
  SELECT cpf_normalized FROM public.clients
  WHERE deleted_at IS NULL AND merged_into_client_id IS NULL AND cpf_normalized IS NOT NULL
  GROUP BY cpf_normalized HAVING COUNT(*) > 1
) t;

-- 9f) Duplicados e-mail ainda existentes (devem ser zero para emails seguros)
SELECT count(*) AS email_dup_restantes
FROM (
  SELECT lower(btrim(client_email)) AS em FROM public.clients
  WHERE deleted_at IS NULL AND merged_into_client_id IS NULL
    AND client_email IS NOT NULL AND position('@' IN btrim(client_email)) > 0
  GROUP BY 1 HAVING COUNT(*) > 1
) t;

-- 9g) Propostas ainda apontando para client merged (devem ser zero)
SELECT count(*) AS proposals_pointing_to_merged
FROM public.proposals p
JOIN public.clients c ON c.id = p.client_id
WHERE p.deleted_at IS NULL
  AND c.merged_into_client_id IS NOT NULL;

-- 9h) Tabela de auditoria de backup criada
SELECT
  backed_up_at::date AS dia,
  backup_reason,
  count(*) AS clientes_salvos
FROM data_hygiene.full_consolidation_clients_backup
GROUP BY 1, 2
ORDER BY 1 DESC, 3 DESC;
