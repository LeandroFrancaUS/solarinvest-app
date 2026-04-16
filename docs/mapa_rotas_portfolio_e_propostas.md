# Mapa de Rotas — Portfolio e Propostas

**Data da auditoria:** 2026-04-16  
**Fonte:** `server/handler.js`, `server/clients/handler.js`, `server/client-portfolio/handler.js`, `server/proposals/handler.js`

---

## 1. Rotas de Clientes (`server/clients/handler.js`)

### `GET /api/clients`
- **Handler:** `handleClientListRequest`
- **Tabelas:** `clients` LEFT JOIN `app_user_profiles` LEFT JOIN `client_energy_profile` LEFT JOIN LATERAL `proposals`
- **Query:** SELECT com paginação, filtros (search, city, state, createdBy, identityStatus)
- **Retorno:** Lista paginada com `energy_profile`, `latest_proposal_profile`, owner metadata
- **Status:** ✅ OK

### `POST /api/clients`
- **Handler:** `handleClientCreateRequest`
- **Tabelas:** `clients` INSERT, `client_energy_profile` upsert (se `body.energyProfile`)
- **Payload esperado:** `client_name`, `client_document`, `client_phone`, `client_email`, `client_city`, `client_state`, `client_address`, `client_cep`, `uc_geradora`, `uc_beneficiaria`, `distribuidora`, `system_kwp`, `term_months`, `consumption_kwh_month`, `metadata`, `energyProfile`
- **Transformação:** `toClientWritePayload()` normaliza nomes; campos de usina vão para `metadata` JSONB
- **Status:** ✅ OK

### `GET /api/clients/:id`
- **Handler:** `handleClientGetRequest`
- **Tabelas:** `clients` SELECT
- **Retorno:** Linha completa do cliente com normalização via `normalizeClientResponse()`
- **Status:** ✅ OK
- **Nota:** Retorna `metadata` JSONB raw, NÃO extrai campos de usina para top-level

### `PATCH /api/clients/:id` (ou `PUT`)
- **Handler:** `handleClientUpdateRequest`
- **Tabelas:** `clients` UPDATE, `client_energy_profile` upsert (se `body.energyProfile` ou campos plano leasing flat)
- **Payload:** Mesmos campos do create + detecção automática de plano leasing: `kwh_mes_contratado` → `kwh_contratado`, `desconto_percentual`, `tarifa_atual`, `valor_mensalidade` → `mensalidade`
- **Transformação:** `toClientWritePayload()` move campos de usina para `metadata`
- **Status:** ✅ OK

### `DELETE /api/clients/:id`
- **Handler:** `handleClientDeleteRequest`
- **Tabelas:** `clients` UPDATE (soft-delete: sets `deleted_at`)
- **Status:** ✅ OK

---

## 2. Rotas de Portfolio (`server/client-portfolio/handler.js`)

### `GET /api/client-portfolio`
- **Handler:** `handlePortfolioListRequest`
- **RBAC:** Leitura: role_admin, role_office, role_financeiro
- **Tabelas:** `clients` WHERE `in_portfolio = true`
- **Retorno:** Lista de clientes no portfolio com paginação e busca
- **Status:** ✅ OK

### `GET /api/client-portfolio/:clientId`
- **Handler:** `handlePortfolioGetRequest`
- **RBAC:** Leitura: role_admin, role_office, role_financeiro
- **Tabelas:** `clients` LEFT JOIN `client_contracts` LEFT JOIN `client_project_status` LEFT JOIN `client_billing_profile` LEFT JOIN `client_energy_profile`
- **Query:** SELECT com JOINs + fallback para clients-only se tabelas auxiliares não existem (42P01/42703)
- **Retorno:** Row completa + campos de usina extraídos de `metadata` JSONB para top-level:
  - `potencia_modulo_wp`, `numero_modulos`, `modelo_modulo`, `modelo_inversor`, `tipo_instalacao`, `area_instalacao_m2`, `geracao_estimada_kwh`
- **Status:** ✅ OK

### `PATCH /api/clients/:clientId/portfolio-export`
- **Handler:** `handlePortfolioExportRequest`
- **RBAC:** Escrita: role_admin, role_office
- **Tabelas:** `clients` UPDATE (sets `in_portfolio = true`)
- **Status:** ✅ OK

### `PATCH /api/client-portfolio/:clientId/lifecycle`
- **Handler:** `handlePortfolioLifecycleRequest`
- **RBAC:** Escrita: role_admin, role_office
- **Tabelas:** `client_lifecycle` UPDATE
- **Payload:** `lifecycle_status`, `onboarding_status`, `is_active_portfolio_client`
- **Status:** ✅ OK (depende da tabela `client_lifecycle` existir)

### `PATCH /api/client-portfolio/:clientId/contract`
- **Handler:** `handlePortfolioContractRequest`
- **RBAC:** Escrita: role_admin, role_office
- **Tabelas:** `client_contracts` UPSERT
- **Payload:** `contract_type`, `contract_status`, `contract_signed_at`, `billing_start_date`, `contractual_term_months`, `buyout_eligible`, `buyout_status`, `notes`, `consultant_id`, `consultant_name`, `contract_file_name`, `contract_file_url`, `contract_file_type`
- **Status:** ✅ OK (tabela existe desde migration 0029, estendida em 0031)

### `PATCH /api/client-portfolio/:clientId/project`
- **Handler:** `handlePortfolioProjectRequest`
- **RBAC:** Escrita: role_admin, role_office
- **Tabelas:** `client_project_status` UPSERT
- **Payload:** `project_status`, `installation_status`, `engineering_status`, `commissioning_date`, `expected_go_live_date`, `integrator_name`, `notes`
- **Status:** ✅ OK (tabela existe desde migration 0029)

### `PATCH /api/client-portfolio/:clientId/billing`
- **Handler:** `handlePortfolioBillingRequest`
- **RBAC:** Escrita: role_admin, role_office
- **Tabelas:** `client_billing_profile` UPSERT
- **Payload:** `due_day`, `reading_day`, `first_billing_date`, `recurrence_type`, `payment_status`, `delinquency_status`, `valor_mensalidade`, `commissioning_date`
- **Status:** ✅ OK (tabela existe desde migration 0029, estendida em 0031)

### `GET /api/client-portfolio/:clientId/notes`
- **Handler:** `handlePortfolioNotesGetRequest`
- **RBAC:** Leitura: role_admin, role_office, role_financeiro
- **Tabelas:** `client_notes` SELECT WHERE `client_id`
- **Status:** ✅ OK (tabela existe desde migration 0029)

### `POST /api/client-portfolio/:clientId/notes`
- **Handler:** `handlePortfolioNotesCreateRequest`
- **RBAC:** Escrita: role_admin, role_office
- **Tabelas:** `client_notes` INSERT
- **Payload:** `entry_type`, `title`, `content`
- **Status:** ✅ OK

---

## 3. Rotas de Propostas (`server/proposals/handler.js`)

### `GET /api/proposals`
- **Handler:** `handleProposalListRequest`
- **Tabelas:** `proposals` LEFT JOIN `app_user_profiles`
- **Filtros:** `type`, `status`, paginação
- **Retorno:** Lista paginada com `payload_json` completo
- **Status:** ✅ OK

### `POST /api/proposals`
- **Handler:** `handleProposalCreateRequest`
- **Tabelas:** `proposals` INSERT + `proposal_audit_log` INSERT
- **Payload:** `proposal_type` (required), `payload_json` (required), `client_*`, `consumption_kwh_month`, `system_kwp`, `term_months`, `capex_total`, `contract_value`, `uc_geradora_nm`, `uc_beneficiaria`
- **Processamento:** `resolveClientLinkByDocument()` busca `client_id` por documento; serializa `payload_json` como `JSON.stringify()::jsonb`
- **Status:** ✅ OK

### `GET /api/proposals/:id`
- **Handler:** `handleProposalGetRequest`
- **Tabelas:** `proposals` LEFT JOIN `app_user_profiles`
- **Retorno:** Linha completa incluindo `payload_json` JSONB
- **Status:** ✅ OK

### `PATCH /api/proposals/:id`
- **Handler:** `handleProposalUpdateRequest`
- **Tabelas:** `proposals` UPDATE + `proposal_audit_log` INSERT
- **Processamento:** Geração dinâmica de SET clause; `payload_json` substituído integralmente (full replace, não merge)
- **⚠️ Risco:** Se o frontend omitir campos no `payload_json`, eles são PERDIDOS. Não há merge de old + new.
- **Status:** ✅ OK (com risco documentado)

### `DELETE /api/proposals/:id`
- **Handler:** `handleProposalDeleteRequest`
- **Tabelas:** `proposals` UPDATE (soft-delete: sets `deleted_at`)
- **Status:** ✅ OK

---

## 4. Comparação: `/api/clients/:id` vs `/api/client-portfolio/:id`

| Campo | `/api/clients/:id` | `/api/client-portfolio/:id` | Observação |
|-------|--------------------|-----------------------------|------------|
| id, name, email, phone | ✅ | ✅ | — |
| city, state, address | ✅ | ✅ | — |
| document, document_type | ✅ | ✅ | — |
| consumption_kwh_month | ✅ | ✅ | — |
| system_kwp, term_months | ✅ | ✅ | — |
| distribuidora, uc, uc_beneficiaria | ✅ | ✅ | — |
| metadata (raw JSONB) | ✅ | ✅ (+ extraídos) | Portfolio extrai para top-level |
| cpf/cnpj normalized/raw | ✅ | ❌ | Portfolio não retorna |
| identity_status, origin | ✅ | ❌ | Portfolio não retorna |
| owner_user_id | ✅ | ✅ | — |
| energy_profile | ❌ (via lateral join) | ✅ (LEFT JOIN) | Diferentes mecanismos |
| contract fields | ❌ | ✅ | Apenas portfolio faz JOIN |
| project fields | ❌ | ✅ | Apenas portfolio faz JOIN |
| billing fields | ❌ | ✅ | Apenas portfolio faz JOIN |
| potencia_modulo_wp, etc. | ❌ (ficam em metadata) | ✅ (extraídos de metadata) | Portfolio extrai |
| latest_proposal_profile | ✅ (na listagem) | ❌ | Só na listagem de clientes |

**Conclusão:** Os endpoints servem propósitos diferentes. `/api/clients/:id` é para edição de dados core do cliente. `/api/client-portfolio/:id` é o endpoint completo para a carteira, com JOINs de todas as tabelas auxiliares.
