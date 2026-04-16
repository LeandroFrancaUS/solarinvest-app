# Etapa 2.5 — Sincronização da UI pós-save na Carteira de Clientes

## Relatório Final

---

## FASE 1 — Diagnóstico do Fluxo Pós-Save

### Arquitetura Identificada

| Componente | Onde o save acontece | Endpoint | Pós-save (antes da correção) |
|---|---|---|---|
| **EditarTab** | `handleSave()` | `PATCH /api/client-portfolio/:id/profile` | ✅ Fazia merge otimista via `onSaved(updated)` |
| **ContratoTab** | `handleSave()` | `PATCH /api/client-portfolio/:id/contract` | ❌ Chamava `onSaved()` → `reload()` sem atualizar estado local |
| **ProjetoTab** | `handleSave()` | `PATCH /api/client-portfolio/:id/project` | ❌ Chamava `onSaved()` → `reload()` sem atualizar estado local |
| **CobrancaTab** | `handleSave()` | `PATCH /api/client-portfolio/:id/billing` | ❌ Chamava `onSaved()` → `reload()` sem atualizar estado local |
| **UsinaTab** | `handleSave()` | `PUT /api/clients/:id` | ❌ Chamava `onSaved()` → `reload()` sem atualizar estado local |
| **PlanoLeasingTab** | `handleSave()` | `PUT /api/clients/:id` | ❌ Chamava `onSaved()` → `reload()` sem atualizar estado local |
| **NotasTab** | `handleAddNote()` | `POST /api/client-portfolio/:id/notes` | ✅ Fazia merge local via `setNotes(prev => [note, ...prev])` |

### Estado do cliente aberto

O estado vive em duas camadas:

1. **`usePortfolioClient(clientId)`** — hook que faz `GET /api/client-portfolio/:id` e mantém `client` em `useState`
2. **`ClientDetailPanel.localClient`** — estado local que permite override otimista: `displayClient = localClient ?? client`

### Onde a UI lê os dados após salvar

Cada aba recebe `client={displayClient}` como prop e inicializa seu form state no `useState(...)` initializer. O form **não se atualiza** quando a prop muda — só quando o componente é remontado.

### Causa-raiz do "flash" com valor antigo

1. Aba salva com sucesso → chama `onSaved()` → `reload()` (antigo)
2. `reload()` chama `setIsLoading(true)` + `fetchPortfolioClient(clientId)`
3. Durante o loading, `client` fica com o valor antigo por um instante
4. Fetch completa → `setClient(novoValor)` → `useEffect` copia para `localClient`
5. Mas a aba já está montada — o `useState(...)` initializer já rodou com o valor antigo
6. Resultado: **flash visual** com o valor antigo, seguido pelo novo (se troca de aba)

---

## FASE 2+3 — Padrão Único Pós-Save Implementado

### Função central: `handleTabSaved(patch)`

```
ClientDetailPanel → handleTabSaved(patch: Partial<PortfolioClientRow>)
```

Fluxo após PATCH bem-sucedido em qualquer aba:

1. **Merge otimista** — `setLocalClient(prev => ({ ...prev, ...patch }))` + `setHookClient(...)` atualiza imediatamente o estado do cliente aberto com os dados do formulário
2. **Refetch silencioso** — `reloadSilent()` faz `GET /api/client-portfolio/:id` **sem** setar `isLoading=true`, evitando flash de loading
3. **Remount do formulário** — Após o refetch, incrementa `refreshKey`, fazendo o React remontar a aba e reinicializar o `useState(...)` com os dados atualizados do servidor
4. **Refresh da lista** — `onClientUpdated()` atualiza a lista lateral de clientes

### Hook atualizado: `usePortfolioClient`

Novos métodos expostos:
- **`reloadSilent()`** — Refetch sem flash de loading
- **`setClient()`** — Permite merge otimista direto no hook

---

## FASE 4 — Prevenção de Sobrescrita por Dados Antigos

### Medidas implementadas

| Problema | Solução |
|---|---|
| `reload()` setava `isLoading=true` causando flash | Substituído por `reloadSilent()` que não altera isLoading |
| `useEffect` copiava `client` stale para `localClient` | Mantido, mas agora `client` é atualizado otimisticamente antes do refetch |
| Form não refletia novo valor após salvar (useState initializer) | `key={tab-${refreshKey}}` força remount com dados novos após refetch |
| Lista de clientes podia sobrescrever detalhe aberto | `onClientUpdated()` atualiza apenas a lista, não o detalhe |

---

## FASE 5 — Atualização Imediata do Cliente Aberto

O objeto central `displayClient` (= `localClient ?? client`) é atualizado em dois momentos:

1. **Imediato** (otimista): `setLocalClient(prev => ({ ...prev, ...patch }))` + `setHookClient(prev => ({ ...prev, ...patch }))`
2. **Confirmado** (servidor): `reloadSilent()` substitui `client` no hook com o payload consolidado do servidor

---

## FASE 6 — Formulários Controlados pelo Payload Novo

Cada aba utiliza `key={tabName-${refreshKey}}` que incrementa após cada refetch silencioso. Isso garante que:

- O componente é **remontado** com o `client` prop atualizado
- O `useState(...)` initializer roda novamente com os dados do servidor
- Não há risco de initialValues antigos

---

## FASE 7 — UX Pós-Save

Comportamento após salvar:

1. ✅ Botão mostra "Salvando…" durante o PATCH
2. ✅ Campos mantêm os valores novos imediatamente (merge otimista)
3. ✅ Sem flash para valores antigos (reloadSilent, sem isLoading)
4. ✅ Após refetch, tab remonta silenciosamente com dados confirmados
5. ✅ Toast de sucesso (onde aplicável)
6. ✅ Usuário permanece na mesma aba
7. ✅ Sem necessidade de refresh manual

---

## Arquivos Modificados

| Arquivo | Alteração |
|---|---|
| `src/hooks/useClientPortfolio.ts` | Expor `reloadSilent()` e `setClient()` no `usePortfolioClient` |
| `src/pages/ClientPortfolioPage.tsx` | Todas as abas passam `patch` no `onSaved`; `ClientDetailPanel` usa `handleTabSaved` com merge otimista + `reloadSilent` + `refreshKey` |

---

## Critérios de Conclusão

- [x] Após save, o valor novo aparece imediatamente na UI
- [x] Não existe mais flash com volta para valor antigo
- [x] A tela não exige refresh manual
- [x] A tela não exige sair e voltar da aba
- [x] O estado do cliente aberto é atualizado imediatamente
- [x] Existe refetch consistente de `/api/client-portfolio/:id` após save (silencioso)
- [x] Nenhum effect / store / reset reaplica snapshot antigo
- [x] Todas as abas da Carteira seguem o mesmo padrão pós-save
