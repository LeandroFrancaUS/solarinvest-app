# Checklist de Anti-Regressão — Camada de Propostas

> Este documento garante que a política de **fonte oficial das propostas** (ver `docs/PROPOSALS_SOURCE_OF_TRUTH.md`) seja mantida em todos os ciclos de desenvolvimento.

---

## Verificações obrigatórias antes de qualquer merge que toque propostas

### 1. Listagem primária usa `/api/proposals`

- [ ] A tela de orçamentos chama `listProposals()` de `src/lib/api/proposalsApi.ts`
- [ ] O resultado exibido vem da resposta do backend, não de cache local como fonte primária
- [ ] Cache local é exibido apenas como estado transitório (enquanto carrega)

**Como verificar:**
```
Network tab → ao abrir "Consultar orçamentos" → deve aparecer GET /api/proposals
```

---

### 2. Salvar proposta chama o backend (não apenas store local)

- [ ] `handleSalvarPropostaPdf` chama `salvarOrcamentoLocalmente` **e** a lógica de persistência no backend via `proposalsApi.ts`
- [ ] `handleSalvarPropostaLeasing` idem
- [ ] O `persistedProposalId` é atualizado após retorno do backend
- [ ] A notificação de sucesso menciona "servidor" quando salvo com sucesso no backend

**Como verificar:**
```
Network tab → clicar em "Salvar proposta" → deve aparecer POST /api/proposals (nova) ou PATCH /api/proposals/:id (atualização)
```

---

### 3. Abrir proposta existente consulta o backend

- [ ] `carregarOrcamentoParaEdicao` tenta carregar de `/api/proposals/:id` antes de usar IndexedDB/localStorage
- [ ] Se o backend retornar os dados, eles têm prioridade sobre o cache local
- [ ] O estado `persistedProposalId` é setado com o `id` retornado pelo backend

**Como verificar:**
```
Network tab → clicar em "Carregar orçamento" na lista → deve aparecer GET /api/proposals/:id
```

---

### 4. Usuário `role_financeiro` não consegue salvar

- [ ] O botão "Salvar proposta" não aparece ou está desabilitado para `role_financeiro`
- [ ] O botão "Excluir" não aparece para `role_financeiro`
- [ ] Mesmo forçando via console/fetch, o backend retorna `403 FORBIDDEN`
- [ ] `useProposalsRbac().canWrite === false` para usuário financeiro

**Como verificar:**
```
1. Login com usuário que tem apenas role_financeiro no Stack Auth
2. Verificar que botões de escrita não aparecem
3. Tentar POST /api/proposals via fetch → esperado: 403
```

---

### 5. Usuário `role_comercial` não consegue alterar proposta de outro owner

- [ ] `canModifyProposal(actor, proposal)` retorna `false` quando `proposal.owner_user_id !== actor.userId`
- [ ] Backend retorna `403 FORBIDDEN` ao tentar PATCH de proposta alheia
- [ ] UI não exibe opções de edição para propostas de outros usuários (quando listadas por admin)

**Como verificar:**
```
1. Login com role_comercial (usuário A)
2. Tentar PATCH /api/proposals/:id onde o owner é usuário B → esperado: 403
```

---

### 6. Admin consegue CRUD completo

- [ ] `role_admin` pode criar, listar todas, abrir qualquer, editar qualquer, excluir qualquer
- [ ] Backend não restringe owner para admin

**Como verificar:**
```
1. Login com role_admin
2. Testar POST, GET, PATCH, DELETE /api/proposals → todos devem retornar 2xx
```

---

### 7. Exclusão usa soft-delete via API

- [ ] `confirmarRemocaoOrcamento` chama `deleteProposal(id)` de `proposalsApi.ts`
- [ ] Após sucesso no backend, o cache local é limpo
- [ ] A linha não some imediatamente — só após confirmação do backend
- [ ] Campo `deleted_at` é setado no banco (não remoção física)

**Como verificar:**
```
1. Excluir uma proposta
2. Network tab → deve aparecer DELETE /api/proposals/:id → esperado: 204
3. Query no Neon: SELECT deleted_at FROM proposals WHERE id = '...' → deve ter timestamp
```

---

### 8. Rota base centralizada em único módulo

- [ ] `BASE_URL` definido em `src/lib/api/proposalsApi.ts` como `resolveApiUrl('/api/proposals')`
- [ ] Nenhum outro arquivo concatena `/api/proposals` manualmente (verificar com grep)
- [ ] Nenhuma tela faz `fetch('/api/proposals')` diretamente fora de `proposalsApi.ts`

**Como verificar:**
```bash
grep -rn "\/api\/proposals" src/ --include="*.ts" --include="*.tsx" | grep -v "proposalsApi.ts"
# Resultado esperado: apenas comentários e documentação, sem chamadas diretas
```

---

### 9. Indicadores de estado de sincronização

- [ ] Proposta sem `persistedProposalId` mostra "Rascunho local"
- [ ] Proposta com `persistedProposalId` e `isDirty=false` mostra "Salvo no servidor"
- [ ] Proposta com `persistedProposalId` e `isDirty=true` mostra "Alterações não sincronizadas"
- [ ] Usuário `role_financeiro` vê indicador "Somente leitura"

---

### 10. Consistência entre Leasing e Venda

- [ ] `handleSalvarPropostaLeasing` e `handleSalvarPropostaPdf` (venda) ambos persistem no backend
- [ ] Ambos os fluxos respeitam o controle de role via `useProposalsRbac().canWrite`
- [ ] Indicador de sincronização aparece em ambas as abas

---

## Comandos de verificação rápida

```bash
# Verificar se URL está centralizada
grep -rn "\/api\/proposals" src/ --include="*.ts" --include="*.tsx" | grep -v "proposalsApi.ts" | grep "fetch\|axios\|http"

# Verificar se proposalStore tem header correto de "local draft cache"
head -10 src/lib/persist/proposalStore.ts

# Verificar que useProposalsRbac está importado onde salvar/excluir são controlados
grep -n "useProposalsRbac" src/App.tsx

# Verificar que os endpoints estão registrados no handler
grep -n "api/proposals" server/handler.js
```

---

## Referências

- [`docs/PROPOSALS_SOURCE_OF_TRUTH.md`](./PROPOSALS_SOURCE_OF_TRUTH.md) — Decisão arquitetural
- [`src/lib/api/proposalsApi.ts`](../src/lib/api/proposalsApi.ts) — Cliente REST centralizado
- [`src/lib/proposals/useProposalsRbac.ts`](../src/lib/proposals/useProposalsRbac.ts) — Hook RBAC
- [`src/lib/proposals/useProposalSyncState.ts`](../src/lib/proposals/useProposalSyncState.ts) — Estado de sincronização
- [`server/proposals/permissions.js`](../server/proposals/permissions.js) — RBAC backend

---

*Última atualização: 2026-04-08*
