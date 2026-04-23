-- ============================================================================================================================
-- SOLARINVEST — DEDUPLICAÇÃO DE CLIENTES POR DOCUMENTO (CPF/CNPJ), EMAIL E TELEFONE
-- ============================================================================================================================
--
-- OBJETIVO:
--   1. Identificar e mesclar clientes duplicados por CPF/CNPJ (regra mais segura).
--   2. Identificar e mesclar clientes duplicados por e-mail (sem conflito de documento).
--   3. Identificar e mesclar clientes duplicados por telefone (com confirmação de documento).
--   4. Purgar registros já mesclados ou soft-deleted antigos sem vínculos relevantes.
--   5. Registrar cada merge em client_merge_audit para auditoria e rastreabilidade.
--
-- PRÉ-REQUISITOS:
--   • Migration 0051 já aplicada (cria client_merge_audit e vw_clients_cleanup_base).
--   • Migration 0013 já aplicada (cnpj_normalized, cpf_normalized).
--   • Para deduplicação por nome: usar script dedup_clients_by_name.sql.
--
-- ESTRUTURA DO SCRIPT:
--   A) PREVIEW / AUDITORIA        — inspecionar duplicatas antes de qualquer alteração
--   B) BACKUP / SEGURANÇA         — snapshots no schema data_hygiene
--   C–G) TRANSAÇÃO PRINCIPAL      — (BEGIN/COMMIT)
--     C1) merge por CPF
--     C2) merge por CNPJ
--     C3) merge por e-mail (guarda contra conflito de documento)
--     C4) merge por telefone (somente com documento coincidente)
--     D)  consolidar campos do canônico com dados dos duplicados
--     E)  migrar todos os vínculos FK para o canônico
--     F)  soft-delete dos duplicados + log em client_merge_audit
--     G)  purge de registros mesclados/soft-deleted antigos sem referências ativas
--   H) VERIFICAÇÃO FINAL          — confirmar estado após COMMIT
--
-- COMO USAR:
--   1. Fazer pg_dump completo ANTES de rodar em produção.
--   2. Rodar o BLOCO A e revisar os resultados com cuidado.
--   3. Rodar o BLOCO B para criar os backups.
--   4. Rodar os BLOCOS C–G como um único bloco (BEGIN/COMMIT).
--      Para simular sem commitar: trocar COMMIT por ROLLBACK ao final.
--   5. Rodar o BLOCO H para validar o resultado.
--
-- REGRAS DE SEGURANÇA:
--   • Nunca merga quando CPF/CNPJ conflitarem entre os dois registros.
--   • Nunca merga telefone sem confirmação por documento coincidente.
--   • Nunca soft-deleta o canônico.
--   • Nunca soft-deleta registros em portfólio, com contrato ativo ou billing ativo.
--   • Todo merge é registrado em public.client_merge_audit.
--   • O purge remove apenas: merged há >30 dias, soft-deleted há >90 dias,
--     sem referências em proposals / client_contracts / client_lifecycle.
--
-- ============================================================================================================================


-- ============================================================================================================================
-- A) BLOCO DE PREVIEW / AUDITORIA
-- ============================================================================================================================
-- Rodar ANTES de qualquer alteração. Inspecionar volumes antes de prosseguir.
-- ============================================================================================================================


-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
-- A1) Grupos de CPF duplicado (clientes ativos, cpf_normalized não-nulo, mais de 1 por valor)
-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

SELECT
  'A1 - grupos de CPF duplicado' AS check_name,
  COUNT(DISTINCT cpf_normalized) AS grupos,
  SUM(cnt - 1)                   AS registros_excedentes,
  SUM(cnt)                       AS total_afetados
FROM (
  SELECT cpf_normalized, COUNT(*) AS cnt
  FROM public.clients
  WHERE deleted_at IS NULL
    AND merged_into_client_id IS NULL
    AND cpf_normalized IS NOT NULL
  GROUP BY cpf_normalized
  HAVING COUNT(*) > 1
) t;

SELECT
  cpf_normalized,
  COUNT(*) AS copies,
  array_agg(id              ORDER BY id) AS ids,
  array_agg(client_name     ORDER BY id) AS nomes,
  array_agg(in_portfolio    ORDER BY id) AS em_carteira,
  array_agg(identity_status ORDER BY id) AS statuses,
  array_agg(created_at      ORDER BY id) AS created_ats
FROM public.clients
WHERE deleted_at IS NULL
  AND merged_into_client_id IS NULL
  AND cpf_normalized IS NOT NULL
GROUP BY cpf_normalized
HAVING COUNT(*) > 1
ORDER BY copies DESC
LIMIT 50;


-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
-- A2) Grupos de CNPJ duplicado
-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

SELECT
  'A2 - grupos de CNPJ duplicado' AS check_name,
  COUNT(DISTINCT cnpj_normalized) AS grupos,
  SUM(cnt - 1)                    AS registros_excedentes,
  SUM(cnt)                        AS total_afetados
FROM (
  SELECT cnpj_normalized, COUNT(*) AS cnt
  FROM public.clients
  WHERE deleted_at IS NULL
    AND merged_into_client_id IS NULL
    AND cnpj_normalized IS NOT NULL
  GROUP BY cnpj_normalized
  HAVING COUNT(*) > 1
) t;


-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
-- A3) Grupos de e-mail duplicado (email_norm não-nulo, sem conflito de documento)
--     Listados separadamente:
--       safe  = pode merge automático (sem conflito CPF/CNPJ)
--       blocked = tem conflito de documento → exige revisão manual
-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

SELECT
  'A3 - grupos de e-mail duplicado (ativos)' AS check_name,
  COUNT(DISTINCT email_norm)                 AS grupos,
  SUM(cnt - 1)                               AS registros_excedentes
FROM (
  SELECT
    lower(btrim(client_email)) AS email_norm,
    COUNT(*) AS cnt
  FROM public.clients
  WHERE deleted_at IS NULL
    AND merged_into_client_id IS NULL
    AND client_email IS NOT NULL
    AND btrim(client_email) <> ''
    AND lower(btrim(client_email)) NOT IN ('null','undefined','[object object]','0','-','—','n/a','na')
    AND position('@' IN btrim(client_email)) > 0
  GROUP BY 1
  HAVING COUNT(*) > 1
) t;

-- Detalhe com flag de bloqueio:
SELECT
  lower(btrim(a.client_email)) AS email_norm,
  a.id AS id_a, a.client_name AS nome_a, a.cpf_normalized AS cpf_a, a.cnpj_normalized AS cnpj_a,
  b.id AS id_b, b.client_name AS nome_b, b.cpf_normalized AS cpf_b, b.cnpj_normalized AS cnpj_b,
  CASE
    WHEN (a.cpf_normalized  IS NOT NULL AND b.cpf_normalized  IS NOT NULL AND a.cpf_normalized  <> b.cpf_normalized)
      OR (a.cnpj_normalized IS NOT NULL AND b.cnpj_normalized IS NOT NULL AND a.cnpj_normalized <> b.cnpj_normalized)
    THEN 'BLOQUEADO (conflito de documento)'
    ELSE 'seguro para merge'
  END AS merge_status
FROM public.clients a
JOIN public.clients b
  ON lower(btrim(b.client_email)) = lower(btrim(a.client_email))
 AND a.id < b.id
 AND b.deleted_at IS NULL
 AND b.merged_into_client_id IS NULL
WHERE a.deleted_at IS NULL
  AND a.merged_into_client_id IS NULL
  AND a.client_email IS NOT NULL
  AND btrim(a.client_email) <> ''
  AND lower(btrim(a.client_email)) NOT IN ('null','undefined','[object object]','0','-','—','n/a','na')
  AND position('@' IN btrim(a.client_email)) > 0
ORDER BY email_norm, a.id
LIMIT 100;


-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
-- A4) Grupos de telefone duplicado COM confirmação de documento
--     Merge automático somente quando: mesmo phone_digits E mesmo cpf/cnpj
-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

SELECT
  'A4 - pares de telefone duplicado c/ documento igual' AS check_name,
  COUNT(*) AS pares_seguros
FROM public.clients a
JOIN public.clients b
  ON regexp_replace(b.client_phone, '\D', '', 'g') = regexp_replace(a.client_phone, '\D', '', 'g')
 AND a.id < b.id
 AND b.deleted_at IS NULL
 AND b.merged_into_client_id IS NULL
WHERE a.deleted_at IS NULL
  AND a.merged_into_client_id IS NULL
  AND a.client_phone IS NOT NULL
  AND length(regexp_replace(a.client_phone, '\D', '', 'g')) >= 10
  AND (
    (a.cpf_normalized  IS NOT NULL AND b.cpf_normalized  IS NOT NULL AND a.cpf_normalized  = b.cpf_normalized)
    OR
    (a.cnpj_normalized IS NOT NULL AND b.cnpj_normalized IS NOT NULL AND a.cnpj_normalized = b.cnpj_normalized)
  );


-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
-- A5) Total estimado de vínculos afetados pelas operações acima
-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

WITH cpf_dup_ids AS (
  SELECT id FROM public.clients
  WHERE deleted_at IS NULL AND merged_into_client_id IS NULL AND cpf_normalized IS NOT NULL
    AND cpf_normalized IN (
      SELECT cpf_normalized FROM public.clients
      WHERE deleted_at IS NULL AND merged_into_client_id IS NULL AND cpf_normalized IS NOT NULL
      GROUP BY cpf_normalized HAVING COUNT(*) > 1
    )
),
cnpj_dup_ids AS (
  SELECT id FROM public.clients
  WHERE deleted_at IS NULL AND merged_into_client_id IS NULL AND cnpj_normalized IS NOT NULL
    AND cnpj_normalized IN (
      SELECT cnpj_normalized FROM public.clients
      WHERE deleted_at IS NULL AND merged_into_client_id IS NULL AND cnpj_normalized IS NOT NULL
      GROUP BY cnpj_normalized HAVING COUNT(*) > 1
    )
),
all_affected AS (SELECT id FROM cpf_dup_ids UNION SELECT id FROM cnpj_dup_ids)
SELECT
  'clients (CPF/CNPJ dupl.)'   AS tabela, (SELECT COUNT(*) FROM all_affected)                                        AS afetados UNION ALL
SELECT 'proposals afetadas',              (SELECT COUNT(*) FROM public.proposals  p  WHERE p.client_id   IN (SELECT id FROM all_affected) AND p.deleted_at IS NULL) UNION ALL
SELECT 'client_contracts afetados',       (SELECT COUNT(*) FROM public.client_contracts cc WHERE cc.client_id IN (SELECT id FROM all_affected))                    UNION ALL
SELECT 'client_lifecycle afetados',       (SELECT COUNT(*) FROM public.client_lifecycle lc WHERE lc.client_id IN (SELECT id FROM all_affected))                    UNION ALL
SELECT 'client_billing_profile afet.',    (SELECT COUNT(*) FROM public.client_billing_profile bp WHERE bp.client_id IN (SELECT id FROM all_affected))              UNION ALL
SELECT 'client_usina_config afetados',    (SELECT COUNT(*) FROM public.client_usina_config uc WHERE uc.client_id IN (SELECT id FROM all_affected))                 UNION ALL
SELECT 'client_energy_profile afet.',     (SELECT COUNT(*) FROM public.client_energy_profile ep WHERE ep.client_id IN (SELECT id FROM all_affected))               UNION ALL
SELECT 'client_project_status afet.',     (SELECT COUNT(*) FROM public.client_project_status ps WHERE ps.client_id IN (SELECT id FROM all_affected))               UNION ALL
SELECT 'client_notes afetadas',           (SELECT COUNT(*) FROM public.client_notes cn WHERE cn.client_id IN (SELECT id FROM all_affected));


-- ============================================================================================================================
-- B) BLOCO DE BACKUP / SEGURANÇA
-- ============================================================================================================================
-- Criar schema e backups antes de qualquer alteração.
-- Execute este bloco ANTES dos BLOCOs C–G.
-- ============================================================================================================================

CREATE SCHEMA IF NOT EXISTS data_hygiene;

-- B1) Backup de clientes afetados por deduplicação de documento (CPF/CNPJ)
CREATE TABLE IF NOT EXISTS data_hygiene.clients_doc_dedup_backup
  AS TABLE public.clients WITH NO DATA;

ALTER TABLE data_hygiene.clients_doc_dedup_backup
  ADD COLUMN IF NOT EXISTS backed_up_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS backup_reason TEXT;

INSERT INTO data_hygiene.clients_doc_dedup_backup
SELECT c.*, now(), 'cpf_duplicate'
FROM public.clients c
WHERE c.deleted_at IS NULL
  AND c.merged_into_client_id IS NULL
  AND c.cpf_normalized IS NOT NULL
  AND c.cpf_normalized IN (
    SELECT cpf_normalized FROM public.clients
    WHERE deleted_at IS NULL AND merged_into_client_id IS NULL AND cpf_normalized IS NOT NULL
    GROUP BY cpf_normalized HAVING COUNT(*) > 1
  )
ON CONFLICT DO NOTHING;

INSERT INTO data_hygiene.clients_doc_dedup_backup
SELECT c.*, now(), 'cnpj_duplicate'
FROM public.clients c
WHERE c.deleted_at IS NULL
  AND c.merged_into_client_id IS NULL
  AND c.cnpj_normalized IS NOT NULL
  AND c.cnpj_normalized IN (
    SELECT cnpj_normalized FROM public.clients
    WHERE deleted_at IS NULL AND merged_into_client_id IS NULL AND cnpj_normalized IS NOT NULL
    GROUP BY cnpj_normalized HAVING COUNT(*) > 1
  )
ON CONFLICT DO NOTHING;

-- B2) Backup de clientes afetados por deduplicação de e-mail (sem conflito de doc)
CREATE TABLE IF NOT EXISTS data_hygiene.clients_email_dedup_backup
  AS TABLE public.clients WITH NO DATA;

ALTER TABLE data_hygiene.clients_email_dedup_backup
  ADD COLUMN IF NOT EXISTS backed_up_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS backup_reason TEXT;

INSERT INTO data_hygiene.clients_email_dedup_backup
SELECT c.*, now(), 'email_duplicate'
FROM public.clients c
WHERE c.deleted_at IS NULL
  AND c.merged_into_client_id IS NULL
  AND c.client_email IS NOT NULL
  AND btrim(c.client_email) <> ''
  AND lower(btrim(c.client_email)) NOT IN ('null','undefined','[object object]','0','-','—','n/a','na')
  AND position('@' IN btrim(c.client_email)) > 0
  AND lower(btrim(c.client_email)) IN (
    SELECT lower(btrim(client_email))
    FROM public.clients
    WHERE deleted_at IS NULL AND merged_into_client_id IS NULL
      AND client_email IS NOT NULL AND btrim(client_email) <> ''
      AND lower(btrim(client_email)) NOT IN ('null','undefined','[object object]','0','-','—','n/a','na')
      AND position('@' IN btrim(client_email)) > 0
    GROUP BY 1 HAVING COUNT(*) > 1
  )
ON CONFLICT DO NOTHING;

-- B3) Confirmar volumes de backup
SELECT 'data_hygiene.clients_doc_dedup_backup'   AS tabela, backup_reason, COUNT(*) AS linhas
FROM data_hygiene.clients_doc_dedup_backup
GROUP BY backup_reason
UNION ALL
SELECT 'data_hygiene.clients_email_dedup_backup', backup_reason, COUNT(*)
FROM data_hygiene.clients_email_dedup_backup
GROUP BY backup_reason
ORDER BY 1, 2;


-- ============================================================================================================================
-- C–G) TRANSAÇÃO PRINCIPAL
-- ============================================================================================================================
-- ATENÇÃO: Envolto em BEGIN / COMMIT como uma única transação atômica.
-- Para simular sem commitar, substituir COMMIT por ROLLBACK ao final.
-- Execute o BLOCO B antes deste bloco.
-- ============================================================================================================================

BEGIN;

-- Limpeza defensiva de tabelas de mapeamento de execuções anteriores:
DROP TABLE IF EXISTS data_hygiene._doc_merge_map;
DROP TABLE IF EXISTS data_hygiene._email_merge_map;
DROP TABLE IF EXISTS data_hygiene._phone_merge_map;
DROP TABLE IF EXISTS data_hygiene._doc_dedup_scores;


-- ============================================================================================================================
-- C1) MAPEAMENTO DE DUPLICADOS POR CPF
-- ============================================================================================================================
-- Eleição do canônico por:
--   1. completeness_score DESC  (mais campos preenchidos)
--   2. identity_status = 'confirmed' preferido
--   3. deleted_at IS NULL preferido
--   4. created_at ASC (mais antigo)
--   5. id ASC (menor id — desempate final)

CREATE TABLE data_hygiene._doc_dedup_scores AS
SELECT
  c.id                                                                   AS client_id,
  c.cpf_normalized,
  c.cnpj_normalized,
  coalesce(c.cpf_normalized, c.cnpj_normalized)                         AS doc_norm,
  vw.completeness_score,
  CASE WHEN c.identity_status = 'confirmed' THEN 0 ELSE 1 END           AS identity_rank,
  CASE WHEN c.deleted_at IS NULL            THEN 0 ELSE 1 END           AS deleted_rank,
  c.created_at,
  c.id                                                                   AS id_for_sort
FROM public.clients c
JOIN public.vw_clients_cleanup_base vw ON vw.id = c.id
WHERE coalesce(c.cpf_normalized, c.cnpj_normalized) IS NOT NULL;

CREATE INDEX ON data_hygiene._doc_dedup_scores (doc_norm, completeness_score DESC, identity_rank, deleted_rank, created_at, id_for_sort);


-- CPF merge map
CREATE TABLE data_hygiene._doc_merge_map AS
WITH ranked AS (
  SELECT
    client_id,
    cpf_normalized  AS key_value,
    'cpf'::text     AS merge_rule,
    completeness_score, identity_rank, deleted_rank, created_at, id_for_sort,
    ROW_NUMBER() OVER (
      PARTITION BY cpf_normalized
      ORDER BY completeness_score DESC, identity_rank, deleted_rank, created_at, id_for_sort
    ) AS rn
  FROM data_hygiene._doc_dedup_scores
  WHERE cpf_normalized IS NOT NULL
    AND cpf_normalized IN (
      SELECT cpf_normalized FROM data_hygiene._doc_dedup_scores
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

-- CNPJ merge map (append to same table)
INSERT INTO data_hygiene._doc_merge_map
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
  FROM data_hygiene._doc_dedup_scores
  WHERE cnpj_normalized IS NOT NULL
    AND cnpj_normalized IN (
      SELECT cnpj_normalized FROM data_hygiene._doc_dedup_scores
      WHERE cnpj_normalized IS NOT NULL
      GROUP BY cnpj_normalized HAVING COUNT(*) > 1
    )
)
SELECT
  canon.client_id, dup.client_id, dup.merge_rule, dup.key_value
FROM ranked dup
JOIN ranked canon ON canon.key_value = dup.key_value AND canon.rn = 1
WHERE dup.rn > 1
  -- Avoid adding a pair already captured by CPF merge (same canonical + duplicate already mapped)
  AND NOT EXISTS (
    SELECT 1 FROM data_hygiene._doc_merge_map ex
    WHERE ex.canonical_id = canon.client_id AND ex.duplicate_id = dup.client_id
  );

CREATE INDEX ON data_hygiene._doc_merge_map (canonical_id);
CREATE INDEX ON data_hygiene._doc_merge_map (duplicate_id);

-- Preview before proceeding:
SELECT
  merge_rule,
  canonical_id,
  array_agg(duplicate_id ORDER BY duplicate_id) AS duplicate_ids,
  COUNT(*)                                       AS duplicates_count
FROM data_hygiene._doc_merge_map
GROUP BY merge_rule, canonical_id
ORDER BY duplicates_count DESC, merge_rule, canonical_id
LIMIT 50;


-- ============================================================================================================================
-- C2) MAPEAMENTO DE DUPLICADOS POR E-MAIL (sem conflito de documento)
-- ============================================================================================================================
-- Regras de bloqueio:
--   • Se ambos têm cpf_normalized e eles diferem → bloqueado
--   • Se ambos têm cnpj_normalized e eles diferem → bloqueado
-- Só prossegue para pares sem conflito de documento.

CREATE TABLE data_hygiene._email_merge_map AS
WITH email_pairs AS (
  SELECT
    a.id                          AS id_a,
    b.id                          AS id_b,
    lower(btrim(a.client_email))  AS email_norm,
    vw_a.completeness_score       AS score_a,
    vw_b.completeness_score       AS score_b,
    a.created_at                  AS created_a,
    b.created_at                  AS created_b
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
    AND lower(btrim(a.client_email)) NOT IN ('null','undefined','[object object]','0','-','—','n/a','na')
    AND position('@' IN btrim(a.client_email)) > 0
    -- Exclude pairs that are about to be merged via the doc map (already handled)
    AND NOT EXISTS (
      SELECT 1 FROM data_hygiene._doc_merge_map dm
      WHERE (dm.canonical_id = a.id AND dm.duplicate_id = b.id)
         OR (dm.canonical_id = b.id AND dm.duplicate_id = a.id)
    )
    -- Document conflict guard: block if both have CPF that differ or both have CNPJ that differ
    AND NOT (
      a.cpf_normalized  IS NOT NULL AND b.cpf_normalized  IS NOT NULL
      AND a.cpf_normalized <> b.cpf_normalized
    )
    AND NOT (
      a.cnpj_normalized IS NOT NULL AND b.cnpj_normalized IS NOT NULL
      AND a.cnpj_normalized <> b.cnpj_normalized
    )
),
-- Elect canonical per email_norm group using the same criteria as doc merge
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
  FROM (
    SELECT DISTINCT email_norm FROM email_pairs
  ) ep
  CROSS JOIN LATERAL (
    SELECT DISTINCT unnest(ARRAY[id_a, id_b]) AS client_id
    FROM email_pairs ep2 WHERE ep2.email_norm = ep.email_norm
  ) unnested
  JOIN public.clients c ON c.id = unnested.client_id
  JOIN public.vw_clients_cleanup_base vw ON vw.id = unnested.client_id
)
SELECT
  canon.client_id AS canonical_id,
  dup.client_id   AS duplicate_id,
  'email'::text   AS merge_rule,
  dup.email_norm  AS key_value
FROM ranked dup
JOIN ranked canon ON canon.email_norm = dup.email_norm AND canon.rn = 1
WHERE dup.rn > 1;

CREATE INDEX ON data_hygiene._email_merge_map (canonical_id);
CREATE INDEX ON data_hygiene._email_merge_map (duplicate_id);

-- Preview:
SELECT
  canonical_id,
  array_agg(duplicate_id ORDER BY duplicate_id) AS duplicate_ids,
  COUNT(*)                                       AS duplicates_count
FROM data_hygiene._email_merge_map
GROUP BY canonical_id
ORDER BY duplicates_count DESC
LIMIT 50;


-- ============================================================================================================================
-- C3) MAPEAMENTO DE DUPLICADOS POR TELEFONE (somente com documento coincidente)
-- ============================================================================================================================
-- Merge automático apenas quando:
--   • phone_digits igual (>=10 dígitos)
--   • E mesmo cpf_normalized OU mesmo cnpj_normalized (confirmação de documento)
-- Telefone sozinho não é suficiente para merge automático.

CREATE TABLE data_hygiene._phone_merge_map AS
WITH phone_pairs AS (
  SELECT
    a.id                                                AS id_a,
    b.id                                                AS id_b,
    regexp_replace(a.client_phone, '\D', '', 'g')       AS phone_digits,
    vw_a.completeness_score                             AS score_a,
    vw_b.completeness_score                             AS score_b,
    a.created_at                                        AS created_a,
    b.created_at                                        AS created_b
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
    -- Document confirmation required:
    AND (
      (a.cpf_normalized  IS NOT NULL AND b.cpf_normalized  IS NOT NULL AND a.cpf_normalized  = b.cpf_normalized)
      OR
      (a.cnpj_normalized IS NOT NULL AND b.cnpj_normalized IS NOT NULL AND a.cnpj_normalized = b.cnpj_normalized)
    )
    -- Not already handled by doc or email merge
    AND NOT EXISTS (
      SELECT 1 FROM data_hygiene._doc_merge_map dm
      WHERE (dm.canonical_id = a.id AND dm.duplicate_id = b.id)
         OR (dm.canonical_id = b.id AND dm.duplicate_id = a.id)
    )
    AND NOT EXISTS (
      SELECT 1 FROM data_hygiene._email_merge_map em
      WHERE (em.canonical_id = a.id AND em.duplicate_id = b.id)
         OR (em.canonical_id = b.id AND em.duplicate_id = a.id)
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
  FROM (
    SELECT DISTINCT phone_digits FROM phone_pairs
  ) pp
  CROSS JOIN LATERAL (
    SELECT DISTINCT unnest(ARRAY[id_a, id_b]) AS client_id
    FROM phone_pairs pp2 WHERE pp2.phone_digits = pp.phone_digits
  ) unnested
  JOIN public.clients c ON c.id = unnested.client_id
  JOIN public.vw_clients_cleanup_base vw ON vw.id = unnested.client_id
)
SELECT
  canon.client_id AS canonical_id,
  dup.client_id   AS duplicate_id,
  'phone'::text   AS merge_rule,
  dup.phone_digits AS key_value
FROM ranked dup
JOIN ranked canon ON canon.phone_digits = dup.phone_digits AND canon.rn = 1
WHERE dup.rn > 1;

CREATE INDEX ON data_hygiene._phone_merge_map (canonical_id);
CREATE INDEX ON data_hygiene._phone_merge_map (duplicate_id);

-- Preview:
SELECT
  canonical_id,
  array_agg(duplicate_id ORDER BY duplicate_id) AS duplicate_ids,
  COUNT(*)                                       AS duplicates_count
FROM data_hygiene._phone_merge_map
GROUP BY canonical_id
ORDER BY duplicates_count DESC
LIMIT 50;


-- ============================================================================================================================
-- D) CONSOLIDAÇÃO DO CANÔNICO
-- ============================================================================================================================
-- Para cada mapa de merge, preencher campos vazios do canônico com o melhor valor
-- disponível nos registros duplicados.
-- Regra: COALESCE — nunca sobrescrever um valor existente com NULL ou vazio.
-- ============================================================================================================================

-- Helper: combined map (all three sources) used for enrichment
-- We operate per-map to keep the logic clear, but the enrichment pattern is identical.

-- D1) Enriquecer canônico com dados dos duplicados do mapa de documentos
WITH best_from_dups AS (
  SELECT
    dm.canonical_id,
    -- Take the first non-null/non-empty value from the best duplicate per field
    (array_agg(d.client_name     ORDER BY vw.completeness_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.client_name IS NOT NULL AND btrim(d.client_name) <> '' AND d.client_name ~* '[A-Za-zÀ-ÖØ-öø-ÿ]'))[1]  AS best_name,
    (array_agg(d.client_document ORDER BY vw.completeness_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.client_document IS NOT NULL AND btrim(d.client_document) <> ''))[1]                                     AS best_document,
    (array_agg(d.cpf_raw         ORDER BY vw.completeness_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.cpf_raw IS NOT NULL AND btrim(d.cpf_raw) <> ''))[1]                                                     AS best_cpf_raw,
    (array_agg(d.cnpj_raw        ORDER BY vw.completeness_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.cnpj_raw IS NOT NULL AND btrim(d.cnpj_raw) <> ''))[1]                                                   AS best_cnpj_raw,
    (array_agg(d.document_type   ORDER BY vw.completeness_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.document_type IS NOT NULL AND btrim(d.document_type) <> ''))[1]                                         AS best_document_type,
    (array_agg(d.client_email    ORDER BY vw.completeness_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.client_email IS NOT NULL AND d.client_email LIKE '%@%.%'))[1]                                           AS best_email,
    (array_agg(d.client_phone    ORDER BY vw.completeness_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.client_phone IS NOT NULL AND length(regexp_replace(d.client_phone, '[^0-9]', '', 'g')) >= 10))[1]       AS best_phone,
    (array_agg(d.client_city     ORDER BY vw.completeness_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.client_city IS NOT NULL AND btrim(d.client_city) <> ''))[1]                                             AS best_city,
    (array_agg(d.client_state    ORDER BY vw.completeness_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.client_state IS NOT NULL AND btrim(d.client_state) <> ''))[1]                                           AS best_state,
    (array_agg(d.client_address  ORDER BY vw.completeness_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.client_address IS NOT NULL AND btrim(d.client_address) <> ''))[1]                                       AS best_address,
    (array_agg(d.cep             ORDER BY vw.completeness_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.cep IS NOT NULL AND btrim(d.cep) <> ''))[1]                                                             AS best_cep,
    (array_agg(d.uc_geradora     ORDER BY vw.completeness_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.uc_geradora IS NOT NULL AND btrim(d.uc_geradora) <> ''))[1]                                             AS best_uc_geradora,
    (array_agg(d.uc_beneficiaria ORDER BY vw.completeness_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.uc_beneficiaria IS NOT NULL AND btrim(d.uc_beneficiaria) <> ''))[1]                                     AS best_uc_beneficiaria,
    (array_agg(d.distribuidora   ORDER BY vw.completeness_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.distribuidora IS NOT NULL AND btrim(d.distribuidora) <> ''))[1]                                         AS best_distribuidora,
    (array_agg(d.consumption_kwh_month ORDER BY vw.completeness_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.consumption_kwh_month IS NOT NULL AND d.consumption_kwh_month > 0))[1]                                  AS best_consumption_kwh_month,
    (array_agg(d.system_kwp      ORDER BY vw.completeness_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.system_kwp IS NOT NULL AND d.system_kwp > 0))[1]                                                        AS best_system_kwp,
    (array_agg(d.term_months     ORDER BY vw.completeness_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.term_months IS NOT NULL AND btrim(d.term_months) <> ''))[1]                                             AS best_term_months,
    (array_agg(d.nome_razao      ORDER BY vw.completeness_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.nome_razao IS NOT NULL AND btrim(d.nome_razao) <> ''))[1]                                               AS best_nome_razao,
    (array_agg(d.logradouro      ORDER BY vw.completeness_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.logradouro IS NOT NULL AND btrim(d.logradouro) <> ''))[1]                                               AS best_logradouro,
    (array_agg(d.numero          ORDER BY vw.completeness_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.numero IS NOT NULL AND btrim(d.numero) <> ''))[1]                                                       AS best_numero,
    (array_agg(d.complemento     ORDER BY vw.completeness_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.complemento IS NOT NULL AND btrim(d.complemento) <> ''))[1]                                             AS best_complemento,
    (array_agg(d.bairro          ORDER BY vw.completeness_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.bairro IS NOT NULL AND btrim(d.bairro) <> ''))[1]                                                       AS best_bairro,
    (array_agg(d.telefone_secundario ORDER BY vw.completeness_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.telefone_secundario IS NOT NULL AND length(regexp_replace(d.telefone_secundario, '[^0-9]', '', 'g')) >= 10))[1] AS best_telefone_secundario,
    (array_agg(d.observacoes     ORDER BY vw.completeness_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.observacoes IS NOT NULL AND btrim(d.observacoes) <> ''))[1]                                             AS best_observacoes
  FROM data_hygiene._doc_merge_map dm
  JOIN public.clients d  ON d.id  = dm.duplicate_id
  JOIN public.vw_clients_cleanup_base vw ON vw.id = dm.duplicate_id
  GROUP BY dm.canonical_id
)
UPDATE public.clients c
SET
  client_name          = COALESCE(c.client_name,           b.best_name),
  client_document      = COALESCE(c.client_document,       b.best_document),
  cpf_raw              = COALESCE(c.cpf_raw,               b.best_cpf_raw),
  cnpj_raw             = COALESCE(c.cnpj_raw,              b.best_cnpj_raw),
  document_type        = COALESCE(c.document_type,         b.best_document_type),
  client_email         = COALESCE(c.client_email,          b.best_email),
  client_phone         = COALESCE(c.client_phone,          b.best_phone),
  client_city          = COALESCE(c.client_city,           b.best_city),
  client_state         = COALESCE(c.client_state,          b.best_state),
  client_address       = COALESCE(c.client_address,        b.best_address),
  cep                  = COALESCE(c.cep,                   b.best_cep),
  uc_geradora          = COALESCE(c.uc_geradora,           b.best_uc_geradora),
  uc_beneficiaria      = COALESCE(c.uc_beneficiaria,       b.best_uc_beneficiaria),
  distribuidora        = COALESCE(c.distribuidora,         b.best_distribuidora),
  consumption_kwh_month= COALESCE(c.consumption_kwh_month, b.best_consumption_kwh_month),
  system_kwp           = COALESCE(c.system_kwp,            b.best_system_kwp),
  term_months          = COALESCE(c.term_months,           b.best_term_months),
  nome_razao           = COALESCE(c.nome_razao,            b.best_nome_razao),
  logradouro           = COALESCE(c.logradouro,            b.best_logradouro),
  numero               = COALESCE(c.numero,                b.best_numero),
  complemento          = COALESCE(c.complemento,           b.best_complemento),
  bairro               = COALESCE(c.bairro,                b.best_bairro),
  telefone_secundario  = COALESCE(c.telefone_secundario,   b.best_telefone_secundario),
  observacoes          = COALESCE(c.observacoes,           b.best_observacoes),
  -- Upgrade identity_status to 'confirmed' if the row now has a valid document
  identity_status      = CASE
                           WHEN c.identity_status = 'pending_cpf'
                            AND (c.cpf_normalized IS NOT NULL OR c.cnpj_normalized IS NOT NULL)
                           THEN 'confirmed'
                           ELSE c.identity_status
                         END,
  -- Merge metadata: duplicate metadata fills gaps; canonical always wins on key conflicts
  metadata             = CASE
                           WHEN c.metadata IS NULL OR c.metadata = '{}'::jsonb OR c.metadata = 'null'::jsonb
                           THEN COALESCE(
                             (SELECT jsonb_object_agg(kv.key, kv.value)
                              FROM (
                                SELECT DISTINCT ON (k2.key) k2.key, k2.value
                                FROM data_hygiene._doc_merge_map dm2
                                JOIN public.clients d2 ON d2.id = dm2.duplicate_id
                                JOIN jsonb_each(COALESCE(d2.metadata, '{}'::jsonb)) k2(key, value) ON true
                                WHERE dm2.canonical_id = c.id
                                  AND d2.metadata IS NOT NULL
                                  AND d2.metadata <> 'null'::jsonb
                                ORDER BY k2.key, (SELECT completeness_score FROM public.vw_clients_cleanup_base WHERE id = d2.id) DESC NULLS LAST
                              ) kv
                             ),
                             '{}'::jsonb
                           )
                           ELSE c.metadata || COALESCE(
                             (SELECT jsonb_object_agg(kv.key, kv.value)
                              FROM (
                                SELECT DISTINCT ON (k2.key) k2.key, k2.value
                                FROM data_hygiene._doc_merge_map dm2
                                JOIN public.clients d2 ON d2.id = dm2.duplicate_id
                                JOIN jsonb_each(COALESCE(d2.metadata, '{}'::jsonb)) k2(key, value) ON true
                                WHERE dm2.canonical_id = c.id
                                  AND d2.metadata IS NOT NULL
                                  AND d2.metadata <> 'null'::jsonb
                                ORDER BY k2.key, (SELECT completeness_score FROM public.vw_clients_cleanup_base WHERE id = d2.id) DESC NULLS LAST
                              ) kv
                             ),
                             '{}'::jsonb
                           )
                         END,
  updated_at           = now()
FROM best_from_dups b
WHERE c.id = b.canonical_id;


-- D2) Enriquecer canônico com dados dos duplicados do mapa de e-mail
WITH best_from_dups AS (
  SELECT
    em.canonical_id,
    (array_agg(d.client_name     ORDER BY vw.completeness_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.client_name IS NOT NULL AND btrim(d.client_name) <> '' AND d.client_name ~* '[A-Za-zÀ-ÖØ-öø-ÿ]'))[1] AS best_name,
    (array_agg(d.client_document ORDER BY vw.completeness_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.client_document IS NOT NULL AND btrim(d.client_document) <> ''))[1]                                    AS best_document,
    (array_agg(d.client_phone    ORDER BY vw.completeness_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.client_phone IS NOT NULL AND length(regexp_replace(d.client_phone, '[^0-9]', '', 'g')) >= 10))[1]      AS best_phone,
    (array_agg(d.client_city     ORDER BY vw.completeness_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.client_city IS NOT NULL AND btrim(d.client_city) <> ''))[1]                                            AS best_city,
    (array_agg(d.client_state    ORDER BY vw.completeness_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.client_state IS NOT NULL AND btrim(d.client_state) <> ''))[1]                                          AS best_state,
    (array_agg(d.client_address  ORDER BY vw.completeness_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.client_address IS NOT NULL AND btrim(d.client_address) <> ''))[1]                                      AS best_address,
    (array_agg(d.cep             ORDER BY vw.completeness_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.cep IS NOT NULL AND btrim(d.cep) <> ''))[1]                                                            AS best_cep,
    (array_agg(d.cpf_normalized  ORDER BY vw.completeness_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.cpf_normalized IS NOT NULL))[1]                                                                        AS best_cpf_normalized,
    (array_agg(d.cnpj_normalized ORDER BY vw.completeness_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.cnpj_normalized IS NOT NULL))[1]                                                                       AS best_cnpj_normalized,
    (array_agg(d.consumption_kwh_month ORDER BY vw.completeness_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.consumption_kwh_month IS NOT NULL AND d.consumption_kwh_month > 0))[1]                                 AS best_consumption_kwh_month,
    (array_agg(d.system_kwp      ORDER BY vw.completeness_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.system_kwp IS NOT NULL AND d.system_kwp > 0))[1]                                                       AS best_system_kwp
  FROM data_hygiene._email_merge_map em
  JOIN public.clients d  ON d.id  = em.duplicate_id
  JOIN public.vw_clients_cleanup_base vw ON vw.id = em.duplicate_id
  GROUP BY em.canonical_id
)
UPDATE public.clients c
SET
  client_name           = COALESCE(c.client_name,           b.best_name),
  client_document       = COALESCE(c.client_document,       b.best_document),
  client_phone          = COALESCE(c.client_phone,          b.best_phone),
  client_city           = COALESCE(c.client_city,           b.best_city),
  client_state          = COALESCE(c.client_state,          b.best_state),
  client_address        = COALESCE(c.client_address,        b.best_address),
  cep                   = COALESCE(c.cep,                   b.best_cep),
  cpf_normalized        = COALESCE(c.cpf_normalized,        b.best_cpf_normalized),
  cnpj_normalized       = COALESCE(c.cnpj_normalized,       b.best_cnpj_normalized),
  consumption_kwh_month = COALESCE(c.consumption_kwh_month, b.best_consumption_kwh_month),
  system_kwp            = COALESCE(c.system_kwp,            b.best_system_kwp),
  identity_status       = CASE
                            WHEN c.identity_status = 'pending_cpf'
                             AND COALESCE(c.cpf_normalized, b.best_cpf_normalized) IS NOT NULL
                            THEN 'confirmed'
                            ELSE c.identity_status
                          END,
  updated_at            = now()
FROM best_from_dups b
WHERE c.id = b.canonical_id;


-- D3) Enriquecer canônico com dados dos duplicados do mapa de telefone
WITH best_from_dups AS (
  SELECT
    pm.canonical_id,
    (array_agg(d.client_name     ORDER BY vw.completeness_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.client_name IS NOT NULL AND btrim(d.client_name) <> '' AND d.client_name ~* '[A-Za-zÀ-ÖØ-öø-ÿ]'))[1] AS best_name,
    (array_agg(d.client_email    ORDER BY vw.completeness_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.client_email IS NOT NULL AND d.client_email LIKE '%@%.%'))[1]                                         AS best_email,
    (array_agg(d.client_city     ORDER BY vw.completeness_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.client_city IS NOT NULL AND btrim(d.client_city) <> ''))[1]                                           AS best_city,
    (array_agg(d.client_state    ORDER BY vw.completeness_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.client_state IS NOT NULL AND btrim(d.client_state) <> ''))[1]                                         AS best_state,
    (array_agg(d.client_address  ORDER BY vw.completeness_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.client_address IS NOT NULL AND btrim(d.client_address) <> ''))[1]                                     AS best_address,
    (array_agg(d.cep             ORDER BY vw.completeness_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.cep IS NOT NULL AND btrim(d.cep) <> ''))[1]                                                           AS best_cep,
    (array_agg(d.consumption_kwh_month ORDER BY vw.completeness_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.consumption_kwh_month IS NOT NULL AND d.consumption_kwh_month > 0))[1]                                AS best_consumption_kwh_month,
    (array_agg(d.system_kwp      ORDER BY vw.completeness_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.system_kwp IS NOT NULL AND d.system_kwp > 0))[1]                                                      AS best_system_kwp
  FROM data_hygiene._phone_merge_map pm
  JOIN public.clients d  ON d.id  = pm.duplicate_id
  JOIN public.vw_clients_cleanup_base vw ON vw.id = pm.duplicate_id
  GROUP BY pm.canonical_id
)
UPDATE public.clients c
SET
  client_name           = COALESCE(c.client_name,           b.best_name),
  client_email          = COALESCE(c.client_email,          b.best_email),
  client_city           = COALESCE(c.client_city,           b.best_city),
  client_state          = COALESCE(c.client_state,          b.best_state),
  client_address        = COALESCE(c.client_address,        b.best_address),
  cep                   = COALESCE(c.cep,                   b.best_cep),
  consumption_kwh_month = COALESCE(c.consumption_kwh_month, b.best_consumption_kwh_month),
  system_kwp            = COALESCE(c.system_kwp,            b.best_system_kwp),
  updated_at            = now()
FROM best_from_dups b
WHERE c.id = b.canonical_id;


-- ============================================================================================================================
-- E) MIGRAÇÃO DE VÍNCULOS
-- ============================================================================================================================
-- Redirecionar todos os client_id que apontam para duplicados para o canônico,
-- em todas as tabelas dependentes. Fazer ANTES do soft-delete dos duplicados.
-- ============================================================================================================================

-- Helper: combined map of all three sources for FK migration
-- We create a temporary aggregate view within a CTE for each table update.

-- E1) proposals
UPDATE public.proposals p
SET
  client_id  = combined.canonical_id,
  updated_at = now()
FROM (
  SELECT duplicate_id, canonical_id FROM data_hygiene._doc_merge_map
  UNION ALL
  SELECT duplicate_id, canonical_id FROM data_hygiene._email_merge_map
  UNION ALL
  SELECT duplicate_id, canonical_id FROM data_hygiene._phone_merge_map
) combined
WHERE p.client_id = combined.duplicate_id
  AND p.deleted_at IS NULL;

-- E2) client_contracts — multi-row, just redirect client_id
UPDATE public.client_contracts cc
SET
  client_id  = combined.canonical_id,
  updated_at = now()
FROM (
  SELECT duplicate_id, canonical_id FROM data_hygiene._doc_merge_map
  UNION ALL
  SELECT duplicate_id, canonical_id FROM data_hygiene._email_merge_map
  UNION ALL
  SELECT duplicate_id, canonical_id FROM data_hygiene._phone_merge_map
) combined
WHERE cc.client_id = combined.duplicate_id;

-- E3) client_notes — multi-row
UPDATE public.client_notes cn
SET client_id = combined.canonical_id
FROM (
  SELECT duplicate_id, canonical_id FROM data_hygiene._doc_merge_map
  UNION ALL
  SELECT duplicate_id, canonical_id FROM data_hygiene._email_merge_map
  UNION ALL
  SELECT duplicate_id, canonical_id FROM data_hygiene._phone_merge_map
) combined
WHERE cn.client_id = combined.duplicate_id;

-- E4) client_billing_profile — UNIQUE(client_id): merge then redirect or delete
-- Step 1: Enrich canonical billing profile with data from duplicate's profile
UPDATE public.client_billing_profile bp_canon
SET
  due_day                    = COALESCE(bp_canon.due_day,                   bp_dup.due_day),
  reading_day                = COALESCE(bp_canon.reading_day,               bp_dup.reading_day),
  first_billing_date         = COALESCE(bp_canon.first_billing_date,        bp_dup.first_billing_date),
  expected_last_billing_date = COALESCE(bp_canon.expected_last_billing_date,bp_dup.expected_last_billing_date),
  recurrence_type            = COALESCE(bp_canon.recurrence_type,           bp_dup.recurrence_type),
  payment_status             = CASE
                                 -- Conservative rule: worst status wins. If either record shows
                                 -- delinquency (overdue/written_off), the merged canonical inherits
                                 -- it — hiding a negative history would misrepresent credit risk.
                                 WHEN bp_canon.payment_status IN ('overdue','written_off') THEN bp_canon.payment_status
                                 WHEN bp_dup.payment_status   IN ('overdue','written_off') THEN bp_dup.payment_status
                                 WHEN bp_canon.payment_status = 'current'                 THEN bp_canon.payment_status
                                 WHEN bp_dup.payment_status   = 'current'                 THEN bp_dup.payment_status
                                 ELSE COALESCE(bp_canon.payment_status, bp_dup.payment_status)
                               END,
  delinquency_status         = COALESCE(bp_canon.delinquency_status,        bp_dup.delinquency_status),
  valor_mensalidade          = COALESCE(bp_canon.valor_mensalidade,         bp_dup.valor_mensalidade),
  updated_at                 = now()
FROM (
  SELECT duplicate_id, canonical_id FROM data_hygiene._doc_merge_map
  UNION ALL
  SELECT duplicate_id, canonical_id FROM data_hygiene._email_merge_map
  UNION ALL
  SELECT duplicate_id, canonical_id FROM data_hygiene._phone_merge_map
) combined
JOIN public.client_billing_profile bp_dup ON bp_dup.client_id = combined.duplicate_id
WHERE bp_canon.client_id = combined.canonical_id;

-- Step 2: Transfer billing profile where canonical doesn't have one
UPDATE public.client_billing_profile bp
SET
  client_id  = combined.canonical_id,
  updated_at = now()
FROM (
  SELECT duplicate_id, canonical_id FROM data_hygiene._doc_merge_map
  UNION ALL
  SELECT duplicate_id, canonical_id FROM data_hygiene._email_merge_map
  UNION ALL
  SELECT duplicate_id, canonical_id FROM data_hygiene._phone_merge_map
) combined
WHERE bp.client_id = combined.duplicate_id
  AND NOT EXISTS (
    SELECT 1 FROM public.client_billing_profile WHERE client_id = combined.canonical_id
  );

-- Step 3: Delete duplicate's billing profile where canonical already has one (merge done)
DELETE FROM public.client_billing_profile
WHERE client_id IN (
  SELECT combined.duplicate_id
  FROM (
    SELECT duplicate_id, canonical_id FROM data_hygiene._doc_merge_map
    UNION ALL
    SELECT duplicate_id, canonical_id FROM data_hygiene._email_merge_map
    UNION ALL
    SELECT duplicate_id, canonical_id FROM data_hygiene._phone_merge_map
  ) combined
  WHERE EXISTS (
    SELECT 1 FROM public.client_billing_profile WHERE client_id = combined.canonical_id
  )
);

-- E5) client_usina_config — UNIQUE(client_id)
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
  SELECT duplicate_id, canonical_id FROM data_hygiene._doc_merge_map
  UNION ALL
  SELECT duplicate_id, canonical_id FROM data_hygiene._email_merge_map
  UNION ALL
  SELECT duplicate_id, canonical_id FROM data_hygiene._phone_merge_map
) combined
JOIN public.client_usina_config uc_dup ON uc_dup.client_id = combined.duplicate_id
WHERE uc_canon.client_id = combined.canonical_id;

UPDATE public.client_usina_config uc
SET
  client_id  = combined.canonical_id,
  updated_at = now()
FROM (
  SELECT duplicate_id, canonical_id FROM data_hygiene._doc_merge_map
  UNION ALL
  SELECT duplicate_id, canonical_id FROM data_hygiene._email_merge_map
  UNION ALL
  SELECT duplicate_id, canonical_id FROM data_hygiene._phone_merge_map
) combined
WHERE uc.client_id = combined.duplicate_id
  AND NOT EXISTS (
    SELECT 1 FROM public.client_usina_config WHERE client_id = combined.canonical_id
  );

DELETE FROM public.client_usina_config
WHERE client_id IN (
  SELECT combined.duplicate_id
  FROM (
    SELECT duplicate_id, canonical_id FROM data_hygiene._doc_merge_map
    UNION ALL
    SELECT duplicate_id, canonical_id FROM data_hygiene._email_merge_map
    UNION ALL
    SELECT duplicate_id, canonical_id FROM data_hygiene._phone_merge_map
  ) combined
  WHERE EXISTS (
    SELECT 1 FROM public.client_usina_config WHERE client_id = combined.canonical_id
  )
);

-- E6) client_lifecycle — UNIQUE(client_id)
UPDATE public.client_lifecycle lc_canon
SET
  is_converted_customer      = (lc_canon.is_converted_customer OR lc_dup.is_converted_customer),
  is_active_portfolio_client = (lc_canon.is_active_portfolio_client OR lc_dup.is_active_portfolio_client),
  exported_to_portfolio_at   = COALESCE(lc_canon.exported_to_portfolio_at, lc_dup.exported_to_portfolio_at),
  converted_from_lead_at     = COALESCE(lc_canon.converted_from_lead_at,  lc_dup.converted_from_lead_at),
  onboarding_status          = COALESCE(lc_canon.onboarding_status,        lc_dup.onboarding_status),
  exported_by_user_id        = COALESCE(lc_canon.exported_by_user_id,      lc_dup.exported_by_user_id),
  lifecycle_status           = CASE
                                 WHEN lc_canon.lifecycle_status IN ('billing','active','contracted') THEN lc_canon.lifecycle_status
                                 WHEN lc_dup.lifecycle_status   IN ('billing','active','contracted') THEN lc_dup.lifecycle_status
                                 ELSE COALESCE(lc_canon.lifecycle_status, lc_dup.lifecycle_status)
                               END,
  updated_at                 = now()
FROM (
  SELECT duplicate_id, canonical_id FROM data_hygiene._doc_merge_map
  UNION ALL
  SELECT duplicate_id, canonical_id FROM data_hygiene._email_merge_map
  UNION ALL
  SELECT duplicate_id, canonical_id FROM data_hygiene._phone_merge_map
) combined
JOIN public.client_lifecycle lc_dup ON lc_dup.client_id = combined.duplicate_id
WHERE lc_canon.client_id = combined.canonical_id;

UPDATE public.client_lifecycle lc
SET
  client_id  = combined.canonical_id,
  updated_at = now()
FROM (
  SELECT duplicate_id, canonical_id FROM data_hygiene._doc_merge_map
  UNION ALL
  SELECT duplicate_id, canonical_id FROM data_hygiene._email_merge_map
  UNION ALL
  SELECT duplicate_id, canonical_id FROM data_hygiene._phone_merge_map
) combined
WHERE lc.client_id = combined.duplicate_id
  AND NOT EXISTS (
    SELECT 1 FROM public.client_lifecycle WHERE client_id = combined.canonical_id
  );

DELETE FROM public.client_lifecycle
WHERE client_id IN (
  SELECT combined.duplicate_id
  FROM (
    SELECT duplicate_id, canonical_id FROM data_hygiene._doc_merge_map
    UNION ALL
    SELECT duplicate_id, canonical_id FROM data_hygiene._email_merge_map
    UNION ALL
    SELECT duplicate_id, canonical_id FROM data_hygiene._phone_merge_map
  ) combined
  WHERE EXISTS (
    SELECT 1 FROM public.client_lifecycle WHERE client_id = combined.canonical_id
  )
);

-- E7) client_project_status — UNIQUE(client_id)
UPDATE public.client_project_status ps_canon
SET
  installation_status   = COALESCE(ps_canon.installation_status,  ps_dup.installation_status),
  engineering_status    = COALESCE(ps_canon.engineering_status,   ps_dup.engineering_status),
  homologation_status   = COALESCE(ps_canon.homologation_status,  ps_dup.homologation_status),
  commissioning_status  = COALESCE(ps_canon.commissioning_status, ps_dup.commissioning_status),
  commissioning_date    = COALESCE(ps_canon.commissioning_date,   ps_dup.commissioning_date),
  first_injection_date  = COALESCE(ps_canon.first_injection_date, ps_dup.first_injection_date),
  first_generation_date = COALESCE(ps_canon.first_generation_date,ps_dup.first_generation_date),
  expected_go_live_date = COALESCE(ps_canon.expected_go_live_date,ps_dup.expected_go_live_date),
  integrator_name       = COALESCE(ps_canon.integrator_name,      ps_dup.integrator_name),
  engineer_name         = COALESCE(ps_canon.engineer_name,        ps_dup.engineer_name),
  notes                 = CASE
                            WHEN ps_canon.notes IS NULL THEN ps_dup.notes
                            WHEN ps_dup.notes IS NULL   THEN ps_canon.notes
                            -- Separator matches dedup_clients_by_name.sql convention.
                            -- To split programmatically, search for '\n---\n'.
                            ELSE ps_canon.notes || E'\n---\n' || ps_dup.notes
                          END,
  updated_at            = now()
FROM (
  SELECT duplicate_id, canonical_id FROM data_hygiene._doc_merge_map
  UNION ALL
  SELECT duplicate_id, canonical_id FROM data_hygiene._email_merge_map
  UNION ALL
  SELECT duplicate_id, canonical_id FROM data_hygiene._phone_merge_map
) combined
JOIN public.client_project_status ps_dup ON ps_dup.client_id = combined.duplicate_id
WHERE ps_canon.client_id = combined.canonical_id;

UPDATE public.client_project_status ps
SET
  client_id  = combined.canonical_id,
  updated_at = now()
FROM (
  SELECT duplicate_id, canonical_id FROM data_hygiene._doc_merge_map
  UNION ALL
  SELECT duplicate_id, canonical_id FROM data_hygiene._email_merge_map
  UNION ALL
  SELECT duplicate_id, canonical_id FROM data_hygiene._phone_merge_map
) combined
WHERE ps.client_id = combined.duplicate_id
  AND NOT EXISTS (
    SELECT 1 FROM public.client_project_status WHERE client_id = combined.canonical_id
  );

DELETE FROM public.client_project_status
WHERE client_id IN (
  SELECT combined.duplicate_id
  FROM (
    SELECT duplicate_id, canonical_id FROM data_hygiene._doc_merge_map
    UNION ALL
    SELECT duplicate_id, canonical_id FROM data_hygiene._email_merge_map
    UNION ALL
    SELECT duplicate_id, canonical_id FROM data_hygiene._phone_merge_map
  ) combined
  WHERE EXISTS (
    SELECT 1 FROM public.client_project_status WHERE client_id = combined.canonical_id
  )
);

-- E8) client_energy_profile — UNIQUE(client_id)
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
  updated_at          = now()
FROM (
  SELECT duplicate_id, canonical_id FROM data_hygiene._doc_merge_map
  UNION ALL
  SELECT duplicate_id, canonical_id FROM data_hygiene._email_merge_map
  UNION ALL
  SELECT duplicate_id, canonical_id FROM data_hygiene._phone_merge_map
) combined
JOIN public.client_energy_profile ep_dup ON ep_dup.client_id = combined.duplicate_id
WHERE ep_canon.client_id = combined.canonical_id;

UPDATE public.client_energy_profile ep
SET
  client_id  = combined.canonical_id,
  updated_at = now()
FROM (
  SELECT duplicate_id, canonical_id FROM data_hygiene._doc_merge_map
  UNION ALL
  SELECT duplicate_id, canonical_id FROM data_hygiene._email_merge_map
  UNION ALL
  SELECT duplicate_id, canonical_id FROM data_hygiene._phone_merge_map
) combined
WHERE ep.client_id = combined.duplicate_id
  AND NOT EXISTS (
    SELECT 1 FROM public.client_energy_profile WHERE client_id = combined.canonical_id
  );

DELETE FROM public.client_energy_profile
WHERE client_id IN (
  SELECT combined.duplicate_id
  FROM (
    SELECT duplicate_id, canonical_id FROM data_hygiene._doc_merge_map
    UNION ALL
    SELECT duplicate_id, canonical_id FROM data_hygiene._email_merge_map
    UNION ALL
    SELECT duplicate_id, canonical_id FROM data_hygiene._phone_merge_map
  ) combined
  WHERE EXISTS (
    SELECT 1 FROM public.client_energy_profile WHERE client_id = combined.canonical_id
  )
);


-- ============================================================================================================================
-- F) SOFT-DELETE DOS DUPLICADOS + AUDITORIA
-- ============================================================================================================================
-- 1. Log each merge to client_merge_audit (before the update).
-- 2. Mark duplicates: merged_into_client_id = canonical_id, identity_status = 'merged',
--    deleted_at = now().
-- Safety guards: never soft-delete a canonical, never soft-delete in_portfolio = true,
-- never soft-delete where an active contract or billing remains.
-- ============================================================================================================================

-- F1) Audit log for all merges (snapshot before soft-delete)
INSERT INTO public.client_merge_audit (
  rule_name,
  canonical_client_id,
  duplicate_client_id,
  reason,
  before_canonical,
  before_duplicate
)
SELECT
  combined.merge_rule,
  combined.canonical_id,
  combined.duplicate_id,
  'deduplicação automática por ' || combined.merge_rule || ' = ' || combined.key_value,
  to_jsonb(canon.*),
  to_jsonb(dup.*)
FROM (
  SELECT duplicate_id, canonical_id, merge_rule, key_value FROM data_hygiene._doc_merge_map
  UNION ALL
  SELECT duplicate_id, canonical_id, merge_rule, key_value FROM data_hygiene._email_merge_map
  UNION ALL
  SELECT duplicate_id, canonical_id, merge_rule, key_value FROM data_hygiene._phone_merge_map
) combined
JOIN public.clients canon ON canon.id = combined.canonical_id
JOIN public.clients dup   ON dup.id   = combined.duplicate_id
WHERE dup.deleted_at IS NULL  -- not already deleted
  AND dup.id <> combined.canonical_id;  -- safety: never log canonical as duplicate


-- F2) Soft-delete duplicados (sem vínculo crítico residual)
UPDATE public.clients c
SET
  merged_into_client_id = combined.canonical_id,
  identity_status       = 'merged',
  deleted_at            = COALESCE(c.deleted_at, now()),
  updated_at            = now()
FROM (
  SELECT duplicate_id, canonical_id FROM data_hygiene._doc_merge_map
  UNION ALL
  SELECT duplicate_id, canonical_id FROM data_hygiene._email_merge_map
  UNION ALL
  SELECT duplicate_id, canonical_id FROM data_hygiene._phone_merge_map
) combined
WHERE c.id = combined.duplicate_id
  AND c.id <> combined.canonical_id  -- safety guard: never mark canonical as merged
  -- Never soft-delete a portfolio client
  AND c.in_portfolio = false
  -- Never soft-delete if an active contract still points to this row (should be migrated already)
  AND NOT EXISTS (
    SELECT 1 FROM public.client_contracts cc
    WHERE cc.client_id = c.id
      AND cc.contract_status IN ('active','signed','suspended')
  )
  -- Never soft-delete if active billing still points to this row
  AND NOT EXISTS (
    SELECT 1 FROM public.client_billing_profile bp
    WHERE bp.client_id = c.id
      AND bp.payment_status NOT IN ('cancelled','written_off')
  );

-- F3) Report duplicados retidos (requerem revisão manual):
SELECT
  c.id,
  c.client_name,
  combined.canonical_id,
  combined.merge_rule,
  combined.key_value,
  CASE
    WHEN c.in_portfolio THEN 'em_portfolio'
    WHEN EXISTS(SELECT 1 FROM public.client_contracts cc WHERE cc.client_id = c.id AND cc.contract_status IN ('active','signed','suspended')) THEN 'contrato_ativo'
    WHEN EXISTS(SELECT 1 FROM public.client_billing_profile bp WHERE bp.client_id = c.id AND bp.payment_status NOT IN ('cancelled','written_off')) THEN 'billing_ativo'
    ELSE 'outro'
  END AS motivo_retencao
FROM (
  SELECT duplicate_id, canonical_id, merge_rule, key_value FROM data_hygiene._doc_merge_map
  UNION ALL
  SELECT duplicate_id, canonical_id, merge_rule, key_value FROM data_hygiene._email_merge_map
  UNION ALL
  SELECT duplicate_id, canonical_id, merge_rule, key_value FROM data_hygiene._phone_merge_map
) combined
JOIN public.clients c ON c.id = combined.duplicate_id
WHERE c.deleted_at IS NULL  -- still active = not soft-deleted in F2
ORDER BY combined.merge_rule, c.id;


-- ============================================================================================================================
-- G) PURGE DE REGISTROS ANTIGOS SEM REFERÊNCIAS ATIVAS
-- ============================================================================================================================
-- Critérios para purge permanente (DELETE):
--   • merged_into_client_id IS NOT NULL  (já mesclado)  AND deleted_at < now() - 30 days
--   OR deleted_at IS NOT NULL            (soft-deleted)  AND deleted_at < now() - 90 days
--   AND sem referência ativa em proposals, client_contracts ou client_lifecycle
--   AND in_portfolio = false
--   AND sem documento válido (cpf_normalized / cnpj_normalized são ambos NULL)
--
-- Rationale dos intervalos de retenção:
--   • 30 dias para mesclados: tempo suficiente para detectar erros de merge e reverter.
--   • 90 dias para soft-deleted: cobre ciclo de faturamento trimestral e auditorias recentes.
--   Para política diferente, ajustar os INTERVAL abaixo nas queries G2/G3/G4.
--
-- Registros com documento válido são preservados por padrão para rastreabilidade.
-- Se quiser arquivar em vez de deletar: substituir DELETE por
--   INSERT INTO clients_purged_archive SELECT * ... ; UPDATE ... SET deleted_at = ...
-- ============================================================================================================================

-- G1) Preview do que seria purgado
SELECT
  'G1 - candidatos a purge (merged >30d, sem referências)' AS check_name,
  COUNT(*) AS total
FROM public.clients c
WHERE c.merged_into_client_id IS NOT NULL
  AND c.deleted_at < now() - INTERVAL '30 days'
  AND c.in_portfolio = false
  AND c.cpf_normalized  IS NULL
  AND c.cnpj_normalized IS NULL
  AND NOT EXISTS (SELECT 1 FROM public.proposals          p  WHERE p.client_id  = c.id AND p.deleted_at IS NULL)
  AND NOT EXISTS (SELECT 1 FROM public.client_contracts   cc WHERE cc.client_id = c.id AND cc.contract_status IN ('active','signed','suspended'))
  AND NOT EXISTS (SELECT 1 FROM public.client_lifecycle   lc WHERE lc.client_id = c.id AND lc.is_converted_customer = true);

SELECT
  'G2 - candidatos a purge (soft-deleted >90d, sem referências)' AS check_name,
  COUNT(*) AS total
FROM public.clients c
WHERE c.merged_into_client_id IS NULL
  AND c.deleted_at IS NOT NULL
  AND c.deleted_at < now() - INTERVAL '90 days'
  AND c.in_portfolio = false
  AND c.cpf_normalized  IS NULL
  AND c.cnpj_normalized IS NULL
  AND NOT EXISTS (SELECT 1 FROM public.proposals          p  WHERE p.client_id  = c.id AND p.deleted_at IS NULL)
  AND NOT EXISTS (SELECT 1 FROM public.client_contracts   cc WHERE cc.client_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM public.client_lifecycle   lc WHERE lc.client_id = c.id AND lc.is_converted_customer = true);


-- G3) DELETE: registros mesclados há mais de 30 dias, sem documento válido, sem referências
--     AVISO: irreversível após COMMIT. Verificar preview acima antes de prosseguir.
DELETE FROM public.clients c
WHERE c.merged_into_client_id IS NOT NULL
  AND c.deleted_at < now() - INTERVAL '30 days'
  AND c.in_portfolio = false
  AND c.cpf_normalized  IS NULL
  AND c.cnpj_normalized IS NULL
  AND NOT EXISTS (SELECT 1 FROM public.proposals          p  WHERE p.client_id  = c.id AND p.deleted_at IS NULL)
  AND NOT EXISTS (SELECT 1 FROM public.client_contracts   cc WHERE cc.client_id = c.id AND cc.contract_status IN ('active','signed','suspended'))
  AND NOT EXISTS (SELECT 1 FROM public.client_lifecycle   lc WHERE lc.client_id = c.id AND lc.is_converted_customer = true);


-- G4) DELETE: registros soft-deleted há mais de 90 dias, sem documento, sem referências
DELETE FROM public.clients c
WHERE c.merged_into_client_id IS NULL
  AND c.deleted_at IS NOT NULL
  AND c.deleted_at < now() - INTERVAL '90 days'
  AND c.in_portfolio = false
  AND c.cpf_normalized  IS NULL
  AND c.cnpj_normalized IS NULL
  AND NOT EXISTS (SELECT 1 FROM public.proposals          p  WHERE p.client_id  = c.id AND p.deleted_at IS NULL)
  AND NOT EXISTS (SELECT 1 FROM public.client_contracts   cc WHERE cc.client_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM public.client_lifecycle   lc WHERE lc.client_id = c.id AND lc.is_converted_customer = true);


-- ============================================================================================================================
-- COMMIT — confirmar todas as alterações dos BLOCOs C–G
-- Para simular sem commitar, substituir por ROLLBACK
-- ============================================================================================================================

COMMIT;

-- NOTA: As tabelas data_hygiene._doc_merge_map, _email_merge_map, _phone_merge_map e
-- _doc_dedup_scores persistem no schema data_hygiene para auditoria pós-execução.
-- Para descartá-las (opcional):
--   DROP TABLE IF EXISTS data_hygiene._doc_merge_map;
--   DROP TABLE IF EXISTS data_hygiene._email_merge_map;
--   DROP TABLE IF EXISTS data_hygiene._phone_merge_map;
--   DROP TABLE IF EXISTS data_hygiene._doc_dedup_scores;


-- ============================================================================================================================
-- H) BLOCO DE VERIFICAÇÃO FINAL
-- ============================================================================================================================
-- Rodar após o COMMIT para confirmar o resultado.
-- ============================================================================================================================

-- H1) Grupos de CPF duplicado restantes (esperado: 0)
SELECT
  'H1 - grupos de CPF duplicado restantes' AS check_name,
  COUNT(DISTINCT cpf_normalized)            AS grupos,
  SUM(cnt - 1)                              AS excedentes
FROM (
  SELECT cpf_normalized, COUNT(*) AS cnt
  FROM public.clients
  WHERE deleted_at IS NULL
    AND merged_into_client_id IS NULL
    AND cpf_normalized IS NOT NULL
  GROUP BY cpf_normalized
  HAVING COUNT(*) > 1
) t;

-- H2) Grupos de CNPJ duplicado restantes (esperado: 0)
SELECT
  'H2 - grupos de CNPJ duplicado restantes' AS check_name,
  COUNT(DISTINCT cnpj_normalized)            AS grupos,
  SUM(cnt - 1)                               AS excedentes
FROM (
  SELECT cnpj_normalized, COUNT(*) AS cnt
  FROM public.clients
  WHERE deleted_at IS NULL
    AND merged_into_client_id IS NULL
    AND cnpj_normalized IS NOT NULL
  GROUP BY cnpj_normalized
  HAVING COUNT(*) > 1
) t;

-- H3) Grupos de e-mail duplicado restantes (esperado: apenas pares bloqueados por conflito)
SELECT
  'H3 - grupos de e-mail duplicado restantes' AS check_name,
  COUNT(DISTINCT lower(btrim(client_email)))   AS grupos,
  SUM(cnt - 1)                                 AS excedentes
FROM (
  SELECT lower(btrim(client_email)) AS email_norm, COUNT(*) AS cnt
  FROM public.clients
  WHERE deleted_at IS NULL
    AND merged_into_client_id IS NULL
    AND client_email IS NOT NULL
    AND btrim(client_email) <> ''
    AND lower(btrim(client_email)) NOT IN ('null','undefined','[object object]','0','-','—','n/a','na')
    AND position('@' IN btrim(client_email)) > 0
  GROUP BY 1
  HAVING COUNT(*) > 1
) t;

-- H4) Audit log — total de merges registrados nesta execução
SELECT
  'H4 - merges registrados em client_merge_audit' AS check_name,
  rule_name,
  COUNT(*) AS total
FROM public.client_merge_audit
GROUP BY rule_name
ORDER BY rule_name;

-- H5) Proposals com client_id apontando para cliente soft-deleted
SELECT
  'H5 - proposals com client_id órfão' AS check_name,
  COUNT(*)                             AS total
FROM public.proposals p
LEFT JOIN public.clients c ON c.id = p.client_id
WHERE p.deleted_at IS NULL
  AND p.client_id IS NOT NULL
  AND (c.id IS NULL OR c.deleted_at IS NOT NULL);

-- H6) Contratos com client_id apontando para cliente soft-deleted
SELECT
  'H6 - contratos com client_id órfão' AS check_name,
  COUNT(*)                              AS total
FROM public.client_contracts cc
LEFT JOIN public.clients c ON c.id = cc.client_id
WHERE c.id IS NULL OR c.deleted_at IS NOT NULL;

-- H7) Resumo geral do estado da tabela clients após o cleanup
SELECT
  'H7 - resumo clients'                                AS check_name,
  COUNT(*)                                              AS total,
  COUNT(*) FILTER (WHERE deleted_at IS NULL AND merged_into_client_id IS NULL) AS ativos,
  COUNT(*) FILTER (WHERE merged_into_client_id IS NOT NULL)                    AS mesclados,
  COUNT(*) FILTER (WHERE deleted_at IS NOT NULL AND merged_into_client_id IS NULL) AS soft_deleted_sem_merge
FROM public.clients;
