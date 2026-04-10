# QA RBAC Smoke Test — SolarInvest

Documento de validação manual e script de smoke test para confirmar que o RBAC
(Role-Based Access Control) está funcionando corretamente após as migrações.

## Casos de Teste

| # | Usuário | Role | Esperado |
|---|---------|------|----------|
| 1 | brsolarinvest@gmail.com | role_admin | Vê **todos** clientes e propostas de todos os usuários |
| 2 | leandro.orders@gmail.com | role_comercial | Vê **apenas** os próprios clientes/propostas |
| 3 | usuario-office@empresa.com | role_office | Vê próprios + clientes/propostas de usuários com role_comercial |
| 4 | financeiro@empresa.com | role_financeiro | Vê **tudo** (leitura), porém **não consegue criar/editar/deletar** |
| 5 | sem-role@empresa.com | (nenhum) | Recebe 403 em todas as rotas |

---

## Pré-Requisitos

```bash
export BASE=https://solarinvest-app.vercel.app   # ou http://localhost:3001 em dev
export ADMIN_TOKEN="<Bearer token do admin>"
export COMERCIAL_TOKEN="<Bearer token do comercial>"
export OFFICE_TOKEN="<Bearer token do office>"
export FINANCEIRO_TOKEN="<Bearer token do financeiro>"
export NO_ROLE_TOKEN="<Bearer token sem role>"
```

Para obter o Bearer token no browser: abra DevTools → Application → Cookies ou use a
Stack Auth client SDK: `await user.getAuthHeaders()`.

---

## Cenário 1 — Admin vê todos os clientes (incluindo de leandro.orders@gmail.com)

```bash
# Listar todos os clientes — admin deve ver todos, sem filtro de owner
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  "$BASE/api/clients?limit=100" | \
  jq '.data | length, ([.[] | .owner_email] | unique)'
```

**Validação:**
- `length` deve ser > 0 e incluir clientes criados por outros usuários.
- `owner_email` deve conter múltiplos emails (não só o do admin).

---

## Cenário 2 — Comercial vê apenas seus próprios clientes

```bash
# Listar clientes — comercial só deve ver os próprios
curl -s -H "Authorization: Bearer $COMERCIAL_TOKEN" \
  "$BASE/api/clients?limit=100" | \
  jq '.data | length, ([.[] | .owner_user_id] | unique)'
```

**Validação:**
- Todos os `owner_user_id` devem ser iguais ao userId do comercial.
- Não deve aparecer clientes de outros usuários.

---

## Cenário 3 — Office vê próprios + clientes de role_comercial

```bash
# Listar clientes — office deve ver os próprios E de role_comercial users
curl -s -H "Authorization: Bearer $OFFICE_TOKEN" \
  "$BASE/api/clients?limit=100" | \
  jq '.data | [.[] | {owner_email, owner_user_id}] | unique_by(.owner_user_id)'
```

**Validação:**
- Deve aparecer clientes do próprio office user.
- Deve aparecer clientes de usuários com primary_role = 'role_comercial'.
- NÃO deve aparecer clientes de role_admin ou outros role_office.

---

## Cenário 4 — Financeiro lê tudo mas NÃO escreve

```bash
# ✅ Leitura — deve retornar 200
curl -s -H "Authorization: Bearer $FINANCEIRO_TOKEN" \
  "$BASE/api/clients?limit=10" | jq '.meta.total'

# ❌ Escrita — deve retornar 403
curl -s -X POST -H "Authorization: Bearer $FINANCEIRO_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Teste Financeiro","cpf_raw":"12345678901"}' \
  "$BASE/api/clients" | jq '.error.code'
# Esperado: "FORBIDDEN"

# ❌ Criar proposta — deve retornar 403
curl -s -X POST -H "Authorization: Bearer $FINANCEIRO_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"proposal_type":"venda"}' \
  "$BASE/api/proposals" | jq '.error.code'
# Esperado: "FORBIDDEN"
```

---

## Cenário 5 — Usuário sem role recebe 403

```bash
curl -s -H "Authorization: Bearer $NO_ROLE_TOKEN" \
  "$BASE/api/clients" | jq '.error.code'
# Esperado: "FORBIDDEN" ou "UNAUTHENTICATED"

curl -s -H "Authorization: Bearer $NO_ROLE_TOKEN" \
  "$BASE/api/proposals" | jq '.error.code'
# Esperado: "FORBIDDEN" ou "UNAUTHENTICATED"
```

---

## Cenário 6 — Comercial NÃO vê dados de outro comercial

```bash
# Criar cliente como comercial A (use COMERCIAL_TOKEN)
CLIENT_ID=$(curl -s -X POST -H "Authorization: Bearer $COMERCIAL_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Cliente Exclusivo Comercial A","cpf_raw":"11122233344"}' \
  "$BASE/api/clients" | jq -r '.data.id')

echo "Cliente criado: $CLIENT_ID"

# Tentar acessar como comercial B — deve retornar 404 (não existe para ele) ou 403
# (substitua $COMERCIAL_B_TOKEN pelo token de outro comercial)
curl -s -H "Authorization: Bearer $COMERCIAL_B_TOKEN" \
  "$BASE/api/clients/$CLIENT_ID" | jq '.error.code'
# Esperado: "NOT_FOUND" (RLS filtra a linha, o server retorna 404)
```

---

## Script Node de Smoke Test (automatizado)

Salve como `/tmp/rbac-smoke.mjs` e execute com `node /tmp/rbac-smoke.mjs`:

```javascript
// /tmp/rbac-smoke.mjs
// Smoke test básico do RBAC — requer variáveis de ambiente configuradas

const BASE = process.env.BASE ?? 'http://localhost:3001'
const tokens = {
  admin:      process.env.ADMIN_TOKEN,
  comercial:  process.env.COMERCIAL_TOKEN,
  office:     process.env.OFFICE_TOKEN,
  financeiro: process.env.FINANCEIRO_TOKEN,
}

async function apiFetch(path, token, opts = {}) {
  const r = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...opts.headers,
    },
  })
  const body = await r.json()
  return { status: r.status, body }
}

async function run() {
  let passed = 0, failed = 0

  function assert(name, condition, detail = '') {
    if (condition) {
      console.log(`  ✅ ${name}`)
      passed++
    } else {
      console.error(`  ❌ ${name}${detail ? ` — ${detail}` : ''}`)
      failed++
    }
  }

  // 1. Admin lista clientes
  console.log('\n[1] Admin lista clientes')
  if (tokens.admin) {
    const { status, body } = await apiFetch('/api/clients?limit=100', tokens.admin)
    assert('GET /api/clients status 200', status === 200, `got ${status}`)
    assert('Retorna array de clientes', Array.isArray(body.data), JSON.stringify(body).slice(0, 100))
  } else {
    console.warn('  ⚠️  ADMIN_TOKEN não configurado — pulando')
  }

  // 2. Financeiro NÃO escreve
  console.log('\n[2] Financeiro não pode criar clientes')
  if (tokens.financeiro) {
    const { status } = await apiFetch('/api/clients', tokens.financeiro, {
      method: 'POST',
      body: JSON.stringify({ name: 'Smoke Test', cpf_raw: '99988877766' }),
    })
    assert('POST /api/clients retorna 403', status === 403, `got ${status}`)
  } else {
    console.warn('  ⚠️  FINANCEIRO_TOKEN não configurado — pulando')
  }

  // 3. Financeiro lê propostas
  console.log('\n[3] Financeiro lê propostas')
  if (tokens.financeiro) {
    const { status } = await apiFetch('/api/proposals', tokens.financeiro)
    assert('GET /api/proposals status 200', status === 200, `got ${status}`)
  }

  // 4. Comercial lista apenas os próprios
  console.log('\n[4] Comercial lista apenas os próprios clientes')
  if (tokens.comercial) {
    const { status, body } = await apiFetch('/api/clients?limit=100', tokens.comercial)
    assert('GET /api/clients status 200', status === 200, `got ${status}`)
    if (body.data?.length > 0) {
      const ownerIds = [...new Set(body.data.map(c => c.owner_user_id))]
      assert('Apenas 1 owner_user_id único (próprio)', ownerIds.length <= 1, ownerIds.join(','))
    }
  } else {
    console.warn('  ⚠️  COMERCIAL_TOKEN não configurado — pulando')
  }

  console.log(`\nResultado: ${passed} passaram, ${failed} falharam\n`)
  if (failed > 0) process.exit(1)
}

run().catch(e => { console.error(e); process.exit(1) })
```

---

## Checklist de Validação Pós-Deploy

- [ ] Migration `0018_role_aware_rls.sql` executada com sucesso (sem erros no log)
- [ ] Admin vê clientes de `leandro.orders@gmail.com` na lista de clientes
- [ ] Admin vê propostas de outros usuários na lista de orçamentos
- [ ] Coluna "Consultor" aparece no painel de clientes para admin/office/financeiro
- [ ] Comercial não vê clientes de outros comerciais
- [ ] Financeiro consegue listar mas recebe 403 ao tentar criar/editar
- [ ] Usuário sem role recebe 403 ao acessar `/api/clients` ou `/api/proposals`
- [ ] Logs do servidor mostram `[RBAC] resolveActor:` apenas quando o fallback DB é usado

---

## Diagnóstico de Problemas

### Admin ainda não vê dados de outros usuários

1. Verifique se a migration `0018_role_aware_rls.sql` foi executada no banco Neon.
2. Verifique se o `STACK_SECRET_SERVER_KEY` está configurado no Vercel (ou se o fallback DB está ativo — veja logs).
3. Confirme que o usuário tem `role_admin` em Stack Auth permissions OU `role='admin'` em `app_user_access`.

### Erro 500 "sql.transaction not available"

O driver Neon HTTP não expõe `.transaction`. Isso pode acontecer se `neonClient.js` não usa o driver com transações ativadas. Verifique se `neon({ fullResults: false })` está sendo usado ou se `neonClient` foi configurado com suporte a batch/transaction.

### Financeiro consegue criar (não deveria)

Verifique se a migration foi aplicada:
```sql
SELECT proname, prosrc FROM pg_proc WHERE proname = 'can_write_owner' AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'app');
```
Se não retornar nada, execute a migration `0018`.
