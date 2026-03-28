# Auditoria Técnica — Cálculos Financeiros SolarInvest

Data: 28/03/2026  
Escopo: módulos de leasing/simulação, venda, análise financeira, proposta impressa e parsing numérico pt-BR.

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
| Análise venda/leasing (comissão dinâmica, IRR) | `src/lib/finance/analiseFinanceiraSpreadsheet.ts` | custo variável + impostos + comissão + projeção | Viabilidade comercial | PARCIALMENTE CORRETO (depende da qualidade dos inputs) | ALTO |
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
