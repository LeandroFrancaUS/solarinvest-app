-- ============================================================================================================================
-- SOLARINVEST — DEDUPLICAÇÃO DE CLIENTES POR NOME NORMALIZADO + REMOÇÃO DE NOMES INVÁLIDOS
-- ============================================================================================================================
--
-- OBJETIVO:
--   1. Identificar e remover clientes com nome inválido (NULL, vazio, só números, só símbolos).
--   2. Identificar grupos de clientes com nome duplicado (por normalização de texto).
--   3. Eleger 1 registro canônico por grupo.
--   4. Consolidar dados úteis dos duplicados no canônico.
--   5. Migrar todos os vínculos (FK) para o canônico.
--   6. Soft-deletar os registros excedentes.
--   7. Hard-deletar clientes com nome inválido sem vínculos relevantes.
--
-- ESCOPO:
--   public.clients                — fonte de identidade (alvo principal)
--   public.proposals              — propostas comerciais (client_id, multi-row)
--   public.client_contracts       — contratos operacionais (client_id, multi-row)
--   public.client_billing_profile — perfil de cobrança (client_id, UNIQUE)
--   public.client_usina_config    — configuração da UFV (client_id, UNIQUE)
--   public.client_lifecycle       — ciclo de vida do cliente (client_id, UNIQUE)
--   public.client_project_status  — status do projeto (client_id, UNIQUE)
--   public.client_energy_profile  — perfil de energia (client_id, UNIQUE)
--   public.client_notes           — notas internas (client_id, multi-row)
--   public.contacts               — contatos CRM (client_id, multi-row)
--   public.deals                  — negócios CRM (client_id, multi-row)
--   public.activities             — atividades CRM (client_id, multi-row)
--   public.notes                  — notas CRM genéricas (client_id, multi-row)
--
-- ESTRUTURA DO SCRIPT:
--   A) PREVIEW / AUDITORIA        — inspecionar antes de qualquer alteração
--   B) BACKUP / SEGURANÇA         — criar backups no schema data_hygiene
--   C) MAPEAMENTO DE DUPLICADOS   — tabela temporária com mapa canônico
--   D) CONSOLIDAÇÃO DO CANÔNICO   — preencher campos vazios do canônico com dados dos duplicados
--   E) MIGRAÇÃO DE VÍNCULOS       — redirecionar FK em todas as tabelas dependentes
--   F) REMOÇÃO DOS DUPLICADOS     — soft-delete dos registros excedentes
--   G) REMOÇÃO DOS INVÁLIDOS      — hard-delete de clientes com nome inválido sem vínculos úteis
--   H) VERIFICAÇÃO FINAL          — conferir estado do banco após a operação
--
-- COMO USAR:
--   1. Fazer pg_dump do banco ANTES de rodar este script em produção.
--   2. Rodar o BLOCO A e revisar os resultados com cuidado.
--   3. Rodar o BLOCO B para criar os backups.
--   4. Rodar os BLOCOS C–G (BEGIN/COMMIT) na mesma sessão de banco.
--      - Para simular sem commitar: substituir COMMIT por ROLLBACK ao final.
--   5. Rodar o BLOCO H para validar o resultado.
--
-- NORMALIZAÇÃO DE NOME (sem dependência de unaccent):
--   lower(regexp_replace(btrim(client_name), '\s+', ' ', 'g'))
--
-- NOME INVÁLIDO = não contém nenhuma letra do alfabeto latino/português:
--   NOT (coalesce(client_name, '') ~* '[A-Za-zÀ-ÖØ-öø-ÿ]')
--
-- CRITÉRIO DE CANÔNICO (por grupo de nome normalizado):
--   1. in_portfolio = true
--   2. tem contrato ativo/assinado/suspenso
--   3. tem billing ativo (não cancelado/baixado)
--   4. tem proposta vinculada ativa
--   5. tem documento válido
--   6. tem e-mail válido
--   7. tem telefone válido
--   8. updated_at mais recente
--   9. created_at mais recente
--  10. maior id (desempate final)
--
-- ATENÇÃO:
--   • Clientes com nome inválido E vínculos ativos (contrato/billing/portfólio) NÃO serão
--     deletados automaticamente — aparecem no BLOCO H para revisão manual.
--   • O script pressupõe que o BLOCO B do sanitize_production_data.sql já foi rodado,
--     mas cria o schema data_hygiene de forma idempotente caso não exista.
--   • Tabelas com restrição UNIQUE (client_id): os dados são MESCLADOS antes do delete.
--   • Tabelas multi-row: apenas o client_id é redirigido para o canônico.
-- ============================================================================================================================


-- ============================================================================================================================
-- A) BLOCO DE PREVIEW / AUDITORIA
-- ============================================================================================================================
-- Rodar estas queries ANTES de qualquer alteração.
-- Inspecionar volumes e amostras antes de prosseguir para o BLOCO B.
-- ============================================================================================================================


-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
-- A1) Clientes com nome inválido (ativos, não soft-deleted)
--     Inválido = NULL | vazio | sem nenhuma letra do alfabeto latino/português
--     Exemplos removidos: NULL, '', '0', '12345', '@@@', '---', '()', '___'
--     Exemplos preservados: 'José', 'Ana 2', 'Cláudio Marcelo'
-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

-- Contagem:
SELECT
  'A1 - clientes com nome inválido (ativos)' AS check_name,
  COUNT(*)                                   AS total
FROM public.clients
WHERE deleted_at IS NULL
  AND NOT (coalesce(client_name, '') ~* '[A-Za-zÀ-ÖØ-öø-ÿ]');

-- Detalhe por categoria de invalidade:
SELECT
  CASE
    WHEN client_name IS NULL                                         THEN 'NULL'
    WHEN btrim(client_name) = ''                                     THEN 'vazio'
    WHEN client_name ~ '^[0-9\s]+$'                                 THEN 'só números'
    WHEN NOT (client_name ~* '[A-Za-zÀ-ÖØ-öø-ÿ]')                  THEN 'sem letras (símbolos/pontuação)'
    ELSE 'outro inválido'
  END AS categoria,
  COUNT(*) AS total
FROM public.clients
WHERE deleted_at IS NULL
  AND NOT (coalesce(client_name, '') ~* '[A-Za-zÀ-ÖØ-öø-ÿ]')
GROUP BY 1
ORDER BY 2 DESC;

-- Amostra (até 50 linhas):
SELECT
  id,
  client_name,
  client_document,
  client_email,
  client_phone,
  cpf_normalized,
  cnpj_normalized,
  in_portfolio,
  identity_status,
  created_at,
  -- Vínculos que impedem remoção automática:
  EXISTS(SELECT 1 FROM public.client_contracts cc   WHERE cc.client_id = c.id AND cc.contract_status IN ('active','signed','suspended')) AS tem_contrato_ativo,
  EXISTS(SELECT 1 FROM public.client_billing_profile bp WHERE bp.client_id = c.id AND bp.payment_status NOT IN ('cancelled','written_off')) AS tem_billing_ativo,
  EXISTS(SELECT 1 FROM public.proposals p           WHERE p.client_id = c.id AND p.deleted_at IS NULL AND p.status NOT IN ('cancelled','rejected')) AS tem_proposta_ativa
FROM public.clients c
WHERE deleted_at IS NULL
  AND NOT (coalesce(client_name, '') ~* '[A-Za-zÀ-ÖØ-öø-ÿ]')
ORDER BY created_at DESC
LIMIT 50;


-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
-- A2) Grupos de clientes com nome duplicado (por nome normalizado)
--     Normalização: lower + trim + colapso de espaços
--     Apenas clientes ativos (deleted_at IS NULL, merged_into_client_id IS NULL)
--     com nome válido (contém pelo menos uma letra)
-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

-- Resumo:
SELECT
  'A2 - grupos de nomes duplicados (nome normalizado)' AS check_name,
  COUNT(DISTINCT normalized_name)                      AS grupos_duplicados,
  SUM(cnt - 1)                                         AS linhas_excedentes,
  SUM(cnt)                                             AS total_clientes_afetados
FROM (
  SELECT
    lower(regexp_replace(btrim(client_name), '\s+', ' ', 'g')) AS normalized_name,
    COUNT(*) AS cnt
  FROM public.clients
  WHERE deleted_at IS NULL
    AND merged_into_client_id IS NULL
    AND coalesce(client_name, '') ~* '[A-Za-zÀ-ÖØ-öø-ÿ]'
  GROUP BY 1
  HAVING COUNT(*) > 1
) t;

-- Detalhe dos grupos (até 50 grupos), com ids e flags de portfólio:
SELECT
  lower(regexp_replace(btrim(client_name), '\s+', ' ', 'g')) AS normalized_name,
  COUNT(*)                                                    AS copies,
  array_agg(id              ORDER BY in_portfolio DESC, updated_at DESC NULLS LAST, id DESC) AS ids,
  array_agg(client_name     ORDER BY in_portfolio DESC, updated_at DESC NULLS LAST, id DESC) AS nomes_originais,
  array_agg(in_portfolio    ORDER BY in_portfolio DESC, updated_at DESC NULLS LAST, id DESC) AS em_carteira,
  array_agg(identity_status ORDER BY in_portfolio DESC, updated_at DESC NULLS LAST, id DESC) AS statuses,
  array_agg(updated_at      ORDER BY in_portfolio DESC, updated_at DESC NULLS LAST, id DESC) AS updated_ats,
  bool_or(in_portfolio)                                       AS algum_em_carteira
FROM public.clients
WHERE deleted_at IS NULL
  AND merged_into_client_id IS NULL
  AND coalesce(client_name, '') ~* '[A-Za-zÀ-ÖØ-öø-ÿ]'
GROUP BY 1
HAVING COUNT(*) > 1
ORDER BY copies DESC, algum_em_carteira DESC
LIMIT 50;


-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
-- A3) Contagem de vínculos por cliente duplicado
--     Ajuda a confirmar qual registro tem mais dados relevantes
-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

WITH dup_ids AS (
  SELECT id
  FROM public.clients
  WHERE deleted_at IS NULL
    AND merged_into_client_id IS NULL
    AND coalesce(client_name, '') ~* '[A-Za-zÀ-ÖØ-öø-ÿ]'
    AND lower(regexp_replace(btrim(client_name), '\s+', ' ', 'g')) IN (
      SELECT lower(regexp_replace(btrim(client_name), '\s+', ' ', 'g'))
      FROM public.clients
      WHERE deleted_at IS NULL AND merged_into_client_id IS NULL
        AND coalesce(client_name, '') ~* '[A-Za-zÀ-ÖØ-öø-ÿ]'
      GROUP BY 1 HAVING COUNT(*) > 1
    )
)
SELECT
  c.id,
  c.client_name,
  lower(regexp_replace(btrim(c.client_name), '\s+', ' ', 'g')) AS normalized_name,
  c.in_portfolio,
  c.identity_status,
  c.client_document,
  c.client_email,
  c.client_phone,
  (SELECT COUNT(*) FROM public.proposals          WHERE client_id = c.id AND deleted_at IS NULL) AS proposals_count,
  (SELECT COUNT(*) FROM public.client_contracts   WHERE client_id = c.id)                        AS contracts_count,
  (SELECT COUNT(*) FROM public.client_billing_profile WHERE client_id = c.id)                   AS billing_count,
  (SELECT COUNT(*) FROM public.client_usina_config    WHERE client_id = c.id)                   AS usina_count,
  (SELECT COUNT(*) FROM public.client_lifecycle       WHERE client_id = c.id)                   AS lifecycle_count,
  (SELECT COUNT(*) FROM public.client_notes           WHERE client_id = c.id)                   AS client_notes_count,
  (SELECT COUNT(*) FROM public.contacts               WHERE client_id = c.id)                   AS contacts_count,
  (SELECT COUNT(*) FROM public.deals                  WHERE client_id = c.id)                   AS deals_count
FROM public.clients c
JOIN dup_ids d ON d.id = c.id
ORDER BY lower(regexp_replace(btrim(c.client_name), '\s+', ' ', 'g')), c.in_portfolio DESC, c.updated_at DESC NULLS LAST
LIMIT 200;


-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
-- A4) Total estimado de registros afetados nas tabelas dependentes
-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

WITH invalid_ids AS (
  SELECT id FROM public.clients
  WHERE deleted_at IS NULL
    AND NOT (coalesce(client_name, '') ~* '[A-Za-zÀ-ÖØ-öø-ÿ]')
),
dup_ids AS (
  SELECT id FROM public.clients
  WHERE deleted_at IS NULL
    AND merged_into_client_id IS NULL
    AND coalesce(client_name, '') ~* '[A-Za-zÀ-ÖØ-öø-ÿ]'
    AND lower(regexp_replace(btrim(client_name), '\s+', ' ', 'g')) IN (
      SELECT lower(regexp_replace(btrim(client_name), '\s+', ' ', 'g'))
      FROM public.clients
      WHERE deleted_at IS NULL AND merged_into_client_id IS NULL
        AND coalesce(client_name, '') ~* '[A-Za-zÀ-ÖØ-öø-ÿ]'
      GROUP BY 1 HAVING COUNT(*) > 1
    )
),
all_affected AS (SELECT id FROM invalid_ids UNION SELECT id FROM dup_ids)
SELECT
  'clients inválidos'        AS tabela, (SELECT COUNT(*) FROM invalid_ids)     AS afetados UNION ALL
SELECT 'clients duplicados',            (SELECT COUNT(*) FROM dup_ids)                     UNION ALL
SELECT 'proposals afetadas',            (SELECT COUNT(*) FROM public.proposals  p  WHERE p.client_id IN (SELECT id FROM all_affected) AND p.deleted_at IS NULL) UNION ALL
SELECT 'client_contracts afetados',     (SELECT COUNT(*) FROM public.client_contracts cc  WHERE cc.client_id IN (SELECT id FROM all_affected)) UNION ALL
SELECT 'client_billing_profile afet.',  (SELECT COUNT(*) FROM public.client_billing_profile bp WHERE bp.client_id IN (SELECT id FROM all_affected)) UNION ALL
SELECT 'client_usina_config afetados',  (SELECT COUNT(*) FROM public.client_usina_config uc WHERE uc.client_id IN (SELECT id FROM all_affected)) UNION ALL
SELECT 'client_lifecycle afetados',     (SELECT COUNT(*) FROM public.client_lifecycle lc  WHERE lc.client_id IN (SELECT id FROM all_affected)) UNION ALL
SELECT 'client_project_status afet.',   (SELECT COUNT(*) FROM public.client_project_status ps WHERE ps.client_id IN (SELECT id FROM all_affected)) UNION ALL
SELECT 'client_energy_profile afet.',   (SELECT COUNT(*) FROM public.client_energy_profile ep WHERE ep.client_id IN (SELECT id FROM all_affected)) UNION ALL
SELECT 'client_notes afetadas',         (SELECT COUNT(*) FROM public.client_notes cn    WHERE cn.client_id IN (SELECT id FROM all_affected)) UNION ALL
SELECT 'contacts afetados',             (SELECT COUNT(*) FROM public.contacts ct         WHERE ct.client_id IN (SELECT id FROM all_affected)) UNION ALL
SELECT 'deals afetados',                (SELECT COUNT(*) FROM public.deals dl            WHERE dl.client_id IN (SELECT id FROM all_affected)) UNION ALL
SELECT 'activities afetadas',           (SELECT COUNT(*) FROM public.activities ac        WHERE ac.client_id IN (SELECT id FROM all_affected)) UNION ALL
SELECT 'notes (CRM) afetadas',          (SELECT COUNT(*) FROM public.notes nt            WHERE nt.client_id IN (SELECT id FROM all_affected));


-- ============================================================================================================================
-- B) BLOCO DE BACKUP / SEGURANÇA
-- ============================================================================================================================
-- Criar schema auxiliar e copiar para lá todos os registros que serão
-- alterados ou removidos nos BLOCOs C–G.
-- Execute este bloco ANTES dos BLOCOs C–G.
-- ============================================================================================================================

-- Schema de backup (idempotente):
CREATE SCHEMA IF NOT EXISTS data_hygiene;

-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
-- B1) Backup de clientes com nome inválido
-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS data_hygiene.clients_dedup_backup
  AS TABLE public.clients WITH NO DATA;
ALTER TABLE data_hygiene.clients_dedup_backup
  ADD COLUMN IF NOT EXISTS backed_up_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS backup_reason TEXT;

-- Clientes com nome inválido:
INSERT INTO data_hygiene.clients_dedup_backup
SELECT c.*, now(), 'invalid_name'
FROM public.clients c
WHERE c.deleted_at IS NULL
  AND NOT (coalesce(c.client_name, '') ~* '[A-Za-zÀ-ÖØ-öø-ÿ]')
ON CONFLICT DO NOTHING;

-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
-- B2) Backup de clientes duplicados por nome normalizado (todos os registros do grupo)
-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

INSERT INTO data_hygiene.clients_dedup_backup
SELECT c.*, now(), 'name_duplicate'
FROM public.clients c
WHERE c.deleted_at IS NULL
  AND c.merged_into_client_id IS NULL
  AND coalesce(c.client_name, '') ~* '[A-Za-zÀ-ÖØ-öø-ÿ]'
  AND lower(regexp_replace(btrim(c.client_name), '\s+', ' ', 'g')) IN (
    SELECT lower(regexp_replace(btrim(client_name), '\s+', ' ', 'g'))
    FROM public.clients
    WHERE deleted_at IS NULL
      AND merged_into_client_id IS NULL
      AND coalesce(client_name, '') ~* '[A-Za-zÀ-ÖØ-öø-ÿ]'
    GROUP BY 1
    HAVING COUNT(*) > 1
  )
ON CONFLICT DO NOTHING;

-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
-- B3) Backup de proposals vinculadas a inválidos ou duplicados
-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS data_hygiene.proposals_dedup_backup
  AS TABLE public.proposals WITH NO DATA;
ALTER TABLE data_hygiene.proposals_dedup_backup
  ADD COLUMN IF NOT EXISTS backed_up_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS backup_reason TEXT;

INSERT INTO data_hygiene.proposals_dedup_backup
SELECT p.*, now(), 'client_invalid_or_duplicate'
FROM public.proposals p
WHERE p.client_id IN (
  SELECT id FROM public.clients
  WHERE deleted_at IS NULL
    AND (
      NOT (coalesce(client_name, '') ~* '[A-Za-zÀ-ÖØ-öø-ÿ]')
      OR (
        merged_into_client_id IS NULL
        AND coalesce(client_name, '') ~* '[A-Za-zÀ-ÖØ-öø-ÿ]'
        AND lower(regexp_replace(btrim(client_name), '\s+', ' ', 'g')) IN (
          SELECT lower(regexp_replace(btrim(client_name), '\s+', ' ', 'g'))
          FROM public.clients
          WHERE deleted_at IS NULL AND merged_into_client_id IS NULL
            AND coalesce(client_name, '') ~* '[A-Za-zÀ-ÖØ-öø-ÿ]'
          GROUP BY 1 HAVING COUNT(*) > 1
        )
      )
    )
)
ON CONFLICT DO NOTHING;

-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
-- B4) Backup de contratos vinculados a inválidos ou duplicados
-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS data_hygiene.client_contracts_dedup_backup
  AS TABLE public.client_contracts WITH NO DATA;
ALTER TABLE data_hygiene.client_contracts_dedup_backup
  ADD COLUMN IF NOT EXISTS backed_up_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS backup_reason TEXT;

INSERT INTO data_hygiene.client_contracts_dedup_backup
SELECT cc.*, now(), 'client_invalid_or_duplicate'
FROM public.client_contracts cc
WHERE cc.client_id IN (
  SELECT id FROM data_hygiene.clients_dedup_backup WHERE backup_reason IN ('invalid_name','name_duplicate')
)
ON CONFLICT DO NOTHING;

-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
-- B5) Backup de billing profiles vinculados a inválidos ou duplicados
-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS data_hygiene.client_billing_profile_dedup_backup
  AS TABLE public.client_billing_profile WITH NO DATA;
ALTER TABLE data_hygiene.client_billing_profile_dedup_backup
  ADD COLUMN IF NOT EXISTS backed_up_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS backup_reason TEXT;

INSERT INTO data_hygiene.client_billing_profile_dedup_backup
SELECT bp.*, now(), 'client_invalid_or_duplicate'
FROM public.client_billing_profile bp
WHERE bp.client_id IN (
  SELECT id FROM data_hygiene.clients_dedup_backup WHERE backup_reason IN ('invalid_name','name_duplicate')
)
ON CONFLICT DO NOTHING;

-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
-- B6) Backup de usina config vinculada a inválidos ou duplicados
-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS data_hygiene.client_usina_config_dedup_backup
  AS TABLE public.client_usina_config WITH NO DATA;
ALTER TABLE data_hygiene.client_usina_config_dedup_backup
  ADD COLUMN IF NOT EXISTS backed_up_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS backup_reason TEXT;

INSERT INTO data_hygiene.client_usina_config_dedup_backup
SELECT uc.*, now(), 'client_invalid_or_duplicate'
FROM public.client_usina_config uc
WHERE uc.client_id IN (
  SELECT id FROM data_hygiene.clients_dedup_backup WHERE backup_reason IN ('invalid_name','name_duplicate')
)
ON CONFLICT DO NOTHING;

-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
-- B7) Confirmar volumes de backup criados
-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

SELECT 'data_hygiene.clients_dedup_backup'               AS tabela_backup, backup_reason, COUNT(*) AS linhas
FROM data_hygiene.clients_dedup_backup
GROUP BY backup_reason
UNION ALL
SELECT 'data_hygiene.proposals_dedup_backup',             backup_reason, COUNT(*)
FROM data_hygiene.proposals_dedup_backup
GROUP BY backup_reason
UNION ALL
SELECT 'data_hygiene.client_contracts_dedup_backup',      backup_reason, COUNT(*)
FROM data_hygiene.client_contracts_dedup_backup
GROUP BY backup_reason
UNION ALL
SELECT 'data_hygiene.client_billing_profile_dedup_backup',backup_reason, COUNT(*)
FROM data_hygiene.client_billing_profile_dedup_backup
GROUP BY backup_reason
UNION ALL
SELECT 'data_hygiene.client_usina_config_dedup_backup',   backup_reason, COUNT(*)
FROM data_hygiene.client_usina_config_dedup_backup
GROUP BY backup_reason
ORDER BY 1, 2;


-- ============================================================================================================================
-- C–G) BLOCOS DE CONSOLIDAÇÃO, MIGRAÇÃO E REMOÇÃO (TRANSAÇÃO PRINCIPAL)
-- ============================================================================================================================
-- ATENÇÃO: Este bloco está envolto em BEGIN / COMMIT.
-- Para simular sem commitar, substituir COMMIT por ROLLBACK ao final.
-- Execute SEMPRE o BLOCO B antes deste bloco.
-- Os BLOCOs C–G usam tabelas persistentes no schema data_hygiene (_duplicate_map, _client_strength_scores)
-- e podem ser executados em sessões/conexões separadas (compatível com Neon SQL Editor).
-- ============================================================================================================================

BEGIN;

-- ============================================================================================================================
-- C) MAPEAMENTO DE DUPLICADOS
-- ============================================================================================================================
-- Cria tabelas de mapeamento no schema data_hygiene com a relação:
--   normalized_name  — nome normalizado do grupo
--   canonical_id     — id do registro canônico (sobrevivente) do grupo
--   duplicate_id     — id de cada registro excedente (a ser consolidado e soft-deletado)
--
-- O canônico é eleito por score de força:
--   in_portfolio (50pts) + contrato ativo (40) + billing ativo (30) + proposta ativa (20)
--   + documento válido (5) + email válido (3) + telefone válido (2)
-- ============================================================================================================================

-- Limpeza defensiva: remover tabelas de mapeamento de execuções anteriores, se existirem.
DROP TABLE IF EXISTS data_hygiene._duplicate_map;
DROP TABLE IF EXISTS data_hygiene._client_strength_scores;

-- C1) Tabela de scores por cliente duplicado (persistida no schema data_hygiene para sobreviver entre conexões)
CREATE TABLE IF NOT EXISTS data_hygiene._client_strength_scores AS
WITH valid_dup_names AS (
  -- Apenas nomes normalizados que aparecem em mais de 1 cliente ativo e válido
  SELECT lower(regexp_replace(btrim(client_name), '\s+', ' ', 'g')) AS normalized_name
  FROM public.clients
  WHERE deleted_at IS NULL
    AND merged_into_client_id IS NULL
    AND coalesce(client_name, '') ~* '[A-Za-zÀ-ÖØ-öø-ÿ]'
  GROUP BY 1
  HAVING COUNT(*) > 1
)
SELECT
  c.id                                                                AS client_id,
  lower(regexp_replace(btrim(c.client_name), '\s+', ' ', 'g'))       AS normalized_name,
  -- Score de força: quanto maior, mais provável de ser o canônico
  (
    CASE WHEN c.in_portfolio                                                                       THEN 50 ELSE 0 END
    + CASE WHEN EXISTS(
        SELECT 1 FROM public.client_contracts cc
        WHERE cc.client_id = c.id AND cc.contract_status IN ('active','signed','suspended')
      )                                                                                            THEN 40 ELSE 0 END
    + CASE WHEN EXISTS(
        SELECT 1 FROM public.client_billing_profile bp
        WHERE bp.client_id = c.id AND bp.payment_status NOT IN ('cancelled','written_off')
      )                                                                                            THEN 30 ELSE 0 END
    + CASE WHEN EXISTS(
        SELECT 1 FROM public.proposals p
        WHERE p.client_id = c.id AND p.deleted_at IS NULL AND p.status NOT IN ('cancelled','rejected')
      )                                                                                            THEN 20 ELSE 0 END
    + CASE WHEN c.client_document IS NOT NULL AND btrim(c.client_document) <> ''                  THEN  5 ELSE 0 END
    + CASE WHEN c.client_email IS NOT NULL AND c.client_email LIKE '%@%.%'                        THEN  3 ELSE 0 END
    + CASE WHEN c.client_phone IS NOT NULL
             AND length(regexp_replace(c.client_phone, '[^0-9]', '', 'g')) >= 10                  THEN  2 ELSE 0 END
  )                                                                   AS strength_score,
  c.updated_at,
  c.created_at
FROM public.clients c
INNER JOIN valid_dup_names vn ON vn.normalized_name = lower(regexp_replace(btrim(c.client_name), '\s+', ' ', 'g'))
WHERE c.deleted_at IS NULL
  AND c.merged_into_client_id IS NULL;

-- Índices para performance:
CREATE INDEX ON data_hygiene._client_strength_scores (normalized_name, strength_score DESC, updated_at DESC, created_at DESC, client_id DESC);


-- C2) Tabela do mapa canônico ↔ duplicado (persistida no schema data_hygiene)
CREATE TABLE IF NOT EXISTS data_hygiene._duplicate_map AS
WITH ranked AS (
  SELECT
    client_id,
    normalized_name,
    strength_score,
    updated_at,
    created_at,
    ROW_NUMBER() OVER (
      PARTITION BY normalized_name
      ORDER BY
        strength_score DESC,
        updated_at     DESC NULLS LAST,
        created_at     DESC NULLS LAST,
        client_id      DESC
    ) AS rn
  FROM data_hygiene._client_strength_scores
)
SELECT
  ranked.normalized_name,
  canon.client_id AS canonical_id,
  ranked.client_id AS duplicate_id
FROM ranked
JOIN (SELECT normalized_name, client_id FROM ranked WHERE rn = 1) AS canon
  ON canon.normalized_name = ranked.normalized_name
WHERE ranked.rn > 1;  -- exclui o próprio canônico

-- Índices:
CREATE INDEX ON data_hygiene._duplicate_map (canonical_id);
CREATE INDEX ON data_hygiene._duplicate_map (duplicate_id);

-- Prévia do mapeamento (verificar antes de avançar):
SELECT
  normalized_name,
  canonical_id,
  array_agg(duplicate_id ORDER BY duplicate_id) AS duplicate_ids,
  COUNT(*) AS duplicates_count
FROM data_hygiene._duplicate_map
GROUP BY normalized_name, canonical_id
ORDER BY duplicates_count DESC, normalized_name
LIMIT 50;


-- ============================================================================================================================
-- D) CONSOLIDAÇÃO DO CANÔNICO
-- ============================================================================================================================
-- Preencher campos vazios ou NULL do registro canônico com os melhores dados
-- disponíveis nos registros duplicados.
-- Regra: nunca sobrescrever dado bom com dado ruim ou NULL.
-- ============================================================================================================================

-- D1) Consolidar campos escalares do clients no canônico
--     Estratégia: COALESCE + prefer non-empty string
--     Para cada grupo, usa o primeiro valor não-nulo/não-vazio encontrado nos duplicados
--     (ordenado por strength_score DESC = mais forte primeiro)
WITH best_from_dups AS (
  -- Para cada canônico, agregar os melhores valores disponíveis nos seus duplicados.
  -- Usa array_agg com ORDER BY dentro do agregado + FILTER para filtrar valores
  -- inválidos — compatível com PostgreSQL (FILTER não é suportado em window functions).
  SELECT
    dm.canonical_id,
    -- Documento: pegar do duplicado mais forte que tenha um valor não-vazio
    (array_agg(d.client_document   ORDER BY sc.strength_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.client_document   IS NOT NULL AND btrim(d.client_document) <> ''))[1]   AS best_document,
    (array_agg(d.cpf_normalized    ORDER BY sc.strength_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.cpf_normalized    IS NOT NULL AND btrim(d.cpf_normalized) <> ''))[1]    AS best_cpf_normalized,
    (array_agg(d.cpf_raw           ORDER BY sc.strength_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.cpf_raw           IS NOT NULL AND btrim(d.cpf_raw) <> ''))[1]           AS best_cpf_raw,
    (array_agg(d.cnpj_normalized   ORDER BY sc.strength_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.cnpj_normalized   IS NOT NULL AND btrim(d.cnpj_normalized) <> ''))[1]   AS best_cnpj_normalized,
    (array_agg(d.cnpj_raw          ORDER BY sc.strength_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.cnpj_raw          IS NOT NULL AND btrim(d.cnpj_raw) <> ''))[1]          AS best_cnpj_raw,
    (array_agg(d.document_type     ORDER BY sc.strength_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.document_type     IS NOT NULL AND btrim(d.document_type) <> ''))[1]     AS best_document_type,
    (array_agg(d.client_email      ORDER BY sc.strength_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.client_email      IS NOT NULL AND d.client_email LIKE '%@%.%'))[1]      AS best_email,
    (array_agg(d.client_phone      ORDER BY sc.strength_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.client_phone      IS NOT NULL
                AND length(regexp_replace(d.client_phone, '[^0-9]', '', 'g')) >= 10))[1]      AS best_phone,
    (array_agg(d.client_city       ORDER BY sc.strength_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.client_city       IS NOT NULL AND btrim(d.client_city) <> ''))[1]       AS best_city,
    (array_agg(d.client_state      ORDER BY sc.strength_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.client_state      IS NOT NULL AND btrim(d.client_state) <> ''))[1]      AS best_state,
    (array_agg(d.client_address    ORDER BY sc.strength_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.client_address    IS NOT NULL AND btrim(d.client_address) <> ''))[1]    AS best_address,
    (array_agg(d.cep               ORDER BY sc.strength_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.cep               IS NOT NULL AND btrim(d.cep) <> ''))[1]               AS best_cep,
    (array_agg(d.uc_geradora       ORDER BY sc.strength_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.uc_geradora       IS NOT NULL AND btrim(d.uc_geradora) <> ''))[1]       AS best_uc_geradora,
    (array_agg(d.uc_beneficiaria   ORDER BY sc.strength_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.uc_beneficiaria   IS NOT NULL AND btrim(d.uc_beneficiaria) <> ''))[1]   AS best_uc_beneficiaria,
    (array_agg(d.distribuidora     ORDER BY sc.strength_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.distribuidora     IS NOT NULL AND btrim(d.distribuidora) <> ''))[1]     AS best_distribuidora,
    (array_agg(d.consumption_kwh_month ORDER BY sc.strength_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.consumption_kwh_month IS NOT NULL AND d.consumption_kwh_month > 0))[1]  AS best_consumption_kwh_month,
    (array_agg(d.system_kwp        ORDER BY sc.strength_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.system_kwp        IS NOT NULL AND d.system_kwp > 0))[1]                 AS best_system_kwp,
    (array_agg(d.term_months       ORDER BY sc.strength_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.term_months       IS NOT NULL AND btrim(d.term_months) <> ''))[1]       AS best_term_months,
    (array_agg(d.nome_razao        ORDER BY sc.strength_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.nome_razao        IS NOT NULL AND btrim(d.nome_razao) <> ''))[1]        AS best_nome_razao,
    (array_agg(d.logradouro        ORDER BY sc.strength_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.logradouro        IS NOT NULL AND btrim(d.logradouro) <> ''))[1]        AS best_logradouro,
    (array_agg(d.numero            ORDER BY sc.strength_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.numero            IS NOT NULL AND btrim(d.numero) <> ''))[1]            AS best_numero,
    (array_agg(d.complemento       ORDER BY sc.strength_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.complemento       IS NOT NULL AND btrim(d.complemento) <> ''))[1]       AS best_complemento,
    (array_agg(d.bairro            ORDER BY sc.strength_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.bairro            IS NOT NULL AND btrim(d.bairro) <> ''))[1]            AS best_bairro,
    (array_agg(d.telefone_secundario ORDER BY sc.strength_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.telefone_secundario IS NOT NULL
                AND length(regexp_replace(d.telefone_secundario, '[^0-9]', '', 'g')) >= 10))[1] AS best_telefone_secundario,
    (array_agg(d.origem            ORDER BY sc.strength_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.origem            IS NOT NULL AND btrim(d.origem) <> ''))[1]            AS best_origem,
    (array_agg(d.observacoes       ORDER BY sc.strength_score DESC, d.updated_at DESC NULLS LAST, d.id DESC)
      FILTER (WHERE d.observacoes       IS NOT NULL AND btrim(d.observacoes) <> ''))[1]       AS best_observacoes
  FROM data_hygiene._duplicate_map dm
  JOIN public.clients d ON d.id = dm.duplicate_id
  JOIN data_hygiene._client_strength_scores sc ON sc.client_id = dm.duplicate_id
  GROUP BY dm.canonical_id
)
UPDATE public.clients c
SET
  client_document      = COALESCE(c.client_document,      b.best_document),
  cpf_normalized       = COALESCE(c.cpf_normalized,       b.best_cpf_normalized),
  cpf_raw              = COALESCE(c.cpf_raw,              b.best_cpf_raw),
  cnpj_normalized      = COALESCE(c.cnpj_normalized,      b.best_cnpj_normalized),
  cnpj_raw             = COALESCE(c.cnpj_raw,             b.best_cnpj_raw),
  document_type        = COALESCE(c.document_type,        b.best_document_type),
  client_email         = COALESCE(c.client_email,         b.best_email),
  client_phone         = COALESCE(c.client_phone,         b.best_phone),
  client_city          = COALESCE(c.client_city,          b.best_city),
  client_state         = COALESCE(c.client_state,         b.best_state),
  client_address       = COALESCE(c.client_address,       b.best_address),
  cep                  = COALESCE(c.cep,                  b.best_cep),
  uc_geradora          = COALESCE(c.uc_geradora,          b.best_uc_geradora),
  uc_beneficiaria      = COALESCE(c.uc_beneficiaria,      b.best_uc_beneficiaria),
  distribuidora        = COALESCE(c.distribuidora,        b.best_distribuidora),
  consumption_kwh_month= COALESCE(c.consumption_kwh_month,b.best_consumption_kwh_month),
  system_kwp           = COALESCE(c.system_kwp,           b.best_system_kwp),
  term_months          = COALESCE(c.term_months,          b.best_term_months),
  nome_razao           = COALESCE(c.nome_razao,           b.best_nome_razao),
  logradouro           = COALESCE(c.logradouro,           b.best_logradouro),
  numero               = COALESCE(c.numero,               b.best_numero),
  complemento          = COALESCE(c.complemento,          b.best_complemento),
  bairro               = COALESCE(c.bairro,               b.best_bairro),
  telefone_secundario  = COALESCE(c.telefone_secundario,  b.best_telefone_secundario),
  origem               = COALESCE(c.origem,               b.best_origem),
  observacoes          = COALESCE(c.observacoes,          b.best_observacoes),
  -- Atualizar identity_status se estava pending_cpf e agora tem documento via consolidação:
  identity_status      = CASE
                           WHEN c.identity_status = 'pending_cpf'
                            AND (
                              COALESCE(c.cpf_normalized, b.best_cpf_normalized) IS NOT NULL
                              OR COALESCE(c.cnpj_normalized, b.best_cnpj_normalized) IS NOT NULL
                            )
                           THEN 'confirmed'
                           ELSE c.identity_status
                         END,
  updated_at           = now()
FROM best_from_dups b
WHERE c.id = b.canonical_id
  -- Só atualizar se houver pelo menos 1 campo a preencher
  AND (
    (c.client_document IS NULL    AND b.best_document IS NOT NULL)
    OR (c.cpf_normalized IS NULL  AND b.best_cpf_normalized IS NOT NULL)
    OR (c.cnpj_normalized IS NULL AND b.best_cnpj_normalized IS NOT NULL)
    OR (c.client_email IS NULL    AND b.best_email IS NOT NULL)
    OR (c.client_phone IS NULL    AND b.best_phone IS NOT NULL)
    OR (c.client_city IS NULL     AND b.best_city IS NOT NULL)
    OR (c.client_state IS NULL    AND b.best_state IS NOT NULL)
    OR (c.client_address IS NULL  AND b.best_address IS NOT NULL)
    OR (c.cep IS NULL             AND b.best_cep IS NOT NULL)
    OR (c.uc_geradora IS NULL     AND b.best_uc_geradora IS NOT NULL)
    OR (c.uc_beneficiaria IS NULL AND b.best_uc_beneficiaria IS NOT NULL)
    OR (c.distribuidora IS NULL   AND b.best_distribuidora IS NOT NULL)
    OR (c.consumption_kwh_month IS NULL AND b.best_consumption_kwh_month IS NOT NULL)
    OR (c.system_kwp IS NULL      AND b.best_system_kwp IS NOT NULL)
    OR (c.term_months IS NULL     AND b.best_term_months IS NOT NULL)
  );


-- D2) Merge de metadata JSONB (canônico ← duplicados, sem sobrescrever chaves existentes)
--     Estratégia: metadata do canônico prevalece; chaves faltantes são preenchidas com
--     o valor do melhor duplicado disponível.
WITH merged_meta AS (
  SELECT
    dm.canonical_id,
    -- Agregar todos os metadata dos duplicados em um único objeto mesclado,
    -- depois o canônico sobrescreve as chaves com seus próprios valores (direito de precedência).
    jsonb_object_agg_strict_fn.merged_dup_meta
  FROM data_hygiene._duplicate_map dm
  CROSS JOIN LATERAL (
    SELECT
      -- Mescla todos os metadata dos duplicados em ordem de strength (mais forte por último = sobrescreve o mais fraco)
      -- Usamos jsonb || para concatenar, sobrescrevendo chaves à direita
      (
        SELECT
          COALESCE(
            jsonb_object_agg_val,
            '{}'::jsonb
          )
        FROM (
          SELECT
            COALESCE(
              (SELECT d.metadata
               FROM public.clients d
               WHERE d.id = dm.duplicate_id
                 AND d.metadata IS NOT NULL
                 AND d.metadata <> 'null'::jsonb
                 AND d.metadata <> '{}'::jsonb
               ORDER BY (SELECT strength_score FROM data_hygiene._client_strength_scores WHERE client_id = d.id) DESC
               LIMIT 1
              ),
              '{}'::jsonb
            ) AS jsonb_object_agg_val
        ) sub
      ) AS merged_dup_meta
  ) jsonb_object_agg_strict_fn
)
-- NOTE: O merge de JSONB é feito abaixo de forma mais direta:
UPDATE public.clients c
SET
  -- Canônico prevalece: dup_merged || canonical (canônico à direita sobrescreve conflitos)
  metadata   = CASE
                 WHEN c.metadata IS NULL OR c.metadata = 'null'::jsonb OR c.metadata = '{}'::jsonb
                 THEN sub.best_dup_meta
                 ELSE sub.best_dup_meta || c.metadata  -- canônico sobrescreve duplicados
               END,
  updated_at = now()
FROM (
  SELECT
    dm.canonical_id,
    -- Agrega JSONB de todos os duplicados, mais forte por último (sobrescreve mais fraco)
    (
      SELECT jsonb_object_agg(kv.key, kv.value)
      FROM (
        SELECT DISTINCT ON (kv2.key)
          kv2.key,
          kv2.value
        FROM data_hygiene._duplicate_map dm2
        JOIN public.clients d ON d.id = dm2.duplicate_id
        JOIN jsonb_each(COALESCE(d.metadata, '{}'::jsonb)) AS kv2(key, value) ON true
        WHERE dm2.canonical_id = dm.canonical_id
          AND d.metadata IS NOT NULL
          AND d.metadata <> 'null'::jsonb
        ORDER BY kv2.key, (SELECT strength_score FROM data_hygiene._client_strength_scores WHERE client_id = d.id) DESC NULLS LAST
      ) kv
    ) AS best_dup_meta
  FROM (SELECT DISTINCT canonical_id FROM data_hygiene._duplicate_map) dm
) sub
WHERE c.id = sub.canonical_id
  AND sub.best_dup_meta IS NOT NULL
  AND sub.best_dup_meta <> '{}'::jsonb;


-- ============================================================================================================================
-- E) MIGRAÇÃO DE VÍNCULOS
-- ============================================================================================================================
-- Redirecionar todas as FKs que apontam para registros duplicados para o canônico.
-- ATENÇÃO: Fazer ANTES de soft-deletar os duplicados.
-- ============================================================================================================================

-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
-- E1) TABELAS MULTI-ROW: apenas atualizar client_id → canonical_id
-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

-- E1a) proposals
UPDATE public.proposals p
SET
  client_id  = dm.canonical_id,
  updated_at = now()
FROM data_hygiene._duplicate_map dm
WHERE p.client_id = dm.duplicate_id
  AND p.deleted_at IS NULL;

-- E1b) client_contracts
UPDATE public.client_contracts cc
SET
  client_id  = dm.canonical_id,
  updated_at = now()
FROM data_hygiene._duplicate_map dm
WHERE cc.client_id = dm.duplicate_id;

-- E1c) client_notes
UPDATE public.client_notes cn
SET
  client_id = dm.canonical_id
FROM data_hygiene._duplicate_map dm
WHERE cn.client_id = dm.duplicate_id;

-- E1d) contacts (CRM)
UPDATE public.contacts ct
SET
  client_id  = dm.canonical_id,
  updated_at = now()
FROM data_hygiene._duplicate_map dm
WHERE ct.client_id = dm.duplicate_id;

-- E1e) deals (CRM)
UPDATE public.deals dl
SET
  client_id  = dm.canonical_id,
  updated_at = now()
FROM data_hygiene._duplicate_map dm
WHERE dl.client_id = dm.duplicate_id;

-- E1f) activities (CRM)
UPDATE public.activities ac
SET
  client_id  = dm.canonical_id,
  updated_at = now()
FROM data_hygiene._duplicate_map dm
WHERE ac.client_id = dm.duplicate_id;

-- E1g) notes / CRM notes (client_id nullable → SET NULL se não migrável, mas aqui migrar)
UPDATE public.notes n
SET
  client_id  = dm.canonical_id,
  updated_at = now()
FROM data_hygiene._duplicate_map dm
WHERE n.client_id = dm.duplicate_id;

-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
-- E2) TABELAS COM UNIQUE(client_id): mesclar dados e depois deletar registro do duplicado
--     Para cada tabela, se o canônico JÁ TEM registro: mesclar campos, então deletar o do duplicado.
--     Se o canônico NÃO TEM registro: apenas redirecionar client_id.
-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

-- ── E2a) client_billing_profile ──────────────────────────────────────────────────────────────────────────────────────────

-- Passo 1: Mesclar dados do duplicado no canônico (onde ambos existem)
UPDATE public.client_billing_profile bp_canon
SET
  contract_id              = COALESCE(bp_canon.contract_id,             bp_dup.contract_id),
  due_day                  = COALESCE(bp_canon.due_day,                 bp_dup.due_day),
  reading_day              = COALESCE(bp_canon.reading_day,             bp_dup.reading_day),
  first_billing_date       = COALESCE(bp_canon.first_billing_date,      bp_dup.first_billing_date),
  expected_last_billing_date = COALESCE(bp_canon.expected_last_billing_date, bp_dup.expected_last_billing_date),
  recurrence_type          = COALESCE(bp_canon.recurrence_type,         bp_dup.recurrence_type),
  -- Prioriza status mais "avançado" (não sobrescrever current com pending)
  payment_status           = CASE
                               WHEN bp_canon.payment_status IN ('overdue','written_off') THEN bp_canon.payment_status
                               WHEN bp_dup.payment_status IN ('overdue','written_off')   THEN bp_dup.payment_status
                               WHEN bp_canon.payment_status = 'current'                 THEN bp_canon.payment_status
                               WHEN bp_dup.payment_status = 'current'                   THEN bp_dup.payment_status
                               ELSE COALESCE(bp_canon.payment_status, bp_dup.payment_status)
                             END,
  delinquency_status       = COALESCE(bp_canon.delinquency_status,      bp_dup.delinquency_status),
  collection_stage         = COALESCE(bp_canon.collection_stage,        bp_dup.collection_stage),
  auto_reminder_enabled    = COALESCE(bp_canon.auto_reminder_enabled,   bp_dup.auto_reminder_enabled),
  valor_mensalidade        = COALESCE(bp_canon.valor_mensalidade,       bp_dup.valor_mensalidade),
  commissioning_date       = COALESCE(bp_canon.commissioning_date,      bp_dup.commissioning_date),
  -- Mesclar installments_json: concatenar arrays sem duplicar
  installments_json        = CASE
                               WHEN bp_canon.installments_json IS NULL OR bp_canon.installments_json = '[]'::jsonb
                               THEN COALESCE(bp_dup.installments_json, '[]'::jsonb)
                               WHEN bp_dup.installments_json IS NULL OR bp_dup.installments_json = '[]'::jsonb
                               THEN bp_canon.installments_json
                               ELSE bp_canon.installments_json || bp_dup.installments_json
                             END,
  updated_at               = now()
FROM data_hygiene._duplicate_map dm
JOIN public.client_billing_profile bp_dup ON bp_dup.client_id = dm.duplicate_id
WHERE bp_canon.client_id = dm.canonical_id;  -- só where canonical já tem registro

-- Passo 2: Onde canônico NÃO tem registro → transferir o do duplicado
UPDATE public.client_billing_profile bp
SET
  client_id  = dm.canonical_id,
  updated_at = now()
FROM data_hygiene._duplicate_map dm
WHERE bp.client_id = dm.duplicate_id
  AND NOT EXISTS (
    SELECT 1 FROM public.client_billing_profile WHERE client_id = dm.canonical_id
  );

-- Passo 3: Excluir registros do duplicado onde o canônico já tem o seu (merge já feito)
DELETE FROM public.client_billing_profile
WHERE client_id IN (
  SELECT dm.duplicate_id
  FROM data_hygiene._duplicate_map dm
  WHERE EXISTS (
    SELECT 1 FROM public.client_billing_profile WHERE client_id = dm.canonical_id
  )
);


-- ── E2b) client_usina_config ──────────────────────────────────────────────────────────────────────────────────────────────

-- Passo 1: Mesclar dados do duplicado no canônico
UPDATE public.client_usina_config uc_canon
SET
  potencia_modulo_wp    = COALESCE(uc_canon.potencia_modulo_wp,    uc_dup.potencia_modulo_wp),
  numero_modulos        = COALESCE(uc_canon.numero_modulos,        uc_dup.numero_modulos),
  modelo_modulo         = COALESCE(uc_canon.modelo_modulo,         uc_dup.modelo_modulo),
  modelo_inversor       = COALESCE(uc_canon.modelo_inversor,       uc_dup.modelo_inversor),
  tipo_instalacao       = COALESCE(uc_canon.tipo_instalacao,       uc_dup.tipo_instalacao),
  area_instalacao_m2    = COALESCE(uc_canon.area_instalacao_m2,    uc_dup.area_instalacao_m2),
  geracao_estimada_kwh  = COALESCE(uc_canon.geracao_estimada_kwh,  uc_dup.geracao_estimada_kwh),
  updated_at            = now()
FROM data_hygiene._duplicate_map dm
JOIN public.client_usina_config uc_dup ON uc_dup.client_id = dm.duplicate_id
WHERE uc_canon.client_id = dm.canonical_id;

-- Passo 2: Transferir onde canônico não tem
UPDATE public.client_usina_config uc
SET
  client_id  = dm.canonical_id,
  updated_at = now()
FROM data_hygiene._duplicate_map dm
WHERE uc.client_id = dm.duplicate_id
  AND NOT EXISTS (
    SELECT 1 FROM public.client_usina_config WHERE client_id = dm.canonical_id
  );

-- Passo 3: Excluir do duplicado onde canônico já tem
DELETE FROM public.client_usina_config
WHERE client_id IN (
  SELECT dm.duplicate_id
  FROM data_hygiene._duplicate_map dm
  WHERE EXISTS (
    SELECT 1 FROM public.client_usina_config WHERE client_id = dm.canonical_id
  )
);


-- ── E2c) client_lifecycle ─────────────────────────────────────────────────────────────────────────────────────────────────

-- Passo 1: Mesclar dados do duplicado no canônico
UPDATE public.client_lifecycle lc_canon
SET
  -- Priorizar status mais avançado no ciclo de vida
  lifecycle_status            = CASE
                                  WHEN lc_canon.lifecycle_status = 'billing'      THEN lc_canon.lifecycle_status
                                  WHEN lc_dup.lifecycle_status   = 'billing'      THEN lc_dup.lifecycle_status
                                  WHEN lc_canon.lifecycle_status = 'active'       THEN lc_canon.lifecycle_status
                                  WHEN lc_dup.lifecycle_status   = 'active'       THEN lc_dup.lifecycle_status
                                  WHEN lc_canon.lifecycle_status = 'contracted'   THEN lc_canon.lifecycle_status
                                  WHEN lc_dup.lifecycle_status   = 'contracted'   THEN lc_dup.lifecycle_status
                                  ELSE COALESCE(lc_canon.lifecycle_status, lc_dup.lifecycle_status)
                                END,
  is_converted_customer       = (lc_canon.is_converted_customer OR lc_dup.is_converted_customer),
  exported_to_portfolio_at    = COALESCE(lc_canon.exported_to_portfolio_at,  lc_dup.exported_to_portfolio_at),
  converted_from_lead_at      = COALESCE(lc_canon.converted_from_lead_at,   lc_dup.converted_from_lead_at),
  onboarding_status           = COALESCE(lc_canon.onboarding_status,         lc_dup.onboarding_status),
  is_active_portfolio_client  = (lc_canon.is_active_portfolio_client OR lc_dup.is_active_portfolio_client),
  exported_by_user_id         = COALESCE(lc_canon.exported_by_user_id,       lc_dup.exported_by_user_id),
  updated_at                  = now()
FROM data_hygiene._duplicate_map dm
JOIN public.client_lifecycle lc_dup ON lc_dup.client_id = dm.duplicate_id
WHERE lc_canon.client_id = dm.canonical_id;

-- Passo 2: Transferir onde canônico não tem
UPDATE public.client_lifecycle lc
SET
  client_id  = dm.canonical_id,
  updated_at = now()
FROM data_hygiene._duplicate_map dm
WHERE lc.client_id = dm.duplicate_id
  AND NOT EXISTS (
    SELECT 1 FROM public.client_lifecycle WHERE client_id = dm.canonical_id
  );

-- Passo 3: Excluir do duplicado onde canônico já tem
DELETE FROM public.client_lifecycle
WHERE client_id IN (
  SELECT dm.duplicate_id
  FROM data_hygiene._duplicate_map dm
  WHERE EXISTS (
    SELECT 1 FROM public.client_lifecycle WHERE client_id = dm.canonical_id
  )
);


-- ── E2d) client_project_status ───────────────────────────────────────────────────────────────────────────────────────────

-- Passo 1: Mesclar dados do duplicado no canônico
UPDATE public.client_project_status ps_canon
SET
  project_status         = COALESCE(ps_canon.project_status,        ps_dup.project_status),
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
  timeline_velocity_score= COALESCE(ps_canon.timeline_velocity_score,ps_dup.timeline_velocity_score),
  notes                  = CASE
                             WHEN ps_canon.notes IS NULL THEN ps_dup.notes
                             WHEN ps_dup.notes IS NULL   THEN ps_canon.notes
                             ELSE ps_canon.notes || E'\n---\n' || ps_dup.notes
                           END,
  updated_at             = now()
FROM data_hygiene._duplicate_map dm
JOIN public.client_project_status ps_dup ON ps_dup.client_id = dm.duplicate_id
WHERE ps_canon.client_id = dm.canonical_id;

-- Passo 2: Transferir onde canônico não tem
UPDATE public.client_project_status ps
SET
  client_id  = dm.canonical_id,
  updated_at = now()
FROM data_hygiene._duplicate_map dm
WHERE ps.client_id = dm.duplicate_id
  AND NOT EXISTS (
    SELECT 1 FROM public.client_project_status WHERE client_id = dm.canonical_id
  );

-- Passo 3: Excluir do duplicado onde canônico já tem
DELETE FROM public.client_project_status
WHERE client_id IN (
  SELECT dm.duplicate_id
  FROM data_hygiene._duplicate_map dm
  WHERE EXISTS (
    SELECT 1 FROM public.client_project_status WHERE client_id = dm.canonical_id
  )
);


-- ── E2e) client_energy_profile ───────────────────────────────────────────────────────────────────────────────────────────

-- Passo 1: Mesclar dados do duplicado no canônico
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
FROM data_hygiene._duplicate_map dm
JOIN public.client_energy_profile ep_dup ON ep_dup.client_id = dm.duplicate_id
WHERE ep_canon.client_id = dm.canonical_id;

-- Passo 2: Transferir onde canônico não tem
UPDATE public.client_energy_profile ep
SET
  client_id  = dm.canonical_id,
  updated_at = now()
FROM data_hygiene._duplicate_map dm
WHERE ep.client_id = dm.duplicate_id
  AND NOT EXISTS (
    SELECT 1 FROM public.client_energy_profile WHERE client_id = dm.canonical_id
  );

-- Passo 3: Excluir do duplicado onde canônico já tem
DELETE FROM public.client_energy_profile
WHERE client_id IN (
  SELECT dm.duplicate_id
  FROM data_hygiene._duplicate_map dm
  WHERE EXISTS (
    SELECT 1 FROM public.client_energy_profile WHERE client_id = dm.canonical_id
  )
);


-- ============================================================================================================================
-- F) REMOÇÃO DOS DUPLICADOS (SOFT-DELETE)
-- ============================================================================================================================
-- Após consolidar dados e migrar vínculos, soft-deletar os registros excedentes.
-- Clientes excedentes com in_portfolio = true NÃO são soft-deletados automaticamente
-- (aparecem no BLOCO H para revisão manual).
-- ============================================================================================================================

-- F1) Soft-delete de duplicados sem vínculo crítico
UPDATE public.clients c
SET
  merged_into_client_id = dm.canonical_id,
  deleted_at            = now(),
  identity_status       = 'merged',
  updated_at            = now()
FROM data_hygiene._duplicate_map dm
WHERE c.id = dm.duplicate_id
  -- Nunca soft-deletar se ainda em portfólio:
  AND c.in_portfolio = false
  -- Nunca soft-deletar se ainda tiver contrato ativo (migração deve ter resolvido, mas checar):
  AND NOT EXISTS (
    SELECT 1 FROM public.client_contracts cc
    WHERE cc.client_id = c.id AND cc.contract_status IN ('active','signed','suspended')
  )
  -- Nunca soft-deletar se ainda tiver billing ativo:
  AND NOT EXISTS (
    SELECT 1 FROM public.client_billing_profile bp
    WHERE bp.client_id = c.id AND bp.payment_status NOT IN ('cancelled','written_off')
  );

-- F2) Registros duplicados protegidos que NÃO foram soft-deletados (requerem revisão manual):
SELECT
  c.id,
  c.client_name,
  dm.canonical_id,
  dm.normalized_name,
  c.in_portfolio,
  CASE
    WHEN c.in_portfolio                                                                           THEN 'em_portfolio'
    WHEN EXISTS(SELECT 1 FROM public.client_contracts cc WHERE cc.client_id = c.id AND cc.contract_status IN ('active','signed','suspended')) THEN 'contrato_ativo'
    WHEN EXISTS(SELECT 1 FROM public.client_billing_profile bp WHERE bp.client_id = c.id AND bp.payment_status NOT IN ('cancelled','written_off')) THEN 'billing_ativo'
    ELSE 'outro'
  END AS motivo_retencao
FROM data_hygiene._duplicate_map dm
JOIN public.clients c ON c.id = dm.duplicate_id
WHERE c.deleted_at IS NULL  -- ainda ativo = não foi soft-deletado no passo F1
ORDER BY dm.normalized_name, c.id;


-- ============================================================================================================================
-- G) REMOÇÃO DOS CLIENTES COM NOME INVÁLIDO
-- ============================================================================================================================
-- ATENÇÃO:
--   • Clientes com nome inválido e vínculos ativos NÃO serão deletados automaticamente.
--     Esses casos são exibidos no BLOCO H para revisão manual.
--   • Clientes com nome inválido sem vínculos relevantes são hard-deletados (DELETE).
--   • O backup foi criado no BLOCO B; é possível restaurar via data_hygiene.clients_dedup_backup.
-- ============================================================================================================================

-- G1) Migrar vínculos de clientes inválidos para canônico (se houver canônico por CPF/CNPJ)
--     Caso o cliente inválido tenha um cpf_normalized ou cnpj_normalized que coincide com
--     um cliente válido, redirecionar os vínculos para esse canônico antes de deletar.

-- G1a) proposals ligadas a clientes inválidos → redirecionar se houver canônico por documento
UPDATE public.proposals p
SET
  client_id  = valid_c.id,
  updated_at = now()
FROM public.clients inval
JOIN public.clients valid_c ON (
  (valid_c.cpf_normalized  IS NOT NULL AND valid_c.cpf_normalized  = inval.cpf_normalized)
  OR
  (valid_c.cnpj_normalized IS NOT NULL AND valid_c.cnpj_normalized = inval.cnpj_normalized)
)
WHERE p.client_id = inval.id
  AND p.deleted_at IS NULL
  AND NOT (coalesce(inval.client_name, '') ~* '[A-Za-zÀ-ÖØ-öø-ÿ]')
  AND inval.deleted_at IS NULL
  AND valid_c.deleted_at IS NULL
  AND valid_c.id <> inval.id
  AND coalesce(valid_c.client_name, '') ~* '[A-Za-zÀ-ÖØ-öø-ÿ]';

-- G1b) contratos — mesmo padrão
UPDATE public.client_contracts cc
SET
  client_id  = valid_c.id,
  updated_at = now()
FROM public.clients inval
JOIN public.clients valid_c ON (
  (valid_c.cpf_normalized  IS NOT NULL AND valid_c.cpf_normalized  = inval.cpf_normalized)
  OR
  (valid_c.cnpj_normalized IS NOT NULL AND valid_c.cnpj_normalized = inval.cnpj_normalized)
)
WHERE cc.client_id = inval.id
  AND NOT (coalesce(inval.client_name, '') ~* '[A-Za-zÀ-ÖØ-öø-ÿ]')
  AND inval.deleted_at IS NULL
  AND valid_c.deleted_at IS NULL
  AND valid_c.id <> inval.id
  AND coalesce(valid_c.client_name, '') ~* '[A-Za-zÀ-ÖØ-öø-ÿ]';

-- G2) Soft-delete de clientes inválidos que ainda têm vínculos ativos não redirecionáveis
--     (não podemos hard-deletar — marcar como rejected para revisão manual)
UPDATE public.clients c
SET
  deleted_at      = now(),
  identity_status = 'rejected',
  updated_at      = now()
WHERE c.deleted_at IS NULL
  AND NOT (coalesce(c.client_name, '') ~* '[A-Za-zÀ-ÖØ-öø-ÿ]')
  AND c.in_portfolio = false
  AND (
    EXISTS(SELECT 1 FROM public.client_contracts cc WHERE cc.client_id = c.id AND cc.contract_status IN ('active','signed','suspended'))
    OR EXISTS(SELECT 1 FROM public.client_billing_profile bp WHERE bp.client_id = c.id AND bp.payment_status NOT IN ('cancelled','written_off'))
    OR EXISTS(SELECT 1 FROM public.proposals p WHERE p.client_id = c.id AND p.deleted_at IS NULL AND p.status NOT IN ('cancelled','rejected'))
  );
-- NOTA: Esses registros ficam com deleted_at setado mas identity_status = 'rejected'.
-- O BLOCO H listará os que têm in_portfolio = true ou vínculos especiais para revisão manual obrigatória.

-- G3) Hard-delete de clientes inválidos sem vínculos relevantes
--     Pré-condição: não estão em portfólio, não têm contrato, billing ou proposta ativa.
--
--     AVISO: Esta operação é irreversível após o COMMIT.
--     O backup criado no BLOCO B deve ser validado antes de executar este passo.
--
DELETE FROM public.clients c
WHERE c.deleted_at IS NULL
  AND NOT (coalesce(c.client_name, '') ~* '[A-Za-zÀ-ÖØ-öø-ÿ]')
  AND c.in_portfolio = false
  AND NOT EXISTS (SELECT 1 FROM public.client_contracts cc WHERE cc.client_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM public.client_billing_profile bp WHERE bp.client_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM public.proposals p WHERE p.client_id = c.id AND p.deleted_at IS NULL)
  AND NOT EXISTS (SELECT 1 FROM public.client_lifecycle lc WHERE lc.client_id = c.id AND lc.is_converted_customer = true)
  AND NOT EXISTS (SELECT 1 FROM public.deals dl WHERE dl.client_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM public.contacts ct WHERE ct.client_id = c.id);

-- G4) Clientes inválidos em portfólio ou com vínculos críticos que exigem revisão manual:
--     (NÃO são deletados automaticamente — listados no BLOCO H)
SELECT
  c.id,
  c.client_name,
  c.client_document,
  c.in_portfolio,
  c.identity_status,
  c.deleted_at,
  CASE
    WHEN c.in_portfolio                                                                           THEN 'em_portfolio'
    WHEN EXISTS(SELECT 1 FROM public.client_contracts cc WHERE cc.client_id = c.id AND cc.contract_status IN ('active','signed','suspended')) THEN 'contrato_ativo'
    WHEN EXISTS(SELECT 1 FROM public.client_billing_profile bp WHERE bp.client_id = c.id AND bp.payment_status NOT IN ('cancelled','written_off')) THEN 'billing_ativo'
    ELSE 'soft_deleted_pendente_revisao'
  END AS status_revisao
FROM public.clients c
WHERE NOT (coalesce(c.client_name, '') ~* '[A-Za-zÀ-ÖØ-öø-ÿ]')
  AND (
    c.in_portfolio = true
    OR EXISTS(SELECT 1 FROM public.client_contracts cc WHERE cc.client_id = c.id AND cc.contract_status IN ('active','signed','suspended'))
    OR EXISTS(SELECT 1 FROM public.client_billing_profile bp WHERE bp.client_id = c.id AND bp.payment_status NOT IN ('cancelled','written_off'))
  )
ORDER BY c.in_portfolio DESC, c.id;


-- ============================================================================================================================
-- COMMIT — confirmar todas as alterações dos BLOCOs C–G
-- Para simular sem commitar, substituir por ROLLBACK
-- ============================================================================================================================

COMMIT;

-- Limpeza das tabelas de mapeamento após o commit (podem ser descartadas com segurança).
DROP TABLE IF EXISTS data_hygiene._duplicate_map;
DROP TABLE IF EXISTS data_hygiene._client_strength_scores;


-- ============================================================================================================================
-- H) BLOCO DE VERIFICAÇÃO FINAL
-- ============================================================================================================================
-- Rodar após o COMMIT para validar o resultado da operação.
-- ============================================================================================================================

-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
-- H1) Clientes com nome inválido restantes (ativos)
--     Esperado: 0 (exceto os retidos por vínculo crítico — revisão manual necessária)
-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

SELECT
  'H1 - clientes com nome inválido restantes (ativos)' AS check_name,
  COUNT(*)                                             AS total
FROM public.clients
WHERE deleted_at IS NULL
  AND NOT (coalesce(client_name, '') ~* '[A-Za-zÀ-ÖØ-öø-ÿ]');

-- Detalhe dos retidos (precisam de revisão manual):
SELECT
  id,
  client_name,
  client_document,
  in_portfolio,
  identity_status,
  CASE
    WHEN in_portfolio                                                                             THEN 'em_portfolio'
    WHEN EXISTS(SELECT 1 FROM public.client_contracts cc WHERE cc.client_id = c.id AND cc.contract_status IN ('active','signed','suspended')) THEN 'contrato_ativo'
    WHEN EXISTS(SELECT 1 FROM public.client_billing_profile bp WHERE bp.client_id = c.id AND bp.payment_status NOT IN ('cancelled','written_off')) THEN 'billing_ativo'
    ELSE 'motivo_nao_identificado'
  END AS motivo_retencao
FROM public.clients c
WHERE deleted_at IS NULL
  AND NOT (coalesce(client_name, '') ~* '[A-Za-zÀ-ÖØ-öø-ÿ]')
ORDER BY in_portfolio DESC, id;


-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
-- H2) Grupos de nomes duplicados restantes (ativos)
--     Esperado: 0 para grupos sem vínculos críticos
--     Grupos com duplicados protegidos (in_portfolio / contrato ativo) ainda aparecerão
-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

SELECT
  'H2 - grupos de nomes duplicados restantes' AS check_name,
  COUNT(DISTINCT normalized_name)             AS grupos_restantes,
  SUM(cnt - 1)                                AS linhas_excedentes
FROM (
  SELECT
    lower(regexp_replace(btrim(client_name), '\s+', ' ', 'g')) AS normalized_name,
    COUNT(*) AS cnt
  FROM public.clients
  WHERE deleted_at IS NULL
    AND merged_into_client_id IS NULL
    AND coalesce(client_name, '') ~* '[A-Za-zÀ-ÖØ-öø-ÿ]'
  GROUP BY 1
  HAVING COUNT(*) > 1
) t;

-- Detalhe dos grupos restantes (para revisão manual):
SELECT
  lower(regexp_replace(btrim(client_name), '\s+', ' ', 'g')) AS normalized_name,
  COUNT(*) AS copies,
  array_agg(id ORDER BY in_portfolio DESC, updated_at DESC NULLS LAST, id DESC) AS ids,
  array_agg(in_portfolio ORDER BY in_portfolio DESC, updated_at DESC NULLS LAST, id DESC) AS em_carteira
FROM public.clients
WHERE deleted_at IS NULL
  AND merged_into_client_id IS NULL
  AND coalesce(client_name, '') ~* '[A-Za-zÀ-ÖØ-öø-ÿ]'
GROUP BY 1
HAVING COUNT(*) > 1
ORDER BY copies DESC;


-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
-- H3) Proposals órfãs (client_id apontando para cliente soft-deleted ou inexistente)
-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

SELECT
  'H3 - proposals com client_id órfão' AS check_name,
  COUNT(*)                             AS total
FROM public.proposals p
LEFT JOIN public.clients c ON c.id = p.client_id
WHERE p.deleted_at IS NULL
  AND p.client_id IS NOT NULL
  AND (c.id IS NULL OR c.deleted_at IS NOT NULL);

-- Amostra:
SELECT p.id, p.status, p.client_name, p.client_id, c.deleted_at AS client_deleted_at
FROM public.proposals p
LEFT JOIN public.clients c ON c.id = p.client_id
WHERE p.deleted_at IS NULL
  AND p.client_id IS NOT NULL
  AND (c.id IS NULL OR c.deleted_at IS NOT NULL)
LIMIT 30;


-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
-- H4) Contratos órfãos
-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

SELECT
  'H4 - contratos com client_id órfão' AS check_name,
  COUNT(*)                             AS total
FROM public.client_contracts cc
LEFT JOIN public.clients c ON c.id = cc.client_id
WHERE c.id IS NULL OR c.deleted_at IS NOT NULL;


-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
-- H5) Billing profiles órfãos
-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

SELECT
  'H5 - billing profiles com client_id órfão' AS check_name,
  COUNT(*)                                    AS total
FROM public.client_billing_profile bp
LEFT JOIN public.clients c ON c.id = bp.client_id
WHERE c.id IS NULL OR c.deleted_at IS NOT NULL;


-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
-- H6) client_usina_config órfãs
-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

SELECT
  'H6 - client_usina_config com client_id órfão' AS check_name,
  COUNT(*)                                       AS total
FROM public.client_usina_config uc
LEFT JOIN public.clients c ON c.id = uc.client_id
WHERE c.id IS NULL OR c.deleted_at IS NOT NULL;


-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
-- H7) client_lifecycle, client_project_status, client_energy_profile órfãos
-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

SELECT 'H7a - client_lifecycle órfãos'        AS check_name, COUNT(*) AS total
FROM public.client_lifecycle lc
LEFT JOIN public.clients c ON c.id = lc.client_id
WHERE c.id IS NULL OR c.deleted_at IS NOT NULL
UNION ALL
SELECT 'H7b - client_project_status órfãos',              COUNT(*)
FROM public.client_project_status ps
LEFT JOIN public.clients c ON c.id = ps.client_id
WHERE c.id IS NULL OR c.deleted_at IS NOT NULL
UNION ALL
SELECT 'H7c - client_energy_profile órfãos',              COUNT(*)
FROM public.client_energy_profile ep
LEFT JOIN public.clients c ON c.id = ep.client_id
WHERE c.id IS NULL OR c.deleted_at IS NOT NULL
UNION ALL
SELECT 'H7d - client_notes órfãs',                        COUNT(*)
FROM public.client_notes cn
LEFT JOIN public.clients c ON c.id = cn.client_id
WHERE cn.client_id IS NOT NULL AND (c.id IS NULL OR c.deleted_at IS NOT NULL)
UNION ALL
SELECT 'H7e - contacts (CRM) órfãos',                     COUNT(*)
FROM public.contacts ct
LEFT JOIN public.clients c ON c.id = ct.client_id
WHERE c.id IS NULL OR c.deleted_at IS NOT NULL
UNION ALL
SELECT 'H7f - deals (CRM) órfãos',                        COUNT(*)
FROM public.deals dl
LEFT JOIN public.clients c ON c.id = dl.client_id
WHERE c.id IS NULL OR c.deleted_at IS NOT NULL;


-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
-- H8) Resumo geral do estado do banco após a operação
-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

SELECT
  (SELECT COUNT(*) FROM public.clients WHERE deleted_at IS NULL)                                          AS clientes_ativos,
  (SELECT COUNT(*) FROM public.clients WHERE deleted_at IS NOT NULL AND identity_status = 'merged')       AS clientes_merged,
  (SELECT COUNT(*) FROM public.clients WHERE deleted_at IS NOT NULL AND identity_status = 'rejected')     AS clientes_rejected,
  (SELECT COUNT(*) FROM public.clients WHERE deleted_at IS NULL AND NOT (coalesce(client_name,'') ~* '[A-Za-zÀ-ÖØ-öø-ÿ]')) AS invalidos_restantes,
  (SELECT COUNT(*) FROM (
    SELECT lower(regexp_replace(btrim(client_name), '\s+', ' ', 'g')) AS n
    FROM public.clients WHERE deleted_at IS NULL AND merged_into_client_id IS NULL
      AND coalesce(client_name,'') ~* '[A-Za-zÀ-ÖØ-öø-ÿ]'
    GROUP BY 1 HAVING COUNT(*) > 1
  ) t)                                                                                                     AS grupos_dup_restantes,
  (SELECT COUNT(*) FROM public.proposals WHERE deleted_at IS NULL)                                        AS proposals_ativas,
  (SELECT COUNT(*) FROM public.client_contracts WHERE contract_status IN ('active','signed'))              AS contratos_ativos,
  (SELECT COUNT(*) FROM public.client_billing_profile WHERE payment_status NOT IN ('cancelled','written_off')) AS billing_ativos,
  (SELECT COUNT(*) FROM public.client_usina_config)                                                       AS usina_configs,
  (SELECT COUNT(*) FROM data_hygiene.clients_dedup_backup WHERE backup_reason = 'invalid_name')           AS invalidos_backupados,
  (SELECT COUNT(*) FROM data_hygiene.clients_dedup_backup WHERE backup_reason = 'name_duplicate')         AS duplicados_backupados;


-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
-- H9) Clientes mergeados — confirmar que merged_into_client_id aponta para cliente ativo válido
-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

SELECT
  'H9 - merges com canônico inativo ou inválido (problema!)' AS check_name,
  COUNT(*) AS total
FROM public.clients c
WHERE c.deleted_at IS NOT NULL
  AND c.identity_status = 'merged'
  AND c.merged_into_client_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.clients canon
    WHERE canon.id = c.merged_into_client_id
      AND canon.deleted_at IS NULL
      AND coalesce(canon.client_name, '') ~* '[A-Za-zÀ-ÖØ-öø-ÿ]'
  );


-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
-- H10) Backups criados — confirmar volumes
-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

SELECT 'data_hygiene.clients_dedup_backup'                AS backup_tabela, backup_reason, COUNT(*) AS linhas
FROM data_hygiene.clients_dedup_backup GROUP BY backup_reason
UNION ALL
SELECT 'data_hygiene.proposals_dedup_backup',              backup_reason, COUNT(*)
FROM data_hygiene.proposals_dedup_backup GROUP BY backup_reason
UNION ALL
SELECT 'data_hygiene.client_contracts_dedup_backup',       backup_reason, COUNT(*)
FROM data_hygiene.client_contracts_dedup_backup GROUP BY backup_reason
UNION ALL
SELECT 'data_hygiene.client_billing_profile_dedup_backup', backup_reason, COUNT(*)
FROM data_hygiene.client_billing_profile_dedup_backup GROUP BY backup_reason
UNION ALL
SELECT 'data_hygiene.client_usina_config_dedup_backup',    backup_reason, COUNT(*)
FROM data_hygiene.client_usina_config_dedup_backup GROUP BY backup_reason
ORDER BY 1, 2;


-- ============================================================================================================================
-- FIM DO SCRIPT DE DEDUPLICAÇÃO POR NOME
-- ============================================================================================================================
-- Para REVERTER qualquer alteração feita nos BLOCOs C–G, os dados originais estão
-- preservados nas tabelas do schema data_hygiene:
--
--   data_hygiene.clients_dedup_backup
--   data_hygiene.proposals_dedup_backup
--   data_hygiene.client_contracts_dedup_backup
--   data_hygiene.client_billing_profile_dedup_backup
--   data_hygiene.client_usina_config_dedup_backup
--
-- Para restaurar um registro específico:
--   INSERT INTO public.clients
--   SELECT <colunas_sem_backed_up_at_sem_backup_reason>
--   FROM data_hygiene.clients_dedup_backup
--   WHERE id = <id_do_cliente>;
--
-- Para limpar os backups após validação completa (somente quando seguro):
--   DROP TABLE data_hygiene.clients_dedup_backup;
--   DROP TABLE data_hygiene.proposals_dedup_backup;
--   DROP TABLE data_hygiene.client_contracts_dedup_backup;
--   DROP TABLE data_hygiene.client_billing_profile_dedup_backup;
--   DROP TABLE data_hygiene.client_usina_config_dedup_backup;
--   -- Ou para remover todo o schema de hygiene (incluindo backups do sanitize_production_data.sql):
--   -- DROP SCHEMA data_hygiene CASCADE;
-- ============================================================================================================================
