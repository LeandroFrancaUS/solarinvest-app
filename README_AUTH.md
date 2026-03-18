# README_AUTH.md — Configuração do Sistema de Autenticação e Autorização

> **SolarInvest** · Login com e-mail/senha + Google · Autorização interna por banco de dados

---

## Visão Geral

O sistema de autenticação do SolarInvest usa dois componentes distintos:

| Responsabilidade | Componente |
|---|---|
| **Autenticação** (quem é o usuário?) | [Stack Auth](https://stack-auth.com/) |
| **Autorização** (quem pode usar o app?) | Tabela `app_user_access` no banco Neon/PostgreSQL |

Mesmo estando autenticado no Stack Auth, um usuário só acessa o app se estiver **aprovado** na tabela interna.

---

## 1. Variáveis de Ambiente

### Frontend (Vite — devem ter prefixo `VITE_`)

| Variável | Descrição | Obrigatória |
|---|---|---|
| `VITE_STACK_PROJECT_ID` | Project ID do Stack Auth | ✅ |
| `VITE_STACK_PUBLISHABLE_CLIENT_KEY` | Chave pública do Stack Auth | ✅ |
| `VITE_API_BASE_URL` | URL base da API (ex: `https://app.solarinvest.info`) | Opcional |

### Backend / Servidor

| Variável | Descrição | Obrigatória |
|---|---|---|
| `DATABASE_URL` | Connection string do Neon/PostgreSQL | ✅ |
| `STACK_PROJECT_ID` | Project ID do Stack Auth (server-side) | ✅ em produção |
| `STACK_JWKS_URL` | URL JWKS do Stack Auth | Opcional (inferida) |
| `STACK_SECRET_SERVER_KEY` | Chave secreta do Stack Auth | ✅ em produção |
| `ADMIN_EMAIL` | E-mail do admin principal | Padrão: `brsolarinvest@gmail.com` |
| `TRUSTED_WEB_ORIGINS` | Origens confiáveis (separadas por vírgula) | Recomendado |
| `AUTH_COOKIE_NAME` | Nome do cookie de sessão | Padrão: `solarinvest_session` |
| `AUTH_COOKIE_SECRET` | Segredo para assinar o cookie de sessão | Recomendado |
| `SESSION_COOKIE_SECURE` | Deve ser `true` em produção | ✅ em produção |
| `APP_BASE_URL` | URL base do app (ex: `https://app.solarinvest.info`) | Recomendado |

> **Nunca** exponha `STACK_SECRET_SERVER_KEY` ou `DATABASE_URL` no frontend.
> Variáveis sem prefixo `VITE_` ficam apenas no servidor.

---

## 2. Configuração do Stack Auth

### 2.1 Criar/acessar o projeto

1. Acesse [app.stack-auth.com](https://app.stack-auth.com/)
2. Crie ou selecione o projeto `solarinvest-app`
3. Vá em **Project Settings** e copie:
   - **Project ID** → `VITE_STACK_PROJECT_ID` (frontend) e `STACK_PROJECT_ID` (backend)
   - **Publishable Client Key** → `VITE_STACK_PUBLISHABLE_CLIENT_KEY`
   - **Secret Server Key** → `STACK_SECRET_SERVER_KEY` (backend apenas)

### 2.2 URLs autorizadas (Allowed Origins / Redirect URLs)

No painel Stack Auth, cadastre:

**Allowed Origins (JavaScript origins):**
```
https://app.solarinvest.info
http://localhost:5173
```

**Redirect URLs (após login/logout):**
```
https://app.solarinvest.info
https://app.solarinvest.info/*
http://localhost:5173
http://localhost:5173/*
```

> Em produção, **remova** as URLs de localhost.

### 2.3 Providers habilitados

No painel Stack Auth → **Auth Methods**:
- ✅ **Email + Password** — habilitar com reset de senha
- ✅ **Google OAuth** — ver seção 3 abaixo
- Reset de senha / magic link via SMTP do Stack (configurar se necessário)

### 2.4 Sessão persistente

O Stack Auth gerencia cookies de sessão com refresh automático.
Não há configuração manual necessária — o tokenStore está configurado como `"cookie"` em `src/stack/client.ts`.

A sessão pode durar semanas/meses enquanto o refresh token for válido.

---

## 3. Configuração do Google OAuth

### 3.1 Google Cloud Console

1. Acesse [console.cloud.google.com](https://console.cloud.google.com/)
2. Crie ou selecione um projeto
3. Vá em **APIs & Services → OAuth consent screen**:
   - Tipo: External
   - Nome do app: **SolarInvest**
   - E-mail de suporte: `brsolarinvest@gmail.com`
   - Authorized domains: `solarinvest.info`
4. Vá em **Credentials → Create Credentials → OAuth 2.0 Client ID**:
   - Tipo: **Web application**
   - Name: SolarInvest Production
   
5. Configure **Authorized JavaScript origins**:
   ```
   https://app.solarinvest.info
   ```

6. Configure **Authorized redirect URIs** (use o valor exato do Stack Auth dashboard):
   ```
   https://api.stack-auth.com/api/v1/auth/oauth/callback/google
   ```
   > Confirme o URI exato no painel do Stack Auth → Google OAuth configuration.

7. Copie **Client ID** e **Client Secret**

### 3.2 Configurar no Stack Auth

No painel Stack Auth → **Auth Methods → Google**:
- Cole o **Google Client ID** e **Google Client Secret**
- Habilite o provider

> **Não use credenciais de desenvolvimento em produção.**
> Publique/valide a OAuth consent screen antes de ir ao ar.

---

## 4. Configuração no Vercel

### 4.1 Environment Variables

No Vercel → **Settings → Environment Variables**, adicione para o ambiente **Production**:

```
VITE_STACK_PROJECT_ID=<seu-project-id>
VITE_STACK_PUBLISHABLE_CLIENT_KEY=<sua-chave-publica>
DATABASE_URL=<sua-connection-string-neon>
STACK_PROJECT_ID=<seu-project-id>
STACK_SECRET_SERVER_KEY=<sua-chave-secreta>
STACK_JWKS_URL=https://api.stack-auth.com/api/v1/projects/<seu-project-id>/.well-known/jwks.json
TRUSTED_WEB_ORIGINS=https://app.solarinvest.info
ADMIN_EMAIL=brsolarinvest@gmail.com
APP_BASE_URL=https://app.solarinvest.info
SESSION_COOKIE_SECURE=true
```

### 4.2 Checklist de produção no Vercel

- [ ] Domínio `app.solarinvest.info` configurado e HTTPS ativo
- [ ] Todas as variáveis acima cadastradas em Production
- [ ] Variáveis `VITE_*` disponíveis em Build time (não apenas runtime)
- [ ] Runtime: Node.js 24.x
- [ ] Rewrites do `vercel.json` preservados: `/api/:path*` → `/api`
- [ ] Cookies: `Secure=true` em produção (validado com `SESSION_COOKIE_SECURE=true`)

### 4.3 Ordem de deploy recomendada

1. Configurar Stack Auth (project, providers, URLs)
2. Configurar Google OAuth (Cloud Console + Stack)
3. Configurar variáveis no Vercel
4. Rodar migrações do banco
5. Fazer deploy
6. Autenticar com `brsolarinvest@gmail.com` pela primeira vez
7. Confirmar admin no banco (ver seção 6)
8. Executar checklist de testes pós-deploy

---

## 5. Configuração do Banco (Neon/PostgreSQL)

### 5.1 Rodar as migrações

No **SQL Editor** do Neon, execute os arquivos em ordem:

```bash
# 1. Tabela de controle de acesso
db/migrations/0004_create_app_user_access.sql

# 2. Tabela de auditoria (opcional mas recomendada)
db/migrations/0005_create_app_user_access_audit.sql
```

Ou copie e cole o conteúdo de cada arquivo no SQL Editor.

### 5.2 Verificar extensões

Confirme que `gen_random_uuid()` está disponível:
```sql
SELECT gen_random_uuid();
```
Se não estiver, habilite:
```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
```

### 5.3 Schema da tabela `app_user_access`

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | UUID | Chave primária interna |
| `auth_provider_user_id` | TEXT UNIQUE | ID do usuário no Stack Auth |
| `email` | TEXT | E-mail do usuário |
| `full_name` | TEXT | Nome completo |
| `role` | TEXT | `admin` \| `manager` \| `user` |
| `access_status` | TEXT | `pending` \| `approved` \| `revoked` \| `blocked` |
| `is_active` | BOOLEAN | Se o usuário está ativo |
| `can_access_app` | BOOLEAN | Se tem acesso liberado |
| `approved_by` | TEXT | E-mail de quem aprovou |
| `approved_at` | TIMESTAMPTZ | Data de aprovação |
| `revoked_by` | TEXT | E-mail de quem revogou |
| `revoked_at` | TIMESTAMPTZ | Data de revogação |
| `last_login_at` | TIMESTAMPTZ | Último login |

---

## 6. Bootstrap do Primeiro Admin

### 6.1 Fluxo automático (preferido)

O sistema faz bootstrap automático do admin principal na primeira autenticação.

Ao fazer login com `brsolarinvest@gmail.com`, o backend executa automaticamente um `UPSERT` que garante:
```
role = 'admin'
access_status = 'approved'
can_access_app = true
is_active = true
```

Isso acontece em `server/auth/currentAppUser.js` na função `ensureBootstrapAdmin()`.

### 6.2 Verificar no banco após o primeiro login

```sql
SELECT id, auth_provider_user_id, email, role, access_status, can_access_app, is_active
FROM app_user_access
WHERE email = 'brsolarinvest@gmail.com';
```

Esperado:
```
role          = 'admin'
access_status = 'approved'
can_access_app = true
is_active     = true
```

### 6.3 Fallback manual (se o bootstrap automático falhar)

**Opção A — Atualizar usuário existente:**
```sql
UPDATE app_user_access
SET
  role = 'admin',
  access_status = 'approved',
  can_access_app = true,
  is_active = true,
  approved_at = now(),
  updated_at = now()
WHERE email = 'brsolarinvest@gmail.com';
```

**Opção B — Inserir novo registro (antes do primeiro login):**
```sql
INSERT INTO app_user_access (
  auth_provider_user_id,
  email,
  full_name,
  role,
  access_status,
  is_active,
  can_access_app
)
VALUES (
  'PREENCHER_APOS_PRIMEIRO_LOGIN',
  'brsolarinvest@gmail.com',
  'SolarInvest Admin',
  'admin',
  'approved',
  true,
  true
);
```

> **Importante:** O `auth_provider_user_id` deve ser preenchido com o ID real do Stack Auth após o primeiro login. Consulte o banco após autenticar para obter o valor correto.

---

## 7. Fluxo de Autenticação e Autorização

```
1. Usuário acessa o app
2. StackProvider envolve o app (src/app/Providers.tsx)
3. RequireAuth verifica se há usuário autenticado no Stack Auth
   └── Não autenticado → exibe tela de login (SignIn component)
4. RequireAuthorizedUser chama GET /api/auth/me
   └── Backend valida token Stack Auth + consulta app_user_access
5. Resposta da API:
   ├── access_status = 'approved' → acesso liberado
   ├── access_status = 'pending'  → tela "Acesso Pendente"
   ├── access_status = 'blocked'  → tela "Acesso Bloqueado"
   └── access_status = 'revoked'  → tela "Acesso Revogado"
```

### Endpoints de autenticação

| Endpoint | Método | Descrição |
|---|---|---|
| `GET /api/auth/me` | GET | Retorna auth + autorização interna |
| `POST /api/auth/login` | POST | Troca token Stack por cookie de sessão |
| `POST /api/auth/logout` | POST | Limpa o cookie de sessão |

### Endpoints de administração (requer role=admin)

| Endpoint | Método | Descrição |
|---|---|---|
| `GET /api/admin/users` | GET | Lista usuários (paginado + busca) |
| `POST /api/admin/users/:id/approve` | POST | Aprova acesso |
| `POST /api/admin/users/:id/block` | POST | Bloqueia acesso |
| `POST /api/admin/users/:id/revoke` | POST | Revoga acesso |
| `POST /api/admin/users/:id/role` | POST | Altera role (`admin`/`manager`/`user`) |

---

## 8. Painel Administrativo

O painel de administração de usuários está disponível em `src/features/admin-users/`.

Para acessar o painel, integre `AdminUsersPage` em uma rota protegida com `RequireAdmin`:

```tsx
import { RequireAdmin } from './auth/guards/RequireAdmin'
import { AdminUsersPage } from './features/admin-users/AdminUsersPage'

// Em alguma rota/página do app:
<RequireAdmin>
  <AdminUsersPage />
</RequireAdmin>
```

---

## 9. Aprovação de Novos Usuários

Quando um usuário se autentica pela primeira vez:
1. O backend cria automaticamente um registro com `access_status = 'pending'`
2. O usuário vê a tela "Acesso Pendente"
3. O admin acessa o painel e aprova o usuário
4. O usuário passa a ter acesso ao sistema

---

## 10. Troubleshooting

### Usuário faz login com Google, mas volta para tela pública

Possíveis causas:
- Callback URI incorreto no Google Cloud Console
- Domínio divergente entre Stack Auth e Vercel
- `/api/auth/me` retornando `authorized: false`
- Usuário ainda com `access_status = 'pending'`
- Cookie não persistindo (problema de domínio/SameSite/Secure)

**Diagnóstico:** Abra o DevTools → Network e verifique a resposta de `/api/auth/me`.

---

### Usuário autenticou, mas não acessa o app

Verificar no banco:
```sql
SELECT email, role, access_status, can_access_app, is_active
FROM app_user_access
WHERE email = 'email-do-usuario@exemplo.com';
```

Para aprovar manualmente:
```sql
UPDATE app_user_access
SET access_status = 'approved', can_access_app = true, is_active = true, updated_at = now()
WHERE email = 'email-do-usuario@exemplo.com';
```

---

### Google login falha em produção mas funciona local

Possíveis causas:
- `Authorized JavaScript origins` não inclui `https://app.solarinvest.info`
- `Authorized redirect URIs` incorretas
- `STACK_SECRET_SERVER_KEY` errada ou ausente no Vercel
- OAuth consent screen em modo "Testing" (publicar para External)

---

### Sessão não persiste após fechar o browser

Possíveis causas:
- `SESSION_COOKIE_SECURE` não está `true` em produção
- Domínio do cookie divergente
- Cookie sendo bloqueado por SameSite policy

Verificar no DevTools → Application → Cookies: o cookie `solarinvest_session` deve ter `HttpOnly`, `Secure` e `SameSite=Lax`.

---

### `/api/auth/me` retorna 401 ou erro de banco

Possíveis causas:
- `DATABASE_URL` não configurada ou inválida
- Tabela `app_user_access` não criada (rodar migration 0004)
- `STACK_PROJECT_ID` ausente (JWT não validado)

---

## 11. Checklist de Testes Pós-Deploy

```
[ ] Login com Google funcionando em produção
[ ] Login com e-mail/senha funcionando em produção
[ ] Logout funcionando e cookie removido
[ ] Sessão persiste após refresh e nova visita
[ ] brsolarinvest@gmail.com acessa como admin
[ ] Usuário novo entra como 'pending' (não acessa o app)
[ ] Admin aprova usuário → usuário passa a acessar
[ ] Usuário revogado perde acesso mesmo autenticado no Stack
[ ] Usuário bloqueado perde acesso
[ ] GET /api/auth/me retorna dados corretos para admin
[ ] GET /api/admin/users funciona apenas para admin aprovado
[ ] Usuário não-admin recebe 403 em /api/admin/users
[ ] Nenhuma senha armazenada em cookie/localStorage
[ ] Cookies têm Secure=true em produção
[ ] Painel admin abre apenas para admin aprovado
[ ] Auditoria registrada na tabela app_user_access_audit
```

---

## 12. Segurança — Regras Importantes

1. ❌ Nunca armazene senha em cookie, localStorage ou sessionStorage
2. ❌ Nunca confie apenas no frontend para controlar acesso
3. ❌ Nunca exponha `STACK_SECRET_SERVER_KEY` no bundle do cliente
4. ✅ Toda rota privada valida token no backend + status na tabela interna
5. ✅ Cookies de sessão: `HttpOnly`, `Secure`, `SameSite=Lax`
6. ✅ A fonte de verdade de autorização é sempre o banco, nunca o JWT isolado
7. ✅ `can_access_app = true` e `access_status = 'approved'` devem ser coerentes

---

## 13. Estrutura de Arquivos Relevantes

```
src/
  auth/
    stack-client.ts          # Re-export do Stack client
    auth-session.ts          # Hook: useAuthSession()
    guards/
      RequireAuth.tsx         # Guard: exige autenticação Stack Auth
      RequireAuthorizedUser.tsx # Guard: exige autorização interna
      RequireAdmin.tsx        # Guard: exige role=admin

  lib/auth/
    access-types.ts          # Tipos: AccessRole, AccessStatus, MeResponse, etc.
    access-mappers.ts        # Helpers: deriveAccessState, roleLabel, etc.

  services/auth/
    me.ts                    # fetchMe() → GET /api/auth/me
    admin-users.ts           # fetchAdminUsers(), approveUser(), etc.

  features/admin-users/
    AdminUsersPage.tsx       # Página do painel admin
    AdminUsersTable.tsx      # Tabela de usuários com ações

  pages/
    SignInPage.tsx            # Tela de login (Stack Auth Sign In)
    AccessPendingPage.tsx     # Tela para usuários não autorizados

  app/
    Providers.tsx             # Wraps app com StackProvider
    Routes.tsx                # Wraps children com RequireAuth + RequireAuthorizedUser

server/
  auth/
    stackAuth.js              # Verificação JWT do Stack Auth
    currentAppUser.js         # Resolve usuário autenticado + autorizado
    rbac.js                   # requireAuth, requireAuthorized, requireAdmin

  routes/
    authMe.js                 # Handler: GET /api/auth/me
    adminUsers.js             # Handlers: admin user management

db/migrations/
  0004_create_app_user_access.sql       # Tabela de autorização
  0005_create_app_user_access_audit.sql # Tabela de auditoria
```

---

*Última atualização: 2026 · SolarInvest*
