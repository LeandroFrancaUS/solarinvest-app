# Auditoria: Dirty State e Transições de Páginas

## 1. Flags que controlam dirty state

### 1.1 Proposta (Leasing/Venda)

| Flag | Tipo | Arquivo | Descrição |
|------|------|---------|-----------|
| `lastSavedSignatureRef` | `useRef<string \| null>` | `App.tsx:5690` | Assinatura JSON do estado da proposta no último save |
| `userInteractedSinceSaveRef` | `useRef<boolean>` | `App.tsx:5691` | Se o usuário interagiu com inputs desde o último save |
| `computeSignatureRef` | `useRef<() => string>` | `App.tsx:5692` | Função que calcula assinatura atual da proposta |
| `initialSignatureSetRef` | `useRef<boolean>` | `App.tsx:5693` | Se a assinatura inicial já foi definida |

### 1.2 Cliente (formulário principal)

| Flag | Tipo | Arquivo | Descrição |
|------|------|---------|-----------|
| `clientIsDirty` | `useMemo<boolean>` | `App.tsx:16224` | Compara `cliente` atual com `originalClientData` |
| `clienteFormularioAlterado` | `useMemo<boolean>` | `App.tsx:16197` | Se o cliente em edição difere do registro original |
| `clienteTemDadosNaoSalvos` | `useMemo<boolean>` | `App.tsx:16209` | Combina dirty do cliente + dirty de proposta |
| `clientLastSaveStatus` | `useState` | `App.tsx:6370` | Status do último save: `idle`, `saving`, `success`, `error` |
| `originalClientData` | `useState` | `App.tsx` | Snapshot dos dados do cliente no momento do load/save |

### 1.3 Proposta Sync State

| Flag | Tipo | Arquivo | Descrição |
|------|------|---------|-----------|
| `isDirty` | campo de `ProposalSyncState` | `useProposalSyncState.ts` | Se edições locais divergem do servidor |
| `lastSyncedAt` | campo de `ProposalSyncState` | `useProposalSyncState.ts` | Timestamp do último sync bem-sucedido |

### 1.4 Crash Recovery

| Flag | Tipo | Arquivo | Descrição |
|------|------|---------|-----------|
| `session_active` | `sessionStorage` | `crashRecovery.ts` | Detecta se sessão anterior terminou sem `beforeunload` |

## 2. Onde as flags são setadas (dirty = true)

| Flag | Setada em | Condição |
|------|-----------|----------|
| `userInteractedSinceSaveRef` | `App.tsx:18008` | Evento `input` ou `change` em qualquer elemento (exceto `[data-ignore-unsaved-warning]`) |
| `clientIsDirty` | Recomputada automaticamente | `cliente !== originalClientData` |
| `clienteFormularioAlterado` | Recomputada automaticamente | Dados do cliente != dados do registro em edição |
| `ProposalSyncState.isDirty` | `markDirty()` | Chamado explicitamente em edições de proposta |

## 3. Onde as flags são resetadas (dirty = false / clean)

| Flag | Resetada em | Contexto |
|------|-------------|----------|
| `userInteractedSinceSaveRef` | `App.tsx:16437`, `scheduleMarkStateAsSaved` | Após save bem-sucedido do cliente ou proposta |
| `lastSavedSignatureRef` | `App.tsx:16438`, `scheduleMarkStateAsSaved` | Atualizada com assinatura atual após save |
| `originalClientData` | `App.tsx:16436` (setOriginalClientData) | Após save bem-sucedido do cliente |
| `clientLastSaveStatus` | `App.tsx:16435` | Setado para `'success'` após save bem-sucedido |
| `ProposalSyncState.isDirty` | `markSyncedToServer()` | Após POST/PATCH bem-sucedido da proposta |

## 4. Onde a navegação é bloqueada

### 4.1 `runWithUnsavedChangesGuard` (App.tsx:19773)

**PROBLEMA IDENTIFICADO E CORRIGIDO**: Esta função era chamada para TODA navegação entre páginas, mas verificava dirty state da proposta mesmo quando o usuário estava em páginas sem relação com propostas (Carteira, Dashboard, Settings, etc.).

**Correção aplicada**: A função agora verifica `isProposalPage` antes de consultar `hasUnsavedChanges()`. Páginas não-proposais (carteira, dashboard, settings, admin-users, simulacoes, crm) passam direto sem trigger do guard.

Páginas que usam o guard:
- `abrirDashboard` → navega para Dashboard
- `abrirCarteira` → navega para Carteira
- `abrirCrmCentral` → navega para CRM
- `abrirConfiguracoes` → navega para Settings
- `abrirAdminUsuarios` → navega para Admin Users
- `abrirPesquisaOrcamentos` → navega para busca de orçamentos

### 4.2 `beforeunload` (App.tsx:18046)

Bloqueia fechamento/refresh do browser quando `hasUnsavedChanges()` retorna `true`. Este é global e correto — previne perda de dados ao fechar a aba.

### 4.3 `abrirClientesPainel` (App.tsx:19825)

Tem lógica própria de skip: `clientLastSaveStatus === 'success' || !clientIsDirty`. Se o cliente foi salvo com sucesso, pula o guard.

### 4.4 `handleNovaProposta` (App.tsx:20150)

Verifica `hasUnsavedChanges()` ao criar nova proposta. Correto — só se aplica no contexto de proposta.

### 4.5 `handleSelecionarOrcamento` (App.tsx:21393)

Verifica `hasUnsavedChanges()` ao carregar outro orçamento. Correto — só se aplica no contexto de proposta.

## 5. Onde o contexto da Carteira se misturava com Proposal/Leasing

### 5.1 PROBLEMA PRINCIPAL (CORRIGIDO)

**`runWithUnsavedChangesGuard`** não verificava qual página estava ativa antes de checar dirty state da proposta.

Fluxo do bug:
1. Usuário está na Carteira (`activePage === 'carteira'`)
2. Salva dados do cliente na Carteira (via API de portfolio)
3. Clica no sidebar para ir ao Dashboard/Leasing/CRM
4. `abrirDashboard()` chama `runWithUnsavedChangesGuard()`
5. `hasUnsavedChanges()` retorna `true` (porque o estado da PROPOSTA mudou — não do portfolio!)
6. Guard mostra modal "Salvar alterações atuais?"
7. Se usuário escolhe "Salvar", `handleSalvarPropostaPdf()` é chamado
8. `handleSalvarPropostaPdf()` chama `validatePropostaLeasingMinimal()`
9. Validação falha e exibe: "Informe o Nome ou Razão Social para gerar a proposta."

**Correção**: `runWithUnsavedChangesGuard` agora verifica `isProposalPage` antes de `hasUnsavedChanges()`. Quando `activePage` é `carteira`, `dashboard`, `settings`, `admin-users`, `simulacoes` ou `crm`, o guard é completamente ignorado.

### 5.2 Storage sync (serverStorage.ts)

O `ensureServerStorageSync` é chamado durante inicialização do app. Falhas de `/api/storage` NÃO afetam dirty state de formulários — são tratadas como erros de infraestrutura. A flag `syncEnabled` é separada das flags de dirty state.

## 6. Arquivos auditados

| Arquivo | Status | Notas |
|---------|--------|-------|
| `src/App.tsx` | ✅ Corrigido | `runWithUnsavedChangesGuard` agora é context-aware |
| `src/lib/proposals/useProposalSyncState.ts` | ✅ OK | Isolado ao domínio de propostas |
| `src/components/proposals/ProposalSyncBadge.tsx` | ✅ OK | Apenas renderização |
| `src/store/crashRecovery.ts` | ✅ OK | Não interfere em dirty state |
| `src/app/services/serverStorage.ts` | ✅ OK | Isolado de dirty state de formulários |
| `src/pages/ClientPortfolioPage.tsx` | ✅ OK | Não tem dirty state global — usa API calls diretas |
