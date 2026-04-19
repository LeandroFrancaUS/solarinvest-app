-- ============================================================================================================================
-- SOLARINVEST — SCRIPT DE SANITIZAÇÃO E CLEANSE DE BAD DATA EM PRODUÇÃO
-- ============================================================================================================================
--
-- OBJETIVO:
--   Identificar e corrigir/remover dados inconsistentes, duplicados, inválidos ou tecnicamente irrelevantes
--   nas principais tabelas do banco SolarInvest, de forma conservadora, auditável e reversível.
--
-- TABELAS COBERTAS:
--   public.clients                  — fonte de identidade de clientes
--   public.proposals                — propostas comerciais (leasing / venda)
--   public.client_contracts         — contratos operacionais
--   public.client_billing_profile   — perfil de cobrança recorrente
--   public.client_usina_config      — configuração da usina solar (UFV)
--   public.storage                  — storage key-value (app state, preferências)
--
-- ESTRUTURA DO SCRIPT:
--   A) Preview / Auditoria          ← rodar primeiro, inspecionar resultados
--   B) Backup / Segurança           ← criar backups antes de alterar qualquer dado
--   C) Sanitização / Limpeza        ← limpeza conservadora dentro de transação
--   D) Relatórios pós-limpeza       ← validar resultado após commit
--
-- COMO USAR:
--   1. Rodar o BLOCO A e revisar os volumes retornados.
--   2. Rodar o BLOCO B para criar os backups.
--   3. Rodar o BLOCO C (já envolto em BEGIN/COMMIT) para aplicar as limpezas.
--      - Se quiser simular sem commitar: trocar COMMIT por ROLLBACK no final.
--   4. Rodar o BLOCO D para conferir o estado final.
--
-- REGRAS GERAIS:
--   • Nunca DELETE sem backup prévio no schema data_hygiene.
--   • Preferir UPDATE campo = NULL → soft-delete → DELETE somente em último caso.
--   • Nunca apagar registros com contrato ativo, billing ou portfólio vinculado.
--   • Comentários explicam cada decisão para auditoria.
--
-- ATENÇÃO: Fazer pg_dump do banco antes de rodar em produção.
-- ============================================================================================================================


-- ============================================================================================================================
-- A) BLOCO DE PREVIEW / AUDITORIA
-- ============================================================================================================================
-- Rodar estas queries ANTES de qualquer alteração.
-- Inspecionar volumes e amostras para confirmar o impacto antes de prosseguir.
-- ============================================================================================================================


-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
-- A1) Clientes com client_name inválido
--     Inválido = NULL | vazio | sem nenhuma letra do alfabeto português/latino
-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

-- Contagem:
SELECT
  'A1 - clientes com nome inválido' AS check_name,
  COUNT(*)                          AS total
FROM public.clients
WHERE deleted_at IS NULL
  AND (
    client_name IS NULL
    OR btrim(client_name) = ''
    OR NOT (coalesce(client_name, '') ~* '[A-Za-zÀ-ÖØ-öø-ÿ]')
  );

-- Amostra (até 50 linhas):
SELECT
  id,
  client_name,
  document,
  email,
  phone,
  cpf_normalized,
  cnpj_normalized,
  identity_status,
  in_portfolio,
  created_at
FROM public.clients
WHERE deleted_at IS NULL
  AND (
    client_name IS NULL
    OR btrim(client_name) = ''
    OR NOT (coalesce(client_name, '') ~* '[A-Za-zÀ-ÖØ-öø-ÿ]')
  )
ORDER BY created_at DESC
LIMIT 50;


-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
-- A2) Clientes com documento placeholder / inválido
--     Placeholder = vazio após remover não-dígitos | todo zero | sequências conhecidas
-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

-- Contagem:
SELECT
  'A2 - clientes com documento placeholder' AS check_name,
  COUNT(*)                                  AS total
FROM public.clients
WHERE deleted_at IS NULL
  AND (
    -- document original
    (document IS NOT NULL AND (
       btrim(regexp_replace(document, '[^0-9]', '', 'g')) = ''
    OR regexp_replace(document, '[^0-9]', '', 'g') ~ '^0+$'
    ))
    OR
    -- cpf_normalized
    (cpf_normalized IS NOT NULL AND (
       btrim(regexp_replace(cpf_normalized, '[^0-9]', '', 'g')) = ''
    OR regexp_replace(cpf_normalized, '[^0-9]', '', 'g') ~ '^0+$'
    ))
    OR
    -- cnpj_normalized
    (cnpj_normalized IS NOT NULL AND (
       btrim(regexp_replace(cnpj_normalized, '[^0-9]', '', 'g')) = ''
    OR regexp_replace(cnpj_normalized, '[^0-9]', '', 'g') ~ '^0+$'
    ))
  );

-- Amostra:
SELECT
  id,
  client_name,
  document,
  cpf_normalized,
  cnpj_normalized,
  identity_status,
  in_portfolio,
  created_at
FROM public.clients
WHERE deleted_at IS NULL
  AND (
    (document IS NOT NULL AND (
       btrim(regexp_replace(document, '[^0-9]', '', 'g')) = ''
    OR regexp_replace(document, '[^0-9]', '', 'g') ~ '^0+$'
    ))
    OR
    (cpf_normalized IS NOT NULL AND (
       btrim(regexp_replace(cpf_normalized, '[^0-9]', '', 'g')) = ''
    OR regexp_replace(cpf_normalized, '[^0-9]', '', 'g') ~ '^0+$'
    ))
    OR
    (cnpj_normalized IS NOT NULL AND (
       btrim(regexp_replace(cnpj_normalized, '[^0-9]', '', 'g')) = ''
    OR regexp_replace(cnpj_normalized, '[^0-9]', '', 'g') ~ '^0+$'
    ))
  )
ORDER BY created_at DESC
LIMIT 50;


-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
-- A3) Clientes com telefone inválido
--     Inválido = "[object Object]" | vazio | sem dígitos | menos de 10 dígitos
-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

SELECT
  'A3 - clientes com telefone inválido' AS check_name,
  COUNT(*) AS total
FROM public.clients
WHERE deleted_at IS NULL
  AND phone IS NOT NULL
  AND (
    lower(btrim(phone)) = '[object object]'
    OR btrim(phone) = ''
    OR regexp_replace(phone, '[^0-9]', '', 'g') = ''
    OR length(regexp_replace(phone, '[^0-9]', '', 'g')) < 10
  );

-- Amostra:
SELECT id, client_name, phone, created_at
FROM public.clients
WHERE deleted_at IS NULL
  AND phone IS NOT NULL
  AND (
    lower(btrim(phone)) = '[object object]'
    OR btrim(phone) = ''
    OR regexp_replace(phone, '[^0-9]', '', 'g') = ''
    OR length(regexp_replace(phone, '[^0-9]', '', 'g')) < 10
  )
LIMIT 50;


-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
-- A4) Clientes duplicados por CPF normalizado
-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

SELECT
  'A4 - grupos de duplicata por CPF' AS check_name,
  COUNT(DISTINCT cpf_normalized)     AS grupos_duplicados,
  SUM(cnt - 1)                       AS linhas_excedentes
FROM (
  SELECT cpf_normalized, COUNT(*) AS cnt
  FROM public.clients
  WHERE cpf_normalized IS NOT NULL
    AND deleted_at IS NULL
    AND merged_into_client_id IS NULL
    AND regexp_replace(cpf_normalized, '[^0-9]', '', 'g') !~ '^0+$'
  GROUP BY cpf_normalized
  HAVING COUNT(*) > 1
) t;

-- Amostra de duplicatas:
SELECT
  cpf_normalized,
  COUNT(*)                            AS copies,
  array_agg(id ORDER BY id)          AS ids,
  array_agg(client_name ORDER BY id) AS nomes,
  array_agg(in_portfolio ORDER BY id) AS em_carteira,
  array_agg(updated_at ORDER BY id)  AS updated_ats
FROM public.clients
WHERE cpf_normalized IS NOT NULL
  AND deleted_at IS NULL
  AND merged_into_client_id IS NULL
  AND regexp_replace(cpf_normalized, '[^0-9]', '', 'g') !~ '^0+$'
GROUP BY cpf_normalized
HAVING COUNT(*) > 1
ORDER BY copies DESC
LIMIT 30;

-- Duplicatas por CNPJ:
SELECT
  'A4b - grupos de duplicata por CNPJ' AS check_name,
  COUNT(DISTINCT cnpj_normalized)       AS grupos_duplicados,
  SUM(cnt - 1)                          AS linhas_excedentes
FROM (
  SELECT cnpj_normalized, COUNT(*) AS cnt
  FROM public.clients
  WHERE cnpj_normalized IS NOT NULL
    AND deleted_at IS NULL
    AND merged_into_client_id IS NULL
    AND regexp_replace(cnpj_normalized, '[^0-9]', '', 'g') !~ '^0+$'
  GROUP BY cnpj_normalized
  HAVING COUNT(*) > 1
) t;


-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
-- A5) Contratos duplicados (mesmo client_id + contract_type + contractual_term_months, status = draft)
-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

SELECT
  'A5 - grupos de contratos draft duplicados' AS check_name,
  COUNT(*) AS grupos,
  SUM(cnt - 1) AS excedentes
FROM (
  SELECT client_id, contract_type, contractual_term_months, COUNT(*) AS cnt
  FROM public.client_contracts
  WHERE contract_status = 'draft'
  GROUP BY client_id, contract_type, contractual_term_months
  HAVING COUNT(*) > 1
) t;

-- Amostra:
SELECT
  client_id,
  contract_type,
  contractual_term_months,
  COUNT(*) AS copies,
  array_agg(id ORDER BY updated_at DESC)              AS contract_ids,
  array_agg(contract_status ORDER BY updated_at DESC) AS statuses,
  array_agg(contract_file_name ORDER BY updated_at DESC) AS arquivos,
  array_agg(updated_at ORDER BY updated_at DESC)      AS updated_ats
FROM public.client_contracts
WHERE contract_status = 'draft'
GROUP BY client_id, contract_type, contractual_term_months
HAVING COUNT(*) > 1
ORDER BY copies DESC
LIMIT 30;


-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
-- A6) Contratos com datas incoerentes
--     Incoerente = expected_billing_end_date anterior a contract_start_date
-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

SELECT
  'A6 - contratos com datas incoerentes' AS check_name,
  COUNT(*) AS total
FROM public.client_contracts
WHERE contract_start_date IS NOT NULL
  AND expected_billing_end_date IS NOT NULL
  AND expected_billing_end_date < contract_start_date;

-- Amostra:
SELECT
  id,
  client_id,
  contract_type,
  contract_status,
  contract_start_date,
  expected_billing_end_date,
  contractual_term_months,
  billing_start_date
FROM public.client_contracts
WHERE contract_start_date IS NOT NULL
  AND expected_billing_end_date IS NOT NULL
  AND expected_billing_end_date < contract_start_date
ORDER BY client_id
LIMIT 30;


-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
-- A7) Billing com datas incoerentes
-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

SELECT
  'A7 - billing com expected_last < first_billing_date' AS check_name,
  COUNT(*) AS total
FROM public.client_billing_profile
WHERE first_billing_date IS NOT NULL
  AND expected_last_billing_date IS NOT NULL
  AND expected_last_billing_date < first_billing_date;

SELECT
  'A7b - billing com first_billing_date < commissioning_date' AS check_name,
  COUNT(*) AS total
FROM public.client_billing_profile
WHERE first_billing_date IS NOT NULL
  AND commissioning_date IS NOT NULL
  AND first_billing_date < commissioning_date;

-- Amostra:
SELECT
  bp.id,
  bp.client_id,
  bp.first_billing_date,
  bp.expected_last_billing_date,
  bp.commissioning_date,
  bp.payment_status,
  bp.auto_reminder_enabled
FROM public.client_billing_profile bp
WHERE (
  (bp.first_billing_date IS NOT NULL
   AND bp.expected_last_billing_date IS NOT NULL
   AND bp.expected_last_billing_date < bp.first_billing_date)
  OR
  (bp.first_billing_date IS NOT NULL
   AND bp.commissioning_date IS NOT NULL
   AND bp.first_billing_date < bp.commissioning_date)
)
LIMIT 30;


-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
-- A8) Proposals com dados inválidos (nome, documento, email)
-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

-- Proposals com client_name inválido:
SELECT
  'A8a - proposals com client_name inválido' AS check_name,
  COUNT(*) AS total
FROM public.proposals
WHERE deleted_at IS NULL
  AND (
    client_name IS NULL
    OR btrim(client_name) = ''
    OR NOT (coalesce(client_name, '') ~* '[A-Za-zÀ-ÖØ-öø-ÿ]')
  );

-- Proposals com client_document placeholder:
SELECT
  'A8b - proposals com client_document placeholder' AS check_name,
  COUNT(*) AS total
FROM public.proposals
WHERE deleted_at IS NULL
  AND client_document IS NOT NULL
  AND (
    btrim(regexp_replace(client_document, '[^0-9]', '', 'g')) = ''
    OR regexp_replace(client_document, '[^0-9]', '', 'g') ~ '^0+$'
  );

-- Proposals com client_email lixo:
SELECT
  'A8c - proposals com client_email lixo' AS check_name,
  COUNT(*) AS total
FROM public.proposals
WHERE deleted_at IS NULL
  AND client_email IS NOT NULL
  AND (
    lower(btrim(client_email)) IN ('t', 'teste', 'test', 'null', 'undefined', '[object object]', 'n/a', 'na', '')
    OR client_email NOT LIKE '%@%.%'
    OR client_email ~ '\s'
  );

-- Proposals totalmente órfãs (sem nenhum dado útil), status draft:
SELECT
  'A8d - proposals draft totalmente órfãs' AS check_name,
  COUNT(*) AS total
FROM public.proposals
WHERE deleted_at IS NULL
  AND status = 'draft'
  AND (client_name IS NULL OR NOT (coalesce(client_name, '') ~* '[A-Za-zÀ-ÖØ-öø-ÿ]'))
  AND (client_document IS NULL OR btrim(client_document) = '')
  AND (client_phone IS NULL OR btrim(client_phone) = '')
  AND (client_email IS NULL OR lower(btrim(client_email)) IN ('t','teste','test','null','undefined','[object object]',''))
  AND (capex_total IS NULL OR capex_total = 0)
  AND (contract_value IS NULL OR contract_value = 0);

-- Amostra de proposals inválidas:
SELECT
  id,
  proposal_type,
  status,
  client_name,
  client_document,
  client_email,
  client_phone,
  is_conflicted,
  conflict_reason,
  created_at
FROM public.proposals
WHERE deleted_at IS NULL
  AND (
    (client_name IS NULL OR NOT (coalesce(client_name, '') ~* '[A-Za-zÀ-ÖØ-öø-ÿ]'))
    OR
    (client_document IS NOT NULL
     AND regexp_replace(client_document, '[^0-9]', '', 'g') ~ '^0+$')
    OR
    (client_email IS NOT NULL
     AND lower(btrim(client_email)) IN ('t','teste','test','null','undefined','[object object]',''))
  )
ORDER BY created_at DESC
LIMIT 50;


-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
-- A9) client_usina_config órfãs ou quase vazias
-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

-- Órfãs (cliente não existe ou está soft-deleted):
SELECT
  'A9a - client_usina_config órfãs' AS check_name,
  COUNT(*) AS total
FROM public.client_usina_config uc
LEFT JOIN public.clients c ON c.id = uc.client_id
WHERE c.id IS NULL OR c.deleted_at IS NOT NULL;

-- Quase vazias (todos os campos técnicos são NULL):
SELECT
  'A9b - client_usina_config quase vazias (sem nenhum campo técnico)' AS check_name,
  COUNT(*) AS total
FROM public.client_usina_config
WHERE potencia_modulo_wp IS NULL
  AND numero_modulos IS NULL
  AND modelo_modulo IS NULL
  AND modelo_inversor IS NULL
  AND tipo_instalacao IS NULL
  AND area_instalacao_m2 IS NULL
  AND geracao_estimada_kwh IS NULL;

-- Amostra de quase vazias:
SELECT uc.*, c.client_name, c.deleted_at AS client_deleted_at
FROM public.client_usina_config uc
LEFT JOIN public.clients c ON c.id = uc.client_id
WHERE uc.potencia_modulo_wp IS NULL
  AND uc.numero_modulos IS NULL
  AND uc.modelo_modulo IS NULL
  AND uc.modelo_inversor IS NULL
  AND uc.tipo_instalacao IS NULL
  AND uc.area_instalacao_m2 IS NULL
  AND uc.geracao_estimada_kwh IS NULL
LIMIT 30;


-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
-- A10) Chaves técnicas indevidas na tabela storage
-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

SELECT
  'A10 - storage com chaves técnicas/lixo' AS check_name,
  COUNT(*) AS total
FROM public.storage
WHERE "key" IN ('clear', 'getItem', 'setItem', 'removeItem', 'vercel-toolbar-position')
   OR "key" LIKE '_STACK_AUTH%'
   OR "key" LIKE '__vercel_toolbar%'
   OR "key" LIKE 'vercel-%';

-- Listagem completa das chaves técnicas:
SELECT id, user_id, "key", created_at, updated_at
FROM public.storage
WHERE "key" IN ('clear', 'getItem', 'setItem', 'removeItem', 'vercel-toolbar-position')
   OR "key" LIKE '_STACK_AUTH%'
   OR "key" LIKE '__vercel_toolbar%'
   OR "key" LIKE 'vercel-%'
ORDER BY "key", user_id;

-- Visão geral do storage (todas as chaves distintas existentes):
SELECT "key", COUNT(*) AS users_com_essa_chave
FROM public.storage
GROUP BY "key"
ORDER BY "key";


-- ============================================================================================================================
-- B) BLOCO DE BACKUP / SEGURANÇA
-- ============================================================================================================================
-- Criar schema auxiliar e copiar para lá todos os registros que serão
-- alterados ou removidos no BLOCO C.
-- Execute este bloco ANTES do BLOCO C.
-- ============================================================================================================================

-- Criar schema de backup (idempotente):
CREATE SCHEMA IF NOT EXISTS data_hygiene;

-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
-- B1) Backup de clientes que serão alterados
-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

-- Cria a tabela sem NOT NULL nem constraints (CREATE TABLE AS ... WITH NO DATA):
CREATE TABLE IF NOT EXISTS data_hygiene.clients_backup
  AS TABLE public.clients WITH NO DATA;
-- Adicionar colunas de auditoria de backup:
ALTER TABLE data_hygiene.clients_backup
  ADD COLUMN IF NOT EXISTS backed_up_at  TIMESTAMPTZ NOT NULL,
  ADD COLUMN IF NOT EXISTS backup_reason TEXT;

-- Inserir clientes com nome inválido (ativos):
INSERT INTO data_hygiene.clients_backup
SELECT c.*, now(), 'invalid_name'
FROM public.clients c
WHERE c.deleted_at IS NULL
  AND (
    client_name IS NULL
    OR btrim(client_name) = ''
    OR NOT (coalesce(client_name, '') ~* '[A-Za-zÀ-ÖØ-öø-ÿ]')
  );

-- Inserir clientes com documento placeholder:
INSERT INTO data_hygiene.clients_backup
SELECT c.*, now(), 'placeholder_document'
FROM public.clients c
WHERE c.deleted_at IS NULL
  AND (
    (document IS NOT NULL AND regexp_replace(document, '[^0-9]', '', 'g') ~ '^0+$')
    OR (cpf_normalized IS NOT NULL AND regexp_replace(cpf_normalized, '[^0-9]', '', 'g') ~ '^0+$')
    OR (cnpj_normalized IS NOT NULL AND regexp_replace(cnpj_normalized, '[^0-9]', '', 'g') ~ '^0+$')
  );

-- Inserir clientes com telefone inválido:
INSERT INTO data_hygiene.clients_backup
SELECT c.*, now(), 'invalid_phone'
FROM public.clients c
WHERE c.deleted_at IS NULL
  AND phone IS NOT NULL
  AND (
    lower(btrim(phone)) = '[object object]'
    OR btrim(phone) = ''
    OR regexp_replace(phone, '[^0-9]', '', 'g') = ''
    OR length(regexp_replace(phone, '[^0-9]', '', 'g')) < 10
  );

-- Inserir duplicatas por CPF (todas as cópias):
INSERT INTO data_hygiene.clients_backup
SELECT c.*, now(), 'cpf_duplicate'
FROM public.clients c
WHERE c.deleted_at IS NULL
  AND c.merged_into_client_id IS NULL
  AND c.cpf_normalized IS NOT NULL
  AND regexp_replace(c.cpf_normalized, '[^0-9]', '', 'g') !~ '^0+$'
  AND c.cpf_normalized IN (
    SELECT cpf_normalized
    FROM public.clients
    WHERE cpf_normalized IS NOT NULL
      AND deleted_at IS NULL
      AND merged_into_client_id IS NULL
    GROUP BY cpf_normalized
    HAVING COUNT(*) > 1
  );

-- Inserir duplicatas por CNPJ:
INSERT INTO data_hygiene.clients_backup
SELECT c.*, now(), 'cnpj_duplicate'
FROM public.clients c
WHERE c.deleted_at IS NULL
  AND c.merged_into_client_id IS NULL
  AND c.cnpj_normalized IS NOT NULL
  AND regexp_replace(c.cnpj_normalized, '[^0-9]', '', 'g') !~ '^0+$'
  AND c.cnpj_normalized IN (
    SELECT cnpj_normalized
    FROM public.clients
    WHERE cnpj_normalized IS NOT NULL
      AND deleted_at IS NULL
      AND merged_into_client_id IS NULL
    GROUP BY cnpj_normalized
    HAVING COUNT(*) > 1
  );


-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
-- B2) Backup de contratos que serão alterados
-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS data_hygiene.client_contracts_backup
  AS TABLE public.client_contracts WITH NO DATA;
ALTER TABLE data_hygiene.client_contracts_backup
  ADD COLUMN IF NOT EXISTS backed_up_at  TIMESTAMPTZ NOT NULL,
  ADD COLUMN IF NOT EXISTS backup_reason TEXT;

-- Backupar contratos draft duplicados:
INSERT INTO data_hygiene.client_contracts_backup
SELECT cc.*, now(), 'draft_duplicate'
FROM public.client_contracts cc
WHERE cc.contract_status = 'draft'
  AND (cc.client_id, cc.contract_type, cc.contractual_term_months) IN (
    SELECT client_id, contract_type, contractual_term_months
    FROM public.client_contracts
    WHERE contract_status = 'draft'
    GROUP BY client_id, contract_type, contractual_term_months
    HAVING COUNT(*) > 1
  );

-- Backupar contratos com datas incoerentes:
INSERT INTO data_hygiene.client_contracts_backup
SELECT cc.*, now(), 'inconsistent_dates'
FROM public.client_contracts cc
WHERE cc.contract_start_date IS NOT NULL
  AND cc.expected_billing_end_date IS NOT NULL
  AND cc.expected_billing_end_date < cc.contract_start_date;


-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
-- B3) Backup de billing que será alterado
-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS data_hygiene.client_billing_profile_backup
  AS TABLE public.client_billing_profile WITH NO DATA;
ALTER TABLE data_hygiene.client_billing_profile_backup
  ADD COLUMN IF NOT EXISTS backed_up_at  TIMESTAMPTZ NOT NULL,
  ADD COLUMN IF NOT EXISTS backup_reason TEXT;

INSERT INTO data_hygiene.client_billing_profile_backup
SELECT bp.*, now(), 'inconsistent_dates'
FROM public.client_billing_profile bp
WHERE (bp.first_billing_date IS NOT NULL
       AND bp.expected_last_billing_date IS NOT NULL
       AND bp.expected_last_billing_date < bp.first_billing_date)
  OR (bp.first_billing_date IS NOT NULL
      AND bp.commissioning_date IS NOT NULL
      AND bp.first_billing_date < bp.commissioning_date)
  OR bp.auto_reminder_enabled IS NULL;


-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
-- B4) Backup de client_usina_config que será alterado
-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS data_hygiene.client_usina_config_backup
  AS TABLE public.client_usina_config WITH NO DATA;
ALTER TABLE data_hygiene.client_usina_config_backup
  ADD COLUMN IF NOT EXISTS backed_up_at  TIMESTAMPTZ NOT NULL,
  ADD COLUMN IF NOT EXISTS backup_reason TEXT;

-- Backupar usina config órfãs:
INSERT INTO data_hygiene.client_usina_config_backup
SELECT uc.*, now(), 'orphaned'
FROM public.client_usina_config uc
LEFT JOIN public.clients c ON c.id = uc.client_id
WHERE c.id IS NULL OR c.deleted_at IS NOT NULL;

-- Backupar usina config quase vazias (somente as que têm cliente ativo, mas sem nenhum campo técnico):
INSERT INTO data_hygiene.client_usina_config_backup
SELECT uc.*, now(), 'nearly_empty'
FROM public.client_usina_config uc
INNER JOIN public.clients c ON c.id = uc.client_id AND c.deleted_at IS NULL
WHERE uc.potencia_modulo_wp IS NULL
  AND uc.numero_modulos IS NULL
  AND uc.modelo_modulo IS NULL
  AND uc.modelo_inversor IS NULL
  AND uc.tipo_instalacao IS NULL
  AND uc.area_instalacao_m2 IS NULL
  AND uc.geracao_estimada_kwh IS NULL;


-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
-- B5) Backup de proposals que serão alteradas
-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS data_hygiene.proposals_backup
  AS TABLE public.proposals WITH NO DATA;
ALTER TABLE data_hygiene.proposals_backup
  ADD COLUMN IF NOT EXISTS backed_up_at  TIMESTAMPTZ NOT NULL,
  ADD COLUMN IF NOT EXISTS backup_reason TEXT;

-- Proposals com dados inválidos:
INSERT INTO data_hygiene.proposals_backup
SELECT p.*, now(), 'invalid_client_data'
FROM public.proposals p
WHERE p.deleted_at IS NULL
  AND (
    (p.client_name IS NULL OR NOT (coalesce(p.client_name, '') ~* '[A-Za-zÀ-ÖØ-öø-ÿ]'))
    OR (p.client_document IS NOT NULL AND regexp_replace(p.client_document, '[^0-9]', '', 'g') ~ '^0+$')
    OR (p.client_email IS NOT NULL AND lower(btrim(p.client_email)) IN ('t','teste','test','null','undefined','[object object]',''))
    OR (p.client_email IS NOT NULL AND p.client_email NOT LIKE '%@%.%')
  );


-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
-- B6) Backup de storage que será removido
-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS data_hygiene.storage_backup
  AS TABLE public.storage WITH NO DATA;
ALTER TABLE data_hygiene.storage_backup
  ADD COLUMN IF NOT EXISTS backed_up_at  TIMESTAMPTZ NOT NULL,
  ADD COLUMN IF NOT EXISTS backup_reason TEXT;

INSERT INTO data_hygiene.storage_backup
SELECT s.*, now(), 'technical_key'
FROM public.storage s
WHERE s."key" IN ('clear', 'getItem', 'setItem', 'removeItem', 'vercel-toolbar-position')
   OR s."key" LIKE '_STACK_AUTH%'
   OR s."key" LIKE '__vercel_toolbar%'
   OR s."key" LIKE 'vercel-%';


-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
-- B7) Confirmar backup criado
-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

SELECT 'data_hygiene.clients_backup'              AS tabela, COUNT(*) AS linhas_backup FROM data_hygiene.clients_backup
UNION ALL
SELECT 'data_hygiene.client_contracts_backup',      COUNT(*) FROM data_hygiene.client_contracts_backup
UNION ALL
SELECT 'data_hygiene.client_billing_profile_backup',COUNT(*) FROM data_hygiene.client_billing_profile_backup
UNION ALL
SELECT 'data_hygiene.client_usina_config_backup',   COUNT(*) FROM data_hygiene.client_usina_config_backup
UNION ALL
SELECT 'data_hygiene.proposals_backup',             COUNT(*) FROM data_hygiene.proposals_backup
UNION ALL
SELECT 'data_hygiene.storage_backup',               COUNT(*) FROM data_hygiene.storage_backup;


-- ============================================================================================================================
-- C) BLOCO DE SANITIZAÇÃO / LIMPEZA
-- ============================================================================================================================
-- ATENÇÃO: O bloco C está envolto em BEGIN / COMMIT.
-- Para simular sem commitar, substitua COMMIT por ROLLBACK no final do bloco.
-- Execute o BLOCO B antes de rodar este bloco.
-- ============================================================================================================================

BEGIN;

-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
-- C1) LIMPEZA DE CLIENTES
-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

-- C1a) Normalizar client_name inválido para NULL (não deletar o cliente se houver vínculo)
--      Vinculado = in_portfolio OR contrato OR billing OR proposta ativa
UPDATE public.clients c
SET
  client_name = NULL,
  updated_at  = now()
WHERE c.deleted_at IS NULL
  AND (
    client_name IS NULL
    OR btrim(client_name) = ''
    OR NOT (coalesce(client_name, '') ~* '[A-Za-zÀ-ÖØ-öø-ÿ]')
  )
  AND (
    c.in_portfolio = true
    OR EXISTS (SELECT 1 FROM public.client_contracts cc WHERE cc.client_id = c.id AND cc.contract_status NOT IN ('cancelled','completed'))
    OR EXISTS (SELECT 1 FROM public.client_billing_profile bp WHERE bp.client_id = c.id AND bp.payment_status NOT IN ('cancelled','written_off'))
    OR EXISTS (SELECT 1 FROM public.proposals p WHERE p.client_id = c.id AND p.deleted_at IS NULL AND p.status NOT IN ('cancelled','rejected'))
  );

-- C1b) Soft-delete de clientes totalmente inválidos sem vínculo algum
--      (nome inválido + sem portfolio + sem contrato + sem billing + sem proposta)
UPDATE public.clients c
SET
  deleted_at      = now(),
  identity_status = 'rejected',
  updated_at      = now()
WHERE c.deleted_at IS NULL
  AND (
    client_name IS NULL
    OR btrim(client_name) = ''
    OR NOT (coalesce(client_name, '') ~* '[A-Za-zÀ-ÖØ-öø-ÿ]')
  )
  AND c.in_portfolio = false
  AND NOT EXISTS (SELECT 1 FROM public.client_contracts cc WHERE cc.client_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM public.client_billing_profile bp WHERE bp.client_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM public.proposals p WHERE p.client_id = c.id AND p.deleted_at IS NULL);

-- C1c) Normalizar documento placeholder para NULL
--      Se identity_status = 'confirmed' e o documento for placeholder, rebaixar para 'pending_cpf'
UPDATE public.clients
SET
  document       = NULL,
  cpf_raw        = CASE WHEN regexp_replace(coalesce(cpf_raw,''), '[^0-9]', '', 'g') ~ '^0+$' THEN NULL ELSE cpf_raw END,
  cpf_normalized = CASE WHEN regexp_replace(coalesce(cpf_normalized,''), '[^0-9]', '', 'g') ~ '^0+$' THEN NULL ELSE cpf_normalized END,
  cnpj_raw       = CASE WHEN regexp_replace(coalesce(cnpj_raw,''), '[^0-9]', '', 'g') ~ '^0+$' THEN NULL ELSE cnpj_raw END,
  cnpj_normalized= CASE WHEN regexp_replace(coalesce(cnpj_normalized,''), '[^0-9]', '', 'g') ~ '^0+$' THEN NULL ELSE cnpj_normalized END,
  identity_status = CASE
                      WHEN identity_status = 'confirmed'
                       AND (
                         (document IS NOT NULL AND regexp_replace(document, '[^0-9]', '', 'g') ~ '^0+$')
                         OR (cpf_normalized IS NOT NULL AND regexp_replace(cpf_normalized, '[^0-9]', '', 'g') ~ '^0+$')
                         OR (cnpj_normalized IS NOT NULL AND regexp_replace(cnpj_normalized, '[^0-9]', '', 'g') ~ '^0+$')
                       )
                      THEN 'pending_cpf'
                      ELSE identity_status
                    END,
  updated_at = now()
WHERE deleted_at IS NULL
  AND (
    (document IS NOT NULL AND regexp_replace(document, '[^0-9]', '', 'g') ~ '^0+$')
    OR (cpf_normalized IS NOT NULL AND regexp_replace(cpf_normalized, '[^0-9]', '', 'g') ~ '^0+$')
    OR (cnpj_normalized IS NOT NULL AND regexp_replace(cnpj_normalized, '[^0-9]', '', 'g') ~ '^0+$')
  );

-- C1d) Normalizar telefone inválido para NULL
UPDATE public.clients
SET
  phone      = CASE
                 WHEN lower(btrim(phone)) = '[object object]'
                   OR btrim(phone) = ''
                   OR regexp_replace(phone, '[^0-9]', '', 'g') = ''
                   OR length(regexp_replace(phone, '[^0-9]', '', 'g')) < 10
                 THEN NULL
                 ELSE phone
               END,
  updated_at = now()
WHERE deleted_at IS NULL
  AND phone IS NOT NULL
  AND (
    lower(btrim(phone)) = '[object object]'
    OR btrim(phone) = ''
    OR regexp_replace(phone, '[^0-9]', '', 'g') = ''
    OR length(regexp_replace(phone, '[^0-9]', '', 'g')) < 10
  );

-- C1e) Normalizar email inválido para NULL nos clientes
UPDATE public.clients
SET
  email      = NULL,
  updated_at = now()
WHERE deleted_at IS NULL
  AND email IS NOT NULL
  AND (
    lower(btrim(email)) IN ('t','teste','test','null','undefined','[object object]','na','n/a','')
    OR email NOT LIKE '%@%.%'
    OR email ~ '\s'
  );

-- C1f) Deduplicação por CPF: soft-delete das duplicatas, mantendo o "vencedor"
--      Critério vencedor: in_portfolio DESC → updated_at DESC → created_at DESC → id DESC
WITH ranked_cpf AS (
  SELECT
    id,
    cpf_normalized,
    ROW_NUMBER() OVER (
      PARTITION BY cpf_normalized
      ORDER BY
        in_portfolio DESC,
        updated_at   DESC NULLS LAST,
        created_at   DESC NULLS LAST,
        id           DESC
    ) AS rn
  FROM public.clients
  WHERE cpf_normalized IS NOT NULL
    AND deleted_at IS NULL
    AND merged_into_client_id IS NULL
    AND regexp_replace(cpf_normalized, '[^0-9]', '', 'g') !~ '^0+$'
),
survivors AS (
  SELECT cpf_normalized, id AS survivor_id
  FROM ranked_cpf WHERE rn = 1
),
duplicates AS (
  SELECT r.id AS dup_id, s.survivor_id
  FROM ranked_cpf r
  JOIN survivors s ON s.cpf_normalized = r.cpf_normalized
  WHERE r.rn > 1
)
UPDATE public.clients c
SET
  merged_into_client_id = d.survivor_id,
  deleted_at            = now(),
  identity_status       = 'merged',
  updated_at            = now()
FROM duplicates d
WHERE c.id = d.dup_id
  -- Não mesclar se tiver contrato ativo ou estiver em portfólio:
  AND c.in_portfolio = false
  AND NOT EXISTS (
    SELECT 1 FROM public.client_contracts cc
    WHERE cc.client_id = c.id AND cc.contract_status IN ('active','signed','suspended')
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.client_billing_profile bp
    WHERE bp.client_id = c.id AND bp.payment_status NOT IN ('cancelled','written_off')
  );

-- C1g) Deduplicação por CNPJ: mesma lógica
WITH ranked_cnpj AS (
  SELECT
    id,
    cnpj_normalized,
    ROW_NUMBER() OVER (
      PARTITION BY cnpj_normalized
      ORDER BY
        in_portfolio DESC,
        updated_at   DESC NULLS LAST,
        created_at   DESC NULLS LAST,
        id           DESC
    ) AS rn
  FROM public.clients
  WHERE cnpj_normalized IS NOT NULL
    AND deleted_at IS NULL
    AND merged_into_client_id IS NULL
    AND regexp_replace(cnpj_normalized, '[^0-9]', '', 'g') !~ '^0+$'
),
survivors_cnpj AS (
  SELECT cnpj_normalized, id AS survivor_id
  FROM ranked_cnpj WHERE rn = 1
),
duplicates_cnpj AS (
  SELECT r.id AS dup_id, s.survivor_id
  FROM ranked_cnpj r
  JOIN survivors_cnpj s ON s.cnpj_normalized = r.cnpj_normalized
  WHERE r.rn > 1
)
UPDATE public.clients c
SET
  merged_into_client_id = d.survivor_id,
  deleted_at            = now(),
  identity_status       = 'merged',
  updated_at            = now()
FROM duplicates_cnpj d
WHERE c.id = d.dup_id
  AND c.in_portfolio = false
  AND NOT EXISTS (
    SELECT 1 FROM public.client_contracts cc
    WHERE cc.client_id = c.id AND cc.contract_status IN ('active','signed','suspended')
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.client_billing_profile bp
    WHERE bp.client_id = c.id AND bp.payment_status NOT IN ('cancelled','written_off')
  );


-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
-- C2) LIMPEZA DE CONTRATOS
-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

-- C2a) Remover drafts duplicados do mesmo cliente+tipo+prazo
--      Manter o mais completo/recente (com arquivo de contrato se houver, senão mais recente)
--      Remover os excedentes via soft-delete (contract_status = 'cancelled')
WITH ranked_drafts AS (
  SELECT
    id,
    client_id,
    contract_type,
    contractual_term_months,
    ROW_NUMBER() OVER (
      PARTITION BY client_id, contract_type, contractual_term_months
      ORDER BY
        -- Prioridade: tem arquivo de contrato > updated_at mais recente > id maior
        (CASE WHEN contract_file_name IS NOT NULL THEN 1 ELSE 0 END) DESC,
        updated_at DESC NULLS LAST,
        id         DESC
    ) AS rn
  FROM public.client_contracts
  WHERE contract_status = 'draft'
    AND (client_id, contract_type, contractual_term_months) IN (
      SELECT client_id, contract_type, contractual_term_months
      FROM public.client_contracts
      WHERE contract_status = 'draft'
      GROUP BY client_id, contract_type, contractual_term_months
      HAVING COUNT(*) > 1
    )
)
UPDATE public.client_contracts cc
SET
  contract_status = 'cancelled',
  notes           = coalesce(notes || ' | ', '') || 'Cancelado por limpeza: draft duplicado em ' || now()::text,
  updated_at      = now()
FROM ranked_drafts rd
WHERE cc.id = rd.id
  AND rd.rn > 1;  -- Mantém rn=1, cancela os excedentes

-- C2b) Corrigir expected_billing_end_date incoerente
--      Se expected_billing_end_date < contract_start_date E contractual_term_months IS NOT NULL,
--      recalcular expected_billing_end_date = contract_start_date + contractual_term_months
UPDATE public.client_contracts
SET
  expected_billing_end_date = contract_start_date + (contractual_term_months * INTERVAL '1 month'),
  notes      = coalesce(notes || ' | ', '') || 'Data fim recalculada por limpeza em ' || now()::text,
  updated_at = now()
WHERE contract_start_date IS NOT NULL
  AND expected_billing_end_date IS NOT NULL
  AND expected_billing_end_date < contract_start_date
  AND contractual_term_months IS NOT NULL
  AND contractual_term_months > 0
  AND contract_status NOT IN ('cancelled','completed');

-- C2c) Para contratos leasing sem prazo definido que têm datas incoerentes e não podem ser recalculados:
--      apenas registrar nota de alerta para revisão manual
UPDATE public.client_contracts
SET
  notes      = coalesce(notes || ' | ', '') || 'ALERTA: data fim anterior ao início — revisar manualmente. Detectado em ' || now()::text,
  updated_at = now()
WHERE contract_start_date IS NOT NULL
  AND expected_billing_end_date IS NOT NULL
  AND expected_billing_end_date < contract_start_date
  AND (contractual_term_months IS NULL OR contractual_term_months = 0)
  AND contract_status NOT IN ('cancelled','completed');

-- C2d) Corrigir buyout_eligible para leasing ativos (alinhamento operacional)
--      Regra: contratos leasing ativos ou assinados devem ter buyout_eligible = true
UPDATE public.client_contracts
SET
  buyout_eligible = true,
  updated_at      = now()
WHERE contract_type = 'leasing'
  AND contract_status IN ('active','signed')
  AND buyout_eligible = false;


-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
-- C3) LIMPEZA DE BILLING
-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

-- C3a) Corrigir expected_last_billing_date quando for anterior a first_billing_date
--      Estratégia: buscar o prazo contratual no contrato vinculado e recalcular
UPDATE public.client_billing_profile bp
SET
  expected_last_billing_date = bp.first_billing_date + (cc.contractual_term_months * INTERVAL '1 month'),
  updated_at                 = now()
FROM public.client_contracts cc
WHERE cc.id = bp.contract_id
  AND bp.first_billing_date IS NOT NULL
  AND bp.expected_last_billing_date IS NOT NULL
  AND bp.expected_last_billing_date < bp.first_billing_date
  AND cc.contractual_term_months IS NOT NULL
  AND cc.contractual_term_months > 0;

-- C3b) Para billing sem contrato vinculado com datas incoerentes: marcar para revisão via delinquency_status
UPDATE public.client_billing_profile
SET
  delinquency_status = coalesce(delinquency_status || '|', '') || 'ALERTA_DATA_INCONSISTENTE',
  updated_at         = now()
WHERE first_billing_date IS NOT NULL
  AND expected_last_billing_date IS NOT NULL
  AND expected_last_billing_date < first_billing_date
  AND (contract_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.client_contracts cc
    WHERE cc.id = contract_id AND cc.contractual_term_months IS NOT NULL
  ));

-- C3c) Corrigir first_billing_date anterior a commissioning_date
--      Se a data de comissionamento existe e é depois do início de billing, alinhar
UPDATE public.client_billing_profile
SET
  first_billing_date = commissioning_date,
  updated_at         = now()
WHERE first_billing_date IS NOT NULL
  AND commissioning_date IS NOT NULL
  AND first_billing_date < commissioning_date
  AND payment_status NOT IN ('cancelled','written_off');

-- C3d) Garantir auto_reminder_enabled = true onde estiver NULL
--      (regra operacional: o padrão é lembrete ativo)
UPDATE public.client_billing_profile
SET
  auto_reminder_enabled = true,
  updated_at            = now()
WHERE auto_reminder_enabled IS NULL;


-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
-- C4) LIMPEZA DE USINA CONFIG
-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

-- C4a) Remover registros órfãos (cliente não existe ou está soft-deleted)
DELETE FROM public.client_usina_config
WHERE client_id NOT IN (
  SELECT id FROM public.clients WHERE deleted_at IS NULL
);

-- C4b) Remover registros quase vazios (todos os campos técnicos são NULL)
--      somente quando o cliente já tem outro registro com dados válidos,
--      ou quando é uma duplicata (caso raro — client_id é UNIQUE, então duplicatas não ocorrem)
--      Portanto: remover apenas os completamente vazios cujo cliente está ativo mas sem dados reais
--
--      CONSERVADOR: só remove se TODOS os 7 campos técnicos são NULL.
--      Manter se houver qualquer dado técnico, mesmo que mínimo.
DELETE FROM public.client_usina_config uc
WHERE uc.potencia_modulo_wp IS NULL
  AND uc.numero_modulos IS NULL
  AND uc.modelo_modulo IS NULL
  AND uc.modelo_inversor IS NULL
  AND uc.tipo_instalacao IS NULL
  AND uc.area_instalacao_m2 IS NULL
  AND uc.geracao_estimada_kwh IS NULL
  -- Só remove se o cliente NÃO estiver em portfólio e NÃO tiver contrato ativo
  AND EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = uc.client_id
      AND c.deleted_at IS NULL
      AND c.in_portfolio = false
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.client_contracts cc
    WHERE cc.client_id = uc.client_id
      AND cc.contract_status IN ('active','signed','suspended')
  );


-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
-- C5) LIMPEZA DE PROPOSALS
-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

-- C5a) Normalizar client_name inválido para NULL nas proposals
UPDATE public.proposals
SET
  client_name = NULL,
  updated_at  = now()
WHERE deleted_at IS NULL
  AND (
    client_name IS NULL
    OR btrim(client_name) = ''
    OR NOT (coalesce(client_name, '') ~* '[A-Za-zÀ-ÖØ-öø-ÿ]')
  );

-- C5b) Normalizar client_document placeholder para NULL
UPDATE public.proposals
SET
  client_document = NULL,
  updated_at      = now()
WHERE deleted_at IS NULL
  AND client_document IS NOT NULL
  AND (
    btrim(regexp_replace(client_document, '[^0-9]', '', 'g')) = ''
    OR regexp_replace(client_document, '[^0-9]', '', 'g') ~ '^0+$'
  );

-- C5c) Normalizar client_email lixo para NULL
UPDATE public.proposals
SET
  client_email = NULL,
  updated_at   = now()
WHERE deleted_at IS NULL
  AND client_email IS NOT NULL
  AND (
    lower(btrim(client_email)) IN ('t','teste','test','null','undefined','[object object]','na','n/a','')
    OR client_email NOT LIKE '%@%.%'
    OR client_email ~ '\s'
  );

-- C5d) Normalizar client_phone inválido para NULL nas proposals
UPDATE public.proposals
SET
  client_phone = NULL,
  updated_at   = now()
WHERE deleted_at IS NULL
  AND client_phone IS NOT NULL
  AND (
    lower(btrim(client_phone)) = '[object object]'
    OR btrim(client_phone) = ''
    OR regexp_replace(client_phone, '[^0-9]', '', 'g') = ''
    OR length(regexp_replace(client_phone, '[^0-9]', '', 'g')) < 10
  );

-- C5e) Soft-delete de proposals draft totalmente órfãs e sem dados úteis
UPDATE public.proposals
SET
  deleted_at = now(),
  status     = 'cancelled',
  updated_at = now()
WHERE deleted_at IS NULL
  AND status = 'draft'
  AND (client_name IS NULL OR NOT (coalesce(client_name, '') ~* '[A-Za-zÀ-ÖØ-öø-ÿ]'))
  AND (client_document IS NULL OR btrim(client_document) = '')
  AND (client_phone IS NULL OR btrim(client_phone) = '')
  AND (client_email IS NULL OR btrim(client_email) = '')
  AND (capex_total IS NULL OR capex_total = 0)
  AND (contract_value IS NULL OR contract_value = 0);

-- C5f) Proposals conflituosas com documento fake: marcar is_conflicted = true para revisão
--      Não apagar — apenas sinalizar para revisão operacional
UPDATE public.proposals
SET
  is_conflicted   = true,
  conflict_reason = coalesce(conflict_reason, '') || ' | bad_data_cleanse:document_placeholder',
  updated_at      = now()
WHERE deleted_at IS NULL
  AND is_conflicted = false
  AND client_document IS NOT NULL
  AND regexp_replace(client_document, '[^0-9]', '', 'g') ~ '^0+$';


-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
-- C6) LIMPEZA DE STORAGE
-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
-- Remover chaves técnicas que não representam dados de negócio.
-- Backupadas no BLOCO B antes desta remoção.

DELETE FROM public.storage
WHERE "key" IN ('clear', 'getItem', 'setItem', 'removeItem', 'vercel-toolbar-position')
   OR "key" LIKE '_STACK_AUTH%'
   OR "key" LIKE '__vercel_toolbar%'
   OR "key" LIKE 'vercel-%';


-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
-- COMMIT — confirmar todas as alterações
-- Para simular sem commitar, trocar por ROLLBACK
-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

COMMIT;


-- ============================================================================================================================
-- D) BLOCO DE RELATÓRIOS PÓS-LIMPEZA
-- ============================================================================================================================
-- Rodar após o COMMIT do BLOCO C para validar o resultado.
-- ============================================================================================================================

-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
-- D1) Clientes inválidos restantes (deveria ser 0 ou apenas os que têm vínculo e precisam de revisão manual)
-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

SELECT
  'D1 - clientes com nome inválido restantes' AS check_name,
  COUNT(*) AS total
FROM public.clients
WHERE deleted_at IS NULL
  AND (
    client_name IS NULL
    OR btrim(client_name) = ''
    OR NOT (coalesce(client_name, '') ~* '[A-Za-zÀ-ÖØ-öø-ÿ]')
  );


-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
-- D2) Duplicatas por CPF/CNPJ restantes
-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

SELECT
  'D2a - duplicatas CPF restantes' AS check_name,
  COUNT(DISTINCT cpf_normalized) AS grupos
FROM (
  SELECT cpf_normalized
  FROM public.clients
  WHERE cpf_normalized IS NOT NULL
    AND deleted_at IS NULL
    AND merged_into_client_id IS NULL
    AND regexp_replace(cpf_normalized, '[^0-9]', '', 'g') !~ '^0+$'
  GROUP BY cpf_normalized
  HAVING COUNT(*) > 1
) t;

SELECT
  'D2b - duplicatas CNPJ restantes' AS check_name,
  COUNT(DISTINCT cnpj_normalized) AS grupos
FROM (
  SELECT cnpj_normalized
  FROM public.clients
  WHERE cnpj_normalized IS NOT NULL
    AND deleted_at IS NULL
    AND merged_into_client_id IS NULL
    AND regexp_replace(cnpj_normalized, '[^0-9]', '', 'g') !~ '^0+$'
  GROUP BY cnpj_normalized
  HAVING COUNT(*) > 1
) t;


-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
-- D3) Contratos draft duplicados restantes
-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

SELECT
  'D3 - contratos draft duplicados restantes' AS check_name,
  COUNT(*) AS grupos,
  SUM(cnt - 1) AS excedentes
FROM (
  SELECT client_id, contract_type, contractual_term_months, COUNT(*) AS cnt
  FROM public.client_contracts
  WHERE contract_status = 'draft'
  GROUP BY client_id, contract_type, contractual_term_months
  HAVING COUNT(*) > 1
) t;


-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
-- D4) Billing incoerente restante
-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

SELECT
  'D4 - billing com datas incoerentes restantes' AS check_name,
  COUNT(*) AS total
FROM public.client_billing_profile
WHERE (first_billing_date IS NOT NULL
       AND expected_last_billing_date IS NOT NULL
       AND expected_last_billing_date < first_billing_date)
  OR (first_billing_date IS NOT NULL
      AND commissioning_date IS NOT NULL
      AND first_billing_date < commissioning_date);


-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
-- D5) Proposals órfãs restantes
-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

SELECT
  'D5 - proposals draft órfãs restantes' AS check_name,
  COUNT(*) AS total
FROM public.proposals
WHERE deleted_at IS NULL
  AND status = 'draft'
  AND (client_name IS NULL OR NOT (coalesce(client_name, '') ~* '[A-Za-zÀ-ÖØ-öø-ÿ]'))
  AND (client_document IS NULL OR btrim(client_document) = '')
  AND (client_phone IS NULL OR btrim(client_phone) = '')
  AND (client_email IS NULL OR btrim(client_email) = '')
  AND (capex_total IS NULL OR capex_total = 0)
  AND (contract_value IS NULL OR contract_value = 0);


-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
-- D6) Storage técnico restante (deveria ser 0)
-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

SELECT
  'D6 - storage com chaves técnicas restantes' AS check_name,
  COUNT(*) AS total
FROM public.storage
WHERE "key" IN ('clear', 'getItem', 'setItem', 'removeItem', 'vercel-toolbar-position')
   OR "key" LIKE '_STACK_AUTH%'
   OR "key" LIKE '__vercel_toolbar%'
   OR "key" LIKE 'vercel-%';


-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
-- D7) Resumo geral — quantos registros foram afetados por tabela (via backups criados)
-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

SELECT
  backup_reason,
  COUNT(*) AS registros_afetados
FROM data_hygiene.clients_backup
GROUP BY backup_reason
ORDER BY backup_reason;

SELECT
  backup_reason,
  COUNT(*) AS registros_afetados
FROM data_hygiene.client_contracts_backup
GROUP BY backup_reason;

SELECT
  backup_reason,
  COUNT(*) AS registros_afetados
FROM data_hygiene.client_billing_profile_backup
GROUP BY backup_reason;

SELECT
  backup_reason,
  COUNT(*) AS registros_afetados
FROM data_hygiene.client_usina_config_backup
GROUP BY backup_reason;

SELECT
  backup_reason,
  COUNT(*) AS registros_afetados
FROM data_hygiene.proposals_backup
GROUP BY backup_reason;

SELECT
  backup_reason,
  COUNT(*) AS registros_afetados
FROM data_hygiene.storage_backup
GROUP BY backup_reason;


-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
-- D8) Estado geral do banco após limpeza
-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

SELECT
  (SELECT COUNT(*) FROM public.clients WHERE deleted_at IS NULL)                                         AS clientes_ativos,
  (SELECT COUNT(*) FROM public.clients WHERE deleted_at IS NOT NULL)                                     AS clientes_soft_deleted,
  (SELECT COUNT(*) FROM public.clients WHERE identity_status = 'merged')                                 AS clientes_merged,
  (SELECT COUNT(*) FROM public.clients WHERE deleted_at IS NULL AND client_name IS NULL)                 AS clientes_sem_nome_vinculados,
  (SELECT COUNT(*) FROM public.proposals WHERE deleted_at IS NULL)                                       AS proposals_ativas,
  (SELECT COUNT(*) FROM public.client_contracts WHERE contract_status IN ('active','signed'))             AS contratos_ativos,
  (SELECT COUNT(*) FROM public.client_billing_profile WHERE payment_status NOT IN ('cancelled','written_off')) AS billing_ativos,
  (SELECT COUNT(*) FROM public.client_usina_config)                                                      AS usina_configs,
  (SELECT COUNT(*) FROM public.storage)                                                                  AS storage_total_keys;


-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
-- D9) Clientes que ainda precisam de revisão manual
--     (nome NULL + vínculo ativo — não puderam ser auto-limpados)
-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

SELECT
  c.id,
  c.client_name,
  c.email,
  c.cpf_normalized,
  c.cnpj_normalized,
  c.identity_status,
  c.in_portfolio,
  CASE
    WHEN EXISTS (SELECT 1 FROM public.client_contracts cc WHERE cc.client_id = c.id AND cc.contract_status IN ('active','signed')) THEN 'tem_contrato_ativo'
    WHEN EXISTS (SELECT 1 FROM public.client_billing_profile bp WHERE bp.client_id = c.id AND bp.payment_status NOT IN ('cancelled','written_off')) THEN 'tem_billing_ativo'
    ELSE 'tem_proposta_ativa'
  END AS motivo_retencao,
  c.created_at
FROM public.clients c
WHERE c.deleted_at IS NULL
  AND (
    c.client_name IS NULL
    OR NOT (coalesce(c.client_name, '') ~* '[A-Za-zÀ-ÖØ-öø-ÿ]')
  )
ORDER BY c.created_at;


-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
-- D10) Proposals conflituosas aguardando revisão
-- ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

SELECT
  id,
  proposal_type,
  status,
  client_name,
  client_document,
  client_email,
  is_conflicted,
  conflict_reason,
  created_at
FROM public.proposals
WHERE deleted_at IS NULL
  AND is_conflicted = true
ORDER BY created_at DESC
LIMIT 50;

-- ============================================================================================================================
-- FIM DO SCRIPT DE SANITIZAÇÃO
-- ============================================================================================================================
-- Para reverter qualquer alteração feita no BLOCO C, os dados originais
-- estão preservados nas tabelas do schema data_hygiene.
--
-- Para restaurar um registro específico de clientes, por exemplo:
--   INSERT INTO public.clients SELECT <colunas> FROM data_hygiene.clients_backup WHERE id = <id>;
--
-- Para limpar os backups após validação completa (somente quando seguro):
--   DROP SCHEMA data_hygiene CASCADE;
-- ============================================================================================================================
