# Etapa 2.4 — Carteira: Notas + Energy Profile + Reidratação Exclusiva

**Data:** 2026-04-16
**Status:** Concluída

---

## Resumo

A Etapa 2.4 validou e reforçou três aspectos da Carteira de Clientes:

1. **Fluxo de POST de notas** — validado ponta a ponta
2. **Uso de `energy_profile` vs `latest_proposal_profile`** — auditado e documentado
3. **Reidratação exclusiva via `/api/client-portfolio/:id`** — confirmada e travada

---

## Arquivos Alterados

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/ClientPortfolioPage.tsx` | NotasTab: adicionado campo de título (opcional), exibição de título nos cards de notas, comentários protetivos de contexto |
| `src/utils/normalizePortfolioPayload.ts` | Documentação expandida com regras de prioridade e fontes proibidas |
| `src/hooks/useClientPortfolio.ts` | Comentários protetivos documentando regra de reidratação |
| `src/services/clientPortfolioApi.ts` | Comentários protetivos documentando exclusividade do endpoint |

---

## Fase 1 — Fluxo de POST de Notas

### Diagnóstico

O fluxo de notas **já estava funcionalmente correto** antes desta etapa:

- **Componente:** `NotasTab` em `ClientPortfolioPage.tsx`
- **Endpoint POST:** `POST /api/client-portfolio/:id/notes`
- **Payload enviado:** `{ content: string, entry_type: 'note', title?: string }`
- **Backend handler:** `handlePortfolioNotesRequest` em `server/client-portfolio/handler.js`
- **Persistência:** `addClientNote()` insere em `public.client_notes`
- **Resposta:** `201 { data: ClientNote }`
- **Reload:** `fetchPortfolioNotes()` recarrega via `GET /api/client-portfolio/:id/notes`

### Correções Aplicadas

- **Adicionado campo de título** (`title`) ao formulário de criação de nota (input opcional)
- **Exibição do título** nos cards de notas (quando presente, em destaque acima do conteúdo)
- **Limpeza de ambos os campos** (título + conteúdo) após salvamento bem-sucedido

### Fluxo Validado

```
[UI] título (opcional) + conteúdo → POST /api/client-portfolio/:id/notes
  → body: { content, entry_type: 'note', title? }
  → backend valida content ≠ empty
  → INSERT INTO client_notes (...)
  → RETURNING * → 201 { data: note }
  → UI adiciona nota ao state local
  → ao reabrir cliente, useEffect refaz GET /api/client-portfolio/:id/notes
```

### Status: ✅ Correto

---

## Fase 2 — Auditoria de `latest_proposal_profile`

### Diagnóstico

Auditoria completa do frontend revelou que `latest_proposal_profile` **NÃO é usado em nenhum componente da Carteira**:

| Arquivo | Uso de `latest_proposal_profile` | Contexto |
|---------|----------------------------------|----------|
| `src/App.tsx` (L1241) | `serverClientToRegistro()` | Listagem de clientes (`/api/clients`) — **NÃO é Carteira** |
| `src/lib/api/clientsApi.ts` (L83) | Definição de tipo | Interface `ClientRow` da API de clientes |
| `src/domain/analytics/normalizers.ts` (L55-56) | Fallback de `contract_value` | Analytics/dashboard — **NÃO é Carteira** |

### Resultado

- `ClientPortfolioPage.tsx` — **ZERO** referências a `latest_proposal_profile`
- `normalizePortfolioPayload.ts` — **ZERO** referências a `latest_proposal_profile`
- `useClientPortfolio.ts` — **ZERO** referências a `latest_proposal_profile`
- `clientPortfolioApi.ts` — **ZERO** referências a `latest_proposal_profile`

A Carteira já estava limpa. Comentários protetivos foram adicionados para prevenir regressões.

### Status: ✅ Limpo (sem contaminação)

---

## Fase 3 — Regra Oficial para `energy_profile`

### Diagnóstico

Na Carteira, os campos de plano energético vêm de:
- `energy_profile` (tabela `client_energy_profile`) via `GET /api/client-portfolio/:id`
- Campos retornados no top-level do payload agregado

### Regra Definida

```
CONTEXTO CARTEIRA — Campos energéticos:

Fonte: /api/client-portfolio/:id → normalizePortfolioClientPayload()

Prioridade:
  1. Top-level field (kwh_mes_contratado, tarifa_atual, etc.)
  2. Alias (kwh_contratado → kwh_mes_contratado)
  3. metadata fallback
  4. null (vazio)

PROIBIDO: latest_proposal_profile como fonte de dados energéticos
```

O `PlanoLeasingTab` lê `client.kwh_mes_contratado`, `client.desconto_percentual`, `client.tarifa_atual`, `client.valor_mensalidade` — todos vindos exclusivamente do normalizer que processa `/api/client-portfolio/:id`.

Quando `energy_profile` está null no banco, esses campos serão null → a UI mostra campos vazios.

### Status: ✅ Correto (sem dados fantasmas)

---

## Fase 4 — Reidratação Travada

### Diagnóstico

A reidratação da Carteira já estava travada no endpoint correto:

```
ClientDetailPanel
  → usePortfolioClient(clientId)
    → fetchPortfolioClient(clientId)
      → GET /api/client-portfolio/${clientId}
    → normalizePortfolioClientPayload(row)
  → client state
  → useEffect → localClient
  → displayClient = localClient ?? client
  → todas as abas recebem displayClient como prop
```

Não existe nenhum `useEffect`, store ou action que:
- Busca `/api/clients/:id` após abrir o painel da Carteira
- Faz merge com dados de listagem
- Sobrescreve com `latest_proposal_profile`
- Mistura com store legado

### Proteções Adicionadas

Comentários explícitos foram adicionados em:
- `ClientDetailPanel` — regra de reidratação documentada
- `PlanoLeasingTab` — proibição de `latest_proposal_profile` documentada
- `NotasTab` — fonte de dados documentada
- `normalizePortfolioPayload.ts` — regras de prioridade e fontes proibidas
- `useClientPortfolio.ts` — exclusividade do hook documentada
- `clientPortfolioApi.ts` — exclusividade do endpoint documentada

### Status: ✅ Travado

---

## Fase 5 — Normalizador Único

### Função Existente

`normalizePortfolioClientPayload()` em `src/utils/normalizePortfolioPayload.ts`

### Prioridade Implementada

| Prioridade | Fonte | Exemplo |
|------------|-------|---------|
| 1 | Top-level field | `raw.potencia_modulo_wp` |
| 2 | Alias estruturado | `raw.usina_potencia_modulo_wp` |
| 3 | `metadata.*` | `metaNum(meta, 'potencia_modulo_wp')` |
| 4 | Default vazio | `null` |

### Fontes NUNCA usadas:
- ❌ `latest_proposal_profile`
- ❌ `/api/clients/:id`
- ❌ `/api/clients?page=...`

### Status: ✅ Consolidado

---

## Resultado Final

| Critério | Status |
|----------|--------|
| POST de notas funciona ponta a ponta | ✅ |
| GET de notas retorna a nota recém salva | ✅ |
| UI de notas mostra e mantém após reopen/reload | ✅ |
| Carteira não usa `latest_proposal_profile` | ✅ |
| Aba Plano usa apenas payload de `/api/client-portfolio/:id` | ✅ |
| Quando `energy_profile` null, UI mostra vazio real | ✅ |
| Reidratação travada em `/api/client-portfolio/:id` | ✅ |
| Nenhum payload legado sobrescreve o estado | ✅ |
