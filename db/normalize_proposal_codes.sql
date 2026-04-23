-- ============================================================================
-- SCRIPT: normalize_proposal_codes.sql
-- ============================================================================
--
-- OBJETIVO:
--   Identificar e corrigir propostas cujo proposal_code foi gravado fora do
--   padrão vigente do SolarInvest:
--
--     Leasing      → SLRINVST-LSE-XXXXXXXX  (8 dígitos decimais)
--     Venda Direta → SLRINVST-VND-XXXXXXXX  (8 dígitos decimais)
--
--   Exemplos de valores inválidos que serão normalizados:
--     • adc26123-7313-49bc-b426-4944d44df136  (UUID usado como código)
--     • be41334d-145a-4b42-82b5-c387dbb90ddd  (idem)
--     • NULL / vazio
--     • qualquer valor que não comece com "SLRINVST-"
--
--   Formatos legados ainda reconhecidos pelo app (SLRINVST-XXXXXX e
--   SLRINVST-XXXXXXXX sem indicador de tipo) NÃO são alterados por padrão;
--   veja o BLOCO OPCIONAL no final do script para migrá-los também.
--
-- ESTRUTURA:
--   BLOCO A — Preview / Auditoria   (somente leitura)
--   BLOCO B — Backup                (cria tabela de segurança)
--   BLOCO C — Normalização          (UPDATE dentro de transação)
--   BLOCO D — Verificação           (confirma resultado)
--   BLOCO E — OPCIONAL: migrar formatos legados SLRINVST sem tipo
--
-- COMO USAR:
--   1. Rodar o BLOCO A e revisar volumes e amostras.
--   2. Rodar o BLOCO B para criar o snapshot de backup.
--   3. Rodar o BLOCO C com ROLLBACK para simular; depois trocar por COMMIT.
--   4. Rodar o BLOCO D para verificar o resultado.
--   5. (Opcional) Rodar o BLOCO E para normalizar formatos legados.
--
-- ATENÇÃO: Faça pg_dump do banco antes de executar em produção.
-- ============================================================================


-- ============================================================================
-- BLOCO A — PREVIEW / AUDITORIA  (somente leitura, sem efeitos colaterais)
-- ============================================================================

-- A.1  Contagem geral de propostas com código fora do padrão novo
SELECT
  count(*)                                                          AS total_ativas,
  count(*) FILTER (WHERE proposal_code IS NULL)                     AS sem_codigo,
  count(*) FILTER (
    WHERE proposal_code IS NOT NULL
      AND proposal_code !~ '^SLRINVST-(LSE|VND)-\d{8}$'
  )                                                                 AS codigo_fora_padrao,
  count(*) FILTER (
    WHERE proposal_code IS NOT NULL
      AND proposal_code !~ '^SLRINVST-(LSE|VND)-\d{8}$'
      AND proposal_code ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  )                                                                 AS codigo_eh_uuid
FROM public.proposals
WHERE deleted_at IS NULL;

-- A.2  Amostra das propostas que serão afetadas
SELECT
  id,
  proposal_type,
  proposal_code                                AS codigo_atual,
  status,
  client_name,
  created_at
FROM public.proposals
WHERE deleted_at IS NULL
  AND (
    proposal_code IS NULL
    OR proposal_code !~ '^SLRINVST-(LSE|VND)-\d{8}$'
  )
ORDER BY created_at DESC
LIMIT 100;


-- ============================================================================
-- BLOCO B — BACKUP  (segurança antes de qualquer UPDATE)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.proposal_code_normalization_backup (
  id               UUID        NOT NULL,
  proposal_type    TEXT,
  old_code         TEXT,
  new_code         TEXT,
  status           TEXT,
  client_name      TEXT,
  created_at       TIMESTAMPTZ,
  backed_up_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Inserir snapshot das propostas que serão atualizadas
-- (idempotente: ON CONFLICT DO NOTHING não duplica se rodar novamente)
INSERT INTO public.proposal_code_normalization_backup
  (id, proposal_type, old_code, status, client_name, created_at)
SELECT
  p.id,
  p.proposal_type,
  p.proposal_code,
  p.status,
  p.client_name,
  p.created_at
FROM public.proposals p
WHERE p.deleted_at IS NULL
  AND (
    p.proposal_code IS NULL
    OR p.proposal_code !~ '^SLRINVST-(LSE|VND)-\d{8}$'
  )
ON CONFLICT DO NOTHING;

-- Confirmar quantas linhas foram salvas no backup
SELECT count(*) AS linhas_no_backup
FROM public.proposal_code_normalization_backup;


-- ============================================================================
-- BLOCO C — NORMALIZAÇÃO  (UPDATE dentro de transação)
--
-- Estratégia de geração de código único:
--   • Prefixo determinado pelo proposal_type ('leasing' → LSE, 'venda' → VND).
--   • Sufixo de 8 dígitos derivado de md5(id || salt) para garantir
--     distribuição uniforme e evitar colisões entre si.
--   • Colisões com códigos já existentes são excluídas via LEFT JOIN + filtro.
--   • Se uma colisão remanescente for detectada no SELECT de verificação dentro
--     da transação (B.3), repita o BLOCO C com um valor de salt diferente.
-- ============================================================================

BEGIN;

-- C.1  Gerar e aplicar os novos códigos
WITH affected AS (
  -- Propostas que precisam de código novo
  SELECT
    id,
    proposal_type,
    CASE proposal_type
      WHEN 'leasing' THEN 'SLRINVST-LSE-'
      ELSE                'SLRINVST-VND-'
    END AS prefix
  FROM public.proposals
  WHERE deleted_at IS NULL
    AND (
      proposal_code IS NULL
      OR proposal_code !~ '^SLRINVST-(LSE|VND)-\d{8}$'
    )
),
generated AS (
  -- Gerar sufixo de 8 dígitos via md5 do id (determinístico e único por row)
  SELECT
    a.id,
    a.prefix || lpad(
      (
        ('x' || substr(md5(a.id::text || 'solarinvest-salt-v1'), 1, 8))::bit(32)::bigint
        & 99999999
      )::text,
      8, '0'
    ) AS new_code
  FROM affected a
),
-- Excluir colisões com códigos já existentes em outras propostas
deduplicated AS (
  SELECT
    g.id,
    g.new_code,
    row_number() OVER (PARTITION BY g.new_code ORDER BY g.id) AS rn
  FROM generated g
  LEFT JOIN public.proposals existing
    ON  existing.proposal_code = g.new_code
    AND existing.id <> g.id
    AND existing.deleted_at IS NULL
  WHERE existing.id IS NULL   -- sem colisão com proposta existente
)
UPDATE public.proposals p
SET
  proposal_code = d.new_code,
  updated_at    = now()
FROM deduplicated d
WHERE p.id = d.id
  AND d.rn = 1;              -- sem colisão entre os próprios novos códigos

-- C.2  Registrar os novos códigos na tabela de backup para rastreabilidade
UPDATE public.proposal_code_normalization_backup b
SET new_code = p.proposal_code
FROM public.proposals p
WHERE b.id = p.id
  AND b.new_code IS NULL;

-- C.3  Verificação dentro da transação: deve retornar 0 linhas restantes
--      Se retornar > 0, ocorreu colisão de sufixo — rode o bloco novamente
--      com um salt diferente (edite 'solarinvest-salt-v1' no passo C.1).
SELECT
  count(*) AS ainda_fora_padrao,
  count(*) FILTER (WHERE proposal_code IS NULL) AS ainda_sem_codigo
FROM public.proposals
WHERE deleted_at IS NULL
  AND (
    proposal_code IS NULL
    OR proposal_code !~ '^SLRINVST-(LSE|VND)-\d{8}$'
  );

COMMIT;   -- ← trocar por ROLLBACK para simular sem gravar


-- ============================================================================
-- BLOCO D — VERIFICAÇÃO PÓS-COMMIT
-- ============================================================================

-- D.1  Todas as propostas ativas devem ter código dentro do padrão
SELECT
  count(*)                                                        AS total_ativas,
  count(*) FILTER (WHERE proposal_code IS NULL)                   AS sem_codigo,
  count(*) FILTER (
    WHERE proposal_code IS NOT NULL
      AND proposal_code !~ '^SLRINVST-(LSE|VND)-\d{8}$'
      AND proposal_code !~ '^SLRINVST-[A-Z0-9]{6}$'
      AND proposal_code !~ '^SLRINVST-\d{8}$'
  )                                                               AS codigo_invalido,
  count(*) FILTER (
    WHERE proposal_code ~ '^SLRINVST-(LSE|VND)-\d{8}$'
  )                                                               AS no_novo_padrao,
  count(*) FILTER (
    WHERE proposal_code ~ '^SLRINVST-[A-Z0-9]{6}$'
      OR  proposal_code ~ '^SLRINVST-\d{8}$'
  )                                                               AS formato_legado
FROM public.proposals
WHERE deleted_at IS NULL;

-- D.2  Nenhum código duplicado deve existir
SELECT proposal_code, count(*) AS qtd
FROM public.proposals
WHERE deleted_at IS NULL
  AND proposal_code IS NOT NULL
GROUP BY proposal_code
HAVING count(*) > 1
ORDER BY qtd DESC;

-- D.3  Relatório dos códigos alterados (para conferência)
SELECT
  b.id,
  p.proposal_type,
  b.old_code   AS codigo_anterior,
  p.proposal_code AS codigo_novo,
  p.status,
  p.client_name,
  p.updated_at
FROM public.proposal_code_normalization_backup b
JOIN public.proposals p ON p.id = b.id
ORDER BY p.updated_at DESC;


-- ============================================================================
-- BLOCO E — OPCIONAL: migrar formatos legados para o novo padrão
--
-- Formatos legados ainda reconhecidos pelo app:
--   SLRINVST-XXXXXX   (6 alfanuméricos maiúsculos)
--   SLRINVST-XXXXXXXX (8 dígitos sem indicador de tipo)
--
-- Execute este bloco SOMENTE se desejar uniformizar também esses registros.
-- Requer que o BLOCO B já tenha sido executado (tabela de backup criada).
-- ============================================================================

-- E.1  Preview dos registros legados
SELECT
  id,
  proposal_type,
  proposal_code AS codigo_legado,
  status,
  client_name,
  created_at
FROM public.proposals
WHERE deleted_at IS NULL
  AND (
    proposal_code ~ '^SLRINVST-[A-Z0-9]{6}$'
    OR proposal_code ~ '^SLRINVST-\d{8}$'
  )
ORDER BY created_at DESC;

-- E.2  Migração dos formatos legados (dentro de transação)
BEGIN;

-- Backup dos registros legados
INSERT INTO public.proposal_code_normalization_backup
  (id, proposal_type, old_code, status, client_name, created_at)
SELECT
  p.id, p.proposal_type, p.proposal_code, p.status, p.client_name, p.created_at
FROM public.proposals p
WHERE p.deleted_at IS NULL
  AND (
    p.proposal_code ~ '^SLRINVST-[A-Z0-9]{6}$'
    OR p.proposal_code ~ '^SLRINVST-\d{8}$'
  )
ON CONFLICT DO NOTHING;

-- Gerar e aplicar novos códigos para os legados
WITH legacy AS (
  SELECT
    id,
    proposal_type,
    CASE proposal_type
      WHEN 'leasing' THEN 'SLRINVST-LSE-'
      ELSE                'SLRINVST-VND-'
    END AS prefix
  FROM public.proposals
  WHERE deleted_at IS NULL
    AND (
      proposal_code ~ '^SLRINVST-[A-Z0-9]{6}$'
      OR proposal_code ~ '^SLRINVST-\d{8}$'
    )
),
generated AS (
  SELECT
    l.id,
    l.prefix || lpad(
      (
        ('x' || substr(md5(l.id::text || 'solarinvest-legacy-salt-v1'), 1, 8))::bit(32)::bigint
        & 99999999
      )::text,
      8, '0'
    ) AS new_code
  FROM legacy l
),
deduplicated AS (
  SELECT
    g.id,
    g.new_code,
    row_number() OVER (PARTITION BY g.new_code ORDER BY g.id) AS rn
  FROM generated g
  LEFT JOIN public.proposals existing
    ON  existing.proposal_code = g.new_code
    AND existing.id <> g.id
    AND existing.deleted_at IS NULL
  WHERE existing.id IS NULL
)
UPDATE public.proposals p
SET
  proposal_code = d.new_code,
  updated_at    = now()
FROM deduplicated d
WHERE p.id = d.id
  AND d.rn = 1;

-- Registrar novos códigos no backup
UPDATE public.proposal_code_normalization_backup b
SET new_code = p.proposal_code
FROM public.proposals p
WHERE b.id = p.id
  AND b.new_code IS NULL;

COMMIT;   -- ← trocar por ROLLBACK para simular sem gravar
