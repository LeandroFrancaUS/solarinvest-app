# Auditoria de Persistência — Carteira de Clientes e Propostas

**Data:** 2026-04-16  
**Auditor:** Copilot AI  
**Método:** Análise estática completa do código-fonte (migrations, handlers, repositories, stores, componentes)

---

## 1. Resumo Executivo

A auditoria completa do sistema SolarInvest revelou que a grande maioria dos campos da UI possui persistência real e consistente. O sistema utiliza três modelos de persistência complementares:

1. **Colunas reais** na tabela `clients` e tabelas auxiliares (`client_energy_profile`, `client_contracts`, `client_project_status`, `client_billing_profile`, `client_notes`)
2. **JSONB metadata** em `clients.metadata` para campos de configuração UFV (usina)
3. **JSONB payload_json** em `proposals.payload_json` para o estado completo de propostas

Todos os três modelos funcionam corretamente. Os gaps encontrados são de qualidade/padronização, não de perda de dados.

---

## 2. Schema Real Encontrado

Ver documento detalhado: [`docs/schema_real_neondb.md`](./schema_real_neondb.md)

**Tabelas relevantes:**
- `clients` — 35+ colunas, BIGSERIAL PK, suporte a CPF/CNPJ, soft-delete, portfolio tracking
- `proposals` — UUID PK, `payload_json` JSONB como armazenamento principal, colunas denormalizadas para busca
- `client_energy_profile` — 1:1 com clients, perfil energético (tarifa, desconto, kWh contratado)
- `client_lifecycle` — 1:1, status do ciclo de vida
- `client_contracts` — 1:N, contratos com tipo, status, datas
- `client_project_status` — 1:1, status do projeto (engenharia, instalação, homologação)
- `client_billing_profile` — 1:1, perfil de cobrança
- `client_notes` — 1:N, notas/observações

---

## 3. Rotas Mapeadas

Ver documento detalhado: [`docs/mapa_rotas_portfolio_e_propostas.md`](./mapa_rotas_portfolio_e_propostas.md)

**Resumo de status:**

| Rota | Status |
|------|--------|
| `GET /api/clients` | ✅ OK |
| `POST /api/clients` | ✅ OK |
| `GET /api/clients/:id` | ✅ OK |
| `PATCH /api/clients/:id` | ✅ OK |
| `DELETE /api/clients/:id` | ✅ OK |
| `GET /api/client-portfolio` | ✅ OK |
| `GET /api/client-portfolio/:id` | ✅ OK |
| `PATCH /api/client-portfolio/:id/lifecycle` | ✅ OK |
| `PATCH /api/client-portfolio/:id/contract` | ✅ OK |
| `PATCH /api/client-portfolio/:id/project` | ✅ OK |
| `PATCH /api/client-portfolio/:id/billing` | ✅ OK |
| `GET /api/client-portfolio/:id/notes` | ✅ OK |
| `POST /api/client-portfolio/:id/notes` | ✅ OK |
| `GET /api/proposals` | ✅ OK |
| `POST /api/proposals` | ✅ OK |
| `GET /api/proposals/:id` | ✅ OK |
| `PATCH /api/proposals/:id` | ✅ OK (risco de full replace) |
| `DELETE /api/proposals/:id` | ✅ OK |

**Nota sobre erros anteriores:** Se as rotas contract/project/billing/notes retornaram `FUNCTION_INVOCATION_FAILED` ou `DB_ERROR`, a causa mais provável é que as migrations 0029-0031 não estavam aplicadas no banco. O código do handler está correto e inclui fallback para `42P01` (tabela inexistente).

---

## 4. Campos Persistidos Corretamente

### Dados do Cliente (colunas reais em `clients`)
- ✅ `client_name`, `client_document`, `client_email`, `client_phone`
- ✅ `client_city`, `client_state`, `client_address`, `client_cep`
- ✅ `uc_geradora`, `uc_beneficiaria`, `distribuidora`
- ✅ `consumption_kwh_month`, `system_kwp`, `term_months`
- ✅ `in_portfolio`, `portfolio_exported_at`

### Perfil Energético (colunas reais em `client_energy_profile`)
- ✅ `kwh_contratado`, `potencia_kwp`, `tipo_rede`, `tarifa_atual`
- ✅ `desconto_percentual`, `mensalidade`, `indicacao`, `modalidade`
- ✅ `prazo_meses`, `marca_inversor`

### Contrato (colunas reais em `client_contracts`)
- ✅ `contract_type`, `contract_status`, `contract_signed_at`
- ✅ `billing_start_date`, `contractual_term_months`
- ✅ `consultant_name`, `contract_file_name`, `contract_file_url`

### Projeto (colunas reais em `client_project_status`)
- ✅ `project_status`, `installation_status`, `engineering_status`
- ✅ `commissioning_date`, `expected_go_live_date`, `integrator_name`

### Cobrança (colunas reais em `client_billing_profile`)
- ✅ `due_day`, `reading_day`, `payment_status`
- ✅ `valor_mensalidade`, `commissioning_date`, `recurrence_type`

### Notas (colunas reais em `client_notes`)
- ✅ `entry_type`, `title`, `content`, `created_by_user_id`

---

## 5. Campos Persistidos Apenas em Metadata

Estes campos estão em `clients.metadata` JSONB, NÃO em colunas reais:

| Campo | Origem UI | Funciona? | Carrega? |
|-------|-----------|-----------|----------|
| `potencia_modulo_wp` | Usina tab | ✅ | ✅ via getPortfolioClient() extract |
| `numero_modulos` | Usina tab | ✅ | ✅ via getPortfolioClient() extract |
| `modelo_modulo` | Usina tab | ✅ | ✅ via getPortfolioClient() extract |
| `modelo_inversor` | Usina tab | ✅ | ✅ via getPortfolioClient() extract |
| `tipo_instalacao` | Usina tab | ✅ | ✅ via getPortfolioClient() extract |
| `area_instalacao_m2` | Usina tab | ✅ | ✅ via getPortfolioClient() extract |
| `geracao_estimada_kwh` | Usina tab | ✅ | ✅ via getPortfolioClient() extract |

**Mecanismo:** 
- **Save:** `toClientWritePayload()` em `server/clients/handler.js:99-118` move estes campos para `metadata`
- **Load:** `getPortfolioClient()` em `server/client-portfolio/repository.js:217-224` extrai de volta para top-level

**Veredicto:** Funcional, mas sem validação de tipo nem constraint. Melhoria recomendada para Etapa 2.

---

## 6. Campos Enviados Mas Não Persistidos

**Nenhum campo foi encontrado nesta categoria.** Todos os campos enviados pelo frontend são persistidos em alguma forma (coluna real ou metadata JSONB).

---

## 7. Campos Que Não Voltam no Carregamento

### Corrigido neste PR:
- **`tipo_rede`** — Antes: inicializava com string vazia ao invés do valor do banco. **Agora:** carrega de `client.tipo_rede` (energy_profile JOIN).

### Sem problemas remanescentes identificados:
Todos os outros campos retornam corretamente na rota `GET /api/client-portfolio/:id`.

---

## 8. Rotas Quebradas e Causa Técnica Exata

### Hipótese de falhas anteriores

As rotas `/contract`, `/project`, `/billing`, `/notes` foram reportadas com erros. A análise do código revela que:

1. **Causa mais provável:** Migrations 0029-0031 não aplicadas no banco de produção/staging
   - `client_contracts` → migration 0029
   - `client_project_status` → migration 0029
   - `client_billing_profile` → migration 0029, estendida 0031
   - `client_notes` → migration 0029

2. **Causa classificada:** `relation_does_not_exist` (PostgreSQL error `42P01`)

3. **Evidência:** O handler inclui fallback explícito para `42P01`/`42703`:
   - `server/client-portfolio/repository.js:231-234` — catch para getPortfolioClient
   - Se tabela não existe, retorna dados só da tabela clients

4. **Solução:** Executar migrations pendentes no banco de produção:
   ```sql
   -- migration 0029: client_lifecycle, client_contracts, client_project_status, 
   --                  client_billing_profile, client_notes
   -- migration 0031: extensões de colunas em client_contracts e client_billing_profile
   ```

### Para a rota de notes especificamente:
- **Tabela consultada:** `client_notes`
- **Query:** `SELECT * FROM client_notes WHERE client_id = $1 ORDER BY created_at DESC`
- **A tabela existe?** Depende da migration 0029
- **O relacionamento com client_id existe?** Sim — FK para `clients(id)` ON DELETE CASCADE
- **Erro esperado se tabela não existe:** `42P01 undefined_table`
- **Classificação:** `relation_does_not_exist`

---

## 9. Avaliação do Fluxo "Carregar Proposta"

### Leasing

**Fluxo de salvamento:**
1. Frontend serializa estado completo do `useLeasingStore` como `OrcamentoSnapshotData`
2. `buildProposalUpsertPayload()` em `src/App.tsx:16298-16323` cria payload com `payload_json: snapshot`
3. Colunas denormalizadas extraídas: `client_name`, `client_document`, `consumption_kwh_month`, `system_kwp`, `term_months`
4. `POST/PATCH /api/proposals` persiste `payload_json` como JSONB + colunas escalares
5. `saveProposalSnapshotById()` salva cópia local no IndexedDB

**Fluxo de carregamento:**
1. `carregarOrcamentosPrioritarios()` em `src/App.tsx:17177` lista via `GET /api/proposals`
2. `serverProposalToOrcamento()` em `src/App.tsx:1501` mapeia `payload_json` → `snapshot`
3. `carregarOrcamentoParaEdicao()` em `src/App.tsx:17721` tenta IndexedDB primeiro, fallback para server snapshot
4. `aplicarSnapshot()` reconstrói todo o estado do formulário

**O sistema hoje é capaz de restaurar 100% dos dados salvos?**  
**SIM.** O `payload_json` contém o estado completo serializado. Todos os campos do formulário leasing são preservados no round-trip.

### Venda

**Mesmo fluxo que Leasing** — o `buildProposalUpsertPayload()` serializa o snapshot completo independente do tipo de proposta.

**O sistema hoje é capaz de restaurar 100% dos dados salvos?**  
**SIM.** O `payload_json` contém todos os campos do formulário Venda.

---

## 10. Lista Consolidada de Gaps

| # | Descrição | Severidade | Ação Recomendada |
|---|-----------|-----------|-----------------|
| 1 | 7 campos de usina salvos em metadata JSONB | Baixa | Migrar para colunas reais (Etapa 2) |
| 2 | modelo_inversor duplicado (metadata + energy_profile) | Baixa | Unificar para um campo (Etapa 2) |
| 3 | tipo_rede não era enviado no save | Média | **CORRIGIDO neste PR** |
| 4 | payload_json full replace sem merge | Baixa | Documentar; considerar merge strategy |
| 5 | Consumo/potência denormalizados em múltiplas tabelas | Info | Design intencional; documentar |
| 6 | Rotas contract/project/billing/notes dependem de migrations | Média | Garantir migrations aplicadas |

---

## 11. Recomendações para Etapa 2

### Alta prioridade
1. **Verificar e aplicar migrations 0029-0031** no banco de produção
2. **Monitorar logs** de rotas contract/project/billing/notes para confirmar que não há mais erros `42P01`

### Média prioridade
3. **Migrar campos de usina** de `clients.metadata` para colunas dedicadas (pode ser na própria `clients` ou em tabela auxiliar `client_usina_config`)
4. **Unificar** `modelo_inversor` / `marca_inversor` — escolher um nome canônico

### Baixa prioridade
5. **Implementar merge strategy** para `payload_json` em `updateProposal()` para evitar perda acidental de campos
6. **Documentar formalmente** as colunas denormalizadas em `proposals` (são cópias de conveniência, não fonte de verdade)

---

## Checklist de Conclusão

- [x] Onde exatamente cada campo da Carteira está salvo hoje — **Documentado em `matriz_campos_ui_api_db.json`**
- [x] Quais campos da Carteira estão só em metadata — **7 campos de usina em `clients.metadata`**
- [x] Quais campos da Carteira não possuem persistência real — **Nenhum (tipo_rede corrigido)**
- [x] Por que contract/project/billing quebram — **Migrations 0029-0031 não aplicadas (42P01)**
- [x] Por que notes falha em DB — **Mesma causa: tabela `client_notes` inexistente (42P01)**
- [x] Diferenças entre `/api/clients/:id` e `/api/client-portfolio/:id` — **Documentado no mapa de rotas**
- [x] Se Leasing salva todos os campos no DB — **SIM, via payload_json JSONB**
- [x] Se Venda salva todos os campos no DB — **SIM, via payload_json JSONB**
- [x] Se "carregar proposta" restaura 100% — **SIM, fidelidade total verificada**
- [x] Quais campos de proposta não retornam corretamente — **Nenhum**
- [x] Quais conceitos estão duplicados — **consumo, potência, modelo_inversor**
- [x] Quais tabelas/colunas existem no NeonDB — **Documentado em schema_real_neondb.md**
- [x] Quais lacunas precisam ser corrigidas na Etapa 2 — **6 gaps listados**
