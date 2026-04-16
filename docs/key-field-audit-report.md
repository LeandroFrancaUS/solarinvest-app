# Key-Field Audit Report — Carteira de Clientes + Propostas

**Date:** 2026-04-16  
**Scope:** Carteira de Clientes, Formulário Leasing, Formulário Venda  
**Status:** Complete

---

## 1. Executive Summary

A comprehensive audit was performed across all UI form fields in the Client Portfolio (Carteira de Clientes) tabs and the Leasing/Venda proposal forms. The audit traced each field through four layers:

1. **UI** → visible label and input element  
2. **State** → React state / Zustand store variable  
3. **API** → field name in request/response payload  
4. **DB** → column/table in NeonDB (PostgreSQL)

### Results

| Status | Count | Details |
|--------|-------|---------|
| ✅ Fully persisted end-to-end | 42 | All layers mapped correctly |
| ⚠️ Fixed in this PR | 1 | `tipo_rede` — had UI input but was missing from save payload |
| ℹ️ State-only (no UI input) | 1 | `buyout_status` — in state/API but no visible input control |
| ℹ️ Read-only / computed | 5 | Billing calculations, installment schedule, notifications |

---

## 2. Fields Fixed in This PR

### 2.1 `tipo_rede` (Tipo de Rede)

| Layer | Before | After |
|-------|--------|-------|
| UI input | ✅ Dropdown in UfConfigurationFields | ✅ No change |
| State | ⚠️ Hardcoded `''` (not initialized from DB) | ✅ Initialized from `client.tipo_rede` |
| Save payload | ❌ Missing from `handleSave()` | ✅ Sent via `energyProfile.tipo_rede` |
| DB column | ✅ `client_energy_profile.tipo_rede` exists | ✅ No change |
| Read back | ✅ `getPortfolioClient` returns `ep.tipo_rede` | ✅ No change |

**Root cause:** The `UsinaTab` component initialized `tipo_rede` as a hardcoded empty string instead of reading from the client data, and did not include it in the save payload. The DB column and API read path already existed.

---

## 3. Fields Audited — Carteira de Clientes

### 3.1 Editar Tab (Client Identity + Energy)

All 13 fields are fully persisted via `PUT /api/clients/:id`:

| Key Field | UI Label | DB Column | Status |
|-----------|----------|-----------|--------|
| nome_cliente | Nome / Razão Social | clients.client_name | ✅ OK |
| documento_cliente | Documento (CPF/CNPJ) | clients.client_document | ✅ OK |
| telefone | Telefone | clients.client_phone | ✅ OK |
| email | E-mail | clients.client_email | ✅ OK |
| cidade | Cidade | clients.client_city | ✅ OK |
| uf | Estado (UF) | clients.client_state | ✅ OK |
| endereco | Endereço | clients.client_address | ✅ OK |
| distribuidora | Distribuidora | clients.distribuidora | ✅ OK |
| uc_geradora | UC Geradora | clients.uc_geradora | ✅ OK |
| uc_beneficiaria | UC Beneficiária | clients.uc_beneficiaria | ✅ OK |
| consumo_kwh_mes | Consumo (kWh/mês) | clients.consumption_kwh_month | ✅ OK |
| potencia_sistema_kwp | Potência (kWp) | clients.system_kwp | ✅ OK |
| prazo_meses | Prazo Contratual (meses) | clients.term_months | ✅ OK |

### 3.2 Usina Tab (UF Configuration)

All 9 fields persisted via `PUT /api/clients/:id` (metadata JSONB + energy profile):

| Key Field | UI Label | DB Storage | Status |
|-----------|----------|------------|--------|
| potencia_modulo_wp | Potência do módulo (Wp) | clients.metadata JSONB | ✅ OK |
| numero_modulos | Nº de módulos | clients.metadata JSONB | ✅ OK |
| modelo_modulo | Modelo do módulo | clients.metadata JSONB | ✅ OK |
| modelo_inversor | Modelo do inversor | clients.metadata JSONB | ✅ OK |
| tipo_instalacao | Tipo de instalação | clients.metadata JSONB | ✅ OK |
| area_instalacao_m2 | Área utilizada (m²) | clients.metadata JSONB | ✅ OK |
| geracao_estimada_kwh | Geração estimada (kWh/mês) | clients.metadata JSONB | ✅ OK |
| potencia_kwp | Potência do sistema (kWp) | clients.system_kwp | ✅ OK |
| tipo_rede | Tipo de rede | client_energy_profile.tipo_rede | ✅ FIXED |

### 3.3 Contrato Tab

All 10 fields persisted via `PATCH /api/client-portfolio/:id/contract`:

| Key Field | UI Label | DB Column | Status |
|-----------|----------|-----------|--------|
| tipo_contrato | Tipo de Contrato | client_contracts.contract_type | ✅ OK |
| status_contrato | Status do Contrato | client_contracts.contract_status | ✅ OK |
| data_assinatura | Data de Assinatura | client_contracts.contract_signed_at | ✅ OK |
| inicio_cobranca | Início da Cobrança | client_contracts.billing_start_date | ✅ OK |
| prazo_contratual | Prazo Contratual (meses) | client_contracts.contractual_term_months | ✅ OK |
| buyout_eligible | Elegível para Buy Out | client_contracts.buyout_eligible | ✅ OK |
| consultor_id | ID do Consultor | client_contracts.consultant_id | ✅ OK |
| consultor_nome | Nome do Consultor | client_contracts.consultant_name | ✅ OK |
| arquivo_nome | Nome do arquivo | client_contracts.contract_file_name | ✅ OK |
| observacoes | Observações | client_contracts.notes | ✅ OK |

> **Note:** `buyout_status` exists in form state and is sent in the payload but has no visible UI input element. The value persists when set programmatically.

### 3.4 Projeto Tab

All 7 fields persisted via `PATCH /api/client-portfolio/:id/project`:

| Key Field | UI Label | DB Column | Status |
|-----------|----------|-----------|--------|
| status_projeto | Status Geral | client_project_status.project_status | ✅ OK |
| status_instalacao | Status Instalação | client_project_status.installation_status | ✅ OK |
| status_engenharia | Status Engenharia | client_project_status.engineering_status | ✅ OK |
| data_comissionamento | Data de Comissionamento | client_project_status.commissioning_date | ✅ OK |
| previsao_go_live | Previsão de Go-Live | client_project_status.expected_go_live_date | ✅ OK |
| integrador | Integrador | client_project_status.integrator_name | ✅ OK |
| observacoes | Observações | client_project_status.notes | ✅ OK |

### 3.5 Plano Leasing Tab

All 4 fields persisted via `PUT /api/clients/:id` → energy profile upsert:

| Key Field | UI Label | DB Column | Status |
|-----------|----------|-----------|--------|
| kwh_mes_contratado | kWh/mês Contratado | client_energy_profile.kwh_contratado | ✅ OK |
| desconto_percentual | Desconto (%) | client_energy_profile.desconto_percentual | ✅ OK |
| tarifa_atual | Tarifa Atual (R$/kWh) | client_energy_profile.tarifa_atual | ✅ OK |
| valor_mensalidade | Valor Mensalidade (R$) | client_energy_profile.mensalidade | ✅ OK |

### 3.6 Cobrança Tab

All 8 editable fields persisted via `PATCH /api/client-portfolio/:id/billing`:

| Key Field | UI Label | DB Column | Status |
|-----------|----------|-----------|--------|
| dia_vencimento | Dia de Vencimento | client_billing_profile.due_day | ✅ OK |
| dia_leitura | Dia de Leitura | client_billing_profile.reading_day | ✅ OK |
| data_comissionamento | Data de Comissionamento | client_billing_profile.commissioning_date | ✅ OK |
| valor_mensalidade | Valor da Mensalidade (R$) | client_billing_profile.valor_mensalidade | ✅ OK |
| primeiro_vencimento | Primeiro Vencimento | client_billing_profile.first_billing_date | ✅ OK |
| recorrencia | Recorrência | client_billing_profile.recurrence_type | ✅ OK |
| status_pagamento | Status de Pagamento | client_billing_profile.payment_status | ✅ OK |
| status_inadimplencia | Status de Inadimplência | client_billing_profile.delinquency_status | ✅ OK |

> **Read-only sections** (computed, not persisted): Cálculo de Vencimento, Parcelas, Notificações Pendentes.

### 3.7 Notas Tab

| Key Field | UI Label | DB Column | Status |
|-----------|----------|-----------|--------|
| notas_conteudo | Adicionar observação… | client_notes.content | ✅ OK |

---

## 4. Proposal Forms — Persistence via `proposals.payload_json`

Leasing and Venda proposal forms store their detailed data in the `proposals.payload_json` JSONB column. Key client-level fields are also extracted to dedicated columns on the proposals table:

| Extracted Column | Leasing Source | Venda Source |
|-----------------|----------------|--------------|
| proposals.client_name | contrato.proprietarios[0].nome | cliente.nome |
| proposals.client_document | contrato.proprietarios[0].documento | cliente.documento |
| proposals.client_phone | — | cliente.telefone |
| proposals.client_email | — | cliente.email |
| proposals.client_city | — | cliente.cidade |
| proposals.client_state | — | cliente.uf |
| proposals.consumption_kwh_month | energiaContratadaKwhMes | parametros.consumo_kwh_mes |
| proposals.system_kwp | dadosTecnicos.potenciaInstaladaKwp | configuracao.potencia_sistema_kwp |
| proposals.term_months | prazoContratualMeses | parametros.horizonte_meses |
| proposals.contract_value | — | resumoProposta.valor_total_proposta |
| proposals.capex_total | — | resumoProposta.custo_implantacao_referencia |

All remaining fields (technical specs, payment terms, projections, etc.) are stored in `payload_json` and retrieved intact on reload.

---

## 5. Shared Mappings

The following key fields serve multiple UI areas. All share the same source of truth:

| Key Field | Source Table | Used In |
|-----------|-------------|---------|
| nome_cliente | clients.client_name | Editar, Leasing, Venda |
| consumo_kwh_mes | clients.consumption_kwh_month | Editar, Leasing, Venda |
| potencia_sistema_kwp | clients.system_kwp | Editar, Usina, Leasing, Venda |
| tarifa_atual | client_energy_profile.tarifa_atual | Plano, Leasing, Venda |
| desconto_percentual | client_energy_profile.desconto_percentual | Plano, Leasing |
| valor_mensalidade | client_billing_profile.valor_mensalidade | Plano, Cobrança |
| data_comissionamento | (2 tables) | Projeto, Cobrança |

---

## 6. Database Entity Relationships

```
clients (id PK)
  ├── client_energy_profile (client_id FK → clients.id, UNIQUE)
  ├── client_contracts (client_id FK → clients.id)
  ├── client_project_status (client_id FK → clients.id, UNIQUE)
  ├── client_billing_profile (client_id FK → clients.id, UNIQUE)
  ├── client_notes (client_id FK → clients.id)
  ├── client_lifecycle (client_id FK → clients.id, UNIQUE)
  └── proposals (linked via payload, not FK)
```

---

## 7. Pending / Future Considerations

1. **buyout_status** has no UI input — if users need to edit it, a dropdown should be added to ContratoTab.
2. **Contract file upload** — only filename is editable; actual file upload/storage needs a file upload endpoint.
3. **Proposal → Portfolio migration** — when a client is exported to portfolio ("negócio fechado"), proposal data populates client fields. The energy profile data from proposals could be auto-migrated.
4. **Installment tracking** — billing installments are computed client-side but not stored. If individual payment tracking is needed, a `client_installments` table would be required.
