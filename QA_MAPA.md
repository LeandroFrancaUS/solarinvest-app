# QA_MAPA

## Visão geral
- **Fluxos principais**: `src/App.tsx` concentra cadastros, abas de **Vendas** e **Leasing**, geração de relatórios e integrações com upload de PDF.
- **Parsers e PDF**: o extrator de orçamento vive em `src/utils/pdfBudgetExtractor.ts`, que delega a normalização textual para `src/utils/structuredBudgetParser.ts` e às heurísticas de agrupamento em `src/lib/pdf/grouping.ts`. A leitura de propostas de venda é feita por `src/lib/pdf/extractVendas.ts`.
- **Formatação numérica**: centralizada em `src/lib/locale/br-number.ts` e reutilizada pelos seletores, cálculos e componentes de UI.
- **Cálculos críticos**: `src/lib/energy/generation.ts` (estimativas de kWh/kWp), `src/lib/finance/roi.ts` (ROI, buyout, leasing) e utilidades correlatas em `src/utils/calcs.ts`, `src/utils/irradiacao.ts` e `src/utils/tarifaAneel.ts`.
- **Printable/PDF**: o componente imprimível `src/components/print/PrintableProposal.tsx` consome dados preparados por `App.tsx`, `structuredBudgetParser` e `extractVendas`.

## Front-end (`src/`)
- `src/App.tsx`
  - Orquestra tabs **Leasing** e **Vendas**, controla formulários (`VendaForm`, leasing settings) e sincroniza dados com `PrintableProposal`.
  - Dependências diretas: `lib/pdf/extractVendas`, `utils/pdfBudgetExtractor`, `utils/moduleDetection`, `lib/locale/br-number`, `lib/energy/generation`, `lib/finance/roi`, `utils/irradiacao`, `utils/tarifaAneel`, `utils/onedrive`, `utils/proposalPdf`.
  - Responsável por compor `budgetStructuredItems` (resultado do parser) e repassar para UI e printable.
- `src/components/print/PrintableProposal.tsx`
  - Gera versão imprimível (Proposta PDF) com tabelas de orçamento, gráficos e quadro comercial.
  - Consome `PrintableProposalProps` (montado em `App.tsx`) e utiliza formatadores de `lib/locale/br-number` e `utils/formatters`.
- `src/selectors.ts`
  - Agrega valores derivados (mensalidades, buyout, inflação) reutilizados pelos gráficos e resumos.
- `src/styles.css`, `src/main.tsx`
  - Bootstrapping de React/Vite e estilos globais.

## Locale e formatação (`src/lib/locale`)
- `src/lib/locale/br-number.ts`
  - `toNumberFlexible`, `formatMoneyBR`, `formatNumberBRWithOptions`, `formatPercentBR`, utilidades `fmt`.
  - Dependências: somente `Intl.NumberFormat` nativo.
  - Consumido em praticamente todas as telas, parsers (`structuredBudgetParser`, `extractVendas`) e cálculos.

## Energia e finanças (`src/lib/energy`, `src/lib/finance`)
- `src/lib/energy/generation.ts`
  - Converte Wp ↔ kWp (`kwpFromWpQty`) e estima geração mensal (`estimateMonthlyGenerationKWh`).
  - Usa `IRRADIACAO_FALLBACK` de `src/utils/irradiacao.ts`.
- `src/lib/finance/roi.ts`
  - Contém modelos de dados (`VendaForm`, `RetornoProjetado`) e cálculos de fluxo de caixa, financiamento e leasing.
  - Consumido por `App.tsx` para calcular projeções e alimentar gráficos/printable.

## PDF e parsing (`src/lib/pdf`, `src/utils`)
- `src/utils/pdfBudgetExtractor.ts`
  - Faz parsing incremental de PDFs (via `pdfjs-dist`/Tesseract CDN) e delega a `parseStructuredBudget` para montar `StructuredBudget`.
  - Produz CSV (`structuredBudgetToCsv`) e agrega warnings/meta.
- `src/utils/structuredBudgetParser.ts`
  - Define âncoras “Produto  Quantidade” até “Valor total” para extrair itens, remove ruídos (dados do cliente), normaliza quantidades e preços usando `toNumberFlexible`.
  - Exporta `StructuredBudget`, `StructuredItem` e helpers (`deriveSection`).
  - Dependências: `lib/locale/br-number`.
- `src/lib/pdf/extractVendas.ts`
  - Regex robustas para CAPEX, kWp, módulos, tarifa; aplica fallback de cálculo (`maybeFillQuantidadeModulos`, `estimateMonthlyGenerationKWh`).
  - Dependências: `lib/energy/generation`, `lib/locale/br-number`.
- `src/lib/pdf/grouping.ts`
  - Agrupa itens similares para apresentação no printable.
- `src/utils/moduleDetection.ts`
  - Classifica itens (módulo/inversor), resume campos essenciais, soma quantidades. Usado por `App.tsx` para alertas e cálculo de módulos.

## Utilidades diversas (`src/utils`)
- `src/utils/irradiacao.ts`
  - Carrega CSV de irradiação, normaliza UF/estado, fallback 5 kWh/m²/dia.
- `src/utils/tarifaAneel.ts`
  - Consulta CKAN da ANEEL e CSV local para tarifas; depende de `lib/locale/br-number`.
- `src/utils/formatters.ts`
  - Formatação de moeda, CEP, CPF/CNPJ, telefone.
- `src/utils/onedrive.ts`, `src/utils/proposalPdf.ts`
  - Persistência externa de registros e PDF gerado.

## Tipos e contratos (`src/types`)
- `src/types/printableProposal.ts`
  - Define `PrintableProposalProps`, `PrintableOrcamentoItem` (entrada do printable), `ClienteDados` etc.
- `src/types/vite__client` (tipos gerados para Vite/ambientais).

## Servidor (`server/`)
- `server/index.js`
  - HTTP server estático + proxy `/api/aneel`; utiliza `handleAneelProxyRequest`.
- `server/aneelProxy.js`
  - Encapsula proxy para dados abertos da ANEEL com CORS e validação de parâmetros.

## Scripts e CI (`scripts/`)
- `scripts/build.mjs` (build Vite), `scripts/find-circular-deps.mjs` (madge), `scripts/run-e2e-placeholder.mjs` (stub de E2E headless, invocado em `qa:full`).

## Principais dependências entre blocos
- `App.tsx` ⇄ `structuredBudgetParser`/`pdfBudgetExtractor` para preencher tabela “Orçamento do Kit Solar”.
- `PrintableProposal` consome `PrintableProposalProps` gerados por `App.tsx`, incluindo itens normalizados e métricas de `extractVendas` + `moduleDetection`.
- `selectors.ts` e `lib/finance/roi.ts` derivam projeções usadas tanto em gráficos (Recharts) quanto no printable.
- `lib/pdf/extractVendas.ts` alimenta `App.tsx` (tab Vendas), `PrintableProposal`, e validações de módulos/geração.
- `locale/br-number.ts` é reutilizado por todos os parsers, cálculos e UI para garantir consistência pt-BR.
