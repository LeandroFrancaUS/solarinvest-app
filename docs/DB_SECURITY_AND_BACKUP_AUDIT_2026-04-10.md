# Auditoria profunda — proteção de dados + resiliência de backup (Neon)

**Data da auditoria:** 2026-04-10  
**Escopo:** fluxo de gravação/leitura de clientes e propostas, RBAC, RLS, trilha de auditoria, risco de perda de informação e plano de continuidade.

## Resumo executivo

- O backend já usa autenticação por sessão/JWT, queries parametrizadas e políticas de RLS com contexto de usuário/role no Postgres.  
- Há trilha de auditoria para clientes (`client_audit_log`) e estrutura RBAC madura para `role_admin`, `role_office`, `role_financeiro` e `role_comercial`.  
- O principal gap operacional identificado era **ausência de mecanismo de backup acionável por perfis privilegiados diretamente na UI** com checksum/controle de destino.  
- Foi implementado mecanismo de backup com controle de acesso (Admin/Office), checksum SHA-256 e destinos operacionais (local, nuvem via share, plataforma).

## Evidências analisadas

1. **Autenticação e verificação de requisição**
   - `verifyRequest` valida cookie assinado e Bearer JWT RS256 por JWKS.  
   - Há fallback e normalização de identidade para `userId`.

2. **Camada de API e segurança de transporte/abuso**
   - `server/handler.js` aplica CORS controlado por origens confiáveis.
   - Limites de taxa para endpoints de autenticação e operações administrativas.

3. **Controle de acesso/RBAC**
   - `resolveActor` usa permissões Stack + fallback de role interna.
   - Precedência de privilégio está explícita e consistente.

4. **Proteção no banco (RLS)**
   - Migrations descrevem e implementam `role_aware_rls` com regras fail-closed.
   - Contexto de role/usuário é propagado via `createUserScopedSql`.

5. **Integridade de dados críticos**
   - Clientes com deduplicação por CPF/CNPJ e idempotência por `offline_origin_id`.
   - Logs de auditoria de criação/atualização/reuso em `client_audit_log`.

## Riscos residuais encontrados

1. **Backup dependia de ação manual externa não padronizada** (risco alto para continuidade operacional).  
2. **Sem checksum operacional de backup no fluxo de usuário** (dificulta validação de integridade).  
3. **Sem retenção simples na própria plataforma para snapshots gerados internamente**.

## Enhancements implementados nesta entrega

1. **Novo endpoint seguro de backup**
   - `POST /api/admin/database-backup`.
   - Acesso restrito a `role_admin` e `role_office`.
   - Gera snapshot de `clients`, `proposals`, `client_audit_log`, `app_user_access`.
   - Emite checksum SHA-256 do payload.
   - Suporta destino `platform` com persistência no banco e retenção dos últimos 20 backups por usuário.

2. **Novo botão de backup na tela de clientes**
   - Botão “Backup banco” na página de lista de clientes.
   - Visível/funcional apenas para Admin e Office.
   - Destinos suportados:
     - **Local**: download JSON.
     - **Nuvem**: uso de Web Share API quando disponível (com fallback para download).
     - **Plataforma**: snapshot salvo no Neon via endpoint seguro.

## Recomendações adicionais (próximas iterações)

1. **Criptografia de backup em repouso (aplicação)**
   - Criptografar payload antes de persistir em `db_backup_snapshots` com chave de KMS.

2. **Restore assistido + testes de restauração**
   - Criar endpoint/processo de restore controlado por ambiente.
   - Rodar teste de restore mensal (tabletop + restore técnico).

3. **Política formal de retenção e DR**
   - Definir RPO/RTO, retenção por camada (diário/semanal/mensal) e runbook.

4. **Observabilidade e alertas**
   - Alertar falhas de backup, variação anômala de volume e falha de integridade (checksum).

5. **Classificação de dados e minimização**
   - Avaliar pseudonimização para campos pessoais em backups secundários.

## Conclusão

A base já estava tecnicamente robusta em autenticação, RBAC, RLS e trilha de auditoria.  
Com o mecanismo implementado nesta entrega, o sistema passa a ter um caminho operacional claro de backup para Admin/Office, reduzindo significativamente risco de perda futura por ausência de rotina padronizada no produto.

## Ajuste adicional (hotfix ambiente) — erros 500 em APIs críticas

- Foi identificado cenário de ambiente com migrations parciais/não aplicadas, causando falhas 500 em:
  - `/api/clients`
  - `/api/proposals`
  - `/api/consultants`
  - `/api/clients/upsert-by-cpf`
- Para mitigar indisponibilidade operacional, foi adicionado **self-healing de schema** no backend:
  - criação idempotente das tabelas/colunas mínimas usadas em runtime (`clients`, `proposals`, `client_audit_log`, `proposal_audit_log`, `app_user_profiles`);
  - `CREATE EXTENSION IF NOT EXISTS "pgcrypto"` para UUID defaults;
  - execução única e cacheada do bootstrap por processo, acionada antes das rotas críticas.
- Resultado esperado: redução imediata de 500 por ausência de estrutura de banco e recuperação de funcionamento das telas dependentes de clients/proposals/consultants.

## Root cause adicional identificado (500 em `/api/clients`)

- Durante a auditoria de runtime foi identificado um segundo gatilho de 500:
  - `createUserScopedSql` (RLS context) lançava erro quando o usuário autenticado não possuía role RBAC resolvida.
  - O fluxo de `server/clients/handler.js` não tratava essa exceção antes de executar a listagem.
  - Resultado: exceção propagava até o handler global e retornava 500 genérico.
- Correção aplicada:
  - tratamento explícito da falha de inicialização de contexto (`401/403/500`) no próprio `clients/handler`,
  - resposta semântica (`FORBIDDEN` quando usuário sem role), eliminando 500 indevido.
