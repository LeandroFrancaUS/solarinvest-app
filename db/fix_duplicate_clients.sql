-- ============================================================================
-- fix_duplicate_clients.sql
-- ============================================================================
--
-- OBJETIVO:
--   Diagnóstico e limpeza definitiva de registros duplicados/inválidos na
--   tabela clients, com ênfase em duplicatas criadas por auto-save sem
--   offline_origin_id nem CPF/CNPJ.
--
-- ⚠️  ATENÇÃO — OPERAÇÃO DESTRUTIVA E IRREVERSÍVEL
-- -------------------------------------------------
--   • Execute sempre após fazer um pg_dump completo do banco de produção.
--   • Os blocos de PREVIEW (SELECT) são seguros de executar a qualquer momento.
--   • Os blocos de DELETE só devem ser executados após revisar os resultados dos SELECTs.
--   • Para simular sem commitar: substitua COMMIT por ROLLBACK no final.
--
-- ESTRUTURA:
--   BLOCO 1 — Diagnóstico: contagem geral
--   BLOCO 2 — Diagnóstico: duplicatas por nome + dono (origem principal do problema)
--   BLOCO 3 — Diagnóstico: duplicatas por offline_origin_id
--   BLOCO 4 — Diagnóstico: clientes inválidos / teste
--   BLOCO 5 — Limpeza: duplicatas por nome + dono (sem CPF/CNPJ)
--   BLOCO 6 — Limpeza: clientes inválidos
--   BLOCO 7 — Verificação final
--
-- ============================================================================


-- ============================================================================
-- BLOCO 1 — DIAGNÓSTICO GERAL
-- ============================================================================

SELECT
  COUNT(*) FILTER (WHERE deleted_at IS NULL AND merged_into_client_id IS NULL) AS clientes_ativos,
  COUNT(*) FILTER (WHERE deleted_at IS NOT NULL) AS soft_deletados,
  COUNT(*) FILTER (WHERE merged_into_client_id IS NOT NULL) AS merged,
  COUNT(*) FILTER (
    WHERE deleted_at IS NULL
      AND merged_into_client_id IS NULL
      AND cpf_normalized IS NULL
      AND cnpj_normalized IS NULL
  ) AS sem_documento,
  COUNT(*) FILTER (
    WHERE deleted_at IS NULL
      AND merged_into_client_id IS NULL
      AND offline_origin_id IS NOT NULL
  ) AS com_offline_origin_id
FROM public.clients;


-- ============================================================================
-- BLOCO 2 — DUPLICATAS POR NOME + DONO (principal causa de duplicação)
-- ============================================================================

-- 2.1 Quantos grupos de duplicatas existem por (nome_normalizado, owner_user_id)?
SELECT
  COUNT(*) AS total_clientes_duplicados,
  COUNT(DISTINCT (lower(regexp_replace(btrim(client_name), '\s+', ' ', 'g')), owner_user_id)) AS grupos_duplicados
FROM public.clients
WHERE deleted_at IS NULL
  AND merged_into_client_id IS NULL
  AND cpf_normalized IS NULL
  AND cnpj_normalized IS NULL
  AND (lower(regexp_replace(btrim(client_name), '\s+', ' ', 'g')),
       owner_user_id) IN (
    SELECT
      lower(regexp_replace(btrim(client_name), '\s+', ' ', 'g')),
      owner_user_id
    FROM public.clients
    WHERE deleted_at IS NULL
      AND merged_into_client_id IS NULL
      AND cpf_normalized IS NULL
      AND cnpj_normalized IS NULL
    GROUP BY
      lower(regexp_replace(btrim(client_name), '\s+', ' ', 'g')),
      owner_user_id
    HAVING COUNT(*) > 1
  );

-- 2.2 Lista os primeiros 50 grupos de duplicatas para revisão
SELECT
  lower(regexp_replace(btrim(client_name), '\s+', ' ', 'g')) AS nome_normalizado,
  owner_user_id,
  COUNT(*) AS qtd_duplicatas,
  MIN(created_at) AS primeiro_criado,
  MAX(created_at) AS ultimo_criado,
  array_agg(id ORDER BY created_at) AS ids
FROM public.clients
WHERE deleted_at IS NULL
  AND merged_into_client_id IS NULL
  AND cpf_normalized IS NULL
  AND cnpj_normalized IS NULL
GROUP BY
  lower(regexp_replace(btrim(client_name), '\s+', ' ', 'g')),
  owner_user_id
HAVING COUNT(*) > 1
ORDER BY qtd_duplicatas DESC, nome_normalizado
LIMIT 50;


-- ============================================================================
-- BLOCO 3 — DUPLICATAS POR offline_origin_id
-- ============================================================================

-- Clientes com mesmo offline_origin_id (não deveria acontecer, mas bom verificar)
SELECT
  offline_origin_id,
  COUNT(*) AS qtd,
  array_agg(id ORDER BY created_at) AS ids,
  array_agg(client_name ORDER BY created_at) AS nomes
FROM public.clients
WHERE deleted_at IS NULL
  AND offline_origin_id IS NOT NULL
GROUP BY offline_origin_id
HAVING COUNT(*) > 1
ORDER BY qtd DESC
LIMIT 20;


-- ============================================================================
-- BLOCO 4 — CLIENTES INVÁLIDOS / TESTE
-- ============================================================================

SELECT
  id,
  client_name,
  owner_user_id,
  created_at
FROM public.clients
WHERE deleted_at IS NULL
  AND merged_into_client_id IS NULL
  AND (
    client_name IS NULL
    OR trim(client_name) = ''
    OR lower(trim(client_name)) IN (
      '0', 'null', 'undefined', '[object object]', '{}', '[]',
      'nan', 'n/a', 'na', '-', '—', '__', '??', 'sem nome',
      'test', 'teste', 'cliente', 'client', 'nome', 'name'
    )
    OR NOT (client_name ~* '[A-Za-zÀ-ÖØ-öø-ÿ]')
  )
ORDER BY created_at DESC
LIMIT 50;


-- ============================================================================
-- BLOCO 5 — LIMPEZA: DUPLICATAS POR NOME + DONO (sem CPF/CNPJ)
-- ============================================================================
--
-- Estratégia: dentro de cada grupo (nome_normalizado, owner_user_id), manter
-- o registro com maior "strength_score" e hard-deletar os demais.
--
-- SAFE: só apaga registros sem CPF/CNPJ que são cópias exatas por nome+dono.
-- ============================================================================

BEGIN;

-- 5.1 Criar mapeamento: canonical_id ↔ duplicate_ids
CREATE TEMP TABLE _name_dedup_map AS
WITH ranked AS (
  SELECT
    id AS client_id,
    lower(regexp_replace(btrim(client_name), '\s+', ' ', 'g')) AS norm_name,
    owner_user_id,
    (
      CASE WHEN in_portfolio THEN 500 ELSE 0 END
      + CASE WHEN EXISTS (
          SELECT 1 FROM public.client_contracts cc
          WHERE cc.client_id = clients.id
            AND cc.contract_status IN ('active', 'signed', 'suspended')
        ) THEN 400 ELSE 0 END
      + CASE WHEN EXISTS (
          SELECT 1 FROM public.client_billing_profile bp
          WHERE bp.client_id = clients.id
            AND bp.payment_status NOT IN ('cancelled', 'written_off')
        ) THEN 300 ELSE 0 END
      + CASE WHEN EXISTS (
          SELECT 1 FROM public.proposals p
          WHERE p.client_id = clients.id
            AND p.deleted_at IS NULL
            AND p.status NOT IN ('cancelled', 'rejected')
        ) THEN 200 ELSE 0 END
      + CASE WHEN offline_origin_id IS NOT NULL THEN 100 ELSE 0 END
      + CASE WHEN client_email IS NOT NULL AND position('@' IN client_email) > 0 THEN 30 ELSE 0 END
      + CASE WHEN length(regexp_replace(coalesce(client_phone, ''), '\D', '', 'g')) >= 10 THEN 20 ELSE 0 END
      + CASE WHEN deleted_at IS NULL THEN 10 ELSE 0 END
    ) AS strength_score,
    updated_at,
    created_at,
    ROW_NUMBER() OVER (
      PARTITION BY
        lower(regexp_replace(btrim(client_name), '\s+', ' ', 'g')),
        owner_user_id
      ORDER BY
        (CASE WHEN in_portfolio THEN 500 ELSE 0 END
         + CASE WHEN offline_origin_id IS NOT NULL THEN 100 ELSE 0 END
         + CASE WHEN client_email IS NOT NULL AND position('@' IN client_email) > 0 THEN 30 ELSE 0 END
         + CASE WHEN length(regexp_replace(coalesce(client_phone, ''), '\D', '', 'g')) >= 10 THEN 20 ELSE 0 END
        ) DESC,
        updated_at DESC NULLS LAST,
        created_at ASC,
        id ASC
    ) AS rn
  FROM public.clients
  WHERE deleted_at IS NULL
    AND merged_into_client_id IS NULL
    AND cpf_normalized IS NULL
    AND cnpj_normalized IS NULL
)
SELECT
  canon.client_id AS canonical_id,
  dup.client_id   AS duplicate_id
FROM ranked dup
JOIN (SELECT norm_name, owner_user_id, client_id FROM ranked WHERE rn = 1) canon
  ON canon.norm_name = dup.norm_name
 AND canon.owner_user_id = dup.owner_user_id
WHERE dup.rn > 1;

-- 5.2 Verificar: quantos serão deletados
SELECT COUNT(*) AS duplicatas_a_deletar FROM _name_dedup_map;

-- 5.3 Migrar FKs de proposals para o canônico
UPDATE public.proposals p
SET client_id = dm.canonical_id, updated_at = now()
FROM _name_dedup_map dm
WHERE p.client_id = dm.duplicate_id;

-- 5.4 Migrar FKs de contratos para o canônico
UPDATE public.client_contracts cc
SET client_id = dm.canonical_id, updated_at = now()
FROM _name_dedup_map dm
WHERE cc.client_id = dm.duplicate_id;

-- 5.5 Migrar FKs de notas para o canônico
UPDATE public.client_notes cn
SET client_id = dm.canonical_id
FROM _name_dedup_map dm
WHERE cn.client_id = dm.duplicate_id;

-- 5.6 Migrar FKs de billing_profile para o canônico
UPDATE public.client_billing_profile bp
SET client_id = dm.canonical_id
FROM _name_dedup_map dm
WHERE bp.client_id = dm.duplicate_id;

-- 5.7 Hard delete dos duplicados
DELETE FROM public.clients
WHERE id IN (SELECT duplicate_id FROM _name_dedup_map);

-- Confirmar resultado antes de COMMIT
SELECT COUNT(*) AS clientes_apos_limpeza FROM public.clients WHERE deleted_at IS NULL AND merged_into_client_id IS NULL;

-- Para confirmar: COMMIT
-- Para cancelar: ROLLBACK
COMMIT;


-- ============================================================================
-- BLOCO 6 — LIMPEZA: CLIENTES INVÁLIDOS (nomes placeholder/teste)
-- ============================================================================

BEGIN;

DELETE FROM public.clients
WHERE deleted_at IS NULL
  AND merged_into_client_id IS NULL
  AND cpf_normalized IS NULL
  AND cnpj_normalized IS NULL
  AND (
    client_name IS NULL
    OR trim(client_name) = ''
    OR lower(trim(client_name)) IN (
      '0', 'null', 'undefined', '[object object]', '{}', '[]',
      'nan', 'n/a', 'na', '-', '—', '__', '??', 'sem nome',
      'test', 'teste', 'cliente', 'client', 'nome', 'name'
    )
    OR NOT (client_name ~* '[A-Za-zÀ-ÖØ-öø-ÿ]')
  )
  -- Safety: don't delete if there are linked proposals, contracts, or billing
  AND NOT EXISTS (
    SELECT 1 FROM public.proposals p WHERE p.client_id = clients.id AND p.deleted_at IS NULL
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.client_contracts cc WHERE cc.client_id = clients.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.client_billing_profile bp WHERE bp.client_id = clients.id
  );

SELECT COUNT(*) AS clientes_apos_limpeza_invalidos FROM public.clients WHERE deleted_at IS NULL AND merged_into_client_id IS NULL;

-- Para confirmar: COMMIT
-- Para cancelar: ROLLBACK
COMMIT;


-- ============================================================================
-- BLOCO 7 — VERIFICAÇÃO FINAL
-- ============================================================================

SELECT
  COUNT(*) FILTER (WHERE deleted_at IS NULL AND merged_into_client_id IS NULL) AS clientes_ativos,
  COUNT(*) FILTER (
    WHERE deleted_at IS NULL
      AND merged_into_client_id IS NULL
      AND cpf_normalized IS NULL
      AND cnpj_normalized IS NULL
  ) AS sem_documento_restantes,
  COUNT(*) FILTER (
    WHERE deleted_at IS NULL
      AND merged_into_client_id IS NULL
      AND cpf_normalized IS NULL
      AND cnpj_normalized IS NULL
      AND (lower(regexp_replace(btrim(client_name), '\s+', ' ', 'g')),
           owner_user_id) IN (
        SELECT
          lower(regexp_replace(btrim(client_name), '\s+', ' ', 'g')),
          owner_user_id
        FROM public.clients
        WHERE deleted_at IS NULL
          AND merged_into_client_id IS NULL
          AND cpf_normalized IS NULL
          AND cnpj_normalized IS NULL
        GROUP BY 1, 2
        HAVING COUNT(*) > 1
      )
  ) AS duplicatas_restantes_por_nome_dono
FROM public.clients;
