-- ============================================================================
-- SCRIPT DE LIMPEZA PARA PRODUÇÃO — NEON SQL EDITOR
-- ============================================================================
--
-- OBJETIVO:
--   Executar limpeza abrangente no banco de dados de produção, incluindo:
--     1. Deletar permanentemente todos os nomes duplicados, mantendo apenas
--        o registro mais importante (com mais informações além do nome)
--     2. Eliminar permanentemente todos os nomes inválidos ou com caracteres
--        inválidos no nome (null, 0, [], {}, etc)
--     3. Deletar permanentemente todas as propostas com nomes de cliente
--        duplicados
--     4. Eliminar permanentemente todas as propostas com código inválido
--        (códigos válidos: SLRINVST-VND ou SLRINVST-LSE)
--
-- ⚠️  ATENÇÃO — OPERAÇÃO DESTRUTIVA E IRREVERSÍVEL
-- -------------------------------------------------
--   • Esta é uma operação de HARD DELETE permanente
--   • Os dados deletados NÃO podem ser recuperados depois do COMMIT
--   • SEMPRE executar pg_dump ANTES de rodar em produção
--   • Para simular sem commitar: substituir COMMIT por ROLLBACK
--   • Testar em ambiente de staging/development primeiro
--
-- ESTRUTURA DO SCRIPT:
--   BLOCO A — Backup e auditoria inicial
--   BLOCO B — Limpeza de clientes duplicados por nome
--   BLOCO C — Limpeza de clientes com nomes inválidos
--   BLOCO D — Limpeza de propostas duplicadas por nome de cliente
--   BLOCO E — Limpeza de propostas com códigos inválidos
--   BLOCO F — Verificação final
--
-- COMO USAR:
--   1. Fazer pg_dump completo do banco de produção
--   2. Revisar cada bloco de PREVIEW antes de executar
--   3. Executar BLOCO A (backup)
--   4. Executar BLOCOS B, C, D, E (um por vez)
--   5. Verificar resultados com BLOCO F
--   6. Em caso de dúvida, usar ROLLBACK ao invés de COMMIT
--
-- ============================================================================


-- ============================================================================
-- BLOCO A — BACKUP E AUDITORIA INICIAL
-- ============================================================================

-- A.1  Preview: Clientes duplicados por nome normalizado
SELECT
  'Preview: Clientes duplicados' AS descricao,
  COUNT(DISTINCT id) AS total_clientes_duplicados,
  COUNT(DISTINCT lower(regexp_replace(btrim(client_name), '\s+', ' ', 'g'))) AS grupos_nome_duplicado
FROM public.clients
WHERE deleted_at IS NULL
  AND merged_into_client_id IS NULL
  AND coalesce(client_name, '') ~* '[A-Za-zÀ-ÖØ-öø-ÿ]'
  AND lower(regexp_replace(btrim(client_name), '\s+', ' ', 'g')) IN (
    SELECT lower(regexp_replace(btrim(client_name), '\s+', ' ', 'g'))
    FROM public.clients
    WHERE deleted_at IS NULL
      AND merged_into_client_id IS NULL
      AND coalesce(client_name, '') ~* '[A-Za-zÀ-ÖØ-öø-ÿ]'
    GROUP BY lower(regexp_replace(btrim(client_name), '\s+', ' ', 'g'))
    HAVING COUNT(*) > 1
  );

-- A.2  Preview: Clientes com nomes inválidos
SELECT
  'Preview: Clientes com nomes inválidos' AS descricao,
  COUNT(*) AS total_clientes_invalidos
FROM public.clients
WHERE deleted_at IS NULL
  AND merged_into_client_id IS NULL
  AND (
    client_name IS NULL
    OR trim(client_name) = ''
    OR lower(trim(client_name)) IN ('0', 'null', 'undefined', '[object object]', '{}', '[]', 'nan', 'n/a', 'na', '-', '—', '__', '??')
    OR NOT (client_name ~* '[A-Za-zÀ-ÖØ-öø-ÿ]')
  );

-- A.3  Preview: Propostas duplicadas por nome de cliente
SELECT
  'Preview: Propostas duplicadas' AS descricao,
  COUNT(DISTINCT id) AS total_propostas_duplicadas,
  COUNT(DISTINCT lower(regexp_replace(btrim(client_name), '\s+', ' ', 'g'))) AS grupos_nome_duplicado
FROM public.proposals
WHERE deleted_at IS NULL
  AND coalesce(client_name, '') ~* '[A-Za-zÀ-ÖØ-öø-ÿ]'
  AND lower(regexp_replace(btrim(client_name), '\s+', ' ', 'g')) IN (
    SELECT lower(regexp_replace(btrim(client_name), '\s+', ' ', 'g'))
    FROM public.proposals
    WHERE deleted_at IS NULL
      AND coalesce(client_name, '') ~* '[A-Za-zÀ-ÖØ-öø-ÿ]'
    GROUP BY lower(regexp_replace(btrim(client_name), '\s+', ' ', 'g'))
    HAVING COUNT(*) > 1
  );

-- A.4  Preview: Propostas com códigos inválidos
SELECT
  'Preview: Propostas com códigos inválidos' AS descricao,
  COUNT(*) AS total_propostas_codigo_invalido
FROM public.proposals
WHERE deleted_at IS NULL
  AND (
    proposal_code IS NULL
    OR NOT (
      proposal_code ~ '^SLRINVST-VND-'
      OR proposal_code ~ '^SLRINVST-LSE-'
    )
  );

-- A.5  Criar tabelas de backup para auditoria
CREATE TABLE IF NOT EXISTS public._cleanup_audit_clientes_deletados (
  id                    BIGINT,
  client_name           TEXT,
  client_email          TEXT,
  client_phone          TEXT,
  client_document       TEXT,
  cpf_normalized        TEXT,
  cnpj_normalized       TEXT,
  motivo_delecao        TEXT,
  deleted_at_original   TIMESTAMPTZ,
  backed_up_at          TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public._cleanup_audit_propostas_deletadas (
  id                    UUID,
  proposal_type         TEXT,
  proposal_code         TEXT,
  client_name           TEXT,
  client_id             BIGINT,
  status                TEXT,
  motivo_delecao        TEXT,
  deleted_at_original   TIMESTAMPTZ,
  backed_up_at          TIMESTAMPTZ DEFAULT now()
);


-- ============================================================================
-- BLOCO B — LIMPEZA DE CLIENTES DUPLICADOS POR NOME
-- ============================================================================
--
-- Estratégia:
--   1. Identificar grupos de clientes com mesmo nome normalizado
--   2. Calcular score de "valor" para cada cliente baseado em:
--      - Estar em portfólio (+500)
--      - Ter contrato ativo/assinado/suspenso (+400)
--      - Ter perfil de cobrança ativo (+300)
--      - Ter proposta ativa (+200)
--      - Ter documento (CPF ou CNPJ) (+50)
--      - Ter email válido (+30)
--      - Ter telefone válido (+20)
--      - Não estar soft-deleted (+10)
--   3. Manter apenas o cliente com maior score
--   4. Migrar todas as FKs dependentes para o canônico
--   5. Deletar permanentemente os duplicados
--
-- ============================================================================

BEGIN;

-- B.1  Criar mapeamento de duplicados
CREATE TEMP TABLE _client_dedup_scores AS
WITH dup_names AS (
  -- Nomes normalizados que aparecem em mais de 1 cliente
  SELECT lower(regexp_replace(btrim(client_name), '\s+', ' ', 'g')) AS norm_name
  FROM public.clients
  WHERE deleted_at IS NULL
    AND merged_into_client_id IS NULL
    AND coalesce(client_name, '') ~* '[A-Za-zÀ-ÖØ-öø-ÿ]'
  GROUP BY 1
  HAVING COUNT(*) > 1
)
SELECT
  c.id AS client_id,
  lower(regexp_replace(btrim(c.client_name), '\s+', ' ', 'g')) AS norm_name,
  (
    CASE WHEN c.in_portfolio THEN 500 ELSE 0 END
    + CASE WHEN EXISTS(
        SELECT 1 FROM public.client_contracts cc
        WHERE cc.client_id = c.id
          AND cc.contract_status IN ('active','signed','suspended')
      ) THEN 400 ELSE 0 END
    + CASE WHEN EXISTS(
        SELECT 1 FROM public.client_billing_profile bp
        WHERE bp.client_id = c.id
          AND bp.payment_status NOT IN ('cancelled','written_off')
      ) THEN 300 ELSE 0 END
    + CASE WHEN EXISTS(
        SELECT 1 FROM public.proposals p
        WHERE p.client_id = c.id
          AND p.deleted_at IS NULL
          AND p.status NOT IN ('cancelled','rejected')
      ) THEN 200 ELSE 0 END
    + CASE WHEN c.cpf_normalized IS NOT NULL OR c.cnpj_normalized IS NOT NULL THEN 50 ELSE 0 END
    + CASE WHEN c.client_email IS NOT NULL AND position('@' IN c.client_email) > 0 THEN 30 ELSE 0 END
    + CASE WHEN length(regexp_replace(coalesce(c.client_phone, ''), '\D', '', 'g')) >= 10 THEN 20 ELSE 0 END
    + CASE WHEN c.deleted_at IS NULL THEN 10 ELSE 0 END
  ) AS strength_score,
  c.updated_at,
  c.created_at
FROM public.clients c
JOIN dup_names dn ON dn.norm_name = lower(regexp_replace(btrim(c.client_name), '\s+', ' ', 'g'))
WHERE c.deleted_at IS NULL
  AND c.merged_into_client_id IS NULL;

CREATE INDEX ON _client_dedup_scores (norm_name, strength_score DESC, updated_at DESC, created_at DESC, client_id ASC);

-- B.2  Criar mapa: canonical_id ↔ duplicate_id
CREATE TEMP TABLE _client_dedup_map AS
WITH ranked AS (
  SELECT
    client_id,
    norm_name,
    strength_score,
    updated_at,
    created_at,
    ROW_NUMBER() OVER (
      PARTITION BY norm_name
      ORDER BY strength_score DESC, updated_at DESC NULLS LAST, created_at DESC NULLS LAST, client_id ASC
    ) AS rn
  FROM _client_dedup_scores
)
SELECT
  canon.client_id AS canonical_id,
  dup.client_id   AS duplicate_id,
  dup.norm_name
FROM ranked dup
JOIN (SELECT norm_name, client_id FROM ranked WHERE rn = 1) canon
  ON canon.norm_name = dup.norm_name
WHERE dup.rn > 1;

CREATE INDEX ON _client_dedup_map (canonical_id);
CREATE INDEX ON _client_dedup_map (duplicate_id);

-- B.3  Backup dos clientes que serão deletados
INSERT INTO public._cleanup_audit_clientes_deletados
  (id, client_name, client_email, client_phone, client_document, cpf_normalized, cnpj_normalized, motivo_delecao, deleted_at_original)
SELECT
  c.id,
  c.client_name,
  c.client_email,
  c.client_phone,
  c.client_document,
  c.cpf_normalized,
  c.cnpj_normalized,
  'Nome duplicado - canônico: ' || dm.canonical_id AS motivo_delecao,
  c.deleted_at
FROM public.clients c
JOIN _client_dedup_map dm ON dm.duplicate_id = c.id;

-- B.4  Enriquecer o canônico com dados dos duplicados
WITH best AS (
  SELECT
    dm.canonical_id,
    (array_agg(d.client_document ORDER BY ds.strength_score DESC, d.updated_at DESC, d.id ASC)
      FILTER (WHERE d.client_document IS NOT NULL AND btrim(d.client_document) <> ''))[1] AS best_document,
    (array_agg(d.cpf_normalized ORDER BY ds.strength_score DESC, d.updated_at DESC, d.id ASC)
      FILTER (WHERE d.cpf_normalized IS NOT NULL))[1] AS best_cpf_normalized,
    (array_agg(d.cnpj_normalized ORDER BY ds.strength_score DESC, d.updated_at DESC, d.id ASC)
      FILTER (WHERE d.cnpj_normalized IS NOT NULL))[1] AS best_cnpj_normalized,
    (array_agg(d.client_email ORDER BY ds.strength_score DESC, d.updated_at DESC, d.id ASC)
      FILTER (WHERE d.client_email IS NOT NULL AND position('@' IN d.client_email) > 0))[1] AS best_email,
    (array_agg(d.client_phone ORDER BY ds.strength_score DESC, d.updated_at DESC, d.id ASC)
      FILTER (WHERE d.client_phone IS NOT NULL AND length(regexp_replace(d.client_phone,'\D','','g')) >= 10))[1] AS best_phone,
    (array_agg(d.client_city ORDER BY ds.strength_score DESC, d.updated_at DESC, d.id ASC)
      FILTER (WHERE d.client_city IS NOT NULL AND btrim(d.client_city) <> ''))[1] AS best_city,
    (array_agg(d.client_state ORDER BY ds.strength_score DESC, d.updated_at DESC, d.id ASC)
      FILTER (WHERE d.client_state IS NOT NULL AND btrim(d.client_state) <> ''))[1] AS best_state,
    bool_or(d.in_portfolio) AS any_in_portfolio
  FROM _client_dedup_map dm
  JOIN public.clients d ON d.id = dm.duplicate_id
  JOIN _client_dedup_scores ds ON ds.client_id = dm.duplicate_id
  GROUP BY dm.canonical_id
)
UPDATE public.clients c
SET
  client_document = COALESCE(c.client_document, best.best_document),
  cpf_normalized  = COALESCE(c.cpf_normalized,  best.best_cpf_normalized),
  cnpj_normalized = COALESCE(c.cnpj_normalized, best.best_cnpj_normalized),
  client_email    = COALESCE(c.client_email,    best.best_email),
  client_phone    = COALESCE(c.client_phone,    best.best_phone),
  client_city     = COALESCE(c.client_city,     best.best_city),
  client_state    = COALESCE(c.client_state,    best.best_state),
  in_portfolio    = c.in_portfolio OR best.any_in_portfolio,
  updated_at      = now()
FROM best
WHERE c.id = best.canonical_id;

-- B.5  Migrar FKs para o canônico
UPDATE public.proposals p
SET client_id = dm.canonical_id, updated_at = now()
FROM _client_dedup_map dm
WHERE p.client_id = dm.duplicate_id;

UPDATE public.client_contracts cc
SET client_id = dm.canonical_id, updated_at = now()
FROM _client_dedup_map dm
WHERE cc.client_id = dm.duplicate_id;

UPDATE public.client_notes cn
SET client_id = dm.canonical_id
FROM _client_dedup_map dm
WHERE cn.client_id = dm.duplicate_id;

-- B.6  HARD DELETE dos clientes duplicados
DELETE FROM public.clients
WHERE id IN (SELECT duplicate_id FROM _client_dedup_map);

-- B.7  Informar quantidade deletada
SELECT
  'BLOCO B Concluído' AS status,
  COUNT(*) AS clientes_deletados
FROM _client_dedup_map;

COMMIT;  -- ← Trocar por ROLLBACK para simular


-- ============================================================================
-- BLOCO C — LIMPEZA DE CLIENTES COM NOMES INVÁLIDOS
-- ============================================================================
--
-- Remove permanentemente clientes cujo nome é:
--   - NULL ou vazio
--   - Placeholder inválido: 0, null, undefined, [object object], {}, [], etc
--   - Sem caracteres alfabéticos válidos
--
-- Apenas deleta se o cliente:
--   - NÃO está em portfólio
--   - NÃO tem CPF ou CNPJ
--   - NÃO tem contrato ativo
--   - NÃO tem billing ativo
--   - NÃO tem proposta ativa
--
-- ============================================================================

BEGIN;

-- C.1  Backup dos clientes com nomes inválidos
INSERT INTO public._cleanup_audit_clientes_deletados
  (id, client_name, client_email, client_phone, client_document, cpf_normalized, cnpj_normalized, motivo_delecao, deleted_at_original)
SELECT
  c.id,
  c.client_name,
  c.client_email,
  c.client_phone,
  c.client_document,
  c.cpf_normalized,
  c.cnpj_normalized,
  'Nome inválido ou placeholder' AS motivo_delecao,
  c.deleted_at
FROM public.clients c
WHERE c.deleted_at IS NULL
  AND c.merged_into_client_id IS NULL
  AND (
    c.client_name IS NULL
    OR trim(c.client_name) = ''
    OR lower(trim(c.client_name)) IN ('0', 'null', 'undefined', '[object object]', '{}', '[]', 'nan', 'n/a', 'na', '-', '—', '__', '??')
    OR NOT (c.client_name ~* '[A-Za-zÀ-ÖØ-öø-ÿ]')
  )
  AND coalesce(c.in_portfolio, false) = false
  AND c.cpf_normalized IS NULL
  AND c.cnpj_normalized IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.client_contracts cc
    WHERE cc.client_id = c.id
      AND cc.contract_status IN ('active','signed','suspended')
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.client_billing_profile bp
    WHERE bp.client_id = c.id
      AND bp.payment_status NOT IN ('cancelled','written_off')
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.proposals p
    WHERE p.client_id = c.id
      AND p.deleted_at IS NULL
      AND p.status NOT IN ('cancelled','rejected')
  );

-- C.2  HARD DELETE dos clientes com nomes inválidos
DELETE FROM public.clients c
WHERE c.deleted_at IS NULL
  AND c.merged_into_client_id IS NULL
  AND (
    c.client_name IS NULL
    OR trim(c.client_name) = ''
    OR lower(trim(c.client_name)) IN ('0', 'null', 'undefined', '[object object]', '{}', '[]', 'nan', 'n/a', 'na', '-', '—', '__', '??')
    OR NOT (c.client_name ~* '[A-Za-zÀ-ÖØ-öø-ÿ]')
  )
  AND coalesce(c.in_portfolio, false) = false
  AND c.cpf_normalized IS NULL
  AND c.cnpj_normalized IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.client_contracts cc
    WHERE cc.client_id = c.id
      AND cc.contract_status IN ('active','signed','suspended')
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.client_billing_profile bp
    WHERE bp.client_id = c.id
      AND bp.payment_status NOT IN ('cancelled','written_off')
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.proposals p
    WHERE p.client_id = c.id
      AND p.deleted_at IS NULL
      AND p.status NOT IN ('cancelled','rejected')
  );

-- C.3  Informar quantidade deletada
SELECT
  'BLOCO C Concluído' AS status,
  COUNT(*) AS clientes_invalidos_deletados
FROM public._cleanup_audit_clientes_deletados
WHERE motivo_delecao = 'Nome inválido ou placeholder'
  AND backed_up_at >= now() - INTERVAL '1 minute';

COMMIT;  -- ← Trocar por ROLLBACK para simular


-- ============================================================================
-- BLOCO D — LIMPEZA DE PROPOSTAS DUPLICADAS POR NOME DE CLIENTE
-- ============================================================================
--
-- Estratégia:
--   1. Identificar grupos de propostas com mesmo nome de cliente normalizado
--   2. Calcular score de "valor" para cada proposta baseado em:
--      - Status: approved (+500), sent (+400), draft (+100), cancelled/rejected (+10)
--      - Tem proposal_code (+200)
--      - Tem capex_total (+100)
--      - Tem consumption_kwh_month (+50)
--      - Tem client_id (+30)
--      - Tem contract_value (+20)
--   3. Manter apenas a proposta com maior score por nome
--   4. Deletar permanentemente as demais
--
-- ============================================================================

BEGIN;

-- D.1  Criar mapeamento de propostas duplicadas
CREATE TEMP TABLE _proposal_dedup_map AS
WITH dup_names AS (
  -- Nomes normalizados com mais de 1 proposta
  SELECT lower(regexp_replace(btrim(client_name), '\s+', ' ', 'g')) AS norm_name
  FROM public.proposals
  WHERE deleted_at IS NULL
    AND coalesce(client_name, '') ~* '[A-Za-zÀ-ÖØ-öø-ÿ]'
  GROUP BY 1
  HAVING COUNT(*) > 1
),
scored AS (
  SELECT
    p.id AS proposal_id,
    lower(regexp_replace(btrim(p.client_name), '\s+', ' ', 'g')) AS norm_name,
    (
      CASE p.status
        WHEN 'approved'   THEN 500
        WHEN 'sent'       THEN 400
        WHEN 'draft'      THEN 100
        WHEN 'cancelled'  THEN  10
        WHEN 'rejected'   THEN  10
        ELSE 50
      END
      + CASE WHEN p.proposal_code IS NOT NULL AND btrim(p.proposal_code) <> '' THEN 200 ELSE 0 END
      + CASE WHEN p.capex_total IS NOT NULL AND p.capex_total > 0 THEN 100 ELSE 0 END
      + CASE WHEN p.consumption_kwh_month IS NOT NULL AND p.consumption_kwh_month > 0 THEN 50 ELSE 0 END
      + CASE WHEN p.client_id IS NOT NULL THEN 30 ELSE 0 END
      + CASE WHEN p.contract_value IS NOT NULL AND p.contract_value > 0 THEN 20 ELSE 0 END
    ) AS score,
    p.updated_at,
    p.created_at
  FROM public.proposals p
  JOIN dup_names dn ON dn.norm_name = lower(regexp_replace(btrim(p.client_name), '\s+', ' ', 'g'))
  WHERE p.deleted_at IS NULL
),
ranked AS (
  SELECT
    proposal_id,
    norm_name,
    score,
    ROW_NUMBER() OVER (
      PARTITION BY norm_name
      ORDER BY score DESC, updated_at DESC NULLS LAST, created_at DESC NULLS LAST, proposal_id ASC
    ) AS rn
  FROM scored
)
SELECT
  canon.proposal_id AS canonical_id,
  dup.proposal_id   AS duplicate_id,
  dup.norm_name
FROM ranked dup
JOIN (SELECT norm_name, proposal_id FROM ranked WHERE rn = 1) canon
  ON canon.norm_name = dup.norm_name
WHERE dup.rn > 1;

CREATE INDEX ON _proposal_dedup_map (canonical_id);
CREATE INDEX ON _proposal_dedup_map (duplicate_id);

-- D.2  Backup das propostas que serão deletadas
INSERT INTO public._cleanup_audit_propostas_deletadas
  (id, proposal_type, proposal_code, client_name, client_id, status, motivo_delecao, deleted_at_original)
SELECT
  p.id,
  p.proposal_type,
  p.proposal_code,
  p.client_name,
  p.client_id,
  p.status,
  'Nome de cliente duplicado - canônica: ' || dm.canonical_id AS motivo_delecao,
  p.deleted_at
FROM public.proposals p
JOIN _proposal_dedup_map dm ON dm.duplicate_id = p.id;

-- D.3  HARD DELETE das propostas duplicadas
DELETE FROM public.proposals
WHERE id IN (SELECT duplicate_id FROM _proposal_dedup_map);

-- D.4  Informar quantidade deletada
SELECT
  'BLOCO D Concluído' AS status,
  COUNT(*) AS propostas_duplicadas_deletadas
FROM _proposal_dedup_map;

COMMIT;  -- ← Trocar por ROLLBACK para simular


-- ============================================================================
-- BLOCO E — LIMPEZA DE PROPOSTAS COM CÓDIGOS INVÁLIDOS
-- ============================================================================
--
-- Remove permanentemente propostas cujo proposal_code é:
--   - NULL ou vazio
--   - Não começa com os prefixos válidos: SLRINVST-VND ou SLRINVST-LSE
--
-- Exemplos de códigos VÁLIDOS:
--   - SLRINVST-VND-12345678
--   - SLRINVST-LSE-87654321
--
-- Exemplos de códigos INVÁLIDOS (serão deletados):
--   - NULL
--   - SLRINVST-ABCDEF (formato legado sem tipo)
--   - adc26123-7313-49bc-b426-4944d44df136 (UUID)
--   - Qualquer outro formato
--
-- ============================================================================

BEGIN;

-- E.1  Backup das propostas com códigos inválidos
INSERT INTO public._cleanup_audit_propostas_deletadas
  (id, proposal_type, proposal_code, client_name, client_id, status, motivo_delecao, deleted_at_original)
SELECT
  p.id,
  p.proposal_type,
  p.proposal_code,
  p.client_name,
  p.client_id,
  p.status,
  'Código de proposta inválido' AS motivo_delecao,
  p.deleted_at
FROM public.proposals p
WHERE p.deleted_at IS NULL
  AND (
    p.proposal_code IS NULL
    OR NOT (
      p.proposal_code ~ '^SLRINVST-VND-'
      OR p.proposal_code ~ '^SLRINVST-LSE-'
    )
  );

-- E.2  HARD DELETE das propostas com códigos inválidos
DELETE FROM public.proposals p
WHERE p.deleted_at IS NULL
  AND (
    p.proposal_code IS NULL
    OR NOT (
      p.proposal_code ~ '^SLRINVST-VND-'
      OR p.proposal_code ~ '^SLRINVST-LSE-'
    )
  );

-- E.3  Informar quantidade deletada
SELECT
  'BLOCO E Concluído' AS status,
  COUNT(*) AS propostas_codigo_invalido_deletadas
FROM public._cleanup_audit_propostas_deletadas
WHERE motivo_delecao = 'Código de proposta inválido'
  AND backed_up_at >= now() - INTERVAL '1 minute';

COMMIT;  -- ← Trocar por ROLLBACK para simular


-- ============================================================================
-- BLOCO F — VERIFICAÇÃO FINAL
-- ============================================================================

-- F.1  Resumo geral da limpeza
SELECT
  'Resumo da Limpeza' AS descricao,
  (SELECT COUNT(*) FROM public._cleanup_audit_clientes_deletados) AS total_clientes_deletados,
  (SELECT COUNT(*) FROM public._cleanup_audit_propostas_deletadas) AS total_propostas_deletadas;

-- F.2  Detalhamento por motivo de deleção - Clientes
SELECT
  motivo_delecao,
  COUNT(*) AS quantidade
FROM public._cleanup_audit_clientes_deletados
GROUP BY motivo_delecao
ORDER BY quantidade DESC;

-- F.3  Detalhamento por motivo de deleção - Propostas
SELECT
  motivo_delecao,
  COUNT(*) AS quantidade
FROM public._cleanup_audit_propostas_deletadas
GROUP BY motivo_delecao
ORDER BY quantidade DESC;

-- F.4  Verificar se ainda existem clientes duplicados
SELECT
  'Verificação: Clientes duplicados remanescentes' AS descricao,
  COUNT(*) AS grupos_duplicados
FROM (
  SELECT lower(regexp_replace(btrim(client_name), '\s+', ' ', 'g')) AS norm_name
  FROM public.clients
  WHERE deleted_at IS NULL
    AND merged_into_client_id IS NULL
    AND coalesce(client_name, '') ~* '[A-Za-zÀ-ÖØ-öø-ÿ]'
  GROUP BY 1
  HAVING COUNT(*) > 1
) t;

-- F.5  Verificar se ainda existem clientes com nomes inválidos
SELECT
  'Verificação: Clientes com nomes inválidos remanescentes' AS descricao,
  COUNT(*) AS clientes_invalidos
FROM public.clients
WHERE deleted_at IS NULL
  AND merged_into_client_id IS NULL
  AND (
    client_name IS NULL
    OR trim(client_name) = ''
    OR lower(trim(client_name)) IN ('0', 'null', 'undefined', '[object object]', '{}', '[]', 'nan', 'n/a', 'na', '-', '—', '__', '??')
    OR NOT (client_name ~* '[A-Za-zÀ-ÖØ-öø-ÿ]')
  );

-- F.6  Verificar se ainda existem propostas duplicadas
SELECT
  'Verificação: Propostas duplicadas remanescentes' AS descricao,
  COUNT(*) AS grupos_duplicados
FROM (
  SELECT lower(regexp_replace(btrim(client_name), '\s+', ' ', 'g')) AS norm_name
  FROM public.proposals
  WHERE deleted_at IS NULL
    AND coalesce(client_name, '') ~* '[A-Za-zÀ-ÖØ-öø-ÿ]'
  GROUP BY 1
  HAVING COUNT(*) > 1
) t;

-- F.7  Verificar se ainda existem propostas com códigos inválidos
SELECT
  'Verificação: Propostas com códigos inválidos remanescentes' AS descricao,
  COUNT(*) AS propostas_codigo_invalido
FROM public.proposals
WHERE deleted_at IS NULL
  AND (
    proposal_code IS NULL
    OR NOT (
      proposal_code ~ '^SLRINVST-VND-'
      OR proposal_code ~ '^SLRINVST-LSE-'
    )
  );

-- F.8  Estatísticas finais do banco
SELECT
  'Estatísticas Finais - Clientes' AS tabela,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE deleted_at IS NULL AND merged_into_client_id IS NULL) AS ativos,
  COUNT(*) FILTER (WHERE deleted_at IS NOT NULL) AS soft_deleted,
  COUNT(*) FILTER (WHERE merged_into_client_id IS NOT NULL) AS merged
FROM public.clients
UNION ALL
SELECT
  'Estatísticas Finais - Propostas' AS tabela,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE deleted_at IS NULL) AS ativos,
  COUNT(*) FILTER (WHERE deleted_at IS NOT NULL) AS soft_deleted,
  NULL AS merged
FROM public.proposals;


-- ============================================================================
-- FIM DO SCRIPT DE LIMPEZA
-- ============================================================================
--
-- INSTRUÇÕES PÓS-EXECUÇÃO:
--   1. Revisar todas as queries de verificação (F.4 a F.7)
--   2. Confirmar que os valores remanescentes são 0 ou aceitáveis
--   3. Se necessário, investigar casos específicos nas tabelas de backup:
--      - public._cleanup_audit_clientes_deletados
--      - public._cleanup_audit_propostas_deletadas
--   4. Após confirmação, as tabelas de backup podem ser mantidas para auditoria
--      ou deletadas se não forem mais necessárias
--
-- ============================================================================
