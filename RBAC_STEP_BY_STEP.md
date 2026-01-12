# Guia RBAC (passo a passo de 8 anos, mas completo)

> Objetivo: te dizer exatamente **o que fazer e configurar**, em ordem, para ter login por e-mail,
> perfis (RBAC) e autorização no backend.

## 0) Antes de começar: o que é RBAC (em 1 frase)

RBAC é como um colar com cores diferentes: cada cor deixa você entrar em salas diferentes.

---

## 1) Crie o banco no Neon (a caixa mágica)

1. Entre em https://neon.tech e crie uma conta.
2. Clique em **New Project**.
3. Copie a conexão do banco (ela se chama `DATABASE_URL`).
4. Guarde essa URL, porque você vai colar na Vercel.

---

## 2) Configure variáveis na Vercel (a “chave da caixa”)

1. Abra seu projeto na Vercel.
2. Vá em **Settings → Environment Variables**.
3. Adicione:
   - `DATABASE_URL` com o valor do Neon.
   - variáveis do login (Stack Auth):  
     - `NEXT_PUBLIC_STACK_PROJECT_ID`  
     - `NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY`  
     - `STACK_SECRET_SERVER_KEY`  
     - `STACK_JWKS_URL`  
     - `TRUSTED_WEB_ORIGINS`
4. Salve e faça **redeploy**.

---

## 3) Crie as tabelas do RBAC no Neon

No **SQL Editor** do Neon, cole e rode este bloco:

```sql
CREATE TABLE IF NOT EXISTS app_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL CHECK (role IN ('admin', 'consultant', 'supervisor', 'support', 'finance')),
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS supervisor_consultants (
  supervisor_id UUID NOT NULL REFERENCES app_users(id),
  consultant_id UUID NOT NULL REFERENCES app_users(id),
  created_at TIMESTAMP DEFAULT now(),
  PRIMARY KEY (supervisor_id, consultant_id)
);

CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  created_by UUID NOT NULL REFERENCES app_users(id),
  updated_by UUID REFERENCES app_users(id),
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id),
  status TEXT NOT NULL DEFAULT 'draft',
  created_by UUID NOT NULL REFERENCES app_users(id),
  updated_by UUID REFERENCES app_users(id),
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS technical_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id),
  installation_status TEXT,
  inspection_status TEXT,
  maintenance_status TEXT,
  support_notes TEXT,
  created_by UUID NOT NULL REFERENCES app_users(id),
  updated_by UUID REFERENCES app_users(id),
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS financial_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id),
  contract_value NUMERIC(12,2),
  billing_status TEXT,
  payment_status TEXT,
  created_by UUID NOT NULL REFERENCES app_users(id),
  updated_by UUID REFERENCES app_users(id),
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);
```

✅ Agora sua “caixa” tem lugares separados para cada tipo de dado.

---

## 4) Crie usuários com perfis (Admin, Consultor, Supervisor, etc.)

No Neon, rode comandos como:

```sql
INSERT INTO app_users (email, full_name, role)
VALUES ('admin@exemplo.com', 'Admin', 'admin');

INSERT INTO app_users (email, full_name, role)
VALUES ('consultor1@exemplo.com', 'Consultor 1', 'consultant');
```

Se for um supervisor, você também precisa ligar o supervisor aos consultores:

```sql
INSERT INTO supervisor_consultants (supervisor_id, consultant_id)
VALUES ('UUID_DO_SUPERVISOR', 'UUID_DO_CONSULTOR');
```

---

## 5) Crie as rotas no backend (as portas)

Você vai criar endpoints como:

- `GET /api/customers`
- `POST /api/customers`
- `PUT /api/customers/:id`
- `DELETE /api/customers/:id`

E também:
- `POST /api/proposals`
- `PATCH /api/proposals/:id/approve`
- `PATCH /api/proposals/:id/reject`
- `PUT /api/technical/:customerId`
- `GET /api/financial/:customerId`

---

## 6) Aplique RBAC no backend (obrigatório)

Antes de responder, o backend **precisa** olhar o perfil do usuário:

```ts
if (user.role === 'admin') {
  // pode tudo
} else if (user.role === 'consultant') {
  // só clientes criados por ele
} else if (user.role === 'supervisor') {
  // só clientes do grupo dele
} else if (user.role === 'support') {
  // só dados técnicos
} else if (user.role === 'finance') {
  // só dados financeiros
} else {
  // nega acesso
}
```

✅ **Se não estiver no backend, não é seguro.**

---

## 7) Sempre grave auditoria (quem fez o quê)

Quando criar ou atualizar algo:

- coloque `created_by = user.id` no INSERT
- coloque `updated_by = user.id` no UPDATE

Assim você sempre sabe quem fez cada coisa.

---

## 8) Teste em ordem (Postman/Insomnia)

1. Faça login e pegue o token.
2. Teste `GET /api/customers`:
   - admin deve ver tudo
   - consultor só vê os dele
3. Teste `PUT /api/technical/:customerId` com técnico.
4. Teste `GET /api/financial/:customerId` com financeiro.
5. Teste aprovar proposta com supervisor.

Se algum usuário conseguir acessar algo proibido → erro no RBAC.

---

## 9) Checklist final (bem simples)

- [ ] Neon criado
- [ ] `DATABASE_URL` na Vercel
- [ ] Variáveis do login na Vercel
- [ ] Tabelas criadas
- [ ] Usuários cadastrados
- [ ] Endpoints criados
- [ ] RBAC no backend aplicado
- [ ] Auditoria gravada
- [ ] Testes manuais feitos
