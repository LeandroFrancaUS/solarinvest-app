# Dashboard Operacional Premium - Documentação

## Visão Geral

O Dashboard Operacional Premium é um painel robusto focado 100% em operações: monitoramento e fiscalização de cobranças, pagamentos, entregas de kits, instalações e suporte técnico. **NÃO inclui** analytics financeiros, ROI, payback ou projeções de investimento.

## Arquitetura

### Backend

#### Migração SQL (`db/migrations/0057_operational_dashboard.sql`)
Cria três tabelas principais:

1. **dashboard_operational_tasks**: Tarefas operacionais (entregas, instalações, suporte, etc.)
2. **dashboard_notification_preferences**: Preferências de notificação por usuário
3. **dashboard_activity_log**: Auditoria de todas as mutações

#### Repositório (`server/operational-tasks/repository.js`)
Camada de acesso a dados com funções para:
- Listar, criar, atualizar e deletar tasks
- Gerenciar preferências de notificação
- Registrar logs de atividade
- Buscar histórico de entidades

#### Handlers (`server/operational-tasks/handler.js`)
Endpoints REST com RBAC:
- `GET /api/operational-tasks` - Listar tasks com filtros
- `POST /api/operational-tasks` - Criar task
- `PATCH /api/operational-tasks/:id` - Atualizar task
- `DELETE /api/operational-tasks/:id` - Deletar task
- `GET /api/operational-tasks/:id/history` - Histórico
- `GET /api/dashboard/notification-preferences` - Buscar preferências
- `POST /api/dashboard/notification-preferences` - Atualizar preferências

### Frontend

#### Tipos (`src/types/operationalDashboard.ts`)
Tipos TypeScript completos para:
- InvoiceStatus, OperationalTaskStatus, OperationalTaskType
- DashboardInvoice, DashboardOperationalTask
- DashboardAlert, DashboardNotificationPreference
- DashboardKPIs, DashboardSummary

#### API Client (`src/lib/api/operationalDashboardApi.ts`)
Cliente HTTP com token provider para:
- Operações CRUD em tasks
- Buscar histórico
- Gerenciar preferências de notificação

#### Motor de Alertas (`src/lib/dashboard/alerts.ts`)
**Função pura** que analisa invoices e tasks para gerar alertas:
- Faturas vencidas
- Faturas vencendo em breve
- Pagamentos parciais vencidos
- Entregas sem agendamento
- Instalações sem agendamento
- Suporte crítico
- Tarefas bloqueadas
- Reagendamento necessário

Suporta filtros por severidade e preferências do usuário.

#### Sistema de Notificações (`src/lib/dashboard/notifications.ts`)
Suporte completo para notificações:

**Visual (Toasts)**
- Sistema pub/sub com listeners
- Toasts com duração configurável
- Ações inline

**Audio**
- Web Audio API para gerar tons
- Tons diferentes por severidade (CRITICAL, ERROR, WARNING, INFO)
- Inicialização após interação do usuário (autoplay policy)

**Push**
- Web Notifications API
- Solicita permissão apenas quando usuário ativa
- Notificações com ações e auto-close
- Suporte para navegação ao clicar

**Batch Dispatch**
- Rate limiting para evitar spam
- Priorização por severidade
- Staggered timing (500ms entre notificações)

#### Página Principal (`src/pages/OperationalDashboardPage.tsx`)
Dashboard completo com:

**Header**
- Título e descrição
- Botão de atualização manual

**KPI Cards (8 cards)**
- Faturas em aberto
- Faturas vencidas
- Vencendo em até 3 dias
- Pagamentos confirmados hoje
- Entregas agendadas
- Instalações agendadas
- Suportes pendentes
- Pendências críticas

**Seção de Alertas**
- Lista de alertas ordenada por severidade
- Visual coding por tipo de alerta
- Ações inline quando disponíveis

**Seção de Cobranças e Pagamentos**
- Tabela de faturas com filtros
- Formatação em pt-BR (data, moeda)
- Status badges coloridos

**Seção de Tarefas Operacionais**
- Lista de tasks com filtros por tipo
- Badges de prioridade e status
- Informações de cliente e tipo

## Características Principais

### ✅ Foco Operacional
- Cobranças e pagamentos
- Entregas de kit
- Instalações
- Suporte técnico
- Pendências e alertas
- Auditoria completa

### ❌ SEM Analytics Financeiros
- Nenhum ROI
- Nenhum payback
- Nenhum gráfico de investimento
- Nenhuma projeção financeira analítica

### ✅ Qualidade
- Tudo em pt-BR
- Formatação correta de datas (`DD/MM/YYYY`)
- Formatação correta de moeda (`R$ 1.234,56`)
- Zero imports circulares
- Typecheck passing
- Testes unitários do motor de alertas

## Uso

### 1. Executar Migração

```bash
npm run db:migrate
```

### 2. Iniciar Servidor

```bash
npm start
```

### 3. Configurar Token Provider (se usar Stack Auth)

```typescript
import { setOperationalDashboardTokenProvider } from './lib/api/operationalDashboardApi'
import { setInvoicesTokenProvider } from './services/invoicesApi'

// Configurar providers
setOperationalDashboardTokenProvider(async () => {
  // Retornar JWT do usuário autenticado
  return user?.getIdToken()
})

setInvoicesTokenProvider(async () => {
  return user?.getIdToken()
})
```

### 4. Acessar Dashboard

Adicionar rota no `AppShell` ou `Sidebar`:

```tsx
import { OperationalDashboardPage } from './pages/OperationalDashboardPage'

// No router
<Route path="/operational-dashboard" element={<OperationalDashboardPage />} />
```

## API Reference

### Listar Tasks

```typescript
const { data: tasks } = await listOperationalTasks({
  clientId: 123,
  type: 'KIT_DELIVERY',
  status: 'SCHEDULED',
  priority: 'HIGH',
  limit: 100
})
```

### Criar Task

```typescript
const { data: task } = await createOperationalTask({
  type: 'INSTALLATION',
  title: 'Instalação residencial',
  client_id: 123,
  client_name: 'João Silva',
  priority: 'MEDIUM',
  status: 'NOT_SCHEDULED'
})
```

### Atualizar Task

```typescript
const { data: task } = await updateOperationalTask(taskId, {
  status: 'SCHEDULED',
  scheduled_for: '2026-04-25T10:00:00Z'
})
```

### Computar Alertas

```typescript
import { computeAlerts, sortAlertsBySeverity } from './lib/dashboard/alerts'

const alerts = computeAlerts(invoices, tasks, preferences)
const sortedAlerts = sortAlertsBySeverity(alerts)
```

### Despachar Notificação

```typescript
import { dispatchNotification, initializeAudio } from './lib/dashboard/notifications'

// Inicializar áudio (após interação do usuário)
initializeAudio()

// Despachar notificação
dispatchNotification(alert, {
  visualEnabled: true,
  audioEnabled: true,
  pushEnabled: false,
  criticalOnly: false
})
```

## Testes

```bash
npm run test -- src/lib/dashboard/__tests__/alerts.test.ts
```

Cobertura:
- ✅ Detecção de faturas vencidas
- ✅ Detecção de faturas vencendo em breve
- ✅ Detecção de tasks não agendadas
- ✅ Detecção de suporte crítico
- ✅ Detecção de tasks bloqueadas
- ✅ Filtragem por preferências
- ✅ Ordenação por severidade
- ✅ Contagem por severidade

## Próximos Passos

### Melhorias Futuras
1. **Modais de Ação**
   - Modal para agendar entrega
   - Modal para agendar instalação
   - Modal para registrar pagamento
   - Modal para adicionar observação
   - Modal para marcar como bloqueado

2. **Filtros Avançados**
   - Filtro por período customizado
   - Filtro por responsável
   - Filtro por cliente
   - Filtro combinado

3. **Exportação**
   - Exportar faturas para CSV
   - Exportar tasks para CSV
   - Exportar alertas para PDF

4. **Integrações**
   - Conectar com Stack Auth para permissões
   - Integrar com Service Worker para push notifications
   - Sincronização em tempo real com WebSockets

5. **Analytics Operacionais** (não financeiros)
   - Tempo médio de entrega
   - Taxa de conclusão de instalações
   - SLA de suporte técnico
   - Taxa de bloqueio de tasks

## Estrutura de Arquivos

```
db/migrations/
  └── 0057_operational_dashboard.sql

server/
  ├── handler.js (rotas adicionadas)
  └── operational-tasks/
      ├── repository.js
      └── handler.js

src/
  ├── types/
  │   └── operationalDashboard.ts
  ├── lib/
  │   ├── api/
  │   │   └── operationalDashboardApi.ts
  │   └── dashboard/
  │       ├── alerts.ts
  │       ├── notifications.ts
  │       └── __tests__/
  │           └── alerts.test.ts
  ├── pages/
  │   └── OperationalDashboardPage.tsx
  └── services/
      └── invoicesApi.ts (listInvoices adicionado)
```

## Notas Importantes

### Evitar Imports Circulares
- Stores não importam componentes
- Componentes podem importar stores
- Lógica pura fica em `src/lib` ou `src/domain`
- Sem barrel exports problemáticos

### Formatação pt-BR
Sempre usar:
```typescript
// Datas
formatDateBR(isoDate) // DD/MM/YYYY

// Moeda
formatMoneyBR(amount) // R$ 1.234,56

// Números
formatNumberBR(value) // 1.234,56
```

### Segurança
- RBAC: admin, office, financeiro têm acesso
- Token JWT obrigatório
- RLS no Postgres
- Logs de auditoria para todas as mutações

## Contribuindo

Ao adicionar novos tipos de alertas:

1. Adicionar tipo em `AlertType` (`src/types/operationalDashboard.ts`)
2. Implementar regra em `computeAlerts()` (`src/lib/dashboard/alerts.ts`)
3. Adicionar teste em `alerts.test.ts`
4. Atualizar esta documentação

Ao adicionar novos tipos de tasks:

1. Adicionar tipo em `OperationalTaskType` (`src/types/operationalDashboard.ts`)
2. Atualizar constraint no SQL (`db/migrations/0057_operational_dashboard.sql`)
3. Atualizar função `getTaskTypeLabel()` no dashboard
4. Adicionar filtro se necessário

---

**Desenvolvido para SolarInvest**
Dashboard 100% operacional, zero analytics financeiros.
