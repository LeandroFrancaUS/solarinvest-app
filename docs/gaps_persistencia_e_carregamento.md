# Gaps de Persistência e Carregamento

**Data da auditoria:** 2026-04-16  
**Fonte:** Análise direta do código-fonte

---

## 1. Campos de Usina em `clients.metadata` JSONB (Risco Médio)

### Situação
Os campos de configuração UFV da aba Usina são salvos dentro de `clients.metadata` JSONB:
- `potencia_modulo_wp`
- `numero_modulos`
- `modelo_modulo`
- `modelo_inversor`
- `tipo_instalacao`
- `area_instalacao_m2`
- `geracao_estimada_kwh`

**Evidência:**
- `server/clients/handler.js:99-118` — `toClientWritePayload()` move estes campos para `metadata`
- `server/client-portfolio/repository.js:217-224` — `getPortfolioClient()` extrai de volta de `metadata`

### Classificação
- **Status:** `SAVED_IN_METADATA_ONLY`
- **Funciona?** Sim — salva e carrega corretamente via o loop metadata → extract
- **Risco:** Sem validação de tipo, sem constraint, sem indexação; metadata é um "saco" genérico

### Impacto Real
Baixo impacto prático. Os dados estão persistidos, são restaurados corretamente, e a extração é feita no `getPortfolioClient()`. A migração para colunas reais seria uma melhoria de qualidade, não uma correção de bug.

---

## 2. `modelo_inversor` com Persistência Dupla (Risco Baixo)

### Situação
O campo "Modelo do inversor" existe em dois lugares:
1. `clients.metadata.modelo_inversor` (salvo via `toClientWritePayload`)
2. `client_energy_profile.marca_inversor` (coluna real, adicionada na migration 0027)

**Evidência:**
- `server/client-portfolio/repository.js:221` — fallback: `meta.modelo_inversor ?? row.marca_inversor`

### Classificação
- **Status:** `DUPLICATED_MODEL`
- **Funciona?** Sim — o portfolio prioriza metadata e faz fallback para energy_profile
- **Risco:** Se os dois tiverem valores diferentes, há ambiguidade

### Recomendação
Padronizar para uma única fonte. Sugestão: mover para `client_energy_profile.marca_inversor` e eliminar de metadata.

---

## 3. `tipo_rede` — Corrigido Neste PR (Risco Eliminado)

### Situação Anterior
O campo "Tipo de rede" estava no formulário da aba Usina mas NÃO era enviado no payload de save. O UsinaTab inicializava com string vazia ao invés de usar o valor do banco.

### Correção
- `src/pages/ClientPortfolioPage.tsx` — UsinaTab agora inicializa `tipo_rede` de `client.tipo_rede`
- `src/pages/ClientPortfolioPage.tsx` — `handleSave` envia `tipo_rede` via `energyProfile`

### Classificação
- **Status:** `OK` (corrigido)

---

## 4. Propostas — payload_json é Full Replace (Risco Médio)

### Situação
Quando uma proposta é atualizada via `PATCH /api/proposals/:id`, o `payload_json` é substituído integralmente. Não há merge de old + new.

**Evidência:**
- `server/proposals/repository.js:223-261` — `updateProposal()` faz `payload_json = ${JSON.stringify(payload_json)}::jsonb`
- Não há leitura do valor antigo para merge

### Classificação
- **Status:** Risco documentado, mas funcional
- **Funciona?** Sim — o frontend sempre envia o snapshot completo
- **Risco:** Se o frontend omitir campos (bug), eles são PERDIDOS permanentemente

### Impacto Real
Na prática, o `buildProposalUpsertPayload()` sempre serializa o snapshot completo. O risco é teórico, mas real se houver race condition ou bug no frontend.

---

## 5. Restauração de Propostas — Fidelidade Verificada (OK)

### Fluxo de Carregamento
1. `carregarOrcamentosPrioritarios()` lista propostas via `GET /api/proposals`
2. `serverProposalToOrcamento()` mapeia `payload_json` → `OrcamentoSalvo.snapshot`
3. `carregarOrcamentoParaEdicao()` carrega snapshot do IndexedDB local (`proposalStore`)
4. Se IndexedDB não tem, usa `registro.snapshot` (do servidor via `payload_json`)
5. `aplicarSnapshot()` reconstrói todo o estado do formulário

**Evidência:**
- `src/App.tsx:1501-1528` — `serverProposalToOrcamento()` usa `payload_json as OrcamentoSnapshotData`
- `src/App.tsx:17721-17783` — `carregarOrcamentoParaEdicao()` prioriza IndexedDB, fallback para server
- `src/lib/persist/proposalStore.ts:87-105` — `loadProposalSnapshotById()` lê de IndexedDB

### Classificação
- **Status:** ✅ OK — restauração com fidelidade total
- **Nota:** O server (via `payload_json`) e o IndexedDB local são fontes redundantes. O IndexedDB é cache; o server é autoritativo.

---

## 6. Rotas de Portfolio — Status Operacional

### `PATCH /api/client-portfolio/:clientId/contract`
- **Status:** ✅ OK
- **Tabela:** `client_contracts` (migration 0029, estendida 0031)
- **Evidência:** `server/client-portfolio/repository.js` — `upsertClientContract()` faz INSERT ON CONFLICT UPDATE
- **Causa de falha anterior (se houve):** Provavelmente migration não aplicada no banco de produção

### `PATCH /api/client-portfolio/:clientId/project`
- **Status:** ✅ OK
- **Tabela:** `client_project_status` (migration 0029)
- **Evidência:** `server/client-portfolio/repository.js` — `upsertClientProjectStatus()`
- **Causa de falha anterior (se houve):** Migration 0029 precisa estar aplicada

### `PATCH /api/client-portfolio/:clientId/billing`
- **Status:** ✅ OK
- **Tabela:** `client_billing_profile` (migration 0029, estendida 0031)
- **Evidência:** `server/client-portfolio/repository.js` — `upsertClientBillingProfile()`
- **Causa de falha anterior (se houve):** Migration 0031 precisa estar aplicada para `valor_mensalidade` e `commissioning_date`

### `GET /POST /api/client-portfolio/:clientId/notes`
- **Status:** ✅ OK
- **Tabela:** `client_notes` (migration 0029)
- **Evidência:** `server/client-portfolio/repository.js` — `getClientNotes()`, `addClientNote()`
- **Causa de falha (DB_ERROR):** Se a tabela `client_notes` não existir no banco (migration 0029 não aplicada), a query falha com `42P01 undefined_table`
- **Classificação da causa:** `relation_does_not_exist` — tabela precisa existir

---

## 7. Modelos Duplicados de Dados

### Conceito: "consumo mensal"
| Localização | Nome | Tipo |
|-------------|------|------|
| `clients.consumption_kwh_month` | Coluna real | NUMERIC |
| `client_energy_profile.kwh_contratado` | Coluna real | NUMERIC(12,2) |
| `proposals.consumption_kwh_month` | Coluna real (denormalizada) | NUMERIC |
| `proposals.payload_json.kcKwhMes` | JSONB key | number |
| `proposals.payload_json.vendaSnapshot.parametros.consumo_kwh_mes` | JSONB nested | number |
| `useLeasingStore.energiaContratadaKwhMes` | Frontend state | number |
| `useVendaStore.parametros.consumo_kwh_mes` | Frontend state | number |
- **Classificação:** `DUPLICATED_MODEL` (5 locais diferentes no banco)
- **Fonte autoritativa:** `clients.consumption_kwh_month` para clientes; `proposals.payload_json` para propostas

### Conceito: "potência do sistema"
| Localização | Nome | Tipo |
|-------------|------|------|
| `clients.system_kwp` | Coluna real | NUMERIC |
| `client_energy_profile.potencia_kwp` | Coluna real | NUMERIC(10,3) |
| `proposals.system_kwp` | Coluna real (denormalizada) | NUMERIC |
| `proposals.payload_json.dadosTecnicos.potenciaInstaladaKwp` | JSONB nested | number |
| `useVendaStore.configuracao_ufv.potencia_sistema_kwp` | Frontend state | number |
- **Classificação:** `DUPLICATED_MODEL` (4 locais no banco)
- **Fonte autoritativa:** `clients.system_kwp` para clientes; `proposals.payload_json` para propostas

### Conceito: "modelo/marca inversor"
| Localização | Nome |
|-------------|------|
| `clients.metadata.modelo_inversor` | JSONB key |
| `client_energy_profile.marca_inversor` | Coluna real |
| `useVendaStore.configuracao_ufv.modelo_inversor` | Frontend state |
- **Classificação:** `DUPLICATED_MODEL`
- **Fonte autoritativa:** `clients.metadata.modelo_inversor` (priorizado pelo portfolio)

---

## 8. Resumo de Gaps Encontrados

| # | Gap | Severidade | Status |
|---|-----|-----------|--------|
| 1 | Campos de usina em metadata JSONB ao invés de colunas reais | Baixa | Funcional — melhoria de qualidade |
| 2 | modelo_inversor duplicado em metadata e energy_profile | Baixa | Funcional — fallback implementado |
| 3 | tipo_rede não era enviado no save da aba Usina | Média | **CORRIGIDO** neste PR |
| 4 | payload_json de propostas é full replace sem merge | Baixa | Design intencional — risco teórico |
| 5 | Consumo/potência duplicados em múltiplas tabelas | Info | Design intencional — denormalização para listagem |
| 6 | Rotas contract/project/billing/notes dependem de migrations aplicadas | Média | Funcional se migrations rodaram |

---

## 9. Recomendações para Etapa 2

1. **Migrar campos de usina de `metadata` para colunas reais** na tabela `clients` ou em tabela auxiliar `client_usina_config`
2. **Eliminar duplicidade** `modelo_inversor` / `marca_inversor` — padronizar em um único campo
3. **Adicionar validação de integridade** no save de propostas para garantir que `payload_json` não está vazio
4. **Garantir que todas as migrations 0029-0031 estão aplicadas** no banco de produção
5. **Considerar merge strategy** para `payload_json` em updates de proposta (ler old, merge, salvar)
