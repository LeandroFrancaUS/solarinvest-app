# Schema Real — NeonDB (PostgreSQL)

**Data da auditoria:** 2026-04-16  
**Fonte:** `db/migrations/0001` → `0031`  
**Método:** Leitura direta de todas as migrations SQL do repositório

---

## 1. Tabela `clients` (Entidade Principal)

| Coluna | Tipo | Nullable | Default | Observações |
|--------|------|----------|---------|-------------|
| `id` | BIGSERIAL | NOT NULL | auto | **PRIMARY KEY** |
| `client_name` | TEXT | YES | — | Renomeado de `name` (0028) |
| `client_document` | TEXT | YES | — | Renomeado de `document` (0027) |
| `client_email` | TEXT | YES | — | Renomeado de `email` (0027) |
| `client_phone` | TEXT | YES | — | Renomeado de `phone` (0027) |
| `client_city` | TEXT | YES | — | Renomeado de `city` (0027) |
| `client_state` | TEXT | YES | — | Renomeado de `state` (0027) |
| `client_address` | TEXT | YES | — | Renomeado de `address` (0027) |
| `client_cep` | TEXT | YES | — | CEP normalizado |
| `uc_geradora` | TEXT | YES | — | Renomeado de `uc` (0027) |
| `uc_beneficiaria` | TEXT | YES | — | Adicionado 0027 |
| `distribuidora` | TEXT | YES | — | — |
| `consumption_kwh_month` | NUMERIC | YES | — | Adicionado 0028 |
| `system_kwp` | NUMERIC | YES | — | Adicionado 0027 |
| `term_months` | TEXT | YES | — | Adicionado 0027 |
| `metadata` | JSONB | YES | — | **⚠️ Usado para campos de usina (potencia_modulo_wp, numero_modulos, etc.)** |
| `cpf_normalized` | TEXT | YES | — | UNIQUE parcial (active, non-merged) |
| `cpf_raw` | TEXT | YES | — | — |
| `cnpj_normalized` | TEXT | YES | — | — |
| `cnpj_raw` | TEXT | YES | — | — |
| `document_type` | TEXT | YES | — | — |
| `identity_status` | TEXT | YES | — | CHECK: pending_cpf, confirmed, merged, rejected, conflict |
| `merged_into_client_id` | BIGINT | YES | — | FK → clients(id) |
| `created_by_user_id` | TEXT | YES | — | — |
| `owner_user_id` | TEXT | YES | — | — |
| `owner_stack_user_id` | TEXT | YES | — | Adicionado 0014 |
| `user_id` | TEXT | YES | — | Legacy |
| `origin` | TEXT | YES | — | CHECK: online, offline, imported, synced, duplicated |
| `offline_origin_id` | TEXT | YES | — | — |
| `last_synced_at` | TIMESTAMPTZ | YES | — | — |
| `deleted_at` | TIMESTAMPTZ | YES | — | Soft-delete |
| `search_text` | TEXT | YES | — | — |
| `in_portfolio` | BOOLEAN | NOT NULL | false | Adicionado 0030 |
| `portfolio_exported_at` | TIMESTAMPTZ | YES | — | Adicionado 0030 |
| `portfolio_exported_by_user_id` | TEXT | YES | — | Adicionado 0030 |
| `created_at` | TIMESTAMPTZ | YES | now() | — |
| `updated_at` | TIMESTAMPTZ | YES | now() | — |

### Índices
- `idx_clients_cpf_normalized` (UNIQUE, parcial: active + non-merged)
- `idx_clients_identity_status`
- `idx_clients_owner_user_id`
- `idx_clients_deleted_at`
- `idx_clients_offline_origin`
- `idx_clients_active_not_deleted` (owner + identity_status)
- `idx_clients_in_portfolio` (parcial: true)

### ⚠️ Risco: `clients.metadata` JSONB
Os campos de usina são salvos dentro de `clients.metadata`:
- `potencia_modulo_wp`
- `numero_modulos`
- `modelo_modulo`
- `modelo_inversor`
- `tipo_instalacao`
- `area_instalacao_m2`
- `geracao_estimada_kwh`

Estes campos **NÃO são colunas reais**. São key-value dentro de JSONB, sem validação de tipo, sem constraint.

---

## 2. Tabela `proposals` (Propostas Leasing/Venda)

| Coluna | Tipo | Nullable | Default | Observações |
|--------|------|----------|---------|-------------|
| `id` | UUID | NOT NULL | gen_random_uuid() | **PRIMARY KEY** |
| `proposal_type` | TEXT | YES | — | CHECK: leasing, venda |
| `proposal_code` | TEXT | YES | — | Código legível |
| `version` | INT | YES | 1 | — |
| `status` | TEXT | YES | — | CHECK: draft, sent, approved, rejected, cancelled |
| `owner_user_id` | TEXT | NOT NULL | — | — |
| `owner_email` | TEXT | YES | — | — |
| `owner_display_name` | TEXT | YES | — | — |
| `created_by_user_id` | TEXT | NOT NULL | — | — |
| `updated_by_user_id` | TEXT | YES | — | — |
| `client_name` | TEXT | YES | — | Extraído do snapshot |
| `client_document` | TEXT | YES | — | — |
| `client_city` | TEXT | YES | — | — |
| `client_state` | TEXT | YES | — | — |
| `client_phone` | TEXT | YES | — | — |
| `client_email` | TEXT | YES | — | — |
| `client_cep` | TEXT | YES | — | — |
| `client_id` | TEXT | YES | — | Referência loose (não FK rígida) |
| `is_conflicted` | BOOLEAN | YES | — | — |
| `conflict_reason` | TEXT | YES | — | — |
| `consumption_kwh_month` | NUMERIC | YES | — | Extraído do snapshot |
| `system_kwp` | NUMERIC | YES | — | Extraído do snapshot |
| `capex_total` | NUMERIC | YES | — | — |
| `contract_value` | NUMERIC | YES | — | — |
| `term_months` | INT | YES | — | — |
| `uc_geradora_nm` | TEXT | YES | — | Renomeado de uc_geradora_numero (0027) |
| `uc_beneficiaria` | TEXT | YES | — | — |
| **`payload_json`** | **JSONB** | **NOT NULL** | **'{}'** | **⚠️ ARMAZENAMENTO PRINCIPAL: Todo o estado do formulário é serializado aqui** |
| `created_at` | TIMESTAMPTZ | YES | now() | — |
| `updated_at` | TIMESTAMPTZ | YES | now() | — |
| `deleted_at` | TIMESTAMPTZ | YES | — | Soft-delete |

### ⚠️ Risco: Toda proposta vive em `payload_json`
Os 80+ campos de leasing/venda são serializados como JSON dentro de `payload_json`. As colunas escalares (`client_name`, `system_kwp`, etc.) são **cópias denormalizadas** para indexação/listagem. O dado autoritativo é o `payload_json`.

---

## 3. Tabela `client_energy_profile`

| Coluna | Tipo | Nullable | Default | Observações |
|--------|------|----------|---------|-------------|
| `id` | BIGSERIAL | NOT NULL | auto | **PRIMARY KEY** |
| `client_id` | BIGINT | NOT NULL | — | **FK → clients(id) ON DELETE CASCADE**, UNIQUE |
| `kwh_contratado` | NUMERIC(12,2) | YES | — | — |
| `potencia_kwp` | NUMERIC(10,3) | YES | — | — |
| `tipo_rede` | TEXT | YES | — | — |
| `tarifa_atual` | NUMERIC(10,6) | YES | — | — |
| `desconto_percentual` | NUMERIC(5,2) | YES | — | — |
| `mensalidade` | NUMERIC(12,2) | YES | — | — |
| `indicacao` | TEXT | YES | — | — |
| `modalidade` | TEXT | YES | — | — |
| `prazo_meses` | INTEGER | YES | — | — |
| `marca_inversor` | TEXT | YES | — | Adicionado 0027 |
| `created_at` | TIMESTAMPTZ | YES | now() | — |
| `updated_at` | TIMESTAMPTZ | YES | now() | — |

---

## 4. Tabela `client_lifecycle`

| Coluna | Tipo | Nullable | Default | Observações |
|--------|------|----------|---------|-------------|
| `id` | BIGSERIAL | NOT NULL | auto | **PRIMARY KEY** |
| `client_id` | BIGINT | NOT NULL | — | **FK → clients(id) ON DELETE CASCADE**, UNIQUE |
| `lifecycle_status` | TEXT | YES | — | CHECK: lead, contracted, active, implementation, billing, churned, cancelled |
| `is_converted_customer` | BOOLEAN | YES | false | — |
| `exported_to_portfolio_at` | TIMESTAMPTZ | YES | — | — |
| `converted_from_lead_at` | TIMESTAMPTZ | YES | — | — |
| `onboarding_status` | TEXT | YES | — | — |
| `is_active_portfolio_client` | BOOLEAN | YES | false | — |
| `exported_by_user_id` | TEXT | YES | — | — |
| `created_at` | TIMESTAMPTZ | YES | now() | — |
| `updated_at` | TIMESTAMPTZ | YES | now() | — |

---

## 5. Tabela `client_contracts`

| Coluna | Tipo | Nullable | Default | Observações |
|--------|------|----------|---------|-------------|
| `id` | BIGSERIAL | NOT NULL | auto | **PRIMARY KEY** |
| `client_id` | BIGINT | NOT NULL | — | **FK → clients(id) ON DELETE CASCADE** |
| `source_proposal_id` | TEXT | YES | — | Referência loose (não FK) |
| `contract_type` | TEXT | YES | — | CHECK: leasing, sale, buyout |
| `contract_status` | TEXT | YES | — | CHECK: draft, active, signed, suspended, completed, cancelled |
| `contract_signed_at` | TIMESTAMPTZ | YES | — | — |
| `contract_start_date` | DATE | YES | — | — |
| `billing_start_date` | DATE | YES | — | — |
| `expected_billing_end_date` | DATE | YES | — | — |
| `contractual_term_months` | INTEGER | YES | — | — |
| `buyout_eligible` | BOOLEAN | YES | false | — |
| `buyout_status` | TEXT | YES | — | — |
| `buyout_date` | DATE | YES | — | — |
| `buyout_amount_reference` | NUMERIC(14,2) | YES | — | — |
| `notes` | TEXT | YES | — | — |
| `consultant_id` | TEXT | YES | — | Adicionado 0031 |
| `consultant_name` | TEXT | YES | — | Adicionado 0031 |
| `contract_file_name` | TEXT | YES | — | Adicionado 0031 |
| `contract_file_url` | TEXT | YES | — | Adicionado 0031 |
| `contract_file_type` | TEXT | YES | — | Adicionado 0031 |
| `created_at` | TIMESTAMPTZ | YES | now() | — |
| `updated_at` | TIMESTAMPTZ | YES | now() | — |

---

## 6. Tabela `client_project_status`

| Coluna | Tipo | Nullable | Default | Observações |
|--------|------|----------|---------|-------------|
| `id` | BIGSERIAL | NOT NULL | auto | **PRIMARY KEY** |
| `client_id` | BIGINT | NOT NULL | — | **FK → clients(id) ON DELETE CASCADE**, UNIQUE |
| `project_status` | TEXT | YES | — | CHECK: pending, engineering, installation, homologation, commissioned, active, issue |
| `installation_status` | TEXT | YES | — | — |
| `engineering_status` | TEXT | YES | — | — |
| `homologation_status` | TEXT | YES | — | — |
| `commissioning_status` | TEXT | YES | — | — |
| `commissioning_date` | DATE | YES | — | — |
| `first_injection_date` | DATE | YES | — | — |
| `first_generation_date` | DATE | YES | — | — |
| `expected_go_live_date` | DATE | YES | — | — |
| `integrator_name` | TEXT | YES | — | — |
| `engineer_name` | TEXT | YES | — | — |
| `timeline_velocity_score` | NUMERIC(5,2) | YES | — | — |
| `notes` | TEXT | YES | — | — |
| `created_at` | TIMESTAMPTZ | YES | now() | — |
| `updated_at` | TIMESTAMPTZ | YES | now() | — |

---

## 7. Tabela `client_billing_profile`

| Coluna | Tipo | Nullable | Default | Observações |
|--------|------|----------|---------|-------------|
| `id` | BIGSERIAL | NOT NULL | auto | **PRIMARY KEY** |
| `client_id` | BIGINT | NOT NULL | — | **FK → clients(id) ON DELETE CASCADE**, UNIQUE |
| `contract_id` | BIGINT | YES | — | FK → client_contracts(id) ON DELETE SET NULL |
| `due_day` | INTEGER | YES | — | — |
| `reading_day` | INTEGER | YES | — | — |
| `first_billing_date` | DATE | YES | — | — |
| `expected_last_billing_date` | DATE | YES | — | — |
| `recurrence_type` | TEXT | YES | — | CHECK: monthly, quarterly, annual, custom |
| `payment_status` | TEXT | YES | — | CHECK: pending, current, overdue, written_off, cancelled |
| `delinquency_status` | TEXT | YES | — | — |
| `collection_stage` | TEXT | YES | — | — |
| `auto_reminder_enabled` | BOOLEAN | YES | true | — |
| `valor_mensalidade` | NUMERIC(14,2) | YES | — | Adicionado 0031 |
| `commissioning_date` | DATE | YES | — | Adicionado 0031 |
| `created_at` | TIMESTAMPTZ | YES | now() | — |
| `updated_at` | TIMESTAMPTZ | YES | now() | — |

---

## 8. Tabela `client_notes`

| Coluna | Tipo | Nullable | Default | Observações |
|--------|------|----------|---------|-------------|
| `id` | BIGSERIAL | NOT NULL | auto | **PRIMARY KEY** |
| `client_id` | BIGINT | NOT NULL | — | **FK → clients(id) ON DELETE CASCADE** |
| `entry_type` | TEXT | YES | — | CHECK: note, observation, alert, milestone |
| `title` | TEXT | YES | — | — |
| `content` | TEXT | NOT NULL | — | — |
| `created_by_user_id` | TEXT | YES | — | — |
| `created_at` | TIMESTAMPTZ | YES | now() | — |

---

## 9. Tabela `proposal_audit_log`

| Coluna | Tipo | Nullable | Default | Observações |
|--------|------|----------|---------|-------------|
| `id` | UUID | NOT NULL | gen_random_uuid() | **PRIMARY KEY** |
| `proposal_id` | UUID | NOT NULL | — | **FK → proposals(id) ON DELETE CASCADE** |
| `actor_user_id` | TEXT | NOT NULL | — | — |
| `actor_email` | TEXT | YES | — | — |
| `action` | TEXT | YES | — | — |
| `old_value_json` | JSONB | YES | — | — |
| `new_value_json` | JSONB | YES | — | — |
| `created_at` | TIMESTAMPTZ | YES | now() | — |

---

## 10. Outras Tabelas

### `storage_events` (0001)
- `id` BIGSERIAL PK, `key`, `value`, `user_id`, `created_at`, `updated_at`
- Finalidade: Storage genérico key-value (legado)

### `app_user_access` (0004)
- `id` BIGSERIAL PK, `stack_user_id` (UNIQUE), `access_status`, `role`
- CHECK: role IN ('admin', 'manager', 'user')
- Finalidade: Controle de acesso RBAC

### `app_user_profiles` (0017)
- `id` BIGSERIAL PK, `stack_user_id` (UNIQUE), `primary_role`, `display_name`, `email`
- Finalidade: Perfil de usuário para display

### `db_backup_snapshots` (0026)
- `id` UUID PK, `table_name`, `snapshot_json`, `row_count`, `created_by_user_id`, `created_at`
- Finalidade: Backup de dados

### CRM Schema (0003)
- `users`, `contacts`, `pipelines`, `pipeline_stages`, `deals`, `quotes`, `activities`, `notes`
- Todas com UUID PK, FKs corretas

---

## Diagrama de Relacionamento

```
clients (id BIGSERIAL PK)
  ├── client_energy_profile (client_id FK, UNIQUE — 1:1)
  ├── client_lifecycle (client_id FK, UNIQUE — 1:1)
  ├── client_contracts (client_id FK — 1:N)
  │   └── client_billing_profile (contract_id FK — 1:1)
  ├── client_billing_profile (client_id FK, UNIQUE — 1:1)
  ├── client_project_status (client_id FK, UNIQUE — 1:1)
  ├── client_notes (client_id FK — 1:N)
  └── proposals (client_id loose TEXT ref — 1:N)
```
