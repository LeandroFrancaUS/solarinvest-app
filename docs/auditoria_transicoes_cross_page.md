# Auditoria: Transições Cross-Page

## Resumo

Auditoria de todas as transições entre páginas do app SolarInvest, verificando se dirty state é respeitado por contexto e se mensagens/prompts são adequados.

## Transições Auditadas

### 1. Carteira → Leasing (via sidebar)

| Aspecto | Antes da correção | Após correção |
|---------|-------------------|---------------|
| Guard acionado | `runWithUnsavedChangesGuard` → `hasUnsavedChanges()` (proposta) | Guard ignorado (não é página de proposta) |
| Prompt exibido | "Salvar alterações atuais?" + possível "Informe o Nome..." | Nenhum prompt — navegação livre |
| Dirty state real | Nenhum (dados da carteira são salvos via API, não via proposta) | Correto |

### 2. Carteira → Dashboard

| Aspecto | Antes da correção | Após correção |
|---------|-------------------|---------------|
| Guard acionado | `runWithUnsavedChangesGuard` → `hasUnsavedChanges()` (proposta) | Guard ignorado |
| Prompt exibido | Prompt indevido de proposta | Nenhum prompt — navegação livre |

### 3. Carteira → Proposal

| Aspecto | Antes da correção | Após correção |
|---------|-------------------|---------------|
| Guard acionado | `runWithUnsavedChangesGuard` | Guard ignorado (carteira não é contexto de proposta) |
| Prompt exibido | Prompt indevido | Nenhum prompt |

### 4. Leasing → Dashboard

| Aspecto | Antes da correção | Após correção |
|---------|-------------------|---------------|
| Guard acionado | `runWithUnsavedChangesGuard` → `hasUnsavedChanges()` | Mesmo comportamento (correto — é página de proposta) |
| Prompt exibido | Contextual à proposta (correto) | Sem mudança |

### 5. Leasing → Carteira

| Aspecto | Antes da correção | Após correção |
|---------|-------------------|---------------|
| Guard acionado | `runWithUnsavedChangesGuard` → `hasUnsavedChanges()` | Mesmo comportamento (correto — saindo de proposta) |
| Prompt exibido | "Salvar alterações atuais?" (contextual) | Sem mudança |

### 6. Proposal → Dashboard

| Aspecto | Antes da correção | Após correção |
|---------|-------------------|---------------|
| Guard acionado | `runWithUnsavedChangesGuard` | Correto — proposta é contexto de proposta |
| Prompt exibido | Contextual à proposta | Sem mudança |

### 7. Proposal → Carteira

| Aspecto | Antes da correção | Após correção |
|---------|-------------------|---------------|
| Guard acionado | `runWithUnsavedChangesGuard` | Correto — saindo de proposta |
| Prompt exibido | Contextual à proposta | Sem mudança |

### 8. Dashboard → Leasing/Proposal

| Aspecto | Antes da correção | Após correção |
|---------|-------------------|---------------|
| Guard acionado | `runWithUnsavedChangesGuard` | Guard ignorado (dashboard não é proposta) |
| Prompt exibido | Possível prompt indevido | Nenhum prompt |

### 9. Settings → qualquer página

| Aspecto | Antes da correção | Após correção |
|---------|-------------------|---------------|
| Guard acionado | `runWithUnsavedChangesGuard` | Guard ignorado (settings não é proposta) |
| Prompt exibido | Possível prompt indevido | Nenhum prompt |

### 10. CRM → qualquer página

| Aspecto | Antes da correção | Após correção |
|---------|-------------------|---------------|
| Guard acionado | `runWithUnsavedChangesGuard` | Guard ignorado (CRM não é proposta) |

### 11. Simulações → qualquer página

| Aspecto | Antes da correção | Após correção |
|---------|-------------------|---------------|
| Guard acionado | Navegação direta (sem guard) | Sem mudança |

## Bugs similares encontrados e corrigidos

### Bug 1: Dashboard → qualquer destino
**Problema**: Ao navegar do Dashboard para outra página, se o estado de proposta tinha mudanças não salvas de uma sessão anterior, o guard era acionado indevidamente.
**Correção**: O guard agora verifica `isProposalPage` antes de `hasUnsavedChanges()`. Dashboard (`activePage === 'dashboard'`) não é proposta.

### Bug 2: Settings/Admin → qualquer destino
**Problema**: Mesmo cenário — guard de proposta acionado fora de contexto.
**Correção**: Mesma — `isProposalPage` exclui Settings e Admin.

### Bug 3: CRM → qualquer destino
**Problema**: Guard de proposta acionado indevidamente ao sair do CRM.
**Correção**: CRM excluído de `isProposalPage`.

## Validação do `serverStorage.ts`

O módulo `serverStorage.ts` foi auditado:
- Erros de `/api/storage` (500) são capturados e logados, mas NÃO afetam dirty state de formulários
- A flag `syncEnabled` controla apenas a sincronização de dados técnicos, não dirty state de UI
- Falhas de storage não disparam prompts de salvar/descartar
- A inicialização tem timeout e fallback — não bloqueia navegação

## Conclusão

A causa raiz era o `runWithUnsavedChangesGuard` ser completamente agnóstico ao contexto da página atual. A correção introduz a variável `isProposalPage` que determina se o guard de proposta deve ser aplicado com base na página ativa. Apenas as páginas `app`, `consultar` e `clientes` (que interagem diretamente com dados de proposta) acionam o guard.
