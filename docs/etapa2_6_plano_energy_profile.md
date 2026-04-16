# Etapa 2.6 — Persistência da aba Plano na Carteira de Clientes

## Relatório Final

---

## FASE 1 — Diagnóstico do Fluxo Anterior

### Problema Identificado

A aba **Plano** da Carteira estava chamando `patchPortfolioUsina()` → `PUT /api/clients/:id`, que:
- Persiste dados na tabela `clients` (campos genéricos)
- **NÃO** persiste na tabela `client_energy_profile`
- Os campos do plano (modalidade, tarifa, desconto, etc.) ficavam null em `GET /api/client-portfolio/:id`

### Campos afetados (sempre retornavam null)

| Campo | Esperado | Retornava |
|---|---|---|
| `energy_profile_id` | ID numérico | null |
| `modalidade` | "leasing" | null |
| `tarifa_atual` | ex: 1.14 | null |
| `desconto_percentual` | ex: 20 | null |
| `mensalidade` | ex: 560 | null |
| `prazo_meses` | ex: 60 | null |
| `kwh_contratado` | ex: 700 | null |
| `potencia_kwp` | ex: 5.34 | null |
| `tipo_rede` | ex: "monofasico" | null |
| `marca_inversor` | ex: "solis" | null |
| `indicacao` | ex: "teste" | null |

### Fonte de dados errada

O `PlanoLeasingTab` usava apenas 4 campos e enviava para `PUT /api/clients/:id` (endpoint genérico de atualização do cliente), que não executa `upsertClientEnergyProfile`.

---

## FASE 2 — Arquitetura Implementada

### Novo endpoint

```
PATCH /api/client-portfolio/:clientId/plan
```

Consistente com o padrão existente:
- `/contract` → `upsertClientContract`
- `/project` → `upsertClientProjectStatus`
- `/billing` → `upsertClientBillingProfile`
- `/plan` → `upsertClientEnergyProfile` ← **NOVO**

### Fonte oficial do Plano

A aba Plano agora:
- **Salva em**: `client_energy_profile` via `PATCH /api/client-portfolio/:id/plan`
- **Hidrata de**: `GET /api/client-portfolio/:id` (que já faz LEFT JOIN com `client_energy_profile`)
- **NÃO usa**: `latest_proposal_profile`, `metadata`, `PUT /api/clients/:id`

---

## FASE 3 — Implementação Backend

### Arquivo: `server/client-portfolio/handler.js`

Nova função `handlePortfolioPlanPatch`:
- Valida RBAC (write access: admin|office)
- Lê body JSON
- Mapeia campos da UI para nomes DB (ex: `kwh_mes_contratado` → `kwh_contratado`, `valor_mensalidade` → `mensalidade`)
- Chama `upsertClientEnergyProfile(sql, clientId, profile)` da `server/clients/repository.js`
- Retorna row persistido

### Arquivo: `server/handler.js`

Nova rota registrada:
```
PATCH /api/client-portfolio/:clientId/plan → handlePortfolioPlanPatch
```

---

## FASE 4 — Campos Persistidos

| Campo UI | Campo DB (`client_energy_profile`) |
|---|---|
| `modalidade` | `modalidade` |
| `kwh_mes_contratado` | `kwh_contratado` |
| `desconto_percentual` | `desconto_percentual` |
| `tarifa_atual` | `tarifa_atual` |
| `mensalidade` / `valor_mensalidade` | `mensalidade` |
| `prazo_meses` | `prazo_meses` |
| `potencia_kwp` | `potencia_kwp` |
| `tipo_rede` | `tipo_rede` |
| `marca_inversor` | `marca_inversor` |
| `indicacao` | `indicacao` |

O alias `kwh_mes_contratado = kwh_contratado` continua funcionando no `enrichPortfolioClientRow`.

---

## FASE 5 — Implementação Frontend

### Arquivo: `src/services/clientPortfolioApi.ts`

Nova função `patchPortfolioPlan(clientId, data)`:
```typescript
export async function patchPortfolioPlan(clientId: number, data: Record<string, unknown>): Promise<void> {
  await apiFetch(resolveApiUrl(`/api/client-portfolio/${clientId}/plan`), {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}
```

### Arquivo: `src/pages/ClientPortfolioPage.tsx`

`PlanoLeasingTab` reescrito com:
1. **10 campos** ao invés de 4 (modalidade, kwh, desconto, tarifa, mensalidade, prazo, potência, tipo_rede, marca_inversor, indicação)
2. Chama `patchPortfolioPlan()` em vez de `patchPortfolioUsina()`
3. Hidrata do `client` prop que vem de `GET /api/client-portfolio/:id`
4. Usa o padrão `onSaved(patch)` da Etapa 2.5 para atualização otimista + refetch silencioso

---

## FASE 6 — Refresh Pós-Save

Segue o padrão da Etapa 2.5:

1. Usuário salva → `PATCH /api/client-portfolio/:id/plan`
2. Sucesso → merge otimista via `onSaved(patch)`
3. `handleTabSaved()` do painel:
   - Atualiza `localClient` imediatamente
   - Dispara `reloadSilent()` (GET sem flash de loading)
   - Incrementa `refreshKey` para remontar a aba
4. Formulário reinicializa com dados confirmados do servidor
5. Sem flash, sem reload manual

---

## Arquivos Modificados

| Arquivo | Alteração |
|---|---|
| `server/client-portfolio/handler.js` | Nova função `handlePortfolioPlanPatch` + import de `upsertClientEnergyProfile` |
| `server/handler.js` | Nova rota `PATCH /api/client-portfolio/:clientId/plan` |
| `src/services/clientPortfolioApi.ts` | Nova função `patchPortfolioPlan` |
| `src/pages/ClientPortfolioPage.tsx` | `PlanoLeasingTab` reescrito com todos os campos + chama `patchPortfolioPlan` |

---

## Critérios de Conclusão

- [x] A aba Plano persiste em `client_energy_profile` via endpoint dedicado
- [x] `GET /api/client-portfolio/:id` retorna os campos do plano preenchidos (já fazia, o problema era que nunca eram gravados)
- [x] A UI da aba Plano hidrata a partir do payload da carteira
- [x] O save do plano atualiza a UI imediatamente (padrão Etapa 2.5)
- [x] Não há dependência de `latest_proposal_profile`
- [x] Não há necessidade de refresh manual
- [x] Todos os 10 campos do energy_profile estão expostos no formulário
- [x] Build e lint passam sem erros
