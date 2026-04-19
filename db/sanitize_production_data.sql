-- =============================================================================
-- db/sanitize_production_data.sql
-- =============================================================================
-- Script de sanitização e cleanse de dados de produção.
-- Dividido em 4 blocos independentes, executáveis separadamente no
-- SQL Editor do Neon / pgAdmin / psql.
--
-- BLOCOS:
--   A — Preview / Auditoria   (somente leitura — seguro para rodar a qualquer hora)
--   B — Backup / Segurança    (cria schema data_hygiene e tabelas de backup)
--   C — Sanitização           (envolvido em BEGIN/COMMIT — troque por ROLLBACK para simular)
--   D — Relatórios pós-limpeza (somente leitura — valida o resultado final)
--
-- USO RECOMENDADO:
--   1. Execute o Bloco A e revise os resultados.
--   2. Execute o Bloco B para fazer backup dos registros que serão alterados.
--      Confirme com a query B7 que os backups estão ok.
--   3. Troque COMMIT por ROLLBACK no Bloco C, execute e valide as linhas afetadas.
--   4. Se o resultado estiver correto, troque ROLLBACK de volta por COMMIT e execute.
--   5. Execute o Bloco D para validar o resultado final.
--
-- ATENÇÃO:
--   - Execute em um ambiente de staging/preview antes de rodar em produção.
--   - O Bloco C modifica dados. Faça backup antes.
--   - As queries de backup no Bloco B devem ser executadas ANTES do Bloco C.
--
-- Schema de referência: public (tabelas: clients, client_contracts,
--   client_billing_profile, client_project_status, client_usina_config,
--   proposals, storage)
-- =============================================================================


-- =============================================================================
-- BLOCO A — PREVIEW / AUDITORIA (somente leitura)
-- =============================================================================
-- Execute cada query individualmente para revisar os dados antes de qualquer
-- alteração. Nenhuma modificação é feita neste bloco.
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- A1 — Clientes com client_name inválido
-- ─────────────────────────────────────────────────────────────────────────────
-- Detecta: NULL, vazio/whitespace, '[object Object]', sequências sem nenhuma
-- letra do alfabeto português (a-z, incluindo acentos e cedilha).
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  c.id,
  c.client_name,
  c.identity_status,
  c.deleted_at,
  c.in_portfolio,
  -- Links ativos que impedem soft-delete direto
  (SELECT COUNT(*) FROM client_contracts cc
    WHERE cc.client_id = c.id
      AND cc.contract_status NOT IN ('draft','cancelled')) AS contratos_ativos,
  (SELECT COUNT(*) FROM proposals p
    WHERE p.client_name = c.client_name
      AND p.deleted_at IS NULL
      AND p.status NOT IN ('draft','cancelled')) AS propostas_ativas
FROM clients c
WHERE c.deleted_at IS NULL
  AND (
    -- NULL ou vazio/whitespace
    c.client_name IS NULL
    OR btrim(c.client_name) = ''
    -- Placeholder literal do JavaScript
    OR c.client_name = '[object Object]'
    -- Sem nenhuma letra portuguesa (a-z, á-ü, ã, õ, ç)
    OR NOT (c.client_name ~* '[a-záéíóúàèìòùâêîôûãõç]')
  )
ORDER BY c.id;

-- ─────────────────────────────────────────────────────────────────────────────
-- A2 — Clientes com documento placeholder / inválido
-- ─────────────────────────────────────────────────────────────────────────────
-- Detecta: todos os dígitos iguais (00000000000, 11111111111...),
-- menos de 11 dígitos (CPF) ou 14 dígitos (CNPJ) após remoção de formatação,
-- campo vazio ou somente caracteres não-numéricos.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  c.id,
  c.client_name,
  c.document,
  c.cpf_raw,
  c.cnpj_raw,
  c.cpf_normalized,
  c.cnpj_normalized,
  c.identity_status,
  c.document_type,
  REGEXP_REPLACE(COALESCE(c.cpf_raw, c.document, ''), '[^0-9]', '', 'g') AS cpf_digits,
  REGEXP_REPLACE(COALESCE(c.cnpj_raw, ''), '[^0-9]', '', 'g')             AS cnpj_digits
FROM clients c
WHERE c.deleted_at IS NULL
  AND (
    -- CPF placeholder: todos os dígitos iguais ou menos de 11 dígitos
    (c.document_type = 'cpf' OR (c.document_type IS NULL AND c.cpf_raw IS NOT NULL))
    AND (
      REGEXP_REPLACE(COALESCE(c.cpf_raw, c.document, ''), '[^0-9]', '', 'g') ~ '^(\d)\1{10}$'
      OR LENGTH(REGEXP_REPLACE(COALESCE(c.cpf_raw, c.document, ''), '[^0-9]', '', 'g')) < 11
    )
  )
  OR (
    -- CNPJ placeholder: todos os dígitos iguais ou menos de 14 dígitos
    c.document_type = 'cnpj'
    AND (
      REGEXP_REPLACE(COALESCE(c.cnpj_raw, ''), '[^0-9]', '', 'g') ~ '^(\d)\1{13}$'
      OR LENGTH(REGEXP_REPLACE(COALESCE(c.cnpj_raw, ''), '[^0-9]', '', 'g')) < 14
    )
  )
ORDER BY c.id;

-- ─────────────────────────────────────────────────────────────────────────────
-- A3 — Clientes com telefone inválido
-- ─────────────────────────────────────────────────────────────────────────────
-- Detecta: '[object Object]', menos de 10 dígitos após limpeza, somente zeros
-- ou caracteres não-numéricos.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  c.id,
  c.client_name,
  c.phone,
  LENGTH(REGEXP_REPLACE(COALESCE(c.phone,''), '[^0-9]','','g')) AS phone_digit_count,
  REGEXP_REPLACE(COALESCE(c.phone,''), '[^0-9]','','g')         AS phone_digits
FROM clients c
WHERE c.deleted_at IS NULL
  AND c.phone IS NOT NULL
  AND btrim(c.phone) <> ''
  AND (
    -- Placeholder do JavaScript
    c.phone = '[object Object]'
    -- Menos de 10 dígitos (mínimo para telefone brasileiro com DDD)
    OR LENGTH(REGEXP_REPLACE(c.phone, '[^0-9]', '', 'g')) < 10
    -- Somente zeros
    OR REGEXP_REPLACE(c.phone, '[^0-9]', '', 'g') ~ '^0+$'
    -- Todos dígitos iguais (suspeito)
    OR REGEXP_REPLACE(c.phone, '[^0-9]', '', 'g') ~ '^(\d)\1{9,}$'
  )
ORDER BY c.id;

-- ─────────────────────────────────────────────────────────────────────────────
-- A4 — Duplicatas de CPF e CNPJ
-- ─────────────────────────────────────────────────────────────────────────────
-- A4a: Duplicatas por CPF normalizado (cpf_normalized)
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  c.cpf_normalized,
  COUNT(*)                                  AS total_clientes,
  ARRAY_AGG(c.id ORDER BY c.id)             AS ids,
  ARRAY_AGG(c.client_name ORDER BY c.id)    AS nomes,
  ARRAY_AGG(c.in_portfolio ORDER BY c.id)   AS em_portfolio,
  ARRAY_AGG(c.updated_at ORDER BY c.id)     AS atualizados_em,
  ARRAY_AGG(c.identity_status ORDER BY c.id) AS status_identidade
FROM clients c
WHERE c.cpf_normalized IS NOT NULL
  AND c.deleted_at IS NULL
  AND c.merged_into_client_id IS NULL
GROUP BY c.cpf_normalized
HAVING COUNT(*) > 1
ORDER BY total_clientes DESC, c.cpf_normalized;

-- A4b: Duplicatas por CNPJ normalizado (cnpj_normalized)
SELECT
  c.cnpj_normalized,
  COUNT(*)                                  AS total_clientes,
  ARRAY_AGG(c.id ORDER BY c.id)             AS ids,
  ARRAY_AGG(c.client_name ORDER BY c.id)    AS nomes,
  ARRAY_AGG(c.in_portfolio ORDER BY c.id)   AS em_portfolio,
  ARRAY_AGG(c.updated_at ORDER BY c.id)     AS atualizados_em
FROM clients c
WHERE c.cnpj_normalized IS NOT NULL
  AND c.deleted_at IS NULL
  AND c.merged_into_client_id IS NULL
GROUP BY c.cnpj_normalized
HAVING COUNT(*) > 1
ORDER BY total_clientes DESC, c.cnpj_normalized;

-- ─────────────────────────────────────────────────────────────────────────────
-- A5 — Contratos draft duplicados
-- ─────────────────────────────────────────────────────────────────────────────
-- Mesmo client_id + contract_type + contractual_term_months → provável duplicata.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  cc.client_id,
  c.client_name,
  cc.contract_type,
  cc.contractual_term_months,
  COUNT(*)                                      AS total_drafts,
  ARRAY_AGG(cc.id ORDER BY cc.id)               AS ids,
  ARRAY_AGG(cc.contract_status ORDER BY cc.id)  AS statuses,
  ARRAY_AGG(cc.created_at ORDER BY cc.id)       AS criados_em,
  ARRAY_AGG(
    CASE WHEN cc.contract_file_url IS NOT NULL OR
              jsonb_array_length(COALESCE(cc.contract_attachments_json,'[]'::jsonb)) > 0
         THEN 'sim' ELSE 'não' END
    ORDER BY cc.id
  )                                             AS tem_arquivo
FROM client_contracts cc
JOIN clients c ON c.id = cc.client_id
WHERE cc.contract_status = 'draft'
GROUP BY cc.client_id, c.client_name, cc.contract_type, cc.contractual_term_months
HAVING COUNT(*) > 1
ORDER BY total_drafts DESC, cc.client_id;

-- ─────────────────────────────────────────────────────────────────────────────
-- A6 — Contratos com expected_billing_end_date inconsistente
-- ─────────────────────────────────────────────────────────────────────────────
-- expected_billing_end_date < contract_start_date → data final antes do início.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  cc.id,
  cc.client_id,
  c.client_name,
  cc.contract_type,
  cc.contract_status,
  cc.contract_start_date,
  cc.expected_billing_end_date,
  cc.contractual_term_months,
  -- Data calculada correta (para referência)
  (cc.contract_start_date + (COALESCE(cc.contractual_term_months,0) * INTERVAL '1 month'))::DATE
    AS end_date_calculada
FROM client_contracts cc
JOIN clients c ON c.id = cc.client_id
WHERE cc.expected_billing_end_date IS NOT NULL
  AND cc.contract_start_date IS NOT NULL
  AND cc.expected_billing_end_date < cc.contract_start_date
ORDER BY cc.client_id, cc.id;

-- ─────────────────────────────────────────────────────────────────────────────
-- A7 — Billing com datas incoerentes
-- ─────────────────────────────────────────────────────────────────────────────
-- A7a: expected_last_billing_date < first_billing_date
-- A7b: first_billing_date < commissioning_date (cobrança antes da vistoria)
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  bp.id,
  bp.client_id,
  c.client_name,
  bp.first_billing_date,
  bp.expected_last_billing_date,
  bp.commissioning_date,
  bp.auto_reminder_enabled,
  bp.payment_status,
  CASE
    WHEN bp.expected_last_billing_date < bp.first_billing_date  THEN 'last < first'
    WHEN bp.first_billing_date < bp.commissioning_date          THEN 'first < commissioning'
    ELSE 'ok'
  END AS problema
FROM client_billing_profile bp
JOIN clients c ON c.id = bp.client_id
WHERE c.deleted_at IS NULL
  AND (
    (bp.expected_last_billing_date IS NOT NULL AND bp.first_billing_date IS NOT NULL
      AND bp.expected_last_billing_date < bp.first_billing_date)
    OR
    (bp.first_billing_date IS NOT NULL AND bp.commissioning_date IS NOT NULL
      AND bp.first_billing_date < bp.commissioning_date)
  )
ORDER BY bp.client_id;

-- ─────────────────────────────────────────────────────────────────────────────
-- A8 — Proposals com dados inválidos e drafts totalmente orphaned
-- ─────────────────────────────────────────────────────────────────────────────
-- A8a: Proposals com client_name, client_document ou client_email com valores lixo
SELECT
  p.id,
  p.proposal_type,
  p.status,
  p.client_name,
  p.client_document,
  p.client_email,
  p.client_phone,
  p.deleted_at,
  p.created_at,
  CASE WHEN p.client_name = '[object Object]'
            OR (p.client_name IS NOT NULL AND NOT (p.client_name ~* '[a-záéíóúàèìòùâêîôûãõç]'))
       THEN 'nome_inválido' ELSE NULL END                                                      AS nome_flag,
  CASE WHEN p.client_email IS NOT NULL
            AND p.client_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
       THEN 'email_inválido' ELSE NULL END                                                     AS email_flag,
  CASE WHEN p.client_phone IS NOT NULL
            AND LENGTH(REGEXP_REPLACE(p.client_phone,'[^0-9]','','g')) < 10
       THEN 'telefone_inválido' ELSE NULL END                                                  AS phone_flag
FROM proposals p
WHERE p.deleted_at IS NULL
  AND (
    p.client_name = '[object Object]'
    OR (p.client_name IS NOT NULL AND btrim(p.client_name) <> ''
        AND NOT (p.client_name ~* '[a-záéíóúàèìòùâêîôûãõç]'))
    OR (p.client_email IS NOT NULL AND btrim(p.client_email) <> ''
        AND p.client_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')
    OR (p.client_phone IS NOT NULL AND btrim(p.client_phone) <> ''
        AND LENGTH(REGEXP_REPLACE(p.client_phone,'[^0-9]','','g')) < 10)
  )
ORDER BY p.created_at DESC;

-- A8b: Drafts totalmente orphaned — sem client_id linkado (source_proposal_id) e sem
--      dados mínimos (sem nome, sem tipo de proposta válido, payload vazio).
SELECT
  p.id,
  p.proposal_type,
  p.status,
  p.client_name,
  p.owner_user_id,
  p.created_at,
  p.updated_at,
  jsonb_strip_nulls(p.payload_json) AS payload_resumido
FROM proposals p
WHERE p.deleted_at IS NULL
  AND p.status = 'draft'
  AND (p.client_name IS NULL OR btrim(p.client_name) = '')
  AND (p.client_document IS NULL OR btrim(p.client_document) = '')
  AND (p.client_email IS NULL OR btrim(p.client_email) = '')
  AND (p.consumption_kwh_month IS NULL)
  AND (p.system_kwp IS NULL)
  AND (p.capex_total IS NULL)
  AND (p.contract_value IS NULL)
  -- Payload praticamente vazio (≤ 2 chaves de metadados)
  AND jsonb_typeof(p.payload_json) = 'object'
  AND (SELECT COUNT(*) FROM jsonb_object_keys(jsonb_strip_nulls(p.payload_json))) <= 2
ORDER BY p.created_at;

-- ─────────────────────────────────────────────────────────────────────────────
-- A9 — client_usina_config órfãs ou quase-vazias
-- ─────────────────────────────────────────────────────────────────────────────
-- Órfãs: client_id referencia um cliente soft-deleted.
-- Quase-vazias: todos os 7 campos técnicos são NULL.
-- ─────────────────────────────────────────────────────────────────────────────
-- A9a: Usina configs cujo cliente foi soft-deleted (ON DELETE CASCADE resolve
--      automaticamente, mas podem existir registros anteriores à constraint)
SELECT
  uc.id,
  uc.client_id,
  c.client_name,
  c.deleted_at   AS cliente_deleted_at
FROM client_usina_config uc
JOIN clients c ON c.id = uc.client_id
WHERE c.deleted_at IS NOT NULL
ORDER BY uc.client_id;

-- A9b: Usina configs quase-vazias (todos os 7 campos técnicos NULL)
SELECT
  uc.id,
  uc.client_id,
  c.client_name,
  c.in_portfolio,
  c.deleted_at,
  uc.potencia_modulo_wp,
  uc.numero_modulos,
  uc.modelo_modulo,
  uc.modelo_inversor,
  uc.tipo_instalacao,
  uc.area_instalacao_m2,
  uc.geracao_estimada_kwh,
  -- Contrato ativo existente?
  (SELECT COUNT(*) FROM client_contracts cc
    WHERE cc.client_id = uc.client_id
      AND cc.contract_status IN ('active','signed')) AS contratos_ativos
FROM client_usina_config uc
JOIN clients c ON c.id = uc.client_id
WHERE c.deleted_at IS NULL
  AND uc.potencia_modulo_wp    IS NULL
  AND uc.numero_modulos        IS NULL
  AND uc.modelo_modulo         IS NULL
  AND uc.modelo_inversor       IS NULL
  AND uc.tipo_instalacao       IS NULL
  AND uc.area_instalacao_m2    IS NULL
  AND uc.geracao_estimada_kwh  IS NULL
ORDER BY c.in_portfolio DESC, uc.client_id;

-- ─────────────────────────────────────────────────────────────────────────────
-- A10 — Chaves técnicas no storage
-- ─────────────────────────────────────────────────────────────────────────────
-- Detecta: _STACK_AUTH.*, __vercel_toolbar*, clear, getItem,
-- e outras chaves de debug/framework que não deveriam estar persistidas.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  s.id,
  s.user_id,
  s.key,
  pg_size_pretty(octet_length(s.value::text)::bigint) AS value_size,
  s.updated_at
FROM storage s
WHERE s.key LIKE '_STACK_AUTH%'
   OR s.key LIKE '__vercel_toolbar%'
   OR s.key IN ('clear','getItem','setItem','removeItem','key','length')
   OR s.key LIKE '%debug%'
   OR s.key LIKE '%__test__%'
   OR s.key LIKE 'vite-%'
ORDER BY s.user_id, s.key;


-- =============================================================================
-- BLOCO B — BACKUP / SEGURANÇA
-- =============================================================================
-- Cria o schema data_hygiene e 6 tabelas de backup append-only.
-- Execute ANTES do Bloco C.
-- Os backups permitem restaurar registros alterados/removidos se necessário.
-- =============================================================================

-- Cria o schema de backup (idempotente)
CREATE SCHEMA IF NOT EXISTS data_hygiene;

-- ─────────────────────────────────────────────────────────────────────────────
-- B1 — Backup: clientes que terão client_name zerado (→ NULL)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS data_hygiene.bkp_clients_name_nulled (
  backedup_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  run_label    TEXT,
  LIKE public.clients
);

INSERT INTO data_hygiene.bkp_clients_name_nulled
SELECT now(), 'sanitize_run_' || TO_CHAR(now(),'YYYYMMDD_HH24MI'), c.*
FROM clients c
WHERE c.deleted_at IS NULL
  AND (
    c.client_name IS NULL
    OR btrim(c.client_name) = ''
    OR c.client_name = '[object Object]'
    OR NOT (c.client_name ~* '[a-záéíóúàèìòùâêîôûãõç]')
  )
  -- Tem ao menos um vínculo ativo (não pode ser soft-deleted diretamente)
  AND (
    c.in_portfolio = true
    OR EXISTS (
      SELECT 1 FROM client_contracts cc
      WHERE cc.client_id = c.id
        AND cc.contract_status NOT IN ('draft','cancelled')
    )
    OR EXISTS (
      SELECT 1 FROM proposals p
      WHERE p.deleted_at IS NULL
        AND p.status NOT IN ('draft','cancelled')
        AND p.owner_user_id = c.owner_user_id
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- B2 — Backup: clientes que serão soft-deleted (sem vínculo ativo + nome inválido)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS data_hygiene.bkp_clients_soft_deleted (
  backedup_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  run_label    TEXT,
  LIKE public.clients
);

INSERT INTO data_hygiene.bkp_clients_soft_deleted
SELECT now(), 'sanitize_run_' || TO_CHAR(now(),'YYYYMMDD_HH24MI'), c.*
FROM clients c
WHERE c.deleted_at IS NULL
  AND (
    c.client_name IS NULL
    OR btrim(c.client_name) = ''
    OR c.client_name = '[object Object]'
    OR NOT (c.client_name ~* '[a-záéíóúàèìòùâêîôûãõç]')
  )
  AND c.in_portfolio = false
  AND NOT EXISTS (
    SELECT 1 FROM client_contracts cc
    WHERE cc.client_id = c.id
      AND cc.contract_status NOT IN ('draft','cancelled')
  )
  AND NOT EXISTS (
    SELECT 1 FROM proposals p
    WHERE p.deleted_at IS NULL
      AND p.status NOT IN ('draft','cancelled')
      AND p.owner_user_id = c.owner_user_id
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- B3 — Backup: contratos draft que serão cancelados (duplicatas)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS data_hygiene.bkp_contracts_drafts_cancelled (
  backedup_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  run_label    TEXT,
  LIKE public.client_contracts
);

INSERT INTO data_hygiene.bkp_contracts_drafts_cancelled
SELECT now(), 'sanitize_run_' || TO_CHAR(now(),'YYYYMMDD_HH24MI'), cc.*
FROM client_contracts cc
WHERE cc.contract_status = 'draft'
  -- É duplicata: existe outro draft com mesmo client_id + type + prazo
  AND EXISTS (
    SELECT 1
    FROM client_contracts cc2
    WHERE cc2.client_id            = cc.client_id
      AND cc2.contract_type        = cc.contract_type
      AND COALESCE(cc2.contractual_term_months,-1) = COALESCE(cc.contractual_term_months,-1)
      AND cc2.id < cc.id          -- Mantém o de menor id (mais antigo); remove os mais novos
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- B4 — Backup: registros de billing que serão atualizados
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS data_hygiene.bkp_billing_updated (
  backedup_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  run_label    TEXT,
  LIKE public.client_billing_profile
);

INSERT INTO data_hygiene.bkp_billing_updated
SELECT now(), 'sanitize_run_' || TO_CHAR(now(),'YYYYMMDD_HH24MI'), bp.*
FROM client_billing_profile bp
JOIN clients c ON c.id = bp.client_id
WHERE c.deleted_at IS NULL
  AND (
    -- expected_last_billing_date incoerente
    (bp.expected_last_billing_date IS NOT NULL AND bp.first_billing_date IS NOT NULL
      AND bp.expected_last_billing_date < bp.first_billing_date)
    -- first_billing_date anterior ao comissionamento
    OR (bp.first_billing_date IS NOT NULL AND bp.commissioning_date IS NOT NULL
      AND bp.first_billing_date < bp.commissioning_date)
    -- auto_reminder_enabled desligado indevidamente
    OR bp.auto_reminder_enabled = false
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- B5 — Backup: proposals que serão alteradas (campos normalizados ou soft-deleted)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS data_hygiene.bkp_proposals_modified (
  backedup_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  run_label    TEXT,
  LIKE public.proposals
);

INSERT INTO data_hygiene.bkp_proposals_modified
SELECT now(), 'sanitize_run_' || TO_CHAR(now(),'YYYYMMDD_HH24MI'), p.*
FROM proposals p
WHERE p.deleted_at IS NULL
  AND (
    -- client_name com valor lixo
    p.client_name = '[object Object]'
    OR (p.client_name IS NOT NULL AND btrim(p.client_name) <> ''
        AND NOT (p.client_name ~* '[a-záéíóúàèìòùâêîôûãõç]'))
    -- client_email inválido
    OR (p.client_email IS NOT NULL AND btrim(p.client_email) <> ''
        AND p.client_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')
    -- client_phone inválido
    OR (p.client_phone IS NOT NULL AND btrim(p.client_phone) <> ''
        AND LENGTH(REGEXP_REPLACE(p.client_phone,'[^0-9]','','g')) < 10)
    -- Draft totalmente vazio (candidato a soft-delete)
    OR (
      p.status = 'draft'
      AND (p.client_name IS NULL OR btrim(p.client_name) = '')
      AND (p.client_document IS NULL OR btrim(p.client_document) = '')
      AND p.consumption_kwh_month IS NULL
      AND p.system_kwp IS NULL
      AND p.capex_total IS NULL
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- B6 — Backup: chaves técnicas do storage que serão removidas
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS data_hygiene.bkp_storage_technical_keys (
  backedup_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  run_label    TEXT,
  LIKE public.storage
);

INSERT INTO data_hygiene.bkp_storage_technical_keys
SELECT now(), 'sanitize_run_' || TO_CHAR(now(),'YYYYMMDD_HH24MI'), s.*
FROM storage s
WHERE s.key LIKE '_STACK_AUTH%'
   OR s.key LIKE '__vercel_toolbar%'
   OR s.key IN ('clear','getItem','setItem','removeItem','key','length')
   OR s.key LIKE '%debug%'
   OR s.key LIKE '%__test__%'
   OR s.key LIKE 'vite-%';

-- ─────────────────────────────────────────────────────────────────────────────
-- B7 — Confirmação: quantas linhas foram backupadas por tabela
-- ─────────────────────────────────────────────────────────────────────────────
SELECT 'bkp_clients_name_nulled'        AS tabela, COUNT(*) AS linhas FROM data_hygiene.bkp_clients_name_nulled
UNION ALL
SELECT 'bkp_clients_soft_deleted',               COUNT(*) FROM data_hygiene.bkp_clients_soft_deleted
UNION ALL
SELECT 'bkp_contracts_drafts_cancelled',          COUNT(*) FROM data_hygiene.bkp_contracts_drafts_cancelled
UNION ALL
SELECT 'bkp_billing_updated',                     COUNT(*) FROM data_hygiene.bkp_billing_updated
UNION ALL
SELECT 'bkp_proposals_modified',                  COUNT(*) FROM data_hygiene.bkp_proposals_modified
UNION ALL
SELECT 'bkp_storage_technical_keys',              COUNT(*) FROM data_hygiene.bkp_storage_technical_keys
ORDER BY tabela;


-- =============================================================================
-- BLOCO C — SANITIZAÇÃO
-- =============================================================================
-- ATENÇÃO: Este bloco modifica dados em produção.
-- Execute o Bloco B (backup) antes.
-- Para simular sem alterar: troque COMMIT por ROLLBACK ao final.
-- =============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- C1a — client_name inválido → NULL (clientes com vínculos ativos)
-- ─────────────────────────────────────────────────────────────────────────────
-- Preserva o registro mas limpa o nome para revisão manual posterior.
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE clients c
SET
  client_name = NULL,
  updated_at  = now()
WHERE c.deleted_at IS NULL
  AND (
    c.client_name = '[object Object]'
    OR (c.client_name IS NOT NULL AND btrim(c.client_name) = '')
    OR (c.client_name IS NOT NULL AND NOT (c.client_name ~* '[a-záéíóúàèìòùâêîôûãõç]'))
  )
  AND (
    c.in_portfolio = true
    OR EXISTS (
      SELECT 1 FROM client_contracts cc
      WHERE cc.client_id = c.id
        AND cc.contract_status NOT IN ('draft','cancelled')
    )
    OR EXISTS (
      SELECT 1 FROM proposals p
      WHERE p.deleted_at IS NULL
        AND p.status NOT IN ('draft','cancelled')
        AND p.owner_user_id = c.owner_user_id
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- C1b — Cliente totalmente inválido sem vínculo ativo → soft-delete
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE clients c
SET
  deleted_at = now(),
  updated_at = now()
WHERE c.deleted_at IS NULL
  AND (
    c.client_name IS NULL
    OR btrim(c.client_name) = ''
    OR c.client_name = '[object Object]'
    OR NOT (c.client_name ~* '[a-záéíóúàèìòùâêîôûãõç]')
  )
  AND c.in_portfolio = false
  AND NOT EXISTS (
    SELECT 1 FROM client_contracts cc
    WHERE cc.client_id = c.id
      AND cc.contract_status NOT IN ('draft','cancelled')
  )
  AND NOT EXISTS (
    SELECT 1 FROM proposals p
    WHERE p.deleted_at IS NULL
      AND p.status NOT IN ('draft','cancelled')
      AND p.owner_user_id = c.owner_user_id
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- C1c — Documento placeholder → NULL; rebaixa identity_status para pending_cpf/pending_cnpj
-- ─────────────────────────────────────────────────────────────────────────────
-- CPF placeholder
UPDATE clients c
SET
  document        = NULL,
  cpf_raw         = NULL,
  cpf_normalized  = NULL,
  identity_status = CASE
    WHEN c.identity_status = 'confirmed' THEN 'pending_cpf'
    ELSE c.identity_status
  END,
  updated_at      = now()
WHERE c.deleted_at IS NULL
  AND (c.document_type = 'cpf' OR c.document_type IS NULL)
  AND (
    REGEXP_REPLACE(COALESCE(c.cpf_raw, c.document, ''), '[^0-9]', '', 'g') ~ '^(\d)\1{10}$'
    OR LENGTH(REGEXP_REPLACE(COALESCE(c.cpf_raw, c.document, ''), '[^0-9]', '', 'g')) < 11
  )
  AND (c.cpf_raw IS NOT NULL OR (c.document_type IS NULL AND c.document IS NOT NULL));

-- CNPJ placeholder
UPDATE clients c
SET
  cnpj_raw        = NULL,
  cnpj_normalized = NULL,
  identity_status = CASE
    WHEN c.identity_status = 'confirmed' THEN 'pending_cpf'
    ELSE c.identity_status
  END,
  updated_at      = now()
WHERE c.deleted_at IS NULL
  AND c.document_type = 'cnpj'
  AND (
    REGEXP_REPLACE(COALESCE(c.cnpj_raw, ''), '[^0-9]', '', 'g') ~ '^(\d)\1{13}$'
    OR LENGTH(REGEXP_REPLACE(COALESCE(c.cnpj_raw, ''), '[^0-9]', '', 'g')) < 14
  )
  AND c.cnpj_raw IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- C1d — Telefone inválido → NULL
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE clients c
SET
  phone      = NULL,
  updated_at = now()
WHERE c.deleted_at IS NULL
  AND c.phone IS NOT NULL
  AND btrim(c.phone) <> ''
  AND (
    c.phone = '[object Object]'
    OR LENGTH(REGEXP_REPLACE(c.phone, '[^0-9]', '', 'g')) < 10
    OR REGEXP_REPLACE(c.phone, '[^0-9]', '', 'g') ~ '^0+$'
    OR REGEXP_REPLACE(c.phone, '[^0-9]', '', 'g') ~ '^(\d)\1{9,}$'
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- C1e — Email inválido → NULL
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE clients c
SET
  email      = NULL,
  updated_at = now()
WHERE c.deleted_at IS NULL
  AND c.email IS NOT NULL
  AND btrim(c.email) <> ''
  AND c.email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$';

-- ─────────────────────────────────────────────────────────────────────────────
-- C1f — Deduplicação CPF: soft-delete dos perdedores
-- ─────────────────────────────────────────────────────────────────────────────
-- Critério de vencedor: in_portfolio DESC → updated_at DESC → id DESC (maior id)
-- Perdedor: recebe deleted_at + merged_into_client_id do vencedor
-- ─────────────────────────────────────────────────────────────────────────────
WITH cpf_ranked AS (
  SELECT
    id,
    cpf_normalized,
    ROW_NUMBER() OVER (
      PARTITION BY cpf_normalized
      ORDER BY
        in_portfolio DESC,
        updated_at   DESC,
        id           DESC
    ) AS rn,
    FIRST_VALUE(id) OVER (
      PARTITION BY cpf_normalized
      ORDER BY
        in_portfolio DESC,
        updated_at   DESC,
        id           DESC
    ) AS winner_id
  FROM clients
  WHERE cpf_normalized IS NOT NULL
    AND deleted_at IS NULL
    AND merged_into_client_id IS NULL
)
UPDATE clients c
SET
  deleted_at            = now(),
  merged_into_client_id = cpf_ranked.winner_id,
  identity_status       = 'merged',
  updated_at            = now()
FROM cpf_ranked
WHERE cpf_ranked.id = c.id
  AND cpf_ranked.rn > 1;

-- ─────────────────────────────────────────────────────────────────────────────
-- C1g — Deduplicação CNPJ: soft-delete dos perdedores
-- ─────────────────────────────────────────────────────────────────────────────
WITH cnpj_ranked AS (
  SELECT
    id,
    cnpj_normalized,
    ROW_NUMBER() OVER (
      PARTITION BY cnpj_normalized
      ORDER BY
        in_portfolio DESC,
        updated_at   DESC,
        id           DESC
    ) AS rn,
    FIRST_VALUE(id) OVER (
      PARTITION BY cnpj_normalized
      ORDER BY
        in_portfolio DESC,
        updated_at   DESC,
        id           DESC
    ) AS winner_id
  FROM clients
  WHERE cnpj_normalized IS NOT NULL
    AND deleted_at IS NULL
    AND merged_into_client_id IS NULL
)
UPDATE clients c
SET
  deleted_at            = now(),
  merged_into_client_id = cnpj_ranked.winner_id,
  identity_status       = 'merged',
  updated_at            = now()
FROM cnpj_ranked
WHERE cnpj_ranked.id = c.id
  AND cnpj_ranked.rn > 1;

-- ─────────────────────────────────────────────────────────────────────────────
-- C2a — Cancela contratos draft duplicados
-- ─────────────────────────────────────────────────────────────────────────────
-- Mantém o draft mais antigo (menor id) ou o que tem arquivo, cancela os demais.
-- Estratégia: vencedor = menor id COM arquivo (se houver), ou menor id sem arquivo.
-- ─────────────────────────────────────────────────────────────────────────────
WITH draft_ranked AS (
  SELECT
    cc.id,
    cc.client_id,
    cc.contract_type,
    cc.contractual_term_months,
    ROW_NUMBER() OVER (
      PARTITION BY cc.client_id, cc.contract_type,
                   COALESCE(cc.contractual_term_months, -1)
      ORDER BY
        -- Prefere o draft com arquivo anexado
        CASE WHEN cc.contract_file_url IS NOT NULL
                  OR jsonb_array_length(COALESCE(cc.contract_attachments_json,'[]'::jsonb)) > 0
             THEN 0 ELSE 1 END ASC,
        cc.id ASC
    ) AS rn
  FROM client_contracts cc
  WHERE cc.contract_status = 'draft'
)
UPDATE client_contracts cc
SET
  contract_status = 'cancelled',
  updated_at      = now(),
  notes           = COALESCE(cc.notes || ' | ', '') ||
                    '[sanitize] Draft duplicado cancelado automaticamente em ' ||
                    TO_CHAR(now(), 'YYYY-MM-DD')
FROM draft_ranked
WHERE draft_ranked.id = cc.id
  AND draft_ranked.rn > 1;

-- ─────────────────────────────────────────────────────────────────────────────
-- C2b — Recalcula expected_billing_end_date incoerente em contratos
-- ─────────────────────────────────────────────────────────────────────────────
-- Quando expected_billing_end_date < contract_start_date, recalcula usando
-- contract_start_date + contractual_term_months.
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE client_contracts cc
SET
  expected_billing_end_date =
    (cc.contract_start_date +
     (COALESCE(cc.contractual_term_months, 0) * INTERVAL '1 month'))::DATE,
  updated_at = now()
WHERE cc.expected_billing_end_date IS NOT NULL
  AND cc.contract_start_date IS NOT NULL
  AND cc.expected_billing_end_date < cc.contract_start_date
  AND cc.contractual_term_months IS NOT NULL
  AND cc.contractual_term_months > 0;

-- ─────────────────────────────────────────────────────────────────────────────
-- C2d — Corrige buyout_eligible = true em contratos leasing ativos/assinados
-- ─────────────────────────────────────────────────────────────────────────────
-- Contratos de leasing que estão 'active' ou 'signed' deveriam ter
-- buyout_eligible = true para permitir resgate antecipado.
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE client_contracts cc
SET
  buyout_eligible = true,
  updated_at      = now()
WHERE cc.contract_type   = 'leasing'
  AND cc.contract_status IN ('active','signed')
  AND cc.buyout_eligible = false;

-- ─────────────────────────────────────────────────────────────────────────────
-- C3a — Billing: recalcula expected_last_billing_date quando < first_billing_date
-- ─────────────────────────────────────────────────────────────────────────────
-- Usa contractual_term_months do contrato vinculado (se existir) ou do próprio billing.
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE client_billing_profile bp
SET
  expected_last_billing_date =
    (bp.first_billing_date +
     (COALESCE(cc.contractual_term_months, 0) * INTERVAL '1 month') - INTERVAL '1 month')::DATE,
  updated_at = now()
FROM client_contracts cc
WHERE bp.contract_id = cc.id
  AND bp.first_billing_date IS NOT NULL
  AND bp.expected_last_billing_date IS NOT NULL
  AND bp.expected_last_billing_date < bp.first_billing_date
  AND cc.contractual_term_months IS NOT NULL
  AND cc.contractual_term_months > 0;

-- Para billing sem contrato vinculado mas com datas incoerentes — mantém como NULL
-- (melhor que uma data errada; será preenchida manualmente)
UPDATE client_billing_profile bp
SET
  expected_last_billing_date = NULL,
  updated_at                 = now()
WHERE bp.contract_id IS NULL
  AND bp.first_billing_date IS NOT NULL
  AND bp.expected_last_billing_date IS NOT NULL
  AND bp.expected_last_billing_date < bp.first_billing_date;

-- ─────────────────────────────────────────────────────────────────────────────
-- C3b — Billing: alinha first_billing_date ao commissioning_date
-- ─────────────────────────────────────────────────────────────────────────────
-- Se first_billing_date < commissioning_date, a cobrança começa antes da vistoria.
-- Corrige: first_billing_date = commissioning_date (início do mês do commissioning).
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE client_billing_profile bp
SET
  first_billing_date = bp.commissioning_date,
  updated_at         = now()
WHERE bp.first_billing_date IS NOT NULL
  AND bp.commissioning_date IS NOT NULL
  AND bp.first_billing_date < bp.commissioning_date;

-- ─────────────────────────────────────────────────────────────────────────────
-- C3c — Billing: garante auto_reminder_enabled = true para clientes ativos
-- ─────────────────────────────────────────────────────────────────────────────
-- Clientes com contrato ativo/assinado deveriam ter lembretes automáticos ativos.
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE client_billing_profile bp
SET
  auto_reminder_enabled = true,
  updated_at            = now()
WHERE bp.auto_reminder_enabled = false
  AND bp.payment_status NOT IN ('cancelled','written_off')
  AND EXISTS (
    SELECT 1 FROM client_contracts cc
    WHERE cc.id = bp.contract_id
      AND cc.contract_status IN ('active','signed')
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- C3d — Billing: recalcula expected_last_billing_date após alinhamento do first_billing
-- ─────────────────────────────────────────────────────────────────────────────
-- Após C3b, o first_billing_date pode ter mudado; recalcula o expected_last.
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE client_billing_profile bp
SET
  expected_last_billing_date =
    (bp.first_billing_date +
     (COALESCE(cc.contractual_term_months, 0) * INTERVAL '1 month') - INTERVAL '1 month')::DATE,
  updated_at = now()
FROM client_contracts cc
WHERE bp.contract_id = cc.id
  AND bp.first_billing_date IS NOT NULL
  AND cc.contractual_term_months IS NOT NULL
  AND cc.contractual_term_months > 0
  -- Recalcula apenas se expected ainda está inconsistente após C3a
  AND (
    bp.expected_last_billing_date IS NULL
    OR bp.expected_last_billing_date < bp.first_billing_date
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- C4a — Remove client_usina_config órfãs (cliente soft-deleted)
-- ─────────────────────────────────────────────────────────────────────────────
-- ON DELETE CASCADE já cuida disso automaticamente em novos deletes,
-- mas registros pré-constraint podem ter ficado órfãos.
-- ─────────────────────────────────────────────────────────────────────────────
DELETE FROM client_usina_config uc
USING clients c
WHERE uc.client_id = c.id
  AND c.deleted_at IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- C4b — Remove client_usina_config quase-vazias sem portfólio nem contrato ativo
-- ─────────────────────────────────────────────────────────────────────────────
-- Remove apenas se: todos os 7 campos técnicos são NULL E o cliente
-- não está no portfólio E não tem contrato ativo/assinado.
-- ─────────────────────────────────────────────────────────────────────────────
DELETE FROM client_usina_config uc
USING clients c
WHERE uc.client_id = c.id
  AND c.deleted_at IS NULL
  AND c.in_portfolio = false
  AND uc.potencia_modulo_wp   IS NULL
  AND uc.numero_modulos       IS NULL
  AND uc.modelo_modulo        IS NULL
  AND uc.modelo_inversor      IS NULL
  AND uc.tipo_instalacao      IS NULL
  AND uc.area_instalacao_m2   IS NULL
  AND uc.geracao_estimada_kwh IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM client_contracts cc
    WHERE cc.client_id = uc.client_id
      AND cc.contract_status IN ('active','signed')
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- C5a — Proposals: normaliza client_name inválido → NULL
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE proposals p
SET
  client_name = NULL,
  updated_at  = now()
WHERE p.deleted_at IS NULL
  AND p.client_name IS NOT NULL
  AND (
    p.client_name = '[object Object]'
    OR (btrim(p.client_name) = '')
    OR NOT (p.client_name ~* '[a-záéíóúàèìòùâêîôûãõç]')
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- C5b — Proposals: normaliza client_document inválido → NULL
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE proposals p
SET
  client_document = NULL,
  updated_at      = now()
WHERE p.deleted_at IS NULL
  AND p.client_document IS NOT NULL
  AND btrim(p.client_document) <> ''
  AND (
    -- Todos dígitos iguais (placeholder)
    REGEXP_REPLACE(p.client_document, '[^0-9]', '', 'g') ~ '^(\d)\1{10,}$'
    -- Muito poucos dígitos para ser CPF ou CNPJ
    OR LENGTH(REGEXP_REPLACE(p.client_document, '[^0-9]', '', 'g')) < 11
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- C5c — Proposals: normaliza client_email inválido → NULL
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE proposals p
SET
  client_email = NULL,
  updated_at   = now()
WHERE p.deleted_at IS NULL
  AND p.client_email IS NOT NULL
  AND btrim(p.client_email) <> ''
  AND p.client_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$';

-- ─────────────────────────────────────────────────────────────────────────────
-- C5d — Proposals: normaliza client_phone inválido → NULL
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE proposals p
SET
  client_phone = NULL,
  updated_at   = now()
WHERE p.deleted_at IS NULL
  AND p.client_phone IS NOT NULL
  AND btrim(p.client_phone) <> ''
  AND (
    p.client_phone = '[object Object]'
    OR LENGTH(REGEXP_REPLACE(p.client_phone, '[^0-9]', '', 'g')) < 10
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- C5e — Proposals: soft-delete de drafts totalmente vazios
-- ─────────────────────────────────────────────────────────────────────────────
-- Apenas drafts sem nome, sem documento, sem consumo, sem valor e payload
-- praticamente vazio (≤ 2 chaves não-nulas). Estes são registros fantasma
-- gerados por criações abortadas no frontend.
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE proposals p
SET
  deleted_at = now(),
  updated_at = now()
WHERE p.deleted_at IS NULL
  AND p.status = 'draft'
  AND (p.client_name IS NULL OR btrim(p.client_name) = '')
  AND (p.client_document IS NULL OR btrim(p.client_document) = '')
  AND (p.client_email IS NULL OR btrim(p.client_email) = '')
  AND p.consumption_kwh_month IS NULL
  AND p.system_kwp IS NULL
  AND p.capex_total IS NULL
  AND p.contract_value IS NULL
  AND jsonb_typeof(p.payload_json) = 'object'
  AND (SELECT COUNT(*) FROM jsonb_object_keys(jsonb_strip_nulls(p.payload_json))) <= 2;

-- ─────────────────────────────────────────────────────────────────────────────
-- C5f — Proposals: sinaliza conflituosas com identity_status = 'conflict'
-- ─────────────────────────────────────────────────────────────────────────────
-- Proposals sent/approved para clientes que foram marcados como 'merged' ou
-- 'conflict' precisam de revisão manual. Adiciona nota no payload_json.
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE proposals p
SET
  payload_json = jsonb_set(
    COALESCE(p.payload_json, '{}'::jsonb),
    '{_sanitize_conflict_flag}',
    to_jsonb('revisão_manual_necessária — cliente origem mesclado em ' || TO_CHAR(now(),'YYYY-MM-DD'))
  ),
  updated_at = now()
WHERE p.deleted_at IS NULL
  AND p.status IN ('sent','approved')
  AND p.owner_user_id IN (
    SELECT owner_user_id FROM clients
    WHERE identity_status IN ('merged','conflict')
      AND deleted_at IS NOT NULL
  )
  AND NOT (p.payload_json ? '_sanitize_conflict_flag');

-- ─────────────────────────────────────────────────────────────────────────────
-- C6 — Remove chaves técnicas do storage
-- ─────────────────────────────────────────────────────────────────────────────
-- Estas chaves foram geradas por vazamentos de estado do framework/autenticação.
-- Backupadas em B6 antes da remoção.
-- ─────────────────────────────────────────────────────────────────────────────
DELETE FROM storage s
WHERE s.key LIKE '_STACK_AUTH%'
   OR s.key LIKE '__vercel_toolbar%'
   OR s.key IN ('clear','getItem','setItem','removeItem','key','length')
   OR s.key LIKE '%debug%'
   OR s.key LIKE '%__test__%'
   OR s.key LIKE 'vite-%';

-- =============================================================================
-- ↓↓↓  ATENÇÃO: troque COMMIT por ROLLBACK na linha abaixo para simular  ↓↓↓
--       sem persistir nenhuma alteração (dry-run / modo simulação).
-- =============================================================================
COMMIT;  -- ← Troque por ROLLBACK para dry-run


-- =============================================================================
-- BLOCO D — RELATÓRIOS PÓS-LIMPEZA
-- =============================================================================
-- Execute após o Bloco C para validar que o resultado final está correto.
-- Nenhuma modificação é feita neste bloco.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- D1 — Contagem de clientes com client_name ainda inválido
-- ─────────────────────────────────────────────────────────────────────────────
-- Esperado: clientes restantes com nome NULL devem ser apenas os que têm
-- vínculos ativos (aguardando revisão manual).
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  'clientes_nome_null_com_portfolio'   AS categoria,
  COUNT(*) AS total
FROM clients
WHERE deleted_at IS NULL AND client_name IS NULL AND in_portfolio = true
UNION ALL
SELECT
  'clientes_nome_null_sem_portfolio',
  COUNT(*)
FROM clients
WHERE deleted_at IS NULL AND client_name IS NULL AND in_portfolio = false
UNION ALL
SELECT
  'clientes_nome_invalido_restantes',
  COUNT(*)
FROM clients
WHERE deleted_at IS NULL
  AND client_name IS NOT NULL
  AND NOT (client_name ~* '[a-záéíóúàèìòùâêîôûãõç]')
ORDER BY categoria;

-- ─────────────────────────────────────────────────────────────────────────────
-- D2 — Duplicatas de CPF/CNPJ restantes
-- ─────────────────────────────────────────────────────────────────────────────
-- Esperado: 0 duplicatas ativas.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  'duplicatas_cpf_ativas' AS categoria,
  COUNT(*) AS grupos_com_duplicata
FROM (
  SELECT cpf_normalized
  FROM clients
  WHERE cpf_normalized IS NOT NULL
    AND deleted_at IS NULL
    AND merged_into_client_id IS NULL
  GROUP BY cpf_normalized
  HAVING COUNT(*) > 1
) AS dup_cpf
UNION ALL
SELECT
  'duplicatas_cnpj_ativas',
  COUNT(*)
FROM (
  SELECT cnpj_normalized
  FROM clients
  WHERE cnpj_normalized IS NOT NULL
    AND deleted_at IS NULL
    AND merged_into_client_id IS NULL
  GROUP BY cnpj_normalized
  HAVING COUNT(*) > 1
) AS dup_cnpj
ORDER BY categoria;

-- ─────────────────────────────────────────────────────────────────────────────
-- D3 — Contratos draft duplicados restantes
-- ─────────────────────────────────────────────────────────────────────────────
-- Esperado: 0 grupos de drafts duplicados.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  COUNT(*) AS grupos_com_draft_duplicado
FROM (
  SELECT client_id, contract_type, COALESCE(contractual_term_months,-1)
  FROM client_contracts
  WHERE contract_status = 'draft'
  GROUP BY client_id, contract_type, COALESCE(contractual_term_months,-1)
  HAVING COUNT(*) > 1
) AS drafts_dup;

-- ─────────────────────────────────────────────────────────────────────────────
-- D4 — Contratos com expected_billing_end_date ainda inconsistente
-- ─────────────────────────────────────────────────────────────────────────────
-- Esperado: 0. Contratos sem contractual_term_months não puderam ser corrigidos
-- automaticamente e aparecem aqui para revisão manual.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  cc.id,
  cc.client_id,
  c.client_name,
  cc.contract_type,
  cc.contract_status,
  cc.contract_start_date,
  cc.expected_billing_end_date,
  cc.contractual_term_months,
  'Requer revisão manual — sem contractual_term_months para recalcular' AS observacao
FROM client_contracts cc
JOIN clients c ON c.id = cc.client_id
WHERE cc.expected_billing_end_date IS NOT NULL
  AND cc.contract_start_date IS NOT NULL
  AND cc.expected_billing_end_date < cc.contract_start_date
ORDER BY cc.client_id;

-- ─────────────────────────────────────────────────────────────────────────────
-- D5 — Billing com datas ainda inconsistentes
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  COUNT(*) FILTER (WHERE bp.expected_last_billing_date < bp.first_billing_date) AS last_menor_que_first,
  COUNT(*) FILTER (WHERE bp.first_billing_date < bp.commissioning_date)          AS first_antes_comissionamento,
  COUNT(*) FILTER (WHERE bp.auto_reminder_enabled = false
                     AND bp.payment_status NOT IN ('cancelled','written_off'))   AS reminder_desligado_indevidamente
FROM client_billing_profile bp
JOIN clients c ON c.id = bp.client_id
WHERE c.deleted_at IS NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- D6 — client_usina_config quase-vazias restantes
-- ─────────────────────────────────────────────────────────────────────────────
-- As que restaram são de clientes em portfólio ou com contratos ativos
-- (mantidas intencionalmente para revisão manual).
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  c.in_portfolio,
  COUNT(*) AS usinas_quasi_vazias
FROM client_usina_config uc
JOIN clients c ON c.id = uc.client_id
WHERE c.deleted_at IS NULL
  AND uc.potencia_modulo_wp   IS NULL
  AND uc.numero_modulos       IS NULL
  AND uc.modelo_modulo        IS NULL
  AND uc.modelo_inversor      IS NULL
  AND uc.tipo_instalacao      IS NULL
  AND uc.area_instalacao_m2   IS NULL
  AND uc.geracao_estimada_kwh IS NULL
GROUP BY c.in_portfolio
ORDER BY c.in_portfolio DESC;

-- ─────────────────────────────────────────────────────────────────────────────
-- D7 — Proposals com dados inválidos restantes
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  COUNT(*) FILTER (WHERE p.client_name = '[object Object]'
                      OR (p.client_name IS NOT NULL AND NOT (p.client_name ~* '[a-záéíóúàèìòùâêîôûãõç]')))
    AS proposals_nome_invalido,
  COUNT(*) FILTER (WHERE p.client_email IS NOT NULL AND btrim(p.client_email) <> ''
                      AND p.client_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')
    AS proposals_email_invalido,
  COUNT(*) FILTER (WHERE p.client_phone IS NOT NULL AND btrim(p.client_phone) <> ''
                      AND LENGTH(REGEXP_REPLACE(p.client_phone,'[^0-9]','','g')) < 10)
    AS proposals_phone_invalido,
  COUNT(*) FILTER (WHERE p.status = 'draft'
                      AND (p.client_name IS NULL OR btrim(p.client_name) = '')
                      AND (p.client_document IS NULL OR btrim(p.client_document) = '')
                      AND p.consumption_kwh_month IS NULL AND p.system_kwp IS NULL)
    AS proposals_draft_vazios
FROM proposals p
WHERE p.deleted_at IS NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- D8 — Chaves técnicas restantes no storage
-- ─────────────────────────────────────────────────────────────────────────────
-- Esperado: 0.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT COUNT(*) AS chaves_tecnicas_restantes
FROM storage s
WHERE s.key LIKE '_STACK_AUTH%'
   OR s.key LIKE '__vercel_toolbar%'
   OR s.key IN ('clear','getItem','setItem','removeItem','key','length')
   OR s.key LIKE '%debug%'
   OR s.key LIKE '%__test__%'
   OR s.key LIKE 'vite-%';

-- ─────────────────────────────────────────────────────────────────────────────
-- D9 — Resumo geral pós-limpeza
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  (SELECT COUNT(*) FROM clients WHERE deleted_at IS NULL)                                     AS clientes_ativos,
  (SELECT COUNT(*) FROM clients WHERE deleted_at IS NOT NULL)                                 AS clientes_soft_deleted,
  (SELECT COUNT(*) FROM clients WHERE in_portfolio = true AND deleted_at IS NULL)             AS clientes_em_portfolio,
  (SELECT COUNT(*) FROM client_contracts WHERE contract_status IN ('active','signed'))        AS contratos_ativos_assinados,
  (SELECT COUNT(*) FROM client_contracts WHERE contract_status = 'draft')                    AS contratos_draft,
  (SELECT COUNT(*) FROM proposals WHERE deleted_at IS NULL AND status NOT IN ('draft'))       AS proposals_ativas,
  (SELECT COUNT(*) FROM proposals WHERE deleted_at IS NULL AND status = 'draft')              AS proposals_draft,
  (SELECT COUNT(*) FROM storage)                                                              AS storage_total_chaves;

-- ─────────────────────────────────────────────────────────────────────────────
-- D10 — Lista de clientes que precisam de revisão manual (nome NULL + vínculo ativo)
-- ─────────────────────────────────────────────────────────────────────────────
-- Estes clientes tiveram o nome zerado (C1a) porque têm vínculos ativos.
-- Devem ser revisados e o nome correto deve ser inserido manualmente.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  c.id,
  c.identity_status,
  c.in_portfolio,
  c.email,
  c.phone,
  c.city,
  c.state,
  c.owner_user_id,
  c.updated_at,
  -- Contexto dos vínculos para ajudar na identificação do cliente
  (SELECT MAX(p.client_name)
    FROM proposals p
    WHERE p.owner_user_id = c.owner_user_id
      AND p.client_name IS NOT NULL
      AND p.deleted_at IS NULL
    LIMIT 1)                                                             AS nome_na_proposta,
  (SELECT COUNT(*) FROM client_contracts cc
    WHERE cc.client_id = c.id
      AND cc.contract_status IN ('active','signed'))                     AS contratos_ativos,
  (SELECT COUNT(*) FROM proposals p
    WHERE p.owner_user_id = c.owner_user_id
      AND p.status NOT IN ('draft','cancelled')
      AND p.deleted_at IS NULL)                                          AS propostas_ativas
FROM clients c
WHERE c.deleted_at IS NULL
  AND c.client_name IS NULL
ORDER BY c.in_portfolio DESC, c.updated_at DESC;
