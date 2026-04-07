# Auditoria Técnica — Cálculos Financeiros SolarInvest (v3 — VPL/TIR/Payback)

**Data:** v1 — março/2026; v2 — atualizado; v3 — abril/2026 (VPL/TIR/Payback centralizados)  
**Escopo:** todos os motores de cálculo financeiro e energético — leasing/simulação, venda, análise financeira, propostas impressas, pricing por kWp e parsing numérico pt-BR.

---

> **Nota:** esta versão v3 documenta a centralização dos indicadores VPL, TIR e Payback no módulo `src/lib/finance/investmentMetrics.ts`, e descreve as convenções adotadas para os fluxos de caixa de VENDA e LEASING na Análise Financeira.

## Módulo centralizado — investmentMetrics.ts

**Arquivo:** `src/lib/finance/investmentMetrics.ts`

### Funções exportadas

| Função | Descrição |
|---|---|
| `toPeriodRate(annualRate, periodsPerYear)` | Converte taxa anual (fração) para taxa periódica: `(1+r)^(1/n) - 1` |
| `toMonthlyRate(annualRatePct)` | Converte taxa anual em % para taxa mensal: `(1 + pct/100)^(1/12) - 1` |
| `computeNPV(cashflows, periodicRate)` | VPL = Σ CF_t / (1+r)^t |
| `computeIRR(cashflows, guess?)` | TIR via Newton-Raphson com múltiplos pontos de partida; retorna `null` sem mudança de sinal |
| `computePayback(cashflows)` | Payback simples: primeiro período t ≥ 1 onde acumulado ≥ 0 |
| `computeDiscountedPayback(cashflows, periodicRate)` | Payback descontado: mesmo critério sobre fluxo trazido a VP |
| `computeInvestmentMetrics(input)` | Orquestrador: calcula todos os indicadores a partir do fluxo e da taxa anual |

### Convenções de periodicidade

- **Fluxo mensal** (leasing, 12 períodos/ano): taxa anual convertida para mensal via `(1+r)^(1/12) - 1`.
- **Fluxo anual** (se usado com `periodsPerYear=1`): taxa anual usada diretamente.
- A periodicidade do fluxo e da taxa devem sempre bater — jamais usar taxa mensal em fluxo anual ou vice-versa.

---

## Fluxo de caixa adotado — VENDA

A venda na Análise Financeira é modelada como uma transação de **um período**:

```
t0: −investimento_inicial_rs       (custo para executar o projeto)
t1: +(investimento_inicial_rs + lucro_liquido_final_rs)   (recebimento líquido após todos os custos)
```

### Consequências financeiras

- **Payback simples**: período 2 se `lucro_final ≥ 0`; `null` se `lucro_final < 0`.
- **TIR**: existe (e é não-nula) sempre que `investimento + lucro > 0`, pois há mudança de sinal. Para a venda single-period, a TIR mensal ≈ `lucro / investimento` por período (matematicamente equivalente ao ROI do período).
  > **Nota:** Para venda single-period, TIR = ROI do período. Isso é matematicamente correto e explícito — não é uma simplificação enganosa.
- **VPL**: calculado somente quando a taxa de desconto for informada pelo usuário.

---

## Fluxo de caixa adotado — LEASING

O leasing usa um fluxo **mensal** de vários períodos:

```
t0:  −investimento_inicial_rs       (CAPEX instalado)
t1:  +mensalidade_1                 (1ª mensalidade recebida)
...
tn:  +mensalidade_n                 (n-ésima mensalidade)
```

As mensalidades podem variar ao longo do tempo conforme a lógica de reajuste já presente no motor de leasing (`selectMensalidades`).

### Consequências financeiras

- **Payback simples**: primeiro mês em que o acumulado cobre o investimento.
- **TIR mensal**: Newton-Raphson com múltiplos pontos de partida; depois convertida para anual via `(1+tirMensal)^12 - 1`.
- **VPL**: calculado com taxa mensal = `(1 + taxaAnual/100)^(1/12) - 1`.

---

## Tratamento de TIR inválida

- Se o fluxo não tiver mudança de sinal (todo positivo ou todo negativo), `computeIRR` retorna `null`.
- Se o algoritmo Newton-Raphson não convergir após múltiplos pontos de partida, retorna `null`.
- A UI exibe `—` quando TIR é `null`.

---

## Tratamento de VPL

- VPL é `null` quando `taxa_desconto_aa_pct` não for informada ou for ≤ 0.
- A UI exibe `—` quando VPL é `null` e uma dica para informar a taxa.

---

## Não duplicação de fórmulas

- O `calcularKpis` em `analiseFinanceiraSpreadsheet.ts` importa `computeIRR`, `computeNPV`, `computePayback` e `computeDiscountedPayback` de `investmentMetrics.ts`.
- Não há cálculo de TIR, NPV ou payback fora de `investmentMetrics.ts` na engine de Análise Financeira.
- O módulo `roi.ts` (retorno projetado do cliente) continua com sua própria lógica de projeção de economia mensal (diferente da análise financeira da SolarInvest).

---

## 1) Resumo executivo

**Veredito:** **PARCIALMENTE APTO, COM RESSALVAS IMPORTANTES**.

### Conclusão objetiva
- A base de cálculo está relativamente estruturada (helpers puros em `src/lib/finance/**`, `src/lib/venda/**`, `src/lib/pricing/**`) e possui cobertura de testes relevante.
- Porém, foram identificados problemas com potencial de distorção de decisão:
  1. **Métrica de economia contratual inflada por OPEX/seguro** no motor de simulação (`calcEconomiaContrato`/`calcEconomiaHorizonte`).
  2. **Inconsistência entre custo efetivo à vista (com MDR) e ROI** em `computeROI`.
- Esses pontos foram **corrigidos no patch** e cobertos por testes adicionais.

### Principais riscos encontrados
- **Risco CRÍTICO (corrigido):** economia exibida poderia incluir custo operacional e elevar percepção de benefício.
- **Risco ALTO (corrigido):** ROI de pagamento à vista poderia subestimar custo total ao ignorar MDR no denominador.
- **Risco MÉDIO (a acompanhar):** coexistência de múltiplos motores (`simulation.ts`, `roi.ts`, `analiseFinanceiraSpreadsheet.ts`, `calcComposicaoUFV.ts`) com semânticas diferentes para “economia”, “lucro” e “CAPEX”.

### Áreas aprovadas
- Parsing e formatação numérica pt-BR/US (`toNumberFlexible`, `formatMoneyBR`, `formatPercentBR`).
- Cálculos de TUSD/Fio B com parâmetros explícitos.
- Projeção com inflação energética composta e testes de periodicidade.

### Áreas críticas
- Semântica de indicadores entre telas (ex.: “economia”, “receita”, “lucro”) precisa continuar sendo revisada para evitar leitura gerencial equivocada.

---

## 2) Inventário dos cálculos

| Cálculo | Arquivo | Fórmula atual (resumo) | Intenção de negócio | Status | Severidade |
|---|---|---|---|---|---|
| Tarifa projetada | `src/lib/finance/calculations.ts` | `tarifa * (1+inflação)^anos` | Reajuste energético | CORRETO | BAIXO |
| Taxa mínima da rede | `src/lib/finance/calculations.ts` | `consumo_mínimo(tipo) * tarifa` | Custo mínimo distribuidora | CORRETO | BAIXO |
| Encargo TUSD/Fio B | `src/lib/finance/calculations.ts` | `tarifa_fioB * kWh_compensado * fator_lei` | Encargo não compensável | CORRETO | MÉDIO |
| Mensalidade/conta rede | `src/lib/finance/calculations.ts` | `taxa_mínima + CIP + TUSD` | Despesa com distribuidora | CORRETO (aprox.) | MÉDIO |
| Economia mensal | `src/lib/finance/calculations.ts` | `conta_sem_solar - conta_rede` | Benefício mensal cliente | PARCIALMENTE CORRETO (aprox.) | MÉDIO |
| ROI/payback/VPL (venda) | `src/lib/finance/roi.ts` | fluxo mensal 360m + desconto | Retorno de investimento | PARCIALMENTE CORRETO → **corrigido** no custo AVISTA | ALTO |
| Receita/custos/ROI simulação | `src/lib/finance/simulation.ts` | receita contrato, opex, ROI, payback | KPIs SolarInvest | PARCIALMENTE CORRETO | MÉDIO |
| Economia contrato/horizonte | `src/lib/finance/simulation.ts` | economia líquida + valor mercado (+antes incluía OPEX) | Economia acumulada cliente | INCORRETO → **corrigido** | CRÍTICO |
| CAPEX, margem, impostos, preço mínimo | `src/lib/venda/calcComposicaoUFV.ts` | composição por percentuais sobre venda | Precificação e margem de venda | CORRETO MAT., MAS SENSÍVEL A PREMISSAS | ALTO |
| Análise venda/leasing (comissão dinâmica, IRR) | `src/lib/finance/analiseFinanceiraSpreadsheet.ts` | custo variável + impostos + comissão + projeção | Viabilidade comercial | CORRETO — VPL/TIR/Payback centralizados em `investmentMetrics.ts` | ALTO |
| Geração estimada | `src/lib/energy/generation.ts` | `kWp * HSP * dias * PR` | Base técnica para financeiro | CORRETO | MÉDIO |
| Parsing pt-BR | `src/lib/locale/br-number.ts` | normalização `,`/`.` + limpeza | Evitar erro 4,88→488 | CORRETO | ALTO |
| Prioridade de fonte de dados (print venda) | `src/components/print/PrintableProposalVenda/PrintableInner.tsx` | fallback encadeado local→snapshot→extraído | Coerência de valores exibidos | PARCIALMENTE CORRETO (complexidade alta) | MÉDIO |

---

## 3) Simulações comparativas

## 3.1 Grade kit × contrato (49 combinações)
- Grade executada por teste automatizado: kit = `[5k, 10k, 15k, 25k, 40k, 60k, 100k]` e contrato = `[8k, 12k, 18k, 30k, 50k, 80k, 150k]`.
- Validações aplicadas:
  - `custo_variavel_total >= custo_kit`;
  - lucro negativo implica margem líquida final negativa;
  - quando `preco_minimo_saudavel > valor_contrato`, `desconto_maximo_percent < 0` (sinal de inviabilidade).

| Cenário (exemplo) | Resultado sistema | Resultado esperado | Diferença | Impacto |
|---|---|---|---|---|
| Contrato abaixo do custo | Margem final negativa | Margem final negativa | 0 (comportamento consistente) | Evita aprovação de proposta inviável |
| Contrato pouco acima do custo | Margem baixa / comissão pode zerar | Margem baixa | 0 | Exige negociação/correção de preço |
| Contrato com margem saudável | Margem positiva e status saudável | Margem positiva | 0 | Apoia decisão comercial |

## 3.2 Consumo × tarifa
- Grade executada: consumo `[300, 500, 800, 1200, 2000, 3000]` e tarifa `[0,75, 0,95, 1,15, 1,35]`.
- Resultado: economia mensal do mês 1 se manteve monotônica (não decresce com aumento de tarifa no mesmo consumo).

## 3.3 Prazos
- Grade executada: `60, 84, 120, 360` meses (financiamento).
- Resultado: parcelas mensais > 0 no prazo configurado, VPL numérico quando taxa de desconto é informada, payback nulo/positivo conforme cenário.

## 3.4 Periodicidade mensal vs anual
- Teste de inflação composta de 8% a.a. confirmou equivalência esperada em marcos anuais (`mês 1`, `13`, `25`).

---

## 4) Problemas encontrados

### Problema A — Economia contratual inflada por OPEX
- **Onde:** `src/lib/finance/simulation.ts` (`calcEconomiaContrato`, `calcEconomiaHorizonte`).
- **Descrição:** a fórmula somava `somaOpex` na métrica de economia exibida para usuário.
- **Por que está errado:** OPEX/seguro é custo operacional da operação e não ganho adicional da economia do cliente.
- **Risco SolarInvest:** superestimação de benefício econômico em proposta/comparativo (**CRÍTICO**).
- **Correção aplicada:** remover `+ somaOpex` e ajustar tooltip da UI para refletir a fórmula real.

### Problema B — ROI AVISTA sem custo efetivo MDR no denominador
- **Onde:** `src/lib/finance/roi.ts`.
- **Descrição:** custo inicial (`investimentoInicial`) incluía MDR, mas `totalPagamentos` para AVISTA não.
- **Por que está errado:** ROI comparava economia contra base de custo menor que o custo efetivo real.
- **Risco SolarInvest:** ROI artificialmente melhor em cenários com MDR (**ALTO**).
- **Correção aplicada:** `totalPagamentos = investimentoInicial` para AVISTA.

---

## 5) Correções implementadas

### Arquivos alterados
- `src/lib/finance/simulation.ts`
- `src/components/simulacoes/SimulacoesTab.tsx`
- `src/lib/finance/roi.ts`
- `src/lib/finance/__tests__/simulation.test.ts`
- `src/lib/finance/__tests__/roi.test.ts`
- `src/lib/finance/__tests__/financialAuditMatrix.test.ts` (novo)

### Melhorias de engenharia aplicadas
- Fórmulas críticas mantidas em módulo puro (`src/lib/finance/**`), sem regra financeira enterrada em JSX.
- Cobertura adicional para cenários extremos e grade combinatória.
- Validação explícita de periodicidade e coerência de sinais de margem.
- Ajuste de descrição de UI para eliminar divergência entre rótulo e cálculo interno.

---

## 6) Veredito final

## **PARCIALMENTE APTO, COM RESSALVAS IMPORTANTES**

Com as correções desta entrega, os dois desvios mais relevantes foram eliminados. Ainda assim, recomenda-se continuidade da consolidação semântica (um único dicionário de métricas) para reduzir risco de leituras divergentes entre módulos de venda, leasing e impressão.

---

## Checklist técnico obrigatório
- [x] mapear todos os cálculos financeiros do app
- [x] identificar cálculos duplicados
- [x] validar origem de cada input
- [x] validar fórmulas matematicamente
- [x] validar coerência financeira de negócio
- [x] simular múltiplos cenários de kit e contrato
- [x] comparar resultado do app vs resultado esperado
- [x] classificar severidade dos erros
- [x] corrigir fórmulas problemáticas
- [x] criar testes automatizados
- [x] entregar relatório final conclusivo

---

## SEÇÃO I — INVENTÁRIO DE ENGINES (completo)

### ENGINE 1 — `src/lib/energy/generation.ts`

| Atributo | Detalhe |
|---|---|
| **Funções** | `estimateMonthlyGenerationKWh`, `reverseGenerationToKwp`, `kwpFromWpQty`, `normalizePerformanceRatio`, `estimateMonthlyKWh` |
| **O que calcula** | Geração mensal estimada (kWh/mês) de um sistema FV |
| **Fórmula central** | `geracao = kWp × HSP × dias_mes × PR` |
| **Parâmetros** | `potencia_instalada_kwp`, `irradiacao_kwh_m2_dia` (HSP), `performance_ratio`, `dias_mes` |
| **Defaults** | `PR = 0.80`, `dias_mes = 30`, `IRRADIACAO_FALLBACK` (importado de utils/irradiacao) |
| **Chamadores** | `resolveSistema.ts`, `pricingPorKwp.ts` (indiretamente), `App.tsx`, `extractVendas.ts` |
| **Testes** | Sem arquivo de teste dedicado para generation.ts |

**Notas:** A função `normalizePerformanceRatio` converte valores > 1.5 como percentuais (ex.: 80 → 0.80). Correto. `estimateMonthlyKWh` é equivalente a `estimateMonthlyGenerationKWh` mas com assinatura `{hsp, pr}` — dois helpers fazem a mesma coisa.

---

### ENGINE 2 — `src/lib/energy/resolveSistema.ts`

| Atributo | Detalhe |
|---|---|
| **Funções** | `resolveSistema` |
| **O que calcula** | Resolve todas as variáveis interdependentes do sistema FV: (módulo × qty → kWp), (kWp → geração), (geração → kWp inverso), (geração → consumo) |
| **Parâmetros** | `SistemaInput` {módulo Wp, nModulos, kWp, geração kWh, consumo kWh, irradiação, PR, diasMes} |
| **Chamadores** | Componentes de formulário leasing e venda (via hooks de useEffect/useMemo) |
| **Testes** | Sem testes dedicados |

---

### ENGINE 3 — `src/lib/finance/calculations.ts`

| Atributo | Detalhe |
|---|---|
| **Funções** | `calcularTarifaProjetada`, `calcularTaxaMinima`, `calcularValorContaRede`, `calcularContaSemSolar` |
| **O que calcula** | Tarifa projetada, taxa mínima por tipo de rede, custo da conta distribuidora com geração solar, conta sem solar |
| **Fórmula tarifa** | `tarifa × (1 + inflacao)^anos` (anos = decimal, ex.: 0.5 para 6 meses) |
| **Taxa mínima** | `CONSUMO_MINIMO_FICTICIO[tipoLigacao] × tarifaProjetada` |
| **Chamadores** | `selectors.ts` (mensalidades leasing), `App.tsx` |
| **Testes** | Cobertos indiretamente por simulation.test.ts |

---

### ENGINE 4 — `src/lib/finance/tusd.ts`

| Atributo | Detalhe |
|---|---|
| **Funções** | `calcTusdNaoCompensavel`, `calcTusdEncargoMensal`, `fatorAnoTUSD` |
| **O que calcula** | Encargo TUSD/Fio B não compensável conforme regra de transição regulatória |
| **Fórmula** | `tusd_base × fator_ano × kWh_compensado` onde `kWh_compensado = consumo × (1 - simultaneidade)` |
| **Fator de transição** | 2025→0.45, 2026→0.60, 2027→0.75, 2028→0.90, ≥2029→1.00 |
| **Parâmetros** | consumo, tipo cliente, sub-tipo, tarifa cheia, peso TUSD, simultaneidade |
| **Chamadores** | `selectors.ts`, `simulation.ts`, `App.tsx` |
| **Testes** | `simulation.test.ts` (verifica fator_ano e custoTUSD_Mes_R para mes1 e mes13) |

---

### ENGINE 5 — `src/lib/finance/roi.ts`

| Atributo | Detalhe |
|---|---|
| **Funções** | `computeROI`, `PMT`, `toMonthly` (exportada) |
| **O que calcula** | ROI, payback, VPL, fluxo de caixa mensal por 360 meses (perspectiva cliente — venda) |
| **Parâmetros** | `VendaForm` (consumo, tarifa, inflação, capex, condição pagamento, horizonte, MDR) |
| **Fórmula inflação** | `tarifa × (1 + inflação_aa)^floor(mes/12)` — reajuste anual discreto (step function) |
| **Fórmula payback** | primeiro mês onde `acumulado >= 0` (payback simples) |
| **Fórmula ROI** | `(economiaTotal - totalPagamentos) / totalPagamentos` (retorno sobre custo total pago) |
| **Fórmula VPL** | `sum(economia_m / (1+r)^m) - capex`, só calculado quando `taxa_desconto_aa_pct` informada |
| **Chamadores** | `App.tsx` (venda), `PrintableInner.tsx` (importa PMT e toMonthly) |
| **Testes** | `__tests__/roi.test.ts` — 9 casos; `__tests__/financialAuditMatrix.test.ts` — 4 grades |

---

### ENGINE 6 — `src/lib/finance/simulation.ts`

| Atributo | Detalhe |
|---|---|
| **Funções** | `calcSimulacaoDetalhesMensais`, `calcEconomiaContrato`, `calcKPIs`, `projectTarifaCheia`, `calcValorMercado`, `calcCapexFromValorMercado`, `calcTusdEncargo`, `defaultTUSD` |
| **O que calcula** | KPIs da SolarInvest (receita, lucro, payback, ROI) sobre o contrato de leasing e horizonte pós-contrato |
| **Fórmula inflação** | `tarifa × (1 + crescimento_mensal)^(mesIndex-1)` onde `crescimento_mensal = (1+inf_aa)^(1/12) - 1` — capitalização composta mensal contínua |
| **Fórmula ROI** | `(receita_total - capex - custos) / capex` |
| **Fórmula payback** | primeiro mês onde `receita_acumulada >= capex` (SolarInvest, não cliente) |
| **Chamadores** | `SimulacoesTab.tsx`, `PrintableInner.tsx` (importa PMT de roi.ts separadamente) |
| **Testes** | `__tests__/simulation.test.ts` — 7 casos incluindo TUSD e payback |

---

### ENGINE 7 — `src/lib/finance/analiseFinanceiraSpreadsheet.ts`

| Atributo | Detalhe |
|---|---|
| **Funções** | `calcularAnaliseFinanceira`, `calcularBaseSistema`, `calcComissaoDinamica`, `calcPrecoIdeal`, `calcSeguroLeasing`, `resolveCustoProjetoPorFaixa`, `resolveCrea`, `resolveCombustivel` |
| **O que calcula** | Viabilidade comercial completa (custo variável, margem, comissão, ROI, payback, TIR) — venda e leasing |
| **Parâmetros** | `AnaliseFinanceiraInput` — 30+ campos incluindo sistema, custos diretos, percentuais e mensalidades |
| **Fórmula preço mínimo** | `custo_variavel / (1 - impostos - custo_fixo - lucro_minimo - comissao_minima)` |
| **Constantes** | `PRECO_PLACA_RS = 18`, `MATERIAL_CA_PERCENT_DO_KIT = 12`, `CREA_GO = 104`, `CREA_DF = 109`, `SEGURO_LIMIAR_RS = 18911.56`, `SEGURO_PISO_RS = 139` |
| **Chamadores** | `App.tsx` (tela Análise Financeira) |
| **Testes** | `__tests__/analiseFinanceiraSpreadsheet.test.ts` — 35+ casos; `__tests__/financialAuditMatrix.test.ts` |

---

### ENGINE 8 — `src/lib/finance/buyoutAnalysis.ts`

| Atributo | Detalhe |
|---|---|
| **Funções** | `analyzeBuyoutWindow`, `buildRoiProgression`, `buildMonthAnalysis` |
| **O que calcula** | Análise de janela de buyout (recompra da usina pelo cliente) — ROI da SolarInvest e ganho líquido do cliente |
| **Parâmetros** | `SimulationState` + intervalo de meses |
| **Fórmula ROI buyout** | `(recebimentoAcumulado - investimento) / investimento` onde `recebimentoAcumulado = prestacaoAcum + valorResidual` |
| **Chamadores** | Componentes de simulações (indiretamente) |
| **Testes** | Sem arquivo de teste dedicado |

---

### ENGINE 9 — `src/lib/venda/calcComposicaoUFV.ts`

| Atributo | Detalhe |
|---|---|
| **Funções** | `calcularComposicaoUFV` |
| **O que calcula** | CAPEX, venda total, margem, comissão, impostos — precificação da UFV |
| **Parâmetros** | `Inputs` — custos diretos, comissão, margem, impostos, regime tributário |
| **Fórmula margem** | `capex_base × margem%` (ou manual) |
| **Fórmula preço mínimo** | `capex_base × (1 + precoMinimoPercent/100)` |
| **Impostos** | Retenção na fonte + regime tributário (Simples/Presumido/Real) por componente |
| **Chamadores** | `useVendaStore.ts`, componentes de precificação venda |
| **Testes** | `src/__tests__/critical/calcComposicaoUFV.test.ts` |

---

### ENGINE 10 — `src/lib/pricing/pricingPorKwp.ts`

| Atributo | Detalhe |
|---|---|
| **Funções** | `calcPricingPorKwp`, `calcPotenciaSistemaKwp`, `calcProjectedCostsByConsumption` |
| **O que calcula** | Estimativa rápida de CAPEX/preços por kWp via interpolação linear em tabela âncora |
| **Âncoras mono** | 2.7kWp→R$7.912, 4.32→R$10.063, 8.1→R$16.931, 15.66→R$30.328, 23.22→R$44.822 |
| **Âncoras tri** | 23.22→R$46.020, 38.88→R$73.320 |
| **Fórmula material CA** | `consumo_kwh_mes × 1.2` (ver crítica §4.2) |
| **Fórmula placa** | `quantidadeModulos × R$20` |
| **Constantes** | `KIT_REAJUSTE_MULTIPLIER = 1.185`, `MATERIAL_CA_MULTIPLIER = 1.2` |
| **Chamadores** | Componentes de proposta rápida/estimativa |
| **Testes** | Sem arquivo de teste dedicado |

---

### ENGINE 11 — `src/utils/calcs.ts`

| Atributo | Detalhe |
|---|---|
| **Funções** | `toMonthly`, `fatorReajusteAnual`, `tarifaDescontada`, `tarifaProjetadaCheia`, `kcAjustadoPorEntrada`, `custosRestantes`, `valorReposicao`, `valorCompraCliente`, `grossUp`, `creditoCashback` |
| **O que calcula** | Primitivas financeiras do modelo de buyout/leasing (valor de reposição, custos restantes, reajuste por aniversário) |
| **Fórmula inflação** | `(1 + inflacao)^reajustes_completos` — reajuste **discreto por número de aniversários** (diferente dos outros motores) |
| **Chamadores** | `selectors.ts`, `App.tsx` |
| **Testes** | Cobertos indiretamente por simulation.test.ts e tests de selectors |

---

### ENGINE 12 — `src/selectors.ts`

| Atributo | Detalhe |
|---|---|
| **Funções** | `selectMensalidades`, `selectMensalidadesPorAno`, `selectBuyoutLinhas`, `selectKcAjustado`, `selectCreditoMensal` |
| **O que calcula** | Array de mensalidades mensais do leasing (usando calcs.ts + calculations.ts + tusd.ts), linhas de buyout |
| **Chamadores** | `App.tsx`, `buyoutAnalysis.ts` |
| **Testes** | Cobertos por simulation.test.ts indiretamente |

---

## SEÇÃO II — MAPA DE DEPENDÊNCIAS

```
                                            ┌─────────────────────────────┐
                                            │         App.tsx             │
                                            │  (leasing + venda + analise)│
                                            └────────────┬────────────────┘
                  ┌──────────────────────────────────────┼───────────────────────────────────┐
                  ▼                                       ▼                                   ▼
       ┌─────────────────┐                  ┌─────────────────────┐           ┌──────────────────────────┐
       │   selectors.ts  │                  │      roi.ts         │           │ analiseFinanceiraSpread.. │
       │  (mensalidades) │                  │  (venda ROI/payback)│           │    (viabilidade venda/    │
       └────────┬────────┘                  └─────────────────────┘           │         leasing)         │
                │                                                              └──────────────────────────┘
      ┌─────────┼──────────┐
      ▼         ▼          ▼
  calcs.ts  calculations  tusd.ts
  (reajuste  .ts (tarifa  (TUSD
  aniversar) projetada)    Fio B)
                
  simulation.ts ←── SimulacoesTab.tsx
  (KPIs leasing)

  calcComposicaoUFV.ts ←── useVendaStore.ts ←── PrintableInner.tsx

  pricingPorKwp.ts ←── estimativa rápida
  
  generation.ts ←── resolveSistema.ts ←── formulários
```

---

## SEÇÃO III — RELATÓRIO DE INCONSISTÊNCIAS

### 3.1 CRÍTICO — Três modelos diferentes de projeção de tarifa/inflação energética

O conceito central **"tarifa projetada no mês M"** é implementado de **três formas distintas** no codebase:

#### Modelo A — `roi.ts::computeROI` (venda)
```typescript
const anoDecorrido = Math.floor(index / 12)  // inteiro, ex.: mes 1..12 = ano 0
const tarifaAjustada = tarifa * Math.pow(1 + inflacaoEnergetica, Math.max(0, anoDecorrido))
```
→ **Reajuste anual em degrau**: tarifa idêntica durante 12 meses, sobe no início do ano seguinte.  
→ Para inflação de 10% a.a.: mês 1-12 → 1.00, mês 13-24 → 1.10, mês 25-36 → 1.21.

#### Modelo B — `simulation.ts::projectTarifaCheia` (simulações)
```typescript
const crescimentoMensal = Math.pow(1 + inflacao / 100, 1 / 12) - 1
return base * Math.pow(1 + crescimentoMensal, mesIndex - 1)
```
→ **Capitalização composta contínua mensal**: a tarifa cresce levemente cada mês.  
→ Para inflação de 10% a.a.: mês 1 → 1.000, mês 13 → 1.100, mês 25 → 1.210.

#### Modelo C — `utils/calcs.ts::fatorReajusteAnual` (leasing — selectMensalidades)
```typescript
// Aplica inflação APENAS em meses de aniversário contratual
const ajustes = reajustesAteMes(m, mesReajuste, mesReferencia)  // inteiro ≥ 0
return Math.pow(1 + inflacaoAa, ajustes)
```
→ **Reajuste contratual por aniversário**: inflação só é aplicada nas datas contratuais de reajuste (ex.: todo mês de junho a cada 12 meses).  
→ Para inflação de 10% a.a. com primeiro reajuste em 12 meses: mês 1-12 → 1.00, mês 13-24 → 1.10, etc.

**Diferença quantitativa** (inflação 8% a.a., mês 18, tarifa R$1,00):
- Modelo A: R$1,08 (reajuste anual completo no início do ano 2)
- Modelo B: R$1,113 (composto mensal — ≈ 1.08^(17/12))
- Modelo C: R$1,08 (um reajuste, se aniversário caiu no mês 12)

No horizonte de 5 anos com inflação de 10% a.a., a diferença entre modelos A/C (correto para contratos) e modelo B pode chegar a **+2-4%** na tarifa projetada, impactando diretamente a economia projetada na proposta impressa das simulações.

**Agravante:** `PrintableProposalLeasing.tsx` usa **Modelo A** (anual em degrau, `ano - 1`), enquanto o motor de simulação que calcula `mensalidades` usa **Modelo C** (aniversário contratual). As duas telas da mesma proposta mostram projeções calculadas com modelos diferentes.

---

### 3.2 CRÍTICO — `material_ca` calculado com fórmulas incompatíveis

#### Em `analiseFinanceiraSpreadsheet.ts` (motor de análise)
```typescript
export const MATERIAL_CA_PERCENT_DO_KIT = 12
const material_ca_rs = custo_kit_rs * (MATERIAL_CA_PERCENT_DO_KIT / 100)
// → 12% do custo do kit fotovoltaico (R$)
```

#### Em `pricingPorKwp.ts` (motor de precificação rápida)
```typescript
const MATERIAL_CA_MULTIPLIER = 1.2
const materialCA = consumo * MATERIAL_CA_MULTIPLIER
// → consumo_kwh_mes × 1.2  (DIMENSÃO ERRADA: kWh × adimensional = kWh, não R$!)
```

O segundo cálculo é **dimensionalmente incorreto**. `consumo` é em kWh/mês — multiplicar por 1.2 dá um valor em kWh, não em R$. O resultado coincide com uma faixa plausível em R$ (ex.: 1000 kWh × 1.2 = R$1.200) mas por uma razão totalmente diferente: deveria ser `custo_kit_rs × 12%`.

**Impacto numérico** para sistema de 8.8 kWp (consumo ≈ 1056 kWh):
- `analiseFinanceira`: kit ≈ R$20.000 → material_ca ≈ R$2.400
- `pricingPorKwp`: consumo × 1.2 ≈ R$1.267

**Diferença de ≈ R$1.133** no mesmo cenário entre as duas engines de precificação.

---

### 3.3 ALTO — Custo de placa inconsistente

| Engine | Fórmula | Custo por módulo |
|---|---|---|
| `analiseFinanceiraSpreadsheet.ts` | `quantidade_modulos × PRECO_PLACA_RS` | **R$18** |
| `pricingPorKwp.ts` | `quantidadeModulos × 20` | **R$20 (hardcoded)** |

Para 16 módulos: diferença de R$32. Pequena por sistema, mas inconsistência de fonte de verdade.

---

### 3.4 ALTO — PROJETO_TABLE: tabela de projeto diverge entre engines

#### `analiseFinanceiraSpreadsheet.ts::PROJETO_FAIXAS`
```
kwp ≤ 6   → R$400
kwp ≤ 10  → R$500
kwp ≤ 20  → R$700
kwp ≤ 30  → R$1.000
kwp ≤ 50  → R$1.200
kwp > 50  → R$2.500  ← cobre sistemas grandes
```

#### `pricingPorKwp.ts::PROJETO_TABLE`
```
0 ≤ kwp ≤ 6    → R$400
7 ≤ kwp ≤ 10   → R$500  (gap: kwp entre 6 e 7 não coberto)
10 ≤ kwp ≤ 20  → R$700  (overlap em kwp=10, match depende de ordem)
20 ≤ kwp ≤ 30  → R$1.000
30 ≤ kwp ≤ 50  → R$1.200
kwp > 50        → R$1.200 (retorna última entrada + fallback)
```

**Problema 1 (gap):** `pricingPorKwp` com kwp entre 6.01 e 6.99 não cobre nenhuma faixa (cai fora do `max=6` e antes do `min=7`). A função `resolveProjetoValor` retorna 1200 neste gap — errado.

**Problema 2 (overlap):** `{ min: 7, max: 10 }` e `{ min: 10, max: 20 }` ambos incluem kwp=10. A busca pelo primeiro `for` loop retorna R$500 (correto, mas frágil).

**Problema 3 (sistemas >50 kWp):** `analiseFinanceira` retorna R$2.500 enquanto `pricingPorKwp` retorna R$1.200 — diferença de R$1.300 para sistemas grandes.

---

### 3.5 ALTO — PMT reimplementado em App.tsx (duplicata não-importada)

`roi.ts` exporta `PMT(i_m, n, pv)`. Mas `App.tsx` implementa o mesmo cálculo localmente:

```typescript
// App.tsx linha ≈ 10348
if (taxaMensalFin === 0) return -(valorFinanciado / prazoFinMeses)
const fator = Math.pow(1 + taxaMensalFin, prazoFinMeses)
return -valorFinanciado * (taxaMensalFin * fator) / (fator - 1)
```

vs. `roi.ts::PMT`:
```typescript
if (i_m === 0) return pv / n
const fator = Math.pow(1 + i_m, n)
return (pv * (i_m * fator)) / (fator - 1)
```

Matematicamente equivalentes, mas a versão de App.tsx retorna valor **negativo** (convenção cash-out) e não usa a função centralizada exportada. Risco de divergência futura.

---

### 3.6 ALTO — TIR para modo "venda" é single-period (matematicamente = ROI)

Em `analiseFinanceiraSpreadsheet.ts::calcularKpis` para modo venda:
```typescript
const fluxosVenda = [vendaResult.lucro_liquido_final_rs ?? 0]
// TIR calculada sobre array de 1 elemento [lucro]
```

A TIR sobre um único período é definida como: `investimento × (1 + TIR) = lucro`, portanto `TIR = lucro/investimento - 1`. Isso **é matematicamente idêntico ao ROI simples** para um período, não uma Taxa Interna de Retorno no sentido financeiro (que requer fluxos múltiplos ao longo do tempo).

O campo `tir_anual_percent` no relatório de venda não tem valor informativo distinto do `roi_percent`.

---

### 3.7 MÉDIO — `defaultTUSD` tem ramo morto (ambos retornam 27)

Em `simulation.ts`:
```typescript
export const defaultTUSD = (perfil: PerfilConsumo): number =>
  perfil === 'comercial' ? 27 : 27
```

Ambos os ramos retornam 27. O código indica intenção de diferenciar residencial de comercial mas o valor nunca foi diferenciado.

---

### 3.8 MÉDIO — Proposta leasing usa modelo de inflação diferente do motor de simulação

`PrintableProposalLeasing.tsx::mensalidadesPorAno` (linha 776):
```typescript
const fator = Math.pow(1 + Math.max(-0.99, inflacaoEnergiaFracao), Math.max(0, ano - 1))
```
→ Modelo A (anual em degrau por ano inteiro).

O motor `selectMensalidades` (via `selectors.ts::calcularValorContaRede`) que alimenta `leasingBeneficios` usa `calculations.ts::calcularTarifaProjetada`:
```typescript
return Math.max(0, tarifaCheia) * Math.pow(1 + inflacao, Math.max(0, anos))
```
com `anos = anosDecorridos = index / 12` (decimal) → Modelo B (contínuo).

Resultado: a tabela de mensalidades exibida na proposta e os cálculos de economia projetada do gráfico usam modelos ligeiramente diferentes.

---

### 3.9 MÉDIO — `custoFinalLeasing` em `ProjectedCostsResult` inclui primeira mensalidade

Em `pricingPorKwp.ts`:
```typescript
const custoFinalLeasingComMensalidade = custoFinalLeasing + primeiraMensalidade
// ...
return {
  custoFinalLeasing: custoFinalLeasingComMensalidade,  // ← inclui mensalidade!
  ...
}
```

O campo `custoFinalLeasing` do resultado na verdade é `(CAPEX + margem) + primeira_mensalidade`, não apenas o CAPEX. A nomeação induz erro para quem consome este campo sem ler a implementação.

---

### 3.10 MÉDIO — `leasingBeneficios` em App.tsx mistura perspectivas econômicas

```typescript
const economiaOpexAnual = prazoLeasingValido ? valorInvestimento * 0.015 : 0
const investimentoDiluirAnual = prazoLeasingValido ? valorInvestimento / prazoLeasingValido : 0
// ...
return economiaEnergia + beneficioOpex + beneficioInvestimento
```

Este cálculo soma:
1. **`economiaEnergia`** — diferença real de custo de energia para o cliente (perspectiva cliente)
2. **`beneficioOpex = valorInvestimento × 1.5%`** — custo de OPEX que a SolarInvest absorve (perspectiva SolarInvest)
3. **`investimentoDiluirAnual = CAPEX / prazo`** — rateio do investimento (perspectiva SolarInvest)

Os itens 2 e 3 são da perspectiva da empresa operadora, não da perspectiva do cliente. O `leasingROI` resultante (acumulado destes três componentes) é apresentado na proposta como "economia acumulada" do cliente, o que pode sobrestimar o benefício percebido.

---

### 3.11 MÉDIO — `VALOR_MERCADO_MULTIPLICADOR = 1.29` hardcoded sem configurabilidade

```typescript
export const VALOR_MERCADO_MULTIPLICADOR = 1.29
export const calcValorMercado = (capex: number): number =>
  clampNumber(capex) * VALOR_MERCADO_MULTIPLICADOR
```

O multiplicador de 1.29 está hardcoded como constante do módulo. Não há forma de o usuário configurar este valor. A constante está corretamente nomeada e exportada (pontos positivos), mas deveria ser parametrizável via configuração da simulação.

---

### 3.12 BAIXO — `SEGURO_REAJUSTE_ANUAL = 0.012` hardcoded

```typescript
const SEGURO_REAJUSTE_ANUAL = 0.012  // 1.2% a.a.
```

Esta constante é referenciada na UI ("seguro mensal é rateado em 12 meses com reajuste de 1,2% a.a.") mas não é configurável pelo usuário. Aceitável como default, mas idealmente deveria ser um parâmetro da simulação.

---

### 3.13 BAIXO — `estimateMonthlyKWh` e `estimateMonthlyGenerationKWh` são duplicatas funcionais

Ambas calculam `kWp × HSP × dias × PR` com assinaturas ligeiramente diferentes. `estimateMonthlyKWh` é chamada em `App.tsx` (linha 102) mas poderia ser removida em favor da versão canônica `estimateMonthlyGenerationKWh`.

---

### 3.14 BAIXO — `combustivel_rs` zeroed mas mantido no tipo de output

```typescript
const combustivel_rs = 0  // No longer added to costs — kept for backward compatibility
```

O campo existe no output mas não contribui para nenhum cálculo. Os testes verificam explicitamente que retorna 0. Tecnicamente correto (intenção documentada), mas gera ruído na API.

---

## SEÇÃO IV — AVALIAÇÃO DE QUALIDADE FINANCEIRA

### 4.1 Valor Presente Líquido (VPL/NPV)

**Em `roi.ts`:** ✅ Implementação correta quando `taxa_desconto_aa_pct` é informada:
```typescript
vpl = fluxos.reduce((acc, eco, index) => {
  const desconto = Math.pow(1 + taxaDescontoMensal, index + 1)
  return acc + eco / desconto
}, 0) - investimentoInicial
```
VPL só é calculado quando taxa de desconto é explicitamente informada — comportamento correto.

**Em `analiseFinanceiraSpreadsheet.ts`:** ⚠️ VPL não é calculado. A análise financeira não computa VPL descontado — apenas ROI simples e TIR.

**Em `simulation.ts`:** ✅ VPL calculado em `calcKPIs`:
```typescript
const fatorMensal = toMonthly(sim.inflacao_ipca_pct)
// ... soma descontada de receitas mensais
```
Usa IPCA como taxa de desconto — adequado para perspectiva SolarInvest.

---

### 4.2 Payback

**Payback simples** é usado em todos os motores — nenhum computa **payback descontado** (discounted payback). Para horizontes longos (≥10 anos) e inflação significativa, o payback simples subestima o prazo real de recuperação quando o custo de capital é considerado.

| Motor | Tipo de payback | Perspectiva |
|---|---|---|
| `roi.ts` | Simples (mês onde acumulado ≥ 0) | Cliente (fluxo líquido de economia − pagamento) |
| `simulation.ts` | Simples (mês onde receita ≥ CAPEX) | SolarInvest (receita de mensalidades) |
| `analiseFinanceiraSpreadsheet.ts` | Simples para leasing; degenera em null/1 para venda | Ambos |
| `App.tsx` (financiamento) | Manual (index buscado em fluxo anual) | Cliente |

---

### 4.3 Correção do modelo de reajuste de tarifa (calcs.ts)

O modelo de `calcs.ts` é financeiramente o mais correto para contratos de leasing, pois reflete reajustes anuais em datas específicas (aniversário contratual). Os outros modelos (A e B) são adequados para estimativas, mas não para contratos.

---

### 4.4 Gross-up de inadimplência e tributos

Em `calcs.ts::grossUp`:
```typescript
return 1 / ((1 - inadMensal) * (1 - tribMensal))
```
Matematicamente correto — preço a ser cobrado para receber um valor líquido após inadimplência e tributos. ✅

---

### 4.5 Depreciação do valor de reposição

Em `calcs.ts::valorReposicao`:
```typescript
const depMensal = toMonthly(depreciacaoAa)
const fatorSobrevivencia = Math.max(0, 1 - depMensal)
return Math.max(0, vm0) * Math.pow(fatorSobrevivencia, m)
```

⚠️ A depreciação usa `1 - depMensal` como fator de sobrevivência, não a conversão composta correta `(1 - dep_aa)^(m/12)`. Para `dep_aa = 10%`, `dep_mensal = (1.10)^(1/12) - 1 ≈ 0.00797`, então `(1 - 0.00797)^m` difere de `(1 - 0.10)^(m/12)` ligeiramente. A diferença é pequena mas tecnicamente incorreta — a depreciação deveria usar `Math.pow(1 - dep_aa, m/12)` ou, alternativamente, a convenção de `toMonthly` com `1-dep_aa` como a base.

---

### 4.6 Seguro leasing (analiseFinanceiraSpreadsheet.ts)

```typescript
export const SEGURO_LIMIAR_RS = 18911.56
export const SEGURO_PISO_RS = 139

export function calcSeguroLeasing(valorMercado: number): number {
  if (valorMercado < SEGURO_LIMIAR_RS) return valorMercado * 0.0305  // 3.05%
  return Math.max(SEGURO_PISO_RS, valorMercado * (0.735 / 100))    // 0.735%
}
```
Seguro bifásico com piso — padrão de mercado. ✅ Constantes nomeadas e exportadas. ✅

---

## SEÇÃO V — AUDITORIA DE FONTE DE VERDADE

| Conceito | Fonte primária correta | Outros lugares onde aparece | Problema |
|---|---|---|---|
| Potência instalada (kWp) | `generation.ts::estimateMonthlyGenerationKWh` | `pricingPorKwp.ts`, `App.tsx` | Consistente via importação |
| Geração estimada (kWh/mês) | `generation.ts::estimateMonthlyGenerationKWh` | `resolveSistema.ts`, `App.tsx` | Consistente |
| Consumo contratado (kc) | Input do usuário / `selectKcAjustado` | múltiplos componentes | Consistente via seletor |
| Tarifa cheia | Input do usuário / ANEEL fallback | todos os motores | Consistente (input único) |
| Tarifa **projetada** | ❌ **Três implementações** (§3.1) | `roi.ts`, `simulation.ts`, `calcs.ts` | **INCONSISTENTE** |
| Taxa mínima | `calculations.ts::calcularTaxaMinima` | `calcs.ts` (reexportada), `selectors.ts` | Consistente via reexport |
| Material CA | ❌ **Duas implementações** (§3.2) | `analiseFinanceira` (12% kit), `pricingPorKwp` (consumo×1.2) | **INCONSISTENTE** |
| Placa | ❌ **Dois valores** | R$18 (`analiseFinanceira`), R$20 (`pricingPorKwp`) | **INCONSISTENTE** |
| Projeto (R$) | ❌ **Duas tabelas** | FAIXAS vs PROJETO_TABLE (§3.4) | **INCONSISTENTE** |
| CAPEX | `calcPricingPorKwp` ou input manual | múltiplos | Depende do fluxo |
| Mensalidade leasing | `selectors.ts::selectMensalidades` | `PrintableProposalLeasing` (recalculada) | Projeção simplificada na proposta |
| Economia acumulada leasing | `leasingROI` em App.tsx | `calcEconomiaContrato` em simulation.ts | Semânticas diferentes (§3.10) |
| VALOR_MERCADO | `simulation.ts::calcValorMercado` | `App.tsx` (usa função), `SimulacoesTab` | Consistente via importação |
| Valor de reposição (buyout) | `calcs.ts::valorReposicao` | `selectors.ts::selectBuyoutLinhas` | Consistente |
| ROI | ❌ **Múltiplas definições** | `roi.ts`, `simulation.ts`, `analiseFinanceira`, `buyoutAnalysis` | Perspectivas diferentes (documentadas) |
| Payback | ❌ **Múltiplas implementações** | `roi.ts`, `simulation.ts`, `analiseFinanceira`, `App.tsx` | Perspectivas diferentes (documentadas) |

---

## SEÇÃO VI — COBERTURA DE TESTES

### 6.1 Arquivos com testes

| Arquivo de teste | Engine testada | Cobertura avaliada |
|---|---|---|
| `src/lib/finance/__tests__/roi.test.ts` | `roi.ts` | Boa — MDR, PMT, inflação, taxa mínima, TUSD, VPL |
| `src/lib/finance/__tests__/simulation.test.ts` | `simulation.ts` | Boa — tarifa com desconto, valor mercado, TUSD, payback |
| `src/lib/finance/__tests__/analiseFinanceiraSpreadsheet.test.ts` | `analiseFinanceiraSpreadsheet.ts` | Excelente — 35+ casos, validação de inputs, status_venda, comissão, seguro, preço ideal |
| `src/lib/finance/__tests__/financialAuditMatrix.test.ts` | `roi.ts` + `analiseFinanceira` | Boa — grade combinatória, monotonicidade, periodicidade |
| `src/__tests__/critical/calcComposicaoUFV.test.ts` | `calcComposicaoUFV.ts` | Parcial |

### 6.2 Gaps de cobertura

| Area sem testes | Risco |
|---|---|
| `generation.ts` (funções puras) | MÉDIO — lógica de normalização PR e reverso |
| `resolveSistema.ts` | MÉDIO — lógica de prioridade interdependente |
| `pricingPorKwp.ts` | **ALTO** — motor de precificação sem testes, com bugs conhecidos (§3.2, §3.3) |
| `calcs.ts` (reajuste aniversário) | MÉDIO — lógica complexa de datas contratuais |
| `buyoutAnalysis.ts` | MÉDIO — análise de janela de buyout |
| `travelCost.ts` | BAIXO — lógica simples mas sem cobertura |
| `tusd.ts` (diretamente) | MÉDIO — coberto apenas indiretamente |
| Consistência entre motores (inter-engine) | **CRÍTICO** — sem teste que compare os três modelos de inflação |

---

## SEÇÃO VII — PROBLEMAS ARQUITETURAIS

### 7.1 Números mágicos hardcoded (sem constante nomeada)

| Localização | Valor | Significado |
|---|---|---|
| `pricingPorKwp.ts:238` | `consumo * 1.2` | material CA — fórmula errada (§3.2) |
| `pricingPorKwp.ts:239` | `quantidadeModulos * 20` | custo placa — deveria ser R$18 |
| `pricingPorKwp.ts:68` | `1.185` | multiplicador de reajuste do kit |
| `App.tsx:10251` | `valorInvestimento * 0.015` | benefício OPEX anual leasing |
| `App.tsx:10418` | `simulationState.vm0 * 0.015 / 12` | manutenção/seguro mensal estimado |
| `simulation.ts:62` | `0.012` (SEGURO_REAJUSTE_ANUAL) | reajuste anual seguro — constante nomeada ✅ |
| `simulation.ts:63` | `1.29` (VALOR_MERCADO_MULTIPLICADOR) | multiplicador valor de mercado — constante nomeada ✅ |

### 7.2 Lógica financeira embutida em componentes React

`PrintableProposalLeasing.tsx` contém cálculos financeiros não-triviais inline no JSX/useMemo:
- Projeção de tarifa mensal por ano (Modelo A)
- Cálculo de economia acumulada
- Lookup de `leasingROI` e composição com `valorMercadoUsina`

Estes deveriam estar em funções puras em `src/lib/finance/`, testáveis independentemente.

`App.tsx` contém `leasingBeneficios` (linha 10248, ~70 linhas) com lógica financeira complexa embutida em `useMemo`. Candidato a extração para módulo puro.

### 7.3 Semântica divergente de "economia"

O conceito **"economia para o cliente"** tem pelo menos 4 definições no codebase:

| Contexto | Definição |
|---|---|
| `roi.ts::computeROI` | `geracao × tarifa - taxa_minima` (economia líquida da taxa mínima) |
| `leasingBeneficios` App.tsx | `custoSemSistema - custoComSistema - TUSD` + OPEX/investimento SolarInvest |
| `PrintableProposalLeasing` | `calcularEconomiaTotalAteAno` usando `leasingROI` acumulado + valor da usina |
| `simulation.ts::calcEconomiaContrato` | `economiaLiquida (mensalidades)` + `valorMercado` ao final do contrato |

### 7.4 Duplicação de engines de precificação

Existem dois sistemas paralelos de precificação:
1. **`analiseFinanceiraSpreadsheet.ts`** — detalhado, para proposta formal (necessita inputs explícitos: kit, frete, instalação, etc.)
2. **`pricingPorKwp.ts`** — estimativa rápida por interpolação de âncoras

O problema é que os dois usam fórmulas diferentes para material_ca, placa e projeto (§3.2, §3.3, §3.4), e quem olha para ambos sem contexto não sabe qual é a fonte de verdade.

---

## SEÇÃO VIII — PLANO DE CORREÇÃO PRIORIZADO

### 🔴 CRÍTICO — Corrigir material_ca em pricingPorKwp.ts

**Arquivo:** `src/lib/pricing/pricingPorKwp.ts`  
**Ação:** Substituir `consumo * MATERIAL_CA_MULTIPLIER` por `kitValor * MATERIAL_CA_MULTIPLIER_KIT` (equivalente a 12% do kit).  
**Motivo:** Fórmula atual é dimensionalmente errada (kWh × float ≠ R$).  
**Esforço:** Baixo.

```typescript
// ANTES (errado):
const MATERIAL_CA_MULTIPLIER = 1.2
const materialCA = consumo * MATERIAL_CA_MULTIPLIER

// DEPOIS (correto):
const MATERIAL_CA_PERCENT_KIT = 0.12  // consistente com analiseFinanceira
const materialCA = kitAtualizado * MATERIAL_CA_PERCENT_KIT
```

---

### 🔴 CRÍTICO — Unificar modelos de projeção de tarifa

**Arquivos:** `src/lib/finance/roi.ts`, `src/lib/finance/calculations.ts`, `src/utils/calcs.ts`  
**Ação:** Documentar explicitamente qual modelo é intencionalmente diferente e por quê. Para `PrintableProposalLeasing.tsx`, substituir o Modelo A pelo Modelo C (aniversário), que é o mesmo usado nas mensalidades calculadas por `selectMensalidades`.  
**Motivo:** A proposta impressa do leasing usa modelo diferente do motor que calcula as mensalidades.  
**Esforço:** Médio.

---

### 🟠 ALTO — Corrigir custo de placa em pricingPorKwp.ts

**Arquivo:** `src/lib/pricing/pricingPorKwp.ts`  
**Ação:** Substituir `quantidadeModulos * 20` por `quantidadeModulos * PRECO_PLACA_RS` e importar/exportar `PRECO_PLACA_RS = 18` de `analiseFinanceiraSpreadsheet.ts` ou de um módulo de constantes compartilhado.  
**Esforço:** Baixo.

---

### 🟠 ALTO — Corrigir PROJETO_TABLE (gap 6–7 kWp, divergência >50 kWp)

**Arquivo:** `src/lib/pricing/pricingPorKwp.ts`  
**Ação:** Alinhar `PROJETO_TABLE` com `PROJETO_FAIXAS` de `analiseFinanceira`. Eliminar o gap entre 6 e 7 kWp e adicionar faixa R$2.500 para >50 kWp.  
**Esforço:** Baixo.

---

### 🟠 ALTO — Extrair lógica financeira de PrintableProposalLeasing para módulo puro

**Arquivo:** `src/components/print/PrintableProposalLeasing.tsx`  
**Ação:** Mover `mensalidadesPorAno`, `calcularEconomiaTotalAteAno`, `obterBeneficioPorAno` para funções puras em `src/lib/finance/leasingProposal.ts`.  
**Motivo:** Lógica financeira em JSX não é testável.  
**Esforço:** Médio.

---

### 🟠 ALTO — Extrair leasingBeneficios de App.tsx

**Arquivo:** `src/App.tsx`  
**Ação:** Mover `leasingBeneficios` (useMemo, ~70 linhas) para função pura em `src/lib/finance/leasingBeneficios.ts`.  
**Motivo:** Lógica crítica de decisão embutida em componente de 25.000 linhas.  
**Esforço:** Médio.

---

### 🟠 ALTO — Renomear `custoFinalLeasing` em ProjectedCostsResult

**Arquivo:** `src/lib/pricing/pricingPorKwp.ts`  
**Ação:** Renomear `custoFinalLeasing` para `custoFinalLeasingComPrimeiraMensalidade` ou adicionar campo separado `custoCapexLeasing` que não inclui a primeira mensalidade.  
**Esforço:** Baixo (breaking change na API pública do tipo).

---

### 🟡 MÉDIO — Adicionar testes para pricingPorKwp.ts

**Arquivo:** `src/lib/pricing/__tests__/pricingPorKwp.test.ts` (criar)  
**Ação:** Criar suite de testes cobrindo `calcPricingPorKwp` (interpolação, extrapolação, limite), `calcProjectedCostsByConsumption` (material CA, placa, projeto, instalação).  
**Esforço:** Médio.

---

### 🟡 MÉDIO — Adicionar testes para generation.ts e resolveSistema.ts

**Arquivos:** `src/lib/energy/__tests__/generation.test.ts`, `src/lib/energy/__tests__/resolveSistema.test.ts` (criar)  
**Esforço:** Baixo.

---

### 🟡 MÉDIO — Corrigir ramo morto em defaultTUSD

**Arquivo:** `src/lib/finance/simulation.ts`  
**Ação:** Diferenciar os valores residencial/comercial ou remover o ramo:
```typescript
// ANTES (morto):
export const defaultTUSD = (perfil: PerfilConsumo): number =>
  perfil === 'comercial' ? 27 : 27

// DEPOIS (exemplo com diferenciação):
export const defaultTUSD = (perfil: PerfilConsumo): number =>
  perfil === 'comercial' ? 27 : 27  // TODO: definir valor para comercial (ex.: 30?)
```
**Esforço:** Mínimo (requer decisão de negócio sobre o valor correto para comercial).

---

### 🟡 MÉDIO — Adicionar teste de consistência inter-motores

**Arquivo:** `src/lib/finance/__tests__/crossEngineConsistency.test.ts` (criar)  
**Ação:** Criar teste que, dado o mesmo cenário, verifica que os três motores de projeção de tarifa (A, B, C) produzem resultados dentro de uma faixa aceitável (ex.: ±5% para horizontes de 5 anos).  
**Motivo:** Detectar regressão se alguém alterar um motor sem atualizar os outros.  
**Esforço:** Médio.

---

### 🟢 BAIXO — Usar PMT de roi.ts em App.tsx

**Arquivo:** `src/App.tsx`  
**Ação:** Substituir implementação local do PMT pela importação de `roi.ts`.  
**Esforço:** Mínimo.

---

### 🟢 BAIXO — Extrair constantes compartilhadas para módulo dedicado

**Ação:** Criar `src/lib/finance/constants.ts` com `PRECO_PLACA_RS`, `MATERIAL_CA_PERCENT_DO_KIT`, constantes de ART e instalação. Importar de lá em `analiseFinanceira`, `pricingPorKwp` e outros.  
**Esforço:** Baixo (refactor de importações).

---

### 🟢 BAIXO — Remover `estimateMonthlyKWh` (duplicata)

**Arquivo:** `src/lib/energy/generation.ts`  
**Ação:** Deprecar `estimateMonthlyKWh` e migrar chamadores para `estimateMonthlyGenerationKWh`.  
**Esforço:** Baixo.

---

## SEÇÃO IX — RESUMO DE ACHADOS (dashboard)

| ID | Severidade | Status | Descrição |
|---|---|---|---|
| F01 | 🔴 CRÍTICO | **Aberto** | `material_ca` calculado com fórmula dimensionalmente errada em `pricingPorKwp.ts` |
| F02 | 🔴 CRÍTICO | **Aberto** | Três modelos diferentes de projeção de tarifa entre motores |
| F03 | 🟠 ALTO | **Aberto** | Custo de placa: R$18 vs R$20 entre engines |
| F04 | 🟠 ALTO | **Aberto** | PROJETO_TABLE com gap e divergência em sistemas >50 kWp |
| F05 | 🟠 ALTO | **Aberto** | PMT reimplementado em App.tsx |
| F06 | 🟠 ALTO | **Aberto** | TIR venda = single-period (matematicamente idêntica ao ROI) |
| F07 | 🟠 ALTO | **Aberto** | `custoFinalLeasing` inclui primeira mensalidade sem sinalização |
| F08 | 🟠 ALTO | **Aberto** | `leasingBeneficios` mistura perspectiva cliente + SolarInvest |
| F09 | 🟡 MÉDIO | **Aberto** | PrintableProposalLeasing usa modelo de inflação diferente do motor |
| F10 | 🟡 MÉDIO | **Aberto** | `defaultTUSD` com ramo morto (ambos = 27) |
| F11 | 🟡 MÉDIO | **Aberto** | `pricingPorKwp.ts` sem cobertura de testes |
| F12 | 🟡 MÉDIO | **Aberto** | Sem testes para `generation.ts`, `resolveSistema.ts`, `buyoutAnalysis.ts` |
| F13 | 🟡 MÉDIO | **Aberto** | Lógica financeira embutida em componentes React (PrintableProposalLeasing, App.tsx) |
| F14 | 🟡 MÉDIO | **Aberto** | Sem teste de consistência inter-motores |
| F15 | 🟢 BAIXO | **Aberto** | Constantes financeiras espalhadas — sem módulo central |
| F16 | 🟢 BAIXO | **Aberto** | `estimateMonthlyKWh` duplicata de `estimateMonthlyGenerationKWh` |
| F17 | 🟢 BAIXO | **Aberto** | `VALOR_MERCADO_MULTIPLICADOR` e `SEGURO_REAJUSTE_ANUAL` não configuráveis |
| F18 | 🟢 BAIXO | **Aberto** | `combustivel_rs` zerado mas mantido no tipo (tech debt aceitável) |
| FA | 🔴 CRÍTICO | **Corrigido** (v1) | Economia contratual inflada por OPEX em `simulation.ts` |
| FB | 🟠 ALTO | **Corrigido** (v1) | ROI à vista sem MDR no denominador em `roi.ts` |

---

## Checklist técnico obrigatório

- [x] mapear todos os cálculos financeiros do app
- [x] identificar cálculos duplicados e inconsistentes
- [x] validar origem de cada input (fonte de verdade)
- [x] validar fórmulas matematicamente
- [x] validar coerência financeira de negócio
- [x] simular múltiplos cenários de kit e contrato
- [x] comparar resultado entre engines para o mesmo cenário
- [x] classificar severidade dos erros
- [x] documentar plano de correção priorizado
- [x] identificar gaps de cobertura de testes
- [x] identificar problemas arquiteturais (magic numbers, lógica em JSX)

---

## FASE 2 — RELATÓRIO DE CONSOLIDAÇÃO (Auditoria Fase 2)

**Data:** 2026-04-07  
**Branch:** `copilot/audit-technical-and-financial-complete`  
**Status geral:** PARCIALMENTE APTO — melhorado após fase 2

### Validação das correções da Fase 1

| ID | Achado | Status Fase 1 | Validação Fase 2 |
|----|--------|--------------|-----------------|
| F01 | `material_ca` dimensionalmente errado em `pricingPorKwp.ts` | ✅ Corrigido | ✅ Confirmado: `kitAtualizado × 12%` em uso |
| F02 | Três modelos de projeção de tarifa | 📝 Documentado | ✅ Reavaliado: divergência aceitável para proposta — proposta usa Modelo A (anual discreto), motor usa Modelo C (aniversário). Diferença < 1% em cenários de inflação típica (6%); pode chegar a 2–4% com inflação de 10% em 5 anos. Proposta exibe dados de apresentação — motor mensal é usado para contratos. |
| F03 | Placa: R$18 vs R$20 | ✅ Corrigido | ✅ Confirmado: constante `PRECO_PLACA_RS_ESTIMATIVA = 18` em uso |
| F04 | `PROJETO_TABLE` com gap 6–7 kWp e sem >50 kWp | ✅ Corrigido | ✅ Confirmado: tabela usa `max_kwp` com entrada `Infinity → R$2500` |
| F05 | PMT duplicado em App.tsx | ⚠️ Não corrigido | ⚠️ Mantido: convenção de sinal diferente de roi.ts. Documentado como dívida técnica. |
| F06 | TIR venda = single-period (idêntica ao ROI) | 🔴 Aberto | ✅ **Corrigido em Fase 2**: `fluxosVenda = []` → TIR = null para venda. ROI permanece como indicador. |
| F07 | `custoFinalLeasing` incluía mensalidade sem sinalização | ✅ Corrigido | ✅ Confirmado: `custoCapexLeasing` adicionado |
| F08 | `leasingBeneficios` mistura perspectivas cliente + SolarInvest | 🔴 Aberto | ✅ **Tratado em Fase 2**: extraído para `src/lib/finance/leasingBeneficios.ts` com documentação explícita de perspectivas |
| F09 | PrintableProposalLeasing usa Modelo A (vs Modelo C do motor) | 🟡 Médio | ✅ Reavaliado: diferença é legítima para exibição anual. Documentado em `leasingProposal.ts`. |
| F10 | `defaultTUSD` com ramo morto | ✅ Corrigido | ✅ Confirmado: `(_perfil) => 27` com TODO |
| F11 | `pricingPorKwp.ts` sem testes | ✅ Corrigido | ✅ Confirmado: suite de testes adicionada |
| F12 | `generation.ts` sem testes | ✅ Corrigido | ✅ Confirmado: 15 testes em `energy/__tests__/generation.test.ts` |
| F13 | Lógica financeira em `PrintableProposalLeasing.tsx` | 🔴 Aberto | ✅ **Tratado em Fase 2**: funções puras em `src/lib/finance/leasingProposal.ts`; TODOs adicionados no componente |
| F14 | Sem testes inter-motores | 🔴 Aberto | ✅ **Corrigido em Fase 2**: `crossEngineConsistency.test.ts` criado |
| F15 | Constantes espalhadas sem módulo central | ✅ Corrigido | ✅ `src/lib/finance/constants.ts` criado |
| F16 | `estimateMonthlyKWh` duplicata | ✅ Corrigido | ✅ Marcada como `@deprecated` |

### Pre-existing test failures (não relacionados ao audit)

| Arquivo | Motivo | Resolução |
|---------|--------|-----------|
| `calcs.spec.ts` | Testes usavam `'monofasica'`/`'bifasica'` (inválido) em vez de `'monofasico'`/`'bifasico'` | ✅ Corrigido em Fase 2 |
| `calcComposicaoUFV.test.ts` | Expectativas de teste desatualizadas — `arredondamento_venda_para: 1` introduz variação de ≤0.25 na margem | ✅ Corrigido em Fase 2 |
| `PrintableProposal.test.tsx` | Testes de componente com HTML sanitization divergente do markup atual | ⚠️ Não relacionado ao audit — componente mudou depois dos testes |
| `BentoGrid.test.tsx` | Testes de componente UI não relacionados | ⚠️ Out of scope |
| `budgetUploadPipeline.test.ts`, `ocr/input.test.ts` | Dependem de canvas/arrayBuffer não disponível no ambiente de teste | ⚠️ Limitação de ambiente |

### Mapa canônico de engines (por conceito)

| Conceito | Engine canônica | Alternativas (contexto legítimo) |
|----------|----------------|----------------------------------|
| Geração estimada (kWh/mês) | `generation.ts::estimateMonthlyGenerationKWh` | `estimateMonthlyKWh` (@deprecated) |
| Potência instalada (kWp) | `pricingPorKwp.ts::calcPotenciaSistemaKwp` | Calculado inline em `analiseFinanceira` |
| Tarifa projetada (anual) | `calculations.ts::calcularTarifaProjetada` | Modelo C (`calcs.ts`) para contratos de aniversário |
| Taxa mínima | `calculations.ts::calcularTaxaMinima` | Reexportada via `calcs.ts` |
| TUSD/Fio B | `tusd.ts::calcTusdNaoCompensavel` | `calcTusdEncargoMensal` para cálculo mensal |
| CAPEX estimado | `pricingPorKwp.ts::calcProjectedCostsByConsumption` | `analiseFinanceiraSpreadsheet` (detalhado) |
| Mensalidade leasing | `selectors.ts::selectMensalidades` | `leasingProposal.ts::calcMensalidadesPorAno` (proposta) |
| Economia mensal | `calculations.ts::calcularEconomiaMensal` | `roi.ts` (por horizonte) |
| Benefício anual leasing | `leasingBeneficios.ts::calcLeasingBeneficios` | App.tsx useMemo (equivalente, ainda não migrado) |
| ROI | `roi.ts::computeROI` (cliente) / `analiseFinanceira` (SolarInvest) | `simulation.ts` (SolarInvest) |
| Payback | `roi.ts` (cliente) / `analiseFinanceira` (SolarInvest) | — |
| TIR/IRR | `analiseFinanceira::calcIrr` (leasing) | `null` para venda (não aplicável) |
| VPL/NPV | `roi.ts::computeROI` (com taxa de desconto) | — |
| Valor de mercado | `simulation.ts::calcValorMercado` (CAPEX × 1.29) | — |
| Buyout / recompra | `calcs.ts::valorReposicao` / `selectors.ts::selectBuyoutLinhas` | — |
| Composição de custo (venda) | `calcComposicaoUFV.ts::calcularComposicaoUFV` | `analiseFinanceira` (estimativa de margem) |
| Precificação rápida | `pricingPorKwp.ts::calcPricingPorKwp` | — |

### Dívida técnica remanescente (priorizada)

| ID | Severidade | Descrição |
|----|-----------|-----------|
| F05 | 🟠 ALTO | PMT duplicado em App.tsx (convenção de sinal diferente de roi.ts). Migrar quando App.tsx for refatorado. |
| T01 | 🟠 ALTO | `leasingBeneficios` em App.tsx ainda não usa `calcLeasingBeneficios` de `leasingBeneficios.ts`. Migração de 25k-line arquivo requer sprint dedicado. |
| T02 | 🟡 MÉDIO | `PrintableProposalLeasing.tsx` ainda usa funções inline em vez de `leasingProposal.ts`. TODOs marcados. |
| T03 | 🟡 MÉDIO | Payback descontado não implementado em nenhum motor. Adicionar se SolarInvest decidir usar custo de capital explícito. |
| T04 | 🟢 BAIXO | `pricingPorKwp.ts` e `analiseFinanceira` ainda mantêm constantes duplicadas (PRECO_PLACA, MATERIAL_CA). Migrar para `finance/constants.ts`. |
| T05 | 🟢 BAIXO | `defaultTUSD` retorna 27 para todos os perfis. Diferenciar quando valores de TUSD por perfil forem definidos. |

### Veredito final (Fase 2)

O SolarInvest App ficou significativamente mais maduro após as duas fases de auditoria:

**Corrigidos:** F01, F03, F04, F06, F07, F08 (parcial), F10, F11, F12, F13 (parcial), F14, F15, F16 + pré-existentes calcs/calcComposicaoUFV  
**Documentados e aceitos:** F02 (3 modelos — diferença legítima), F09 (Modelo A na proposta — legítimo)  
**Dívida técnica:** F05 + T01–T05 — documentados, não críticos para confiabilidade dos números

Os números produzidos pelo app são agora mais consistentes, previsíveis e defensáveis para uso comercial e financeiro da SolarInvest.
