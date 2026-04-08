# Fonte Oficial das Propostas — SolarInvest

> **Decisão arquitetural permanente.**  
> Toda proposta oficial da SolarInvest existe no **Neon** e é acessada pelo backend em `/api/proposals`.  
> Qualquer estado local no frontend é apenas transitório, auxiliar ou cache — **nunca a fonte oficial**.

---

## 1. Declaração de fonte oficial

A fonte oficial de leitura e escrita de propostas é o banco **Neon (PostgreSQL)**, acessado exclusivamente pelo backend da aplicação via API REST:

```
GET    /api/proposals          → listar propostas
GET    /api/proposals/:id      → ler proposta específica
POST   /api/proposals          → criar nova proposta
PATCH  /api/proposals/:id      → atualizar proposta existente
DELETE /api/proposals/:id      → excluir proposta (soft-delete)
```

Nenhuma outra rota, store, banco local ou mecanismo de persistência tem status de **fonte oficial**.

---

## 2. URL principal do repositório de propostas

A URL base oficial é `/api/proposals`, centralizada em um único módulo:

```
src/lib/api/proposalsApi.ts
```

Construída via utilitário central:

```ts
// src/lib/api/proposalsApi.ts
const BASE_URL = resolveApiUrl('/api/proposals')
```

- Em produção: `https://app.solarinvest.app/api/proposals`
- Em dev local: `http://localhost:<porta>/api/proposals`
- A função `resolveApiUrl()` está em `src/utils/apiUrl.ts` e respeita `VITE_API_BASE_URL`

**Regras:**
- Toda chamada de rede relacionada a propostas deve usar os helpers em `proposalsApi.ts`
- Nenhuma tela deve concatenar manualmente `/api/proposals`
- Não pode haver rota alternativa paralela para o mesmo domínio funcional

---

## 3. Stores, IndexedDB e localStorage — papel auxiliar apenas

| Mecanismo | Status | Uso permitido |
|---|---|---|
| `proposals` (Neon via `/api/proposals`) | **Fonte oficial** | Leitura e escrita definitivas |
| Zustand stores (`useLeasingStore`, `useVendaStore`, etc.) | **Estado de edição** | Manter campos em edição durante a sessão |
| `proposalStore` (IndexedDB via localforage) | **Cache local de rascunho** | Restauração de campos após reload local, fallback offline |
| `localStorage` / `solarinvest-orcamentos` | **Cache de listagem** | Exibição rápida de metadados enquanto o backend carrega |
| `serverStorage` (`/api/storage`) | **Sync de configurações** | Configurações e preferências do usuário — não propostas |

> **Importante:** Os stores locais só existem como cache transitório.  
> Se há `persistedProposalId` (id retornado pelo backend), a proposta oficial já vive no Neon.  
> Sem `persistedProposalId`, é um **rascunho local temporário**.

---

## 4. Fluxo correto de dados

```
UI  →  POST/PATCH /api/proposals  →  NEON  →  resposta  →  UI (atualiza store local)
```

### Criação
1. Usuário preenche campos → estado local (store/rascunho)
2. Clica em "Salvar" → `POST /api/proposals` com `payload_json` completo
3. Backend retorna `{ data: { id, ... } }`
4. Frontend registra `persistedProposalId = id` → proposta agora é oficial
5. Store local é atualizada com os dados retornados

### Edição
1. Usuário abre proposta existente → `GET /api/proposals/:id`
2. Backend retorna dados canônicos → store local é hidratada
3. Usuário edita → store local atualizada (isDirty = true)
4. Clica em "Salvar" → `PATCH /api/proposals/:id`
5. Store local atualizada com retorno do backend (isDirty = false)

### Listagem
1. Tela de orçamentos chama `listProposals()` → `GET /api/proposals`
2. Cache local pode ser exibido enquanto carrega (UX)
3. Dados do backend substituem o cache ao chegarem

### Exclusão
1. Clique em "Excluir" → `DELETE /api/proposals/:id` (soft-delete via `deleted_at`)
2. Somente após sucesso do backend: limpar cache local correspondente
3. `proposal_audit_log` registra o evento no backend — nunca no frontend

---

## 5. Controle de acesso por role (RBAC)

Roles definidas exclusivamente via **Stack Auth native permissions**.

| Role | Criar | Listar | Abrir | Editar | Excluir |
|---|---|---|---|---|---|
| `role_admin` | ✅ qualquer | ✅ todas | ✅ qualquer | ✅ qualquer | ✅ qualquer |
| `role_comercial` | ✅ | ✅ próprias | ✅ próprias | ✅ próprias | ✅ próprias |
| `role_financeiro` | ❌ | ✅ todas (read-only) | ✅ qualquer (read-only) | ❌ | ❌ |

**A UI oculta ações indevidas, mas a segurança real está no backend.**  
Mesmo que um usuário `role_financeiro` tente forçar uma chamada, o backend retorna `403`.

---

## 6. Soft-delete e auditoria

- Exclusão de proposta usa soft-delete (`deleted_at`) — o registro permanece no banco para auditoria
- A tabela `proposal_audit_log` registra todos os eventos críticos (create, update, delete, status_change)
- A auditoria é gerada exclusivamente pelo backend — o frontend não escreve no log diretamente

---

## 7. Indicadores de sincronização (estado da proposta)

O frontend deve sinalizar ao usuário o estado atual da proposta:

| Indicador | Significado |
|---|---|
| **Rascunho local** | `persistedProposalId` ausente — proposta não existe no backend |
| **Salvo no servidor** | `saveSource === 'server'` e `!isDirty` |
| **Alterações não sincronizadas** | `isDirty === true` e `persistedProposalId` presente |
| **Somente leitura** | `role_financeiro` — nenhuma ação de escrita disponível |

---

## 8. Proibido

As práticas abaixo violam esta política e **não devem ser introduzidas ou mantidas**:

- ❌ Salvar proposta apenas em store local (sem `POST /api/proposals`)
- ❌ Tratar IndexedDB/localStorage como persistência definitiva de propostas
- ❌ Montar listagem primária de propostas a partir de store em memória
- ❌ Editar proposta sem persistir no backend via `PATCH /api/proposals/:id`
- ❌ Usar rota alternativa fora de `/api/proposals` para CRUD de propostas
- ❌ Gerar PDF como definitivo a partir de rascunho local quando já existe `persistedProposalId`
- ❌ Concatenar manualmente `/api/proposals` em telas — usar sempre `proposalsApi.ts`
- ❌ Escrever no banco diretamente do frontend (sem passar pela API)
- ❌ Remover cache local antes de confirmar sucesso no backend

---

## 9. Referências de implementação

| Arquivo | Responsabilidade |
|---|---|
| `db/migrations/0009_create_proposals.sql` | Schema da tabela `proposals` + `proposal_audit_log` |
| `server/proposals/repository.js` | Queries Neon SQL |
| `server/proposals/permissions.js` | RBAC via Stack Auth |
| `server/proposals/handler.js` | Handlers HTTP das rotas |
| `server/handler.js` | Registro das rotas `/api/proposals` |
| `src/lib/api/proposalsApi.ts` | Cliente REST frontend — URL base centralizada |
| `src/lib/proposals/useProposalsRbac.ts` | Hook de RBAC para UI |
| `src/lib/proposals/useProposalSyncState.ts` | Hook de estado de sincronização (draft vs servidor) |
| `src/lib/persist/proposalStore.ts` | Cache local de rascunho (IndexedDB) — **não é fonte oficial** |

---

*Última atualização: 2026-04-08*
