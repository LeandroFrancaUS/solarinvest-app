# Análise de logs e plano de otimização (SolarInvest)

## Data da análise
- 2026-03-26

## Resumo executivo
Os logs mostram **três classes principais** de eventos:
1. **Ruído de extensões do navegador** (Yoroi/MetaMask/Leap/etc.) que não pertence ao app.
2. **Falhas de CSP/CORS em scripts externos de instrumentação/overlay** (principalmente `vercel.live`).
3. **Ponto real de UX no app:** logout no Safari demorando mais de 15s em condições de rede/execução instáveis.

A correção mais crítica e imediata é reduzir o tempo máximo de logout com timeout curto e fluxo resiliente.

## O que é ruído externo (não é bug do app)
### Extensões Web3 / scripts injetados
Indicadores claros:
- `yoroi/prod dapp-connector is successfully injected`
- `Cannot assign to read only property 'cardano' of object '#<Window>'`
- `No Listener: tabs:outgoing.message.ready`
- `TrustedScript assignment... blocked`

Esses erros vêm de `chrome-extension://...`, `inject.js`, `content-script.js`, etc., e não de arquivos do app SolarInvest.

### Alertas de segurança do console (Self-XSS)
Mensagens `AVISO` sobre não colar código no console são padrão de páginas Google/YouTube e não indicam regressão no app.

## Problemas reais priorizados

## P0 — Logout lento no Safari (>15s)
**Sintoma:** usuário clica em sair e a navegação demora excessivamente.

**Causa provável:**
- Operações pré-redirect sem limite estrito de tempo (limpeza local + chamada de logout servidor) podem ficar lentas/interrompidas em Safari.

**Ação aplicada neste patch:**
- Timeout curto para limpeza local.
- Timeout curto + `AbortController` para `POST /api/auth/logout`.
- `keepalive: true` para aumentar chance de envio do logout mesmo durante navegação.
- Execução paralela das etapas limitadas antes de redirecionar.

**Meta sugerida:** logout visível em até ~2s na maioria dos casos, mesmo com rede ruim.

## P1 — Falhas ANEEL/CSV com fallback frequente
**Sintoma:** avisos repetidos de fallback (`[ANEEL] ... fallback` e `[Tarifa] ...`).

**Hipóteses:**
- indisponibilidade temporária do endpoint ANEEL/CKAN;
- políticas de CORS no contexto de execução de terceiros;
- quedas de rede intermitentes.

**Plano recomendado:**
- instrumentar taxa de sucesso/fallback por navegador;
- cache local de tarifa por UF com TTL para reduzir chamadas repetidas;
- opcionalmente mover consulta ANEEL para endpoint server-side próprio para padronizar CORS e observabilidade.

## P2 — CSP de fontes (`vercel.live/geist*.woff2` bloqueadas)
**Sintoma:** mensagens de CSP font-src bloqueando `vercel.live`.

**Leitura:** associado ao ambiente de preview/instrumentação e não ao caminho funcional principal do app.

**Plano recomendado:**
- em produção, validar que nenhuma fonte crítica depende de domínio não permitido;
- manter CSP estrita e remover dependências de assets de domínios de overlay.

## Plano de execução (7 dias)
1. **Dia 1-2 (P0):** medir tempo real de logout por navegador e confirmar redução no Safari após patch.
2. **Dia 2-4 (P1):** criar métricas de sucesso/fallback para ANEEL + CSV e painel de erros por UF/distribuidora.
3. **Dia 4-5 (P1):** introduzir cache com TTL e backoff exponencial para consultas ANEEL.
4. **Dia 5-7 (P2):** auditoria de CSP/assets em ambiente de produção (sem overlays de preview).

## Checklist de validação
- [ ] Logout no Safari < 3s em rede normal.
- [ ] Logout no Safari < 5s em rede degradada.
- [ ] Taxa de fallback de tarifa monitorada por release.
- [ ] Sem regressão no fluxo de autenticação (`/api/auth/login`, `/api/auth/me`, `/api/auth/logout`).
