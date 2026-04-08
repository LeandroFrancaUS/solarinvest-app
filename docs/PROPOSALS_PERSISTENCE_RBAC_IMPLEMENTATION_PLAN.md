# Plano Técnico — Persistência de Propostas (Leasing + Vendas) com RBAC no Neon + Stack Auth

## 1) Resumo executivo

Este plano orienta a implementação **incremental, segura e sem regressão** da persistência de **todas as propostas de Leasing e de Vendas** no banco **Neon** já existente no projeto, com **controle de acesso por papel (RBAC)** e backend como fonte de verdade.

Objetivos centrais:
- Persistir propostas em tabela principal `proposals` com modelo híbrido (colunas indexáveis + snapshot JSON canônico).
- Implementar autorização robusta por papel (Admin, Usuário comum, Financeiro) no backend.
- Integrar autenticação/autorização com Stack Auth usando middleware/helper centralizado.
- Migrar do autosave/local para persistência real sem quebra de fluxo atual.
- Garantir observabilidade mínima e anti-regressão (testes + hardening + rollout por fases).

---

## 2) Premissas do ambiente atual

1. Stack atual e mandatória:
   - Frontend: **React + Vite + TypeScript** (não usar Next.js).
   - Backend: rotas Node existentes.
   - Banco: **Neon** já em uso (com `@neondatabase/serverless`), com algumas rotas legadas em `pg` Pool.
   - Migrações: SQL simples já adotado pelo projeto.
   - Auth: **Stack Auth** já utilizado.

2. Restrições arquiteturais a preservar:
   - Não introduzir Prisma, Drizzle ou novo ORM.
   - Não criar dependência de `App.tsx` em módulos de `db/auth/services/stores`.
   - Não usar barrels `index.ts` em camadas sensíveis (auth, db, services, stores).
   - Evitar imports circulares/TDZ; usar `import type` quando aplicável.

3. Princípio de segurança:
   - Frontend pode ocultar ações, mas **toda decisão de acesso real é do backend**.

---

## 3) Objetivo funcional

Implementar persistência completa para propostas de:
- **Leasing**
- **Venda**

Com as capacidades:
- Criar proposta
- Listar propostas
- Abrir proposta
- Editar proposta
- Excluir proposta (soft/hard conforme decisão explícita)
- Preservar autoria, ownership e auditoria mínima
- Suportar evolução de schema sem perda de compatibilidade por snapshot JSON

---

## 4) Modelo de autorização (RBAC + ownership)

### 4.1 Papéis e permissões

1. **Admin**
   - Acesso completo: `read + write + update + delete` em todas as propostas.
   - Pode editar status, conteúdo, metadados e ownership.

2. **Usuário comum**
   - `read + write` apenas nas próprias propostas.
   - Não pode visualizar ou editar proposta de outro usuário.
   - Não pode alterar ownership.

3. **Financeiro**
   - Leitura de todas as propostas (`read only`).
   - Não cria, não edita, não exclui.
   - Não altera ownership, status sensível ou conteúdo comercial.

### 4.2 Camadas de segurança (obrigatórias)

1. **Autenticação** via Stack Auth.
2. **Resolução do papel** do usuário autenticado.
3. **Autorização por endpoint/operação**.
4. **Filtro por ownership** em nível de query/operação quando aplicável.

### 4.3 Regras por operação

- **Criar proposta**: Admin ✅ / Usuário comum ✅ / Financeiro ❌
- **Listar propostas**: Admin todas ✅ / Usuário comum somente próprias ✅ / Financeiro todas (read only) ✅
- **Ler proposta específica**: Admin qualquer ✅ / Usuário comum apenas owner ✅ / Financeiro qualquer (read only) ✅
- **Atualizar proposta**: Admin ✅ / Usuário comum apenas próprias ✅ / Financeiro ❌
- **Excluir proposta**: Admin ✅ / Usuário comum (opcional, apenas próprias e se regra permitir) / Financeiro ❌
- **Alterar ownership/status sensível**: Admin ✅ / Usuário comum ❌ / Financeiro ❌

### 4.4 Política de resposta para não vazar dados

- `401` quando não autenticado.
- `403` quando autenticado sem permissão global.
- `404` quando recurso não existe **ou** não deve ser revelado ao ator.
- `422` payload inválido.
- `500` erro interno.

---

## 5) Modelo de dados proposto

## 5.1 Tabela principal `proposals` (modelo híbrido)

Estruturar colunas indexáveis para filtro/listagem + JSON canônico:

- `id` (uuid, pk)
- `proposal_type` (`leasing` | `venda`)
- `proposal_code` (texto, indexável)
- `version` (int) / `revision` (int)
- `status` (texto/enum operacional)
- `owner_user_id` (texto, obrigatório)
- `owner_email` (texto)
- `owner_display_name` (texto)
- `created_by_user_id` (texto)
- `updated_by_user_id` (texto)
- `client_name` (texto)
- `client_document` (texto)
- `client_city` (texto)
- `client_state` (texto)
- `client_phone` (texto)
- `client_email` (texto)
- `client_address_json` (jsonb, opcional)
- `consumption_kwh_month` (numeric)
- `system_kwp` (numeric)
- `estimated_generation_kwh_month` (numeric)
- `capex_total` (numeric)
- `contract_value` (numeric)
- `term_months` (int)
- `payload_json` (jsonb, **snapshot canônico completo**)
- `source_pdf_json` (jsonb, itens extraídos + metadados + referência de arquivo)
- `created_at` (timestamptz)
- `updated_at` (timestamptz)
- `deleted_at` (timestamptz nullable, se soft delete)

> Recomendação: manter campos comerciais específicos adicionais em `payload_json` inicialmente e promover para colunas indexáveis à medida que surgirem necessidades de consulta recorrente.

## 5.2 Tabela opcional `proposal_audit_log`

- `id` (uuid, pk)
- `proposal_id` (fk)
- `actor_user_id`
- `actor_email`
- `action` (ex.: create, update, delete, status_change, ownership_change)
- `old_value_json` (jsonb)
- `new_value_json` (jsonb)
- `created_at`

Uso recomendado para trilha mínima de ações críticas sem bloquear operação principal.

## 5.3 Fonte da verdade do papel

- **Fonte primária recomendada**: Stack Auth (metadata/permissões).
- `user_roles_cache` só se houver necessidade comprovada de performance/operacional.
- Se cache for adotado, definir TTL + rotina de reconciliação para evitar divergência.

## 5.4 Índices mínimos

- `idx_proposals_type` em (`proposal_type`)
- `idx_proposals_status` em (`status`)
- `idx_proposals_owner_user_id` em (`owner_user_id`)
- `idx_proposals_created_at` em (`created_at` desc)
- `idx_proposals_updated_at` em (`updated_at` desc)
- `idx_proposals_owner_updated` em (`owner_user_id`, `updated_at` desc)
- opcional: índice parcial em `deleted_at is null`

---

## 6) Fases de implementação (incremental + critérios de aceite)

## Fase 1 — Levantamento e preparação

### Tarefas
1. Inventariar telas/componentes/stores/serviços ligados a propostas de leasing e venda.
2. Mapear onde há autosave/localStorage/indexedDB e como o payload é montado hoje.
3. Identificar endpoints/handlers atuais relacionados a proposta (ou ausência deles).
4. Definir contrato de domínio mínimo (`Proposal`, `ProposalType`, `ProposalStatus`, `ProposalPayload`).
5. Definir ponto único de resolução de usuário e papel (Stack Auth helper).

### Critérios de aceite
- Documento de mapeamento com fluxos atuais (criação, edição, listagem, reopen).
- Lista de campos efetivamente usados hoje (mínimo + opcionais).
- Decisão explícita da fonte de verdade de role (Stack Auth).

### Riscos + mitigação
- **Risco**: campo crítico esquecido no schema.  
  **Mitigação**: snapshot `payload_json` obrigatório desde a primeira versão.

---

## Fase 2 — Schema e migrações SQL

### Tarefas
1. Criar migration SQL para `proposals`.
2. Criar índices mínimos.
3. Criar `proposal_audit_log` (se aprovado).
4. Garantir compatibilidade com migration runner existente.
5. Validar em banco local/preview Neon correto.

### Critérios de aceite
- Migration sobe e desce (quando suportado) sem erro.
- Tabelas e índices criados no schema correto.
- Inserção/consulta básica validada por script de smoke SQL.

### Rollback
- Script de rollback da migration (drop reverso controlado).
- Em produção, rollback preferencial por feature flag + stop de tráfego de escrita antes de revert físico.

---

## Fase 3 — Backend (repository + service + API)

### Tarefas
1. Criar camada de dados em módulos separados (exemplo):
   - `src/server/proposals/repository.ts`
   - `src/server/proposals/service.ts`
   - `src/server/proposals/validators.ts`
   - `src/server/auth/permissions.ts`
2. Reutilizar cliente Neon serverless existente (queries parametrizadas sempre).
3. Manter uso de `pg` apenas em rotas legadas que já dependam disso.
4. Implementar funções centrais de autorização:
   - `requireAuth()`
   - `getCurrentUserRole()`
   - `canReadProposal(user, proposal)`
   - `canWriteProposal(user, proposal)`
   - `canReadAllProposals(user)`
5. Implementar endpoints protegidos e padronizar erros (`401/403/404/422/500`).
6. Registrar auditoria mínima em criação/edição/exclusão e mudança de status sensível.

### Critérios de aceite
- Endpoints funcionam com controle por role validado no backend.
- Usuário comum nunca lê/escreve recurso de outro owner.
- Financeiro recebe apenas leitura.
- Admin tem controle total.

### Riscos + mitigação
- **Risco**: lógica de permissão duplicada por rota.  
  **Mitigação**: centralizar guardas em `permissions.ts` + testes unitários.

---

## Fase 4 — Integração frontend (sem confiar só na UI)

### Tarefas
1. Ajustar fluxo de salvar proposta para usar API (`POST`/`PATCH`).
2. Persistir `id` retornado e alternar corretamente entre criação vs edição.
3. Implementar carregamento de proposta existente por `id`.
4. Atualizar listagem para consumir backend com filtros do usuário.
5. Manter autosave local temporariamente (convivência transitória):
   - Fase 4.1: local + remoto
   - Fase 4.2: remoto prioritário
   - Fase 4.3: local apenas fallback offline (opcional)
6. Proteger UI por perfil (ocultar/desabilitar ações indevidas), sem remover validação backend.

### Critérios de aceite
- Salvar e reabrir proposta funciona para leasing e venda.
- Edição atualiza registro existente (sem duplicar).
- Perfil Financeiro não vê ações de edição/criação na UI e recebe bloqueio backend se tentar forçar.

---

## Fase 5 — Testes e hardening

### Tarefas
1. Unit tests de autorização e ownership.
2. Integration tests de API com perfis reais simulados.
3. Testes de validação de payload (`422`).
4. Testes anti-regressão de import cycle (`madge`) e typecheck/build.
5. Smoke UI manual por perfil.

### Critérios de aceite
- Cenários obrigatórios de RBAC aprovados.
- Sem regressão crítica de build/typecheck.
- Sem ciclos novos em módulos sensíveis.

---

## Fase 6 — Rollout controlado

### Tarefas
1. Liberar por feature flag (escrita/listagem) se viável.
2. Validar em preview com contas de teste por papel.
3. Monitorar erros de API, latência e taxa de `403/422/500`.
4. Ativar gradualmente em produção.

### Critérios de aceite
- Fluxos de criação/edição/listagem estáveis por papel.
- Sem incidentes de vazamento de dados entre owners.

### Rollback operacional
- Desativar feature flag para retornar ao fluxo anterior.
- Preservar dados já persistidos (sem perda).
- Reverter apenas camada de consumo frontend se necessário, mantendo histórico no banco.

---

## 7) Endpoints e regras por operação

## 7.1 Endpoints principais

1. `GET /api/proposals`
   - Admin: retorna todas.
   - Comum: filtra `owner_user_id = current_user_id`.
   - Financeiro: retorna todas read-only.
   - Suporte a paginação, filtro por `proposal_type/status/date`.

2. `GET /api/proposals/:id`
   - Busca por `id` + valida `canReadProposal`.
   - Em caso de não autorizado a recurso: retornar `404` (anti-enumeração).

3. `POST /api/proposals`
   - Admin e Comum podem criar.
   - Financeiro recebe `403`.
   - Ownership inicial definido no backend (nunca confiar em owner vindo da UI).

4. `PATCH /api/proposals/:id`
   - Admin pode editar qualquer.
   - Comum só edita próprias.
   - Financeiro `403`.
   - Alterações de ownership/status sensível bloqueadas para não-admin.

5. `DELETE /api/proposals/:id`
   - Admin permitido.
   - Comum: política explícita (permitir apenas próprias se regra aprovar).
   - Financeiro `403`.
   - Preferir soft delete (`deleted_at`) para recuperação/auditoria.

## 7.2 Endpoints auxiliares (opcional)

- `POST /api/proposals/:id/clone`
- `POST /api/proposals/:id/status`
- `GET /api/proposals/summary`

Todos com os mesmos guardas de autenticação e autorização.

## 7.3 Contratos de erro padronizados

Estrutura sugerida:
```json
{ "error": { "code": "FORBIDDEN", "message": "...", "details": {} } }
```

Codificação mínima:
- `UNAUTHENTICATED` (401)
- `FORBIDDEN` (403)
- `NOT_FOUND` (404)
- `VALIDATION_ERROR` (422)
- `INTERNAL_ERROR` (500)

---

## 8) Integração com Stack Auth

## 8.1 Fluxo recomendado em backend

1. Extrair sessão/usuário autenticado nas rotas protegidas.
2. Resolver atributos mínimos:
   - `userId`
   - `primaryEmail`
   - `displayName`
   - `role`
3. Construir `AuthContext` único por requisição.
4. Aplicar guardas centralizados antes de acessar repository.

## 8.2 Estratégia de implementação

- Criar middleware/helper reutilizável para evitar duplicação.
- Evitar lógica de role dentro de componentes UI.
- Não derivar permissões apenas de claims não validadas.
- Registrar papel resolvido para troubleshooting (sem dados sensíveis em log).

## 8.3 Proteção em duas frentes

- **Frontend**: restringir visualmente ações por perfil (UX).
- **Backend**: validar tudo de novo antes de query/mutação (segurança real).

---

## 9) Passos manuais do desenvolvedor para habilitar a comunicação segura com o banco e autenticação

1. **Conferir variáveis de ambiente de banco**
   - `DATABASE_URL`
   - `NEON_DATABASE_URL`
   - `DATABASE_URL_UNPOOLED`
   - quaisquer outras já usadas no projeto.

2. **Definir fonte oficial da nova camada de propostas**
   - Escolher uma URL principal para repositório de propostas.
   - Documentar no `README`/runbook para evitar ambiguidade.

3. **Configurar ambientes**
   - Local (`.env`)
   - Vercel Preview
   - Vercel Production

4. **Validar parâmetros de conexão Neon**
   - SSL habilitado conforme exigido.
   - schema default esperado.
   - credenciais/usuário com privilégios corretos.

5. **Aplicar migrações no banco correto**
   - Confirmar que migration runner aponta para ambiente alvo.
   - Bloquear execução em banco incorreto (check explícito de env).

6. **Verificar Stack Auth em produção**
   - domínio correto cadastrado.
   - callbacks de produção corretos.
   - localhost removido/desativado em produção.
   - OAuth providers de produção configurados (quando aplicável).

7. **Definir onde o papel é consultado**
   - Preferencialmente metadata/permissões do Stack Auth.
   - Documentar fallback/comportamento quando papel ausente.

8. **Preparar contas de teste separadas**
   - 1 admin
   - 1 usuário comum
   - 1 financeiro

9. **Executar checklist pré-deploy completo**
   - build
   - typecheck
   - testes
   - migrações
   - smoke test de permissões por papel

---

## 10) Testes obrigatórios

## 10.1 Cenários de API/segurança (obrigatórios)

1. Admin cria/lista/lê/edita/exclui qualquer proposta.
2. Usuário comum cria proposta própria.
3. Usuário comum não lê proposta de outro usuário.
4. Usuário comum não edita proposta de outro usuário.
5. Financeiro lista e abre propostas de qualquer usuário.
6. Financeiro não cria proposta (`403`).
7. Financeiro não edita proposta (`403`).
8. Papel sem permissão retorna `403`.
9. Recurso inexistente ou não revelável retorna `404`.
10. Payload inválido retorna `422`.
11. Proposta persiste após reload da aplicação.
12. Edição não gera registro duplicado.

## 10.2 Smoke tests manuais de UI

- Login com cada perfil.
- Tela de listagem de propostas.
- Tela de detalhe.
- Salvar proposta de leasing.
- Salvar proposta de venda.
- Bloqueio de edição para financeiro.
- Bloqueio de visualização cruzada para usuário comum.

## 10.3 Testes de qualidade técnica

- Build de produção.
- Typecheck TS.
- Lint.
- Verificação de ciclos com `madge`.
- Testes de integração backend.

---

## 11) Checklist de deploy e rollback

## 11.1 Deploy

1. Feature flag criada e documentada (quando aplicável).
2. Migrações aplicadas e validadas no ambiente alvo.
3. Variáveis de ambiente conferidas (DB + Stack Auth).
4. Health checks de API e logs sem erro crítico.
5. Smoke por papel executado e aprovado.
6. Monitoramento pós-deploy ativo (erros 4xx/5xx e latência).

## 11.2 Rollback

1. Desabilitar feature flag para interromper escrita/leitura nova.
2. Reverter frontend para fluxo anterior (se necessário).
3. Manter dados gravados para posterior reconciliação.
4. Reverter migration apenas em janela controlada e com backup.
5. Registrar incidente e plano de correção antes de novo deploy.

---

## 12) Critérios de aceite por fase

### Fase 1
- Mapeamento funcional completo aprovado por time técnico.
- Contrato de dados inicial fechado.

### Fase 2
- Schema criado no Neon com índices e migração validada.
- Sem quebra de migração em ambientes locais/preview.

### Fase 3
- API com RBAC e ownership funcionando conforme matriz de acesso.
- Auditoria mínima ativa para eventos críticos.

### Fase 4
- Fluxo de salvar/editar/reabrir funcional para leasing e venda.
- Financeiro sem capacidades de escrita.

### Fase 5
- Testes obrigatórios aprovados (automáticos + manuais).
- Sem regressão de build/typecheck/import cycles.

### Fase 6
- Rollout gradual concluído sem vazamento de acesso.
- Operação estável e monitorada.

---

## Ordem recomendada de execução para o Copilot (resumo operacional)

1. Levantar fluxos atuais e payload real.
2. Definir contrato de domínio + autorização centralizada.
3. Criar migrations SQL + índices.
4. Implementar repository/service/permissions no backend.
5. Expor endpoints protegidos com erros padronizados.
6. Integrar frontend (create/edit/load/list) preservando fallback local transitório.
7. Adicionar auditoria mínima.
8. Executar suíte de testes obrigatórios + madge.
9. Liberar por rollout controlado com contas de cada papel.
10. Monitorar, ajustar e só então tornar padrão.

Este plano permite implementação progressiva, segura e aderente à arquitetura atual (React/Vite + TS + Neon + Stack Auth), minimizando regressão e garantindo RBAC efetivo no backend.
