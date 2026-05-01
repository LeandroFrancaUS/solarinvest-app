# Adapter Layer — Field Mapping Reference

`server/adapters/` — compatibility layer between the new app model and the production PostgreSQL schema.

All adapters are **pure data-mapping functions** (no DB access).
They sit between route handlers and repository queries.

---

## Quick-start

```js
import { ClientAdapter, AuthAdapter } from '../adapters/index.js'

// 1. Resolve the RLS actor from the HTTP request
const actor = AuthAdapter.fromStackUserAndPermissions(stackUser, permissions)

// 2. Convert app model → DB shape before INSERT/UPDATE
const dbShape = ClientAdapter.toDb(appModel, actor, 'insert')

// 3. Convert DB row → app model after SELECT
const appModel = ClientAdapter.fromDb(dbRow)

// 4. Soft-delete
const sdShape = ClientAdapter.toSoftDelete(id, actor)
```

---

## 1. ClientAdapter (`clientAdapter.js`)

**Source table:** `public.clients`

| App model field | DB column | Notes |
|---|---|---|
| `id` | `id` | BIGSERIAL |
| `name` | `client_name` | Renamed from `name` in migration 0028 |
| `document` | `client_document` | Raw doc string; also drives normalization |
| `email` | `client_email` | Renamed from `email` in migration 0027 |
| `phone` | `client_phone` | Renamed from `phone` in migration 0027 |
| `city` | `client_city` | Renamed from `city` in migration 0027 |
| `state` | `client_state` | Renamed from `state` in migration 0027 |
| `address` | `client_address` | Renamed from `address` in migration 0027 |
| `cep` | `client_cep` | — |
| `owner` | `owner_user_id` | Stack Auth user ID of owner |
| `cpf_normalized` | `cpf_normalized` | Auto-populated by `normalizeDocumentServer()` |
| `cnpj_normalized` | `cnpj_normalized` | Auto-populated by `normalizeDocumentServer()` |
| `document_type` | `document_type` | `'cpf'` \| `'cnpj'` \| `'unknown'` |
| `uc` | `uc_geradora` | Renamed from `uc` in migration 0027 |
| `uc_beneficiaria` | `uc_beneficiaria` | — |
| `system_kwp` | `system_kwp` | — |
| `term_months` | `term_months` | — |
| `consumption_kwh_month` | `consumption_kwh_month` | — |
| `distribuidora` | `distribuidora` | — |
| `status_comercial` | `status_comercial` | `LEAD` \| `PROPOSTA_ENVIADA` \| … |
| `status_cliente` | `status_cliente` | `NAO_CLIENTE` \| `ATIVO` \| … |
| `in_portfolio` | `in_portfolio` | Boolean; set when exported to Carteira |
| `consultant_id` | `consultant_id` | BIGINT FK → consultants(id) |
| `metadata` | `metadata` | JSONB |
| `created_by_user_id` | `created_by_user_id` | Set from `actor.authProviderUserId` on insert |
| `updated_by_user_id` | `updated_by_user_id` | Set from `actor.authProviderUserId` on every write |

**Soft-delete:** `deleted_at TIMESTAMPTZ` — `toSoftDelete()` sets `deleted_at = now()`.

---

## 2. ProposalAdapter (`proposalAdapter.js`)

**Source table:** `public.proposals`

| App model field | DB column | Notes |
|---|---|---|
| `id` | `id` | UUID |
| `proposal_type` | `proposal_type` | `'leasing'` \| `'venda'` — validated |
| `proposal_code` | `proposal_code` | Human-readable code |
| `version` | `version` | Integer; defaults to 1 |
| `status` | `status` | `'draft'` \| `'sent'` \| … |
| `client_id` | `client_id` | BIGINT nullable; added in migration 0049; `null` on legacy rows |
| `client_name` | `client_name` | Denormalized snapshot |
| `client_document` | `client_document` | Denormalized snapshot |
| `payload_json` | `payload_json` | JSONB; never null — defaults to `{}` |
| `owner_user_id` | `owner_user_id` | Stack Auth user ID |
| `created_by_user_id` | `created_by_user_id` | Set on insert |
| `updated_by_user_id` | `updated_by_user_id` | Set on every write |

**Legacy rows:** `client_id` may be `null` (created before migration 0049). `fromDb()` handles this transparently.

**Soft-delete:** `deleted_at TIMESTAMPTZ`.

---

## 3. PortfolioAdapter (`portfolioAdapter.js`)

**Source:** Join of `clients` + `client_lifecycle` + `client_contracts` + `client_project_status` + `client_billing_profile` + `client_energy_profile` (optional).

This adapter has **no `toDb`** — writes go through `ClientAdapter` and `ContractAdapter` individually.

### `fromDb(row)` — column aliases from `listPortfolioClients()`

| App model field | DB column / alias | Source table |
|---|---|---|
| `id` | `id` | clients |
| `name` | `name` (alias for `client_name`) | clients |
| `email` | `email` (alias for `client_email`) | clients |
| `phone` | `phone` (alias for `client_phone`) | clients |
| `city` | `city` (alias for `client_city`) | clients |
| `state` | `state` (alias for `client_state`) | clients |
| `document` | `document` (alias for `client_document`) | clients |
| `uc` | `uc` (alias for `uc_geradora`) | clients |
| `is_converted_customer` | `is_converted_customer` (alias for `in_portfolio`) | clients |
| `exported_to_portfolio_at` | `exported_to_portfolio_at` (alias for `portfolio_exported_at`) | clients |

### `enrichFromContracts(portfolioClient, extras)`

Appends nested objects from auxiliary tables:

| `extras` key | Produces `enriched` field | Source table |
|---|---|---|
| `contract` | `enriched.contract` | client_contracts |
| `projectStatus` | `enriched.project_status` | client_project_status |
| `billingProfile` | `enriched.billing_profile` | client_billing_profile |
| `energyProfile` | `enriched.energy_profile` | client_energy_profile |
| `usinaConfig` | `enriched.usina` | client_usina_config |

---

## 4. StorageAdapter (`storageAdapter.js`)

**Source table:** `public.storage`

| Field | DB column | Notes |
|---|---|---|
| `key` | `"key"` | TEXT; production keys must not be renamed |
| `value` | `value` | JSONB; may be a gzip-base64 envelope |
| `user_id` | `user_id` | TEXT; must not be empty |

**Gzip-base64 envelope:** Production rows may contain `{ "__si_compression": "gzip-base64", "data": "<base64>" }`.  
`fromDb()` transparently decompresses; `toDb()` transparently compresses when the compressed form is smaller.

**Size limit:** 5 MB per value. `toDb()` throws `RangeError` with `code = 'STORAGE_PAYLOAD_TOO_LARGE'` if exceeded.

**No soft-delete:** storage uses hard `DELETE`.

---

## 5. AuthAdapter (`authAdapter.js`)

Converts Stack Auth identity → `AuthenticatedRlsActor` for `applyRlsContext()`.

### Role hierarchy (highest → lowest)

| Priority | DB role | Business aliases |
|---|---|---|
| 1 (highest) | `role_admin` | `admin`, `role_admin` |
| 2 | `role_office` | `office`, `role_office` |
| 3 | `role_financeiro` | `financeiro`, `role_financeiro` |
| 4 | `role_gerente_comercial` | `gerente_comercial`, `role_gerente_comercial` |
| 5 (lowest) | `role_comercial` | `comercial`, `role_comercial` |

### `fromStackUser(stackUser, businessRole)` → `AuthenticatedRlsActor`

Delegates to `mapBusinessRoleToDatabaseRole()` in `server/database/rlsContext.js`.

```js
{ authProviderUserId: stackUser.id, role: 'role_admin' }
```

### `fromPermissions(permissions[])` → `DatabaseRlsRole`

Selects the **highest-priority** recognised role from a Stack Auth permissions array.  
Falls back to `role_comercial` when no recognised role is found.

---

## 6. FinanceAdapter (`financeAdapter.js`)

### financial_entries

| App model field | DB column | Notes |
|---|---|---|
| `id` | `id` | UUID |
| `entry_type` | `entry_type` | `'income'` \| `'expense'` — validated |
| `scope_type` | `scope_type` | `'company'` \| `'project'` — validated |
| `status` | `status` | `'planned'` \| `'due'` \| `'paid'` \| `'received'` \| `'cancelled'` |
| `amount` | `amount` | NUMERIC(14,2) |
| `client_id` | `client_id` | ⚠️ **UUID** in this table — schema mismatch vs `clients.id BIGINT`; surfaced as `string` |
| `project_id` | `project_id` | UUID FK → projects(id) |
| `proposal_id` | `proposal_id` | UUID FK → proposals(id) |
| `created_by_user_id` | `created_by_user_id` | Set on insert |
| `updated_by_user_id` | `updated_by_user_id` | Set on every write |

> ⚠️ **`client_id` type mismatch:** `financial_entries.client_id` is `UUID` (migration 0043 schema), but `clients.id` is `BIGINT`. `fromEntryDb()` casts `client_id` to `string`. Never use it as a direct BIGINT FK join without an explicit SQL `CAST`.

**Soft-delete:** `deleted_at TIMESTAMPTZ`.

### client_invoices, financial_import_batches, financial_import_items

These tables are read-only mapped (`fromXxxDb()`). See field list in `financeAdapter.js` source.

---

## 7. ProjectAdapter (`projectAdapter.js`)

**Source tables:** `public.projects`, `public.project_pv_data`

| App model field | DB column | Notes |
|---|---|---|
| `id` | `id` | UUID |
| `client_id` | `client_id` | BIGINT FK → clients(id) |
| `plan_id` | `plan_id` | TEXT (string representation of client_id in legacy rows) |
| `contract_id` | `contract_id` | BIGINT FK → client_contracts(id) |
| `proposal_id` | `proposal_id` | UUID FK → proposals(id) |
| `project_type` | `project_type` | `'leasing'` \| `'venda'` — validated |
| `status` | `status` | `'Aguardando'` \| `'Em andamento'` \| `'Concluído'` — validated |
| `client_name_snapshot` | `client_name_snapshot` | Denormalized snapshot |
| `created_by_user_id` | `created_by_user_id` | Set on insert |
| `updated_by_user_id` | `updated_by_user_id` | Set on every write |

**Soft-delete:** `deleted_at TIMESTAMPTZ`.

### project_pv_data (1:1 with projects)

| App model field | DB column |
|---|---|
| `project_id` | `project_id` |
| `consumo_kwh_mes` | `consumo_kwh_mes` |
| `potencia_modulo_wp` | `potencia_modulo_wp` |
| `numero_modulos` | `numero_modulos` |
| `tipo_rede` | `tipo_rede` |
| `potencia_sistema_kwp` | `potencia_sistema_kwp` |
| `geracao_estimada_kwh_mes` | `geracao_estimada_kwh_mes` |
| `area_utilizada_m2` | `area_utilizada_m2` |
| `modelo_modulo` | `modelo_modulo` |
| `modelo_inversor` | `modelo_inversor` |

---

## 8. ContractAdapter (`contractAdapter.js`)

**Source table:** `public.client_contracts`

| App model field | DB column | Notes |
|---|---|---|
| `id` | `id` | BIGSERIAL |
| `client_id` | `client_id` | BIGINT FK → clients(id) |
| `contract_type` | `contract_type` | `'leasing'` \| `'sale'` \| `'buyout'` — validated |
| `contract_status` | `contract_status` | `'draft'` \| `'active'` \| `'suspended'` \| `'completed'` \| `'cancelled'` — validated |
| `contract_signed_at` | `contract_signed_at` | TIMESTAMPTZ |
| `contractual_term_months` | `contractual_term_months` | INTEGER |
| `source_proposal_id` | `source_proposal_id` | ⚠️ **TEXT** (legacy, no FK) — preserved verbatim |
| `consultant_id` | `consultant_id` | ⚠️ **TEXT** (legacy, no FK) — preserved verbatim |
| `contract_attachments_json` | `contract_attachments_json` | JSONB |

> ⚠️ **Legacy TEXT fields:** `source_proposal_id` and `consultant_id` are TEXT columns with no FK enforcement. They may contain UUID strings, numeric strings, or arbitrary codes from legacy imports. The adapter passes them through unchanged.

**No `deleted_at`:** contracts use `contract_status = 'cancelled'` (via `toCancel()`). There is no soft-delete column.

---

## Security rules enforced by all adapters

1. **No DB access** — adapters never call `sql()` or any DB client directly.
2. **No RLS bypass** — adapters only produce plain JS objects; the calling code is responsible for using a RLS-scoped `sql` handle.
3. **Audit fields always set** — every `toDb()` call stamps `updated_by_user_id`; `insert` mode also stamps `created_by_user_id`.
4. **Soft-delete only** — for tables with `deleted_at`, adapters provide `toSoftDelete()` and never produce a hard `DELETE` shape.
5. **Validation** — enum-constrained fields (`proposal_type`, `entry_type`, `project_type`, `status`, etc.) throw `TypeError` with a descriptive message when invalid values are provided, preventing silent bad data from reaching the DB.
