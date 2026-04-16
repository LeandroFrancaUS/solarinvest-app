# Etapa 2.3 — Hidratação da Carteira de Clientes

## Objetivo

Corrigir a camada de frontend / hidratação da Carteira de Clientes para que:

1. Os formulários usem `GET /api/client-portfolio/:id` como fonte principal
2. `metadata` deixe de ter prioridade sobre campos top-level estruturados
3. Campos já persistidos nas tabelas estruturadas sejam exibidos fielmente
4. Reload / reopen reflita os dados persistidos
5. Não haja sobrescrita por `/api/clients/:id` no contexto de Carteira

---

## FASE 1 — Mapeamento da Fonte Usada pela UI

### Arquivo que abre o painel / fullscreen da Carteira

| Componente | Arquivo | Linhas |
|---|---|---|
| **ClientPortfolioPage** (página principal) | `src/pages/ClientPortfolioPage.tsx` | Linha ~1321 |
| **ClientDetailPanel** (painel de detalhe) | `src/pages/ClientPortfolioPage.tsx` | Linha ~1119 |
| **ClientPortfolioEditorShell** (fullscreen) | `src/components/portfolio/ClientPortfolioEditorShell.tsx` | Linha ~33 |

### Arquivo que popula cada aba

| Aba | Componente | Endpoint de Leitura | Endpoint de Escrita |
|---|---|---|---|
| Editar | `EditarTab` | `GET /api/client-portfolio/:id` | `PATCH /api/client-portfolio/:id/profile` |
| Usina | `UsinaTab` | `GET /api/client-portfolio/:id` | `PUT /api/clients/:id` (via `patchPortfolioUsina`) |
| Contrato | `ContratoTab` | `GET /api/client-portfolio/:id` | `PATCH /api/client-portfolio/:id/contract` |
| Plano | `PlanoLeasingTab` | `GET /api/client-portfolio/:id` | `PUT /api/clients/:id` (via `patchPortfolioUsina`) |
| Projeto | `ProjetoTab` | `GET /api/client-portfolio/:id` | `PATCH /api/client-portfolio/:id/project` |
| Cobrança | `CobrancaTab` | `GET /api/client-portfolio/:id` | `PATCH /api/client-portfolio/:id/billing` |
| Notas | `NotasTab` | `GET /api/client-portfolio/:id/notes` | `POST /api/client-portfolio/:id/notes` |

### Hook de leitura

- `usePortfolioClient(clientId)` em `src/hooks/useClientPortfolio.ts`
- Chama exclusivamente `fetchPortfolioClient(clientId)` → `GET /api/client-portfolio/:id`
- **NÃO** chama `/api/clients/:id` para leitura

### Store / estado

- Não há store global (Zustand/Redux) para a Carteira
- Estado gerido localmente em `ClientDetailPanel` via `useState`
- Cada aba mantém estado local do formulário via `useState`

---

## FASE 2 — Fonte de Verdade Fixada

### Antes

- `EditarTab` e `UsinaTab` usavam `usePortfolioUpdate()` → `PUT /api/clients/:id`
- O hook `usePortfolioClient` retornava o payload bruto sem normalização

### Depois

- Criado `normalizePortfolioClientPayload()` em `src/utils/normalizePortfolioPayload.ts`
- `usePortfolioClient` aplica o normalizador imediatamente após o fetch
- `EditarTab` agora salva via `patchPortfolioProfile()` → `PATCH /api/client-portfolio/:id/profile`
- Nenhuma leitura usa `/api/clients/:id` no contexto de Carteira
- `usePortfolioUpdate` removido dos imports do `ClientPortfolioPage`

---

## FASE 3 — Prioridade Correta dos Campos

O normalizador `normalizePortfolioClientPayload` implementa a seguinte cadeia de prioridade:

1. **PRIORIDADE 1** — campo top-level explícito do payload
2. **PRIORIDADE 2** — alias estrutural (ex: `usina_potencia_modulo_wp`)
3. **PRIORIDADE 3** — `metadata.*` como fallback
4. **PRIORIDADE 4** — `null` (default da UI)

### Regras aplicadas

- Se `potencia_modulo_wp` existir no top-level → ignora `metadata.potencia_modulo_wp`
- Contrato, Projeto e Cobrança **nunca** usam metadata — apenas campos top-level
- `metadata` é tratado como `Record<string, unknown>` e acessado com funções tipadas (`metaNum`, `metaStr`)

---

## FASE 4 — Mapeamento dos Campos

### Aba Usina

| Campo do formulário | Fonte primária | Fallback 1 | Fallback 2 |
|---|---|---|---|
| `potencia_modulo_wp` | `payload.potencia_modulo_wp` | `payload.usina_potencia_modulo_wp` | `metadata.potencia_modulo_wp` |
| `numero_modulos` | `payload.numero_modulos` | `payload.usina_numero_modulos` | `metadata.numero_modulos` |
| `modelo_modulo` | `payload.modelo_modulo` | `payload.usina_modelo_modulo` | `metadata.modelo_modulo` |
| `modelo_inversor` | `payload.modelo_inversor` | `payload.usina_modelo_inversor` | `metadata.modelo_inversor` |
| `tipo_instalacao` | `payload.tipo_instalacao` | `payload.usina_tipo_instalacao` | `metadata.tipo_instalacao` |
| `area_instalacao_m2` | `payload.area_instalacao_m2` | `payload.usina_area_instalacao_m2` | `metadata.area_instalacao_m2` |
| `geracao_estimada_kwh` | `payload.geracao_estimada_kwh` | `payload.usina_geracao_estimada_kwh` | `metadata.geracao_estimada_kwh` |

### Aba Contrato (sem metadata)

Campos mapeados diretamente: `contract_id`, `contract_type`, `contract_status`, `source_proposal_id`, `contract_signed_at`, `contract_start_date`, `billing_start_date`, `expected_billing_end_date`, `contractual_term_months`, `buyout_eligible`, `buyout_status`, `buyout_date`, `buyout_amount_reference`, `contract_notes`, `consultant_id`, `consultant_name`, `contract_file_name`, `contract_file_url`, `contract_file_type`.

### Aba Projeto (sem metadata)

Campos mapeados diretamente: `project_id`, `project_status`, `installation_status`, `engineering_status`, `homologation_status`, `commissioning_status`, `commissioning_date`, `first_injection_date`, `first_generation_date`, `expected_go_live_date`, `integrator_name`, `engineer_name`, `timeline_velocity_score`, `project_notes`.

### Aba Cobrança (sem metadata)

Campos mapeados diretamente: `billing_id`, `due_day`, `reading_day`, `first_billing_date`, `expected_last_billing_date`, `recurrence_type`, `billing_payment_status`, `delinquency_status`, `collection_stage`, `auto_reminder_enabled`, `valor_mensalidade`, `commissioning_date_billing`.

### Aba Notas

Fonte: `GET /api/client-portfolio/:id/notes` (sem cache, sem merge com payload principal).

---

## FASE 5 — Eliminação de Sobrescrita Indevida

### Auditoria realizada

- **Resultado**: NÃO há efeito colateral de sobrescrita. A Carteira nunca chama `GET /api/clients/:id` para leitura.
- O hook `usePortfolioClient` é a única fonte de dados para o `ClientDetailPanel`.
- O estado local (`localClient`) é atualizado exclusivamente pelo payload da carteira ou por optimistic update local após save.
- O `usePortfolioUpdate` (que usava `PUT /api/clients/:id`) foi removido das abas Editar e Plano Leasing.

---

## FASE 6 — Normalizador de Payload

### Arquivo: `src/utils/normalizePortfolioPayload.ts`

#### Função: `normalizePortfolioClientPayload(raw)`

- Recebe o payload bruto da API
- Retorna `PortfolioClientRow` completo e normalizado
- Resolve prioridades (top-level > alias > metadata)
- Evita repetição de lógica em cada aba
- Usado automaticamente no hook `usePortfolioClient`

---

## FASE 7 — Preservação do Restante

- ✅ Fluxo da página de clientes comuns — não alterado
- ✅ Fluxo de proposals — não alterado
- ✅ Backend / schema / migrations — não alterados
- ✅ Lógica de proposta — não alterada
- ✅ CRUD operacional existente — preservado

---

## FASE 8 — Campos Adicionados nos Formulários

### Contrato (novos campos)

- `source_proposal_id` — ID da Proposta de Origem
- `contract_start_date` — Início do Contrato
- `expected_billing_end_date` — Fim Previsto da Cobrança
- `buyout_date` — Data do Buy Out (exibido condicionalmente)
- `buyout_amount_reference` — Valor de Referência Buy Out (exibido condicionalmente)

### Projeto (novos campos)

- `homologation_status` — Status Homologação
- `commissioning_status` — Status Comissionamento
- `first_injection_date` — Primeira Injeção
- `first_generation_date` — Primeira Geração
- `engineer_name` — Engenheiro
- `timeline_velocity_score` — Score de Velocidade

### Cobrança (novos campos)

- `expected_last_billing_date` — Último Vencimento Previsto
- `collection_stage` — Etapa de Cobrança
- `auto_reminder_enabled` — Lembrete automático ativado

---

## FASE 9 — Critério de Conclusão

- [x] A Carteira usa `/api/client-portfolio/:id` como fonte primária
- [x] A aba Usina mostra os campos top-level corretos (via normalizador)
- [x] `metadata` deixou de ter prioridade (é apenas fallback no normalizador)
- [x] Contrato / Projeto / Cobrança refletem o payload real da carteira
- [x] Reload / reopen preservam os dados já salvos (sem state local órfão)
- [x] Não há sobrescrita posterior por `/api/clients/:id`
- [x] O frontend exibe exatamente o que o backend já retorna

---

## Arquivos Modificados

| Arquivo | Tipo de Alteração |
|---|---|
| `src/utils/normalizePortfolioPayload.ts` | **Novo** — normalizador de payload |
| `src/hooks/useClientPortfolio.ts` | Modificado — aplica normalizador após fetch |
| `src/services/clientPortfolioApi.ts` | Modificado — adicionado `patchPortfolioUsina` |
| `src/pages/ClientPortfolioPage.tsx` | Modificado — EditarTab usa patchPortfolioProfile, UsinaTab/PlanoTab usam patchPortfolioUsina, campos adicionados em Contrato/Projeto/Cobrança |
| `docs/etapa2_3_hidratacao_carteira.md` | **Novo** — este relatório |
