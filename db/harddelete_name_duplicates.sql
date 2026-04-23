-- ============================================================================
-- SOLARINVEST — HARD-DELETE DE DUPLICADOS POR NOME (SEM BACKUP)
-- ============================================================================
--
-- OBJETIVO
-- --------
-- Para cada nome normalizado que apareça em mais de 1 registro:
--   • CLIENTES  → manter 1 registro (o mais "valioso"), redirecionar todas
--                 as FKs dependentes para ele, e DELETAR permanentemente
--                 os demais.
--   • PROPOSTAS → manter 1 proposta por nome normalizado de cliente (a mais
--                 completa/recente), e DELETAR permanentemente as demais.
--
-- ⚠️  ATENÇÃO — OPERAÇÃO DESTRUTIVA E IRREVERSÍVEL
-- -------------------------------------------------
--   • Não há backup. Os dados deletados NÃO podem ser recuperados depois do COMMIT.
--   • Executar pg_dump ANTES de rodar em produção, se houver qualquer dúvida.
--   • Para simular sem commitar: substituir COMMIT por ROLLBACK no final.
--
-- NORMALIZAÇÃO DE NOME (clientes e propostas):
--   lower(regexp_replace(btrim(client_name), '\s+', ' ', 'g'))
--
-- CRITÉRIO DE CANÔNICO — CLIENTES (em ordem de prioridade):
--   1. in_portfolio = true
--   2. contrato ativo / assinado / suspenso
--   3. billing ativo (não cancelado / baixado)
--   4. proposta vinculada ativa
--   5. documento válido (cpf_normalized ou cnpj_normalized não-nulo)
--   6. e-mail válido
--   7. telefone válido (≥ 10 dígitos)
--   8. updated_at mais recente
--   9. created_at mais recente
--  10. id menor (desempate final — mais antigo)
--
-- CRITÉRIO DE CANÔNICO — PROPOSTAS (em ordem de prioridade):
--   1. status: approved > sent > draft > cancelled/rejected
--   2. proposal_code não-nulo
--   3. capex_total não-nulo
--   4. consumption_kwh_month > 0
--   5. client_id não-nulo
--   6. updated_at mais recente
--   7. created_at mais recente
--   8. id menor (desempate final)
--
-- TABELAS AFETADAS (FKs migradas antes do delete):
--   proposals              (client_id)
--   client_contracts       (client_id)
--   client_notes           (client_id)
--   contacts               (client_id)
--   deals                  (client_id)
--   activities             (client_id)
--   notes                  (client_id)
--   client_billing_profile (client_id — UNIQUE: merge + delete)
--   client_usina_config    (client_id — UNIQUE: merge + delete)
--   client_lifecycle       (client_id — UNIQUE: merge + delete)
--   client_project_status  (client_id — UNIQUE: merge + delete)
--   client_energy_profile  (client_id — UNIQUE: merge + delete)
--
-- ============================================================================


BEGIN;

-- ============================================================================
-- ETAPA 1 — MAPEAMENTO DE CLIENTES DUPLICADOS (por nome normalizado)
-- ============================================================================

-- Tabela temporária de scores por cliente dentro de um grupo de nome duplicado.
-- Inclui clientes já soft-deleted para garantir que o canônico escolhido
-- seja sempre o de maior valor, independente do estado atual.

CREATE TEMP TABLE _client_dedup_scores AS
WITH dup_names AS (
  -- Nomes normalizados que aparecem em mais de 1 cliente (active ou soft-deleted)
  SELECT lower(regexp_replace(btrim(client_name), '\s+', ' ', 'g')) AS norm_name
  FROM public.clients
  WHERE coalesce(client_name, '') ~* '[A-Za-zÀ-ÖØ-öø-ÿ]'
  GROUP BY 1
  HAVING COUNT(*) > 1
)
SELECT
  c.id AS client_id,
  lower(regexp_replace(btrim(c.client_name), '\s+', ' ', 'g')) AS norm_name,
  (
    CASE WHEN c.in_portfolio                                                                                          THEN 500 ELSE 0 END
    + CASE WHEN EXISTS(SELECT 1 FROM public.client_contracts cc WHERE cc.client_id = c.id AND cc.contract_status IN ('active','signed','suspended')) THEN 400 ELSE 0 END
    + CASE WHEN EXISTS(SELECT 1 FROM public.client_billing_profile bp WHERE bp.client_id = c.id AND bp.payment_status NOT IN ('cancelled','written_off')) THEN 300 ELSE 0 END
    + CASE WHEN EXISTS(SELECT 1 FROM public.proposals p WHERE p.client_id = c.id AND p.deleted_at IS NULL AND p.status NOT IN ('cancelled','rejected')) THEN 200 ELSE 0 END
    + CASE WHEN c.cpf_normalized IS NOT NULL OR c.cnpj_normalized IS NOT NULL                                         THEN  50 ELSE 0 END
    + CASE WHEN c.client_email IS NOT NULL AND c.client_email LIKE '%@%.%'                                            THEN  30 ELSE 0 END
    + CASE WHEN c.client_phone IS NOT NULL AND length(regexp_replace(c.client_phone,'[^0-9]','','g')) >= 10           THEN  20 ELSE 0 END
    + CASE WHEN c.deleted_at IS NULL                                                                                  THEN  10 ELSE 0 END
  ) AS strength_score,
  c.updated_at,
  c.created_at
FROM public.clients c
JOIN dup_names dn ON dn.norm_name = lower(regexp_replace(btrim(c.client_name), '\s+', ' ', 'g'));

CREATE INDEX ON _client_dedup_scores (norm_name, strength_score DESC, updated_at DESC NULLS LAST, created_at DESC NULLS LAST, client_id ASC);


-- Tabela temporária com o mapa: canonical_id ↔ duplicate_id
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

-- Preview (informativo — não grava nada):
SELECT
  'clientes a deletar' AS check_name,
  COUNT(DISTINCT duplicate_id) AS total_duplicados,
  COUNT(DISTINCT norm_name)    AS grupos_nome
FROM _client_dedup_map;


-- ============================================================================
-- ETAPA 2 — ENRIQUECIMENTO DO CANÔNICO
-- Preenche campos vazios do canônico com os melhores dados dos duplicados.
-- Regra: nunca sobrescrever dado existente com NULL ou vazio.
-- ============================================================================

WITH best AS (
  SELECT
    dm.canonical_id,
    (array_agg(d.client_document   ORDER BY ds.strength_score DESC, d.updated_at DESC NULLS LAST, d.id ASC)
      FILTER (WHERE d.client_document IS NOT NULL AND btrim(d.client_document) <> ''))[1]  AS best_document,
    (array_agg(d.cpf_normalized    ORDER BY ds.strength_score DESC, d.updated_at DESC NULLS LAST, d.id ASC)
      FILTER (WHERE d.cpf_normalized IS NOT NULL))[1]                                       AS best_cpf_normalized,
    (array_agg(d.cpf_raw           ORDER BY ds.strength_score DESC, d.updated_at DESC NULLS LAST, d.id ASC)
      FILTER (WHERE d.cpf_raw IS NOT NULL AND btrim(d.cpf_raw) <> ''))[1]                   AS best_cpf_raw,
    (array_agg(d.cnpj_normalized   ORDER BY ds.strength_score DESC, d.updated_at DESC NULLS LAST, d.id ASC)
      FILTER (WHERE d.cnpj_normalized IS NOT NULL))[1]                                      AS best_cnpj_normalized,
    (array_agg(d.cnpj_raw          ORDER BY ds.strength_score DESC, d.updated_at DESC NULLS LAST, d.id ASC)
      FILTER (WHERE d.cnpj_raw IS NOT NULL AND btrim(d.cnpj_raw) <> ''))[1]                 AS best_cnpj_raw,
    (array_agg(d.document_type     ORDER BY ds.strength_score DESC, d.updated_at DESC NULLS LAST, d.id ASC)
      FILTER (WHERE d.document_type IS NOT NULL AND btrim(d.document_type) <> ''))[1]       AS best_document_type,
    (array_agg(d.client_email      ORDER BY ds.strength_score DESC, d.updated_at DESC NULLS LAST, d.id ASC)
      FILTER (WHERE d.client_email IS NOT NULL AND d.client_email LIKE '%@%.%'))[1]         AS best_email,
    (array_agg(d.client_phone      ORDER BY ds.strength_score DESC, d.updated_at DESC NULLS LAST, d.id ASC)
      FILTER (WHERE d.client_phone IS NOT NULL AND length(regexp_replace(d.client_phone,'[^0-9]','','g')) >= 10))[1] AS best_phone,
    (array_agg(d.client_city       ORDER BY ds.strength_score DESC, d.updated_at DESC NULLS LAST, d.id ASC)
      FILTER (WHERE d.client_city IS NOT NULL AND btrim(d.client_city) <> ''))[1]           AS best_city,
    (array_agg(d.client_state      ORDER BY ds.strength_score DESC, d.updated_at DESC NULLS LAST, d.id ASC)
      FILTER (WHERE d.client_state IS NOT NULL AND btrim(d.client_state) <> ''))[1]         AS best_state,
    (array_agg(d.client_address    ORDER BY ds.strength_score DESC, d.updated_at DESC NULLS LAST, d.id ASC)
      FILTER (WHERE d.client_address IS NOT NULL AND btrim(d.client_address) <> ''))[1]     AS best_address,
    (array_agg(d.cep               ORDER BY ds.strength_score DESC, d.updated_at DESC NULLS LAST, d.id ASC)
      FILTER (WHERE d.cep IS NOT NULL AND btrim(d.cep) <> ''))[1]                           AS best_cep,
    (array_agg(d.uc_geradora       ORDER BY ds.strength_score DESC, d.updated_at DESC NULLS LAST, d.id ASC)
      FILTER (WHERE d.uc_geradora IS NOT NULL AND btrim(d.uc_geradora) <> ''))[1]           AS best_uc_geradora,
    (array_agg(d.uc_beneficiaria   ORDER BY ds.strength_score DESC, d.updated_at DESC NULLS LAST, d.id ASC)
      FILTER (WHERE d.uc_beneficiaria IS NOT NULL AND btrim(d.uc_beneficiaria) <> ''))[1]   AS best_uc_beneficiaria,
    (array_agg(d.distribuidora     ORDER BY ds.strength_score DESC, d.updated_at DESC NULLS LAST, d.id ASC)
      FILTER (WHERE d.distribuidora IS NOT NULL AND btrim(d.distribuidora) <> ''))[1]       AS best_distribuidora,
    (array_agg(d.consumption_kwh_month ORDER BY ds.strength_score DESC, d.updated_at DESC NULLS LAST, d.id ASC)
      FILTER (WHERE d.consumption_kwh_month IS NOT NULL AND d.consumption_kwh_month > 0))[1] AS best_consumption_kwh_month,
    (array_agg(d.system_kwp        ORDER BY ds.strength_score DESC, d.updated_at DESC NULLS LAST, d.id ASC)
      FILTER (WHERE d.system_kwp IS NOT NULL AND d.system_kwp > 0))[1]                     AS best_system_kwp,
    (array_agg(d.logradouro        ORDER BY ds.strength_score DESC, d.updated_at DESC NULLS LAST, d.id ASC)
      FILTER (WHERE d.logradouro IS NOT NULL AND btrim(d.logradouro) <> ''))[1]             AS best_logradouro,
    (array_agg(d.numero            ORDER BY ds.strength_score DESC, d.updated_at DESC NULLS LAST, d.id ASC)
      FILTER (WHERE d.numero IS NOT NULL AND btrim(d.numero) <> ''))[1]                    AS best_numero,
    (array_agg(d.bairro            ORDER BY ds.strength_score DESC, d.updated_at DESC NULLS LAST, d.id ASC)
      FILTER (WHERE d.bairro IS NOT NULL AND btrim(d.bairro) <> ''))[1]                    AS best_bairro,
    (array_agg(d.observacoes       ORDER BY ds.strength_score DESC, d.updated_at DESC NULLS LAST, d.id ASC)
      FILTER (WHERE d.observacoes IS NOT NULL AND btrim(d.observacoes) <> ''))[1]          AS best_observacoes,
    -- Merge in_portfolio: se qualquer duplicado era in_portfolio, promover o canônico
    bool_or(d.in_portfolio) AS any_in_portfolio
  FROM _client_dedup_map dm
  JOIN public.clients d ON d.id = dm.duplicate_id
  JOIN _client_dedup_scores ds ON ds.client_id = dm.duplicate_id
  GROUP BY dm.canonical_id
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
  numero                = COALESCE(c.numero,                best.best_numero),
  bairro                = COALESCE(c.bairro,                best.best_bairro),
  observacoes           = COALESCE(c.observacoes,           best.best_observacoes),
  -- Herdar in_portfolio de qualquer duplicado que estava em portfólio
  in_portfolio          = c.in_portfolio OR best.any_in_portfolio,
  -- Se o canônico tinha deleted_at (era soft-deleted) mas existe duplicado ativo, reativar
  deleted_at            = CASE WHEN best.any_in_portfolio OR (c.deleted_at IS NOT NULL) THEN NULL ELSE c.deleted_at END,
  -- Garantir que canônico não aponte para ele mesmo via merged_into_client_id
  merged_into_client_id = NULL,
  identity_status       = CASE
                            WHEN c.identity_status IN ('merged','rejected') THEN 'confirmed'
                            WHEN c.identity_status = 'pending_cpf'
                             AND COALESCE(c.cpf_normalized, best.best_cpf_normalized) IS NOT NULL
                            THEN 'confirmed'
                            ELSE c.identity_status
                          END,
  updated_at            = now()
FROM best
WHERE c.id = best.canonical_id;


-- ============================================================================
-- ETAPA 3 — MIGRAÇÃO DE VÍNCULOS (FK → canonical_id)
-- Redirecionar ANTES de deletar os duplicados.
-- ============================================================================

-- proposals
UPDATE public.proposals p
SET   client_id = dm.canonical_id, updated_at = now()
FROM  _client_dedup_map dm
WHERE p.client_id = dm.duplicate_id;

-- client_contracts
UPDATE public.client_contracts cc
SET   client_id = dm.canonical_id, updated_at = now()
FROM  _client_dedup_map dm
WHERE cc.client_id = dm.duplicate_id;

-- client_notes
UPDATE public.client_notes cn
SET   client_id = dm.canonical_id
FROM  _client_dedup_map dm
WHERE cn.client_id = dm.duplicate_id;

-- contacts (CRM)
UPDATE public.contacts ct
SET   client_id = dm.canonical_id, updated_at = now()
FROM  _client_dedup_map dm
WHERE ct.client_id = dm.duplicate_id;

-- deals (CRM)
UPDATE public.deals dl
SET   client_id = dm.canonical_id, updated_at = now()
FROM  _client_dedup_map dm
WHERE dl.client_id = dm.duplicate_id;

-- activities (CRM)
UPDATE public.activities ac
SET   client_id = dm.canonical_id, updated_at = now()
FROM  _client_dedup_map dm
WHERE ac.client_id = dm.duplicate_id;

-- notes (CRM)
UPDATE public.notes n
SET   client_id = dm.canonical_id, updated_at = now()
FROM  _client_dedup_map dm
WHERE n.client_id = dm.duplicate_id;

-- clients auto-referência merged_into_client_id:
-- Se algum cliente aponta para um duplicado como seu "canônico de merge",
-- redirecionar para o novo canônico.
UPDATE public.clients c
SET   merged_into_client_id = dm.canonical_id, updated_at = now()
FROM  _client_dedup_map dm
WHERE c.merged_into_client_id = dm.duplicate_id
  AND c.id <> dm.canonical_id;

-- ── UNIQUE(client_id) tables: mesclar no canônico, depois deletar do duplicado ──

-- client_billing_profile
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
FROM _client_dedup_map dm
JOIN public.client_billing_profile bp_dup ON bp_dup.client_id = dm.duplicate_id
WHERE bp_canon.client_id = dm.canonical_id;

UPDATE public.client_billing_profile bp
SET   client_id = dm.canonical_id, updated_at = now()
FROM  _client_dedup_map dm
WHERE bp.client_id = dm.duplicate_id
  AND NOT EXISTS (SELECT 1 FROM public.client_billing_profile WHERE client_id = dm.canonical_id);

DELETE FROM public.client_billing_profile
WHERE client_id IN (SELECT duplicate_id FROM _client_dedup_map);

-- client_usina_config
UPDATE public.client_usina_config uc_canon
SET
  potencia_modulo_wp   = COALESCE(uc_canon.potencia_modulo_wp,   uc_dup.potencia_modulo_wp),
  numero_modulos       = COALESCE(uc_canon.numero_modulos,       uc_dup.numero_modulos),
  modelo_modulo        = COALESCE(uc_canon.modelo_modulo,        uc_dup.modelo_modulo),
  modelo_inversor      = COALESCE(uc_canon.modelo_inversor,      uc_dup.modelo_inversor),
  tipo_instalacao      = COALESCE(uc_canon.tipo_instalacao,      uc_dup.tipo_instalacao),
  area_instalacao_m2   = COALESCE(uc_canon.area_instalacao_m2,   uc_dup.area_instalacao_m2),
  geracao_estimada_kwh = COALESCE(uc_canon.geracao_estimada_kwh, uc_dup.geracao_estimada_kwh),
  updated_at           = now()
FROM _client_dedup_map dm
JOIN public.client_usina_config uc_dup ON uc_dup.client_id = dm.duplicate_id
WHERE uc_canon.client_id = dm.canonical_id;

UPDATE public.client_usina_config uc
SET   client_id = dm.canonical_id, updated_at = now()
FROM  _client_dedup_map dm
WHERE uc.client_id = dm.duplicate_id
  AND NOT EXISTS (SELECT 1 FROM public.client_usina_config WHERE client_id = dm.canonical_id);

DELETE FROM public.client_usina_config
WHERE client_id IN (SELECT duplicate_id FROM _client_dedup_map);

-- client_lifecycle
UPDATE public.client_lifecycle lc_canon
SET
  lifecycle_status           = CASE
                                 WHEN lc_canon.lifecycle_status = 'billing'    THEN lc_canon.lifecycle_status
                                 WHEN lc_dup.lifecycle_status   = 'billing'    THEN lc_dup.lifecycle_status
                                 WHEN lc_canon.lifecycle_status = 'active'     THEN lc_canon.lifecycle_status
                                 WHEN lc_dup.lifecycle_status   = 'active'     THEN lc_dup.lifecycle_status
                                 WHEN lc_canon.lifecycle_status = 'contracted' THEN lc_canon.lifecycle_status
                                 WHEN lc_dup.lifecycle_status   = 'contracted' THEN lc_dup.lifecycle_status
                                 ELSE COALESCE(lc_canon.lifecycle_status, lc_dup.lifecycle_status)
                               END,
  is_converted_customer      = (lc_canon.is_converted_customer OR lc_dup.is_converted_customer),
  is_active_portfolio_client = (lc_canon.is_active_portfolio_client OR lc_dup.is_active_portfolio_client),
  exported_to_portfolio_at   = COALESCE(lc_canon.exported_to_portfolio_at,  lc_dup.exported_to_portfolio_at),
  converted_from_lead_at     = COALESCE(lc_canon.converted_from_lead_at,   lc_dup.converted_from_lead_at),
  onboarding_status          = COALESCE(lc_canon.onboarding_status,         lc_dup.onboarding_status),
  exported_by_user_id        = COALESCE(lc_canon.exported_by_user_id,       lc_dup.exported_by_user_id),
  updated_at                 = now()
FROM _client_dedup_map dm
JOIN public.client_lifecycle lc_dup ON lc_dup.client_id = dm.duplicate_id
WHERE lc_canon.client_id = dm.canonical_id;

UPDATE public.client_lifecycle lc
SET   client_id = dm.canonical_id, updated_at = now()
FROM  _client_dedup_map dm
WHERE lc.client_id = dm.duplicate_id
  AND NOT EXISTS (SELECT 1 FROM public.client_lifecycle WHERE client_id = dm.canonical_id);

DELETE FROM public.client_lifecycle
WHERE client_id IN (SELECT duplicate_id FROM _client_dedup_map);

-- client_project_status
UPDATE public.client_project_status ps_canon
SET
  installation_status   = COALESCE(ps_canon.installation_status,   ps_dup.installation_status),
  engineering_status    = COALESCE(ps_canon.engineering_status,    ps_dup.engineering_status),
  homologation_status   = COALESCE(ps_canon.homologation_status,   ps_dup.homologation_status),
  commissioning_status  = COALESCE(ps_canon.commissioning_status,  ps_dup.commissioning_status),
  commissioning_date    = COALESCE(ps_canon.commissioning_date,    ps_dup.commissioning_date),
  first_injection_date  = COALESCE(ps_canon.first_injection_date,  ps_dup.first_injection_date),
  first_generation_date = COALESCE(ps_canon.first_generation_date, ps_dup.first_generation_date),
  expected_go_live_date = COALESCE(ps_canon.expected_go_live_date, ps_dup.expected_go_live_date),
  integrator_name       = COALESCE(ps_canon.integrator_name,       ps_dup.integrator_name),
  engineer_name         = COALESCE(ps_canon.engineer_name,         ps_dup.engineer_name),
  notes                 = CASE
                            WHEN ps_canon.notes IS NULL THEN ps_dup.notes
                            WHEN ps_dup.notes   IS NULL THEN ps_canon.notes
                            ELSE ps_canon.notes || E'\n---\n' || ps_dup.notes
                          END,
  updated_at            = now()
FROM _client_dedup_map dm
JOIN public.client_project_status ps_dup ON ps_dup.client_id = dm.duplicate_id
WHERE ps_canon.client_id = dm.canonical_id;

UPDATE public.client_project_status ps
SET   client_id = dm.canonical_id, updated_at = now()
FROM  _client_dedup_map dm
WHERE ps.client_id = dm.duplicate_id
  AND NOT EXISTS (SELECT 1 FROM public.client_project_status WHERE client_id = dm.canonical_id);

DELETE FROM public.client_project_status
WHERE client_id IN (SELECT duplicate_id FROM _client_dedup_map);

-- client_energy_profile
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
FROM _client_dedup_map dm
JOIN public.client_energy_profile ep_dup ON ep_dup.client_id = dm.duplicate_id
WHERE ep_canon.client_id = dm.canonical_id;

UPDATE public.client_energy_profile ep
SET   client_id = dm.canonical_id, updated_at = now()
FROM  _client_dedup_map dm
WHERE ep.client_id = dm.duplicate_id
  AND NOT EXISTS (SELECT 1 FROM public.client_energy_profile WHERE client_id = dm.canonical_id);

DELETE FROM public.client_energy_profile
WHERE client_id IN (SELECT duplicate_id FROM _client_dedup_map);


-- ============================================================================
-- ETAPA 4 — HARD-DELETE DOS CLIENTES DUPLICADOS
-- ============================================================================

DELETE FROM public.clients
WHERE id IN (SELECT duplicate_id FROM _client_dedup_map);


-- ============================================================================
-- ETAPA 5 — MAPEAMENTO DE PROPOSTAS DUPLICADAS (por nome normalizado)
-- ============================================================================

CREATE TEMP TABLE _proposal_dedup_map AS
WITH dup_names AS (
  -- Nomes normalizados com mais de 1 proposta (não deletadas)
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
      + CASE WHEN p.capex_total IS NOT NULL AND p.capex_total > 0              THEN 100 ELSE 0 END
      + CASE WHEN p.consumption_kwh_month IS NOT NULL AND p.consumption_kwh_month > 0 THEN 50 ELSE 0 END
      + CASE WHEN p.client_id IS NOT NULL                                       THEN  30 ELSE 0 END
      + CASE WHEN p.contract_value IS NOT NULL AND p.contract_value > 0         THEN  20 ELSE 0 END
    ) AS score
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
      ORDER BY score DESC, updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id ASC
    ) AS rn
  FROM scored
  JOIN public.proposals pp ON pp.id = scored.proposal_id
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

-- Preview (informativo):
SELECT
  'propostas a deletar' AS check_name,
  COUNT(DISTINCT duplicate_id) AS total_duplicadas,
  COUNT(DISTINCT norm_name)    AS grupos_nome
FROM _proposal_dedup_map;


-- ============================================================================
-- ETAPA 6 — HARD-DELETE DAS PROPOSTAS DUPLICADAS
-- proposal_audit_log tem ON DELETE CASCADE → deletado automaticamente
-- ============================================================================

DELETE FROM public.proposals
WHERE id IN (SELECT duplicate_id FROM _proposal_dedup_map);


-- ============================================================================
-- ETAPA 7 — LIMPEZA EXTRA: clientes com nome inválido sem nenhum vínculo ativo
-- (sem portfólio, sem contrato, sem billing, sem proposta ativa)
-- ============================================================================

DELETE FROM public.clients c
WHERE NOT (coalesce(c.client_name, '') ~* '[A-Za-zÀ-ÖØ-öø-ÿ]')
  AND c.in_portfolio = false
  AND c.cpf_normalized IS NULL
  AND c.cnpj_normalized IS NULL
  AND NOT EXISTS (SELECT 1 FROM public.client_contracts    cc WHERE cc.client_id = c.id AND cc.contract_status IN ('active','signed','suspended'))
  AND NOT EXISTS (SELECT 1 FROM public.client_billing_profile bp WHERE bp.client_id = c.id AND bp.payment_status NOT IN ('cancelled','written_off'))
  AND NOT EXISTS (SELECT 1 FROM public.proposals             p  WHERE p.client_id  = c.id AND p.deleted_at IS NULL AND p.status NOT IN ('cancelled','rejected'));


-- ============================================================================
-- ETAPA 8 — LIMPEZA EXTRA: propostas draft completamente vazias
-- ============================================================================

DELETE FROM public.proposals
WHERE deleted_at IS NULL
  AND coalesce(status, '') = 'draft'
  AND proposal_code IS NULL
  AND client_id IS NULL
  AND nullif(trim(coalesce(client_name,     '')), '') IS NULL
  AND nullif(trim(coalesce(client_document, '')), '') IS NULL
  AND nullif(trim(coalesce(client_email,    '')), '') IS NULL
  AND nullif(trim(coalesce(client_phone,    '')), '') IS NULL
  AND coalesce(consumption_kwh_month, 0) = 0
  AND capex_total IS NULL;


COMMIT;  -- ← substituir por ROLLBACK para dry-run (simular sem gravar)


-- ============================================================================
-- VERIFICAÇÃO FINAL
-- ============================================================================

-- V.1  Clientes listáveis após limpeza (deve ser muito menor que 1891)
SELECT count(*) AS listable_clients FROM public.vw_clients_listable;

-- V.2  Propostas listáveis após limpeza
SELECT count(*) AS listable_proposals FROM public.vw_proposals_listable;

-- V.3  Confirmar zero duplicados por nome (clientes ativos)
SELECT count(*) AS grupos_ainda_duplicados
FROM (
  SELECT lower(regexp_replace(btrim(client_name), '\s+', ' ', 'g')) AS norm_name
  FROM public.clients
  WHERE deleted_at IS NULL
    AND merged_into_client_id IS NULL
    AND coalesce(client_name, '') ~* '[A-Za-zÀ-ÖØ-öø-ÿ]'
  GROUP BY 1
  HAVING COUNT(*) > 1
) t;

-- V.4  Confirmar zero duplicados por nome (propostas ativas)
SELECT count(*) AS grupos_proposta_ainda_duplicados
FROM (
  SELECT lower(regexp_replace(btrim(client_name), '\s+', ' ', 'g')) AS norm_name
  FROM public.proposals
  WHERE deleted_at IS NULL
    AND coalesce(client_name, '') ~* '[A-Za-zÀ-ÖØ-öø-ÿ]'
  GROUP BY 1
  HAVING COUNT(*) > 1
) t;

-- V.5  Snapshot geral do banco
SELECT
  count(*)                                                              AS total_clients,
  count(*) FILTER (WHERE deleted_at IS NULL AND merged_into_client_id IS NULL) AS active_clean,
  count(*) FILTER (WHERE deleted_at IS NOT NULL)                        AS soft_deleted,
  count(*) FILTER (WHERE merged_into_client_id IS NOT NULL)             AS merged
FROM public.clients;

-- V.6  Snapshot de propostas
SELECT
  count(*)                                           AS total_proposals,
  count(*) FILTER (WHERE deleted_at IS NULL)         AS active_proposals,
  count(*) FILTER (WHERE deleted_at IS NOT NULL)     AS deleted_proposals
FROM public.proposals;
