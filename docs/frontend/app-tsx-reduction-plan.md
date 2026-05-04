# App.tsx Reduction Plan — Frontend Baseline Documentation

> **Status**: Baseline documentation only. No code changes. No UI changes.
> **Target**: Define a safe, incremental extraction sequence that reduces `src/App.tsx` from
> ~21 500 lines to a thin orchestration shell without introducing regressions.

---

## 1. Current State Snapshot

| Metric | Value |
|---|---|
| Total lines | 21 471 |
| `useState` calls inside `App()` | 234 |
| `useEffect` calls inside `App()` | 117 |
| `useCallback` handlers inside `App()` | 200+ |
| Inline sub-component definitions (before `App()`) | 7 |
| Module-level standalone functions | 60+ |
| Lazy-loaded components (`React.lazy`) | 5 |

---

## 2. Responsibility Map

Each responsibility block is a candidate for extraction. The line ranges are approximate and
refer to the current `main` branch at the time this document was written.

### 2.1 Navigation

**Location**: `App()` body, lines ~4329–4360; JSX wiring lines ~19 666–20 094.

**What it owns**:
- `activePage` state (`ActivePage`) — which top-level page is rendered (8 known values)
- `activeTab` state (`TabKey`) — leasing vs. vendas proposal tab
- `simulacoesSection` state (`SimulacoesSection`) — which Simulações sub-section is active
- `isSidebarCollapsed`, `isSidebarMobileOpen`, `isMobileViewport` state
- `pendingFinancialProjectId` — auto-open project on navigation to Gestão Financeira
- `handleSidebarNavigate`, `handleSidebarMenuToggle`, `handleSidebarClose` callbacks
- `abrirSimulacoes`, `abrirConfiguracoes`, `voltarParaPaginaPrincipal` callbacks
- `activeSidebarItem` mapping (lines ~20 014–20 033)
- `useRouteGuard` hook integration
- LocalStorage read/write for `STORAGE_KEYS.activePage` and `STORAGE_KEYS.activeTab`

**External consumers**: AppShell sidebar props, every `activePage ===` branch in the JSX tree.

---

### 2.2 Modals

**Location**: Multiple — see table below.

| Component | Defined at | State in `App()` |
|---|---|---|
| `ContractTemplatesModal` | Line 3111 (before `App()`) | `isContractTemplatesModalOpen`, `contractTemplates`, `selectedContractTemplates`, `contractTemplatesLoading`, `contractTemplatesError` |
| `LeasingContractsModal` | Line 3221 (before `App()`) | `isLeasingContractsModalOpen`, `leasingAnexosSelecionados`, `leasingAnexosAvailability`, `leasingAnexosLoading` |
| `CorresponsavelModal` | Line 3358 (before `App()`) | `isCorresponsavelModalOpen`, `corresponsavelErrors` |
| `SaveChangesModal` / `SaveProposalModal` | Lines ~3540 / ~3609 (before `App()`) | `saveDecisionPrompt` |
| `EnviarPropostaModal` | Line 3658 (before `App()`) | `isEnviarPropostaModalOpen`, `contatoEnvioSelecionadoId` |
| `PrecheckModal` (external page) | `./pages/PrecheckModal` | `precheckModalData`, `precheckModalClienteCiente`, `precheckClienteCiente` |
| `ClientReadinessErrorModal` (external) | `./components/validation/…` | `clientReadinessErrors` |
| `BulkImportPreviewModal` (external) | `./components/clients/…` | `bulkImportPreviewRows`, `isBulkImportPreviewOpen`, `bulkImportAutoMerge`, `isBulkImportConfirming` |
| `BackupActionModal` (external) | `./components/clients/…` | `isBackupModalOpen` |
| `confirmDialog` (inline) | Lines ~4684 (JSX) | `confirmDialog` |

**What it owns**: All modal visibility flags, modal-scoped form state, modal open/close handlers,
loading/error state tied to modal actions.

**External consumers**: Handlers that set modal state scattered throughout `App()`.

---

### 2.3 Storage Hydration

**Location**: `App()` body, lines ~4216–4244; ~5322–5390; ~14 576–14 650.

**What it owns**:
- Token provider registration for 12 services:
  `setStorageTokenProvider`, `setProposalsTokenProvider`, `setClientsTokenProvider`,
  `setAdminUsersTokenProvider`, `setPortfolioTokenProvider`,
  `setFinancialManagementTokenProvider`, `setRevenueBillingTokenProvider`,
  `setProjectsTokenProvider`, `setProjectFinanceTokenProvider`,
  `setFinancialImportTokenProvider`, `setInvoicesTokenProvider`,
  `setOperationalDashboardTokenProvider`, `setMigrationTokenProvider`,
  `setFetchAuthTokenProvider`
- `migrateLocalStorageToServer()` — fire-and-forget on auth
- `ensureServerStorageSync({ timeoutMs: 6000 })` — re-sync on auth
- `authSyncKey` increment — triggers data-load effects after auth resolves
- Form draft hydration (`loadFormDraft<OrcamentoSnapshotData>`)
- `isHydrating` / `isHydratingRef` flag — prevents auto-save during replay
- `mergeSnapshotWithDefaults()` (line ~12 895) — merges loaded snapshot with defaults
- Proposal server-id map hydration (`PROPOSAL_SERVER_ID_MAP_STORAGE_KEY`)
- Client server-id map hydration (`CLIENT_SERVER_ID_MAP_STORAGE_KEY`)
- Consultant cache hydration (`CONSULTORES_CACHE_KEY`)

**External consumers**: All data-load `useEffect` hooks that depend on `authSyncKey`; every
handler that calls `saveFormDraft` / `clearFormDraft`.

---

### 2.4 Proposal Orchestration

**Location**: `App()` body, lines ~4622–4768; ~14 439–15 453; ~13 368–14 097.

**What it owns**:
- `orcamentosSalvos` list + `proposalsSyncState`
- `orcamentoAtivoInfo` (active proposal metadata) + `orcamentoRegistroBase` (base snapshot for dirty-check)
- `carregarOrcamentosSalvos`, `carregarOrcamentosPrioritarios` (localStorage + API load)
- `salvarOrcamentoLocalmente` (localStorage + API save)
- `carregarOrcamentoParaEdicao` — full snapshot replay into form state
- `carregarOrcamentoSalvo`, `abrirOrcamentoSalvo`, `confirmarRemocaoOrcamento`
- `handleSalvarCliente` — client upsert via API + local store + server storage
- `handleExcluirCliente` — client soft-delete
- `handleExportarParaCarteira` — converts client → closed deal → portfolio
- Auto-save `useEffect` (line ~14 628) — serialises snapshot and persists on state change
- `getCurrentSnapshot` (line ~13 006) — collects all form pieces into `OrcamentoSnapshotData`
- Proposal ID generation helpers: `generateBudgetId`, `ensureProposalId`, `normalizeProposalId`
- Server-to-local mapping functions: `serverClientToRegistro`, `serverProposalToOrcamento`
- Proposal fingerprint / signature helpers: `createBudgetFingerprint`, `computeSnapshotSignature`
- `OrcamentoSnapshotData` type (line ~878) — canonical snapshot shape with ~80 fields

**External consumers**: BudgetSearchPage (read proposals), ClientesPage (read/mutate clients),
proposals auto-save effect, `carregarOrcamentoParaEdicao` callback.

---

### 2.5 PDF / Print Orchestration

**Location**: Module level, lines ~3824–4070; `App()` body, lines ~10 797–10 860; ~15 516–16 155.

**What it owns**:
- Module-level render utilities (used both inside and outside `App()`):
  - `renderPrintableProposalToHtml(dados)` (line 3824) — mounts `PrintableProposal` off-screen, captures HTML
  - `renderPrintableBuyoutTableToHtml(dados)` (line 3977)
  - `sanitizePrintableHtml(html)` (line 3940)
  - `buildProposalPdfDocument(layoutHtml, nomeCliente, variant)` (line 3948) — wraps HTML in full PDF page with print styles
  - `renderBentoLeasingToHtml` / `buildBentoLeasingPdfDocument` (imported from `./utils/renderBentoLeasing`)
- `printableRef` — ref to hidden `<PrintableProposal>` in the DOM
- `printableData` (`useMemo`, line 10 855) — large memo composing all form state into `PrintableProposalProps`
- `isPrintMode` — early-return rendering of `PrintPageLeasing` for Bento Grid PDF generation
- `salvandoPropostaPdf`, `gerandoTabelaTransferencia`, `salvandoPropostaLeasing` state
- `useBentoGridPdf` toggle state
- `handlePrint()` (line 15 516) — print or download proposal PDF
- `handleImprimirTabelaTransferencia()` (line 15 564)
- `handlePreviewActionRequest()` (line 15 643) — action bar print/download button
- `persistProposalPdf` / `isProposalPdfIntegrationAvailable` integration
- `proposalPdfIntegrationAvailable` state
- Lazy-loaded printable components: `PrintableProposal`, `PrintPageLeasing`, `PrintableBuyoutTable`
- Hidden `<PrintableProposal ref={printableRef} {...printableData} />` in the JSX (line 20 098)
- `clonePrintableData`, `cloneSnapshotData`, `clonePrintableData` clone helpers

**External consumers**: `handlePrint`, contract generation (`gerandoContratos`), `salvarOrcamentoLocalmente`
(attaches `dados` to the record).

---

### 2.6 Simulation State (Leasing / Venda Form Parameters)

**Location**: `App()` body, lines ~4472–5130; ~6610–6940; ~7870–8060.

**What it owns**:
- Core leasing parameters: `kcKwhMes`, `tarifaCheia`, `desconto`, `taxaMinima`, `leasingPrazo`, `prazoMeses`
- Tariff / ANEEL data: `ufTarifa`, `distribuidoraTarifa`, `ufsDisponiveis`, `distribuidorasPorUf`, `mesReajuste`
- Technical parameters: `potenciaModulo`, `tipoInstalacao`, `tipoSistema`, `tipoRede`
- TUSD: `tusdPercent`, `tusdTipoCliente`, `tusdSubtipo`, `tusdSimultaneidade`, `tusdTarifaRkwh`, `tusdAnoReferencia`
- Charge extras: `encargosFixosExtras`, `bandeiraEncargo`, `cipEncargo`
- Leasing OEM/seguro: `oemBase`, `oemInflacao`, `seguroModo`, `seguroReajuste`, `seguroValorA`, `seguroPercentualB`
- Leasing cashflow: `cashbackPct`, `depreciacaoAa`, `inadimplenciaAa`, `tributosAa`, `ipcaAa`, `custosFixosM`, `opexM`, `seguroM`, `duracaoMeses`, `pagosAcumAteM`
- Entry params: `entradaRs`, `entradaModo`
- Leasing display toggles: `mostrarValorMercadoLeasing`, `mostrarTabelaParcelas`, `mostrarTabelaBuyout`, `exibirLeasingLinha`, `exibirFinLinha`
- Financing: `jurosFinAa`, `prazoFinMeses`, `entradaFinPct`, `mostrarFinanciamento`
- Venda form: `vendaForm` + `vendaFormErrors` + `retornoProjetado` + `retornoStatus` + `retornoError`
- Irradiation / efficiency: `irradiacao`, `eficiencia`, `diasMes`, `inflacaoAa`
- Pricing: `precoPorKwp`, `modoOrcamento`, `autoKitValor`, `autoCustoFinal`, `autoPricingRede`
- Segmento / edificação: `segmentoCliente`, `tipoEdificacaoOutro`
- Multi-UC state (11 variables): `multiUcAtivo`, `multiUcRows`, `multiUcRateioModo`, etc.
- Composition (UFV): `composicaoTelhado`, `composicaoSolo`
- Budget upload/processing: `isBudgetProcessing`, `budgetProcessingError`, `kitBudget`, `budgetStructuredItems`, `ocrDpi`
- `pageSharedState` (line ~5130) — a derived "synced" view of the above, mirrored into snapshot
- Numerous derived selectors: `selectCreditoMensal`, `selectMensalidades`, `selectBuyoutLinhas`, etc.

**External consumers**: `printableData` memo, `getCurrentSnapshot`, `carregarOrcamentoParaEdicao`,
financial analysis state.

---

### 2.7 Financial Analysis State

**Location**: `App()` body, lines ~4382–4444; Simulações render logic ~19 835–20 012.

**What it owns**:
- ~35 `af*` state variables:
  `afModo`, `afCustoKit`, `afFrete`, `afDescarregamento`, `afHotelPousada`,
  `afTransporteCombustivel`, `afOutros`, `afCidadeDestino`, `afDeslocamentoKm`,
  `afDeslocamentoRs`, `afDeslocamentoStatus`, `afDeslocamentoCidadeLabel`,
  `afDeslocamentoErro`, `afValorContrato`, `afImpostosVenda`, `afImpostosLeasing`,
  `afInadimplencia`, `afCustoOperacional`, `afMesesProjecao`, `afMensalidadeBase`,
  `afMensalidadeBaseAuto`, `afMargemLiquidaVenda`, `afMargemLiquidaMinima`,
  `afComissaoMinimaPercent`, `afTaxaDesconto`, `afConsumoOverride`, `afIrradiacaoOverride`,
  `afPROverride`, `afDiasOverride`, `afModuloWpOverride`, `afUfOverride`,
  `afNumModulosOverride`, `afPlaca`, `afAutoMaterialCA`, `afMaterialCAOverride`,
  `afProjetoOverride`, `afCreaOverride`, `afCidadeSuggestions`, `afCidadeShowSuggestions`
- `afBaseInitializedRef` — lazy initialisation guard
- `afCidadeBlurTimerRef` — city suggestion close timer
- `afCustoKitField`, `afFreteField`, … (11 `useBRNumberField` hooks)
- `aprovacaoStatus`, `aprovacaoChecklist`, `ultimaDecisaoTimestamp`
- `analiseFinanceiraResult` derived memo
- `indicadorEficienciaProjeto` derived memo
- `renderSimulacoesPage()` — inline render function (line ~19 835)
- `registrarDecisaoInterna`, `toggleAprovacaoChecklist` handlers

**External consumers**: `AnaliseFinanceiraSection` component (receives all via props),
`SimulacoesHeroCard`, `SimulacoesTab`.

---

## 3. Extraction Order

Ordered from **lowest risk** to **highest risk**. Each step must complete its gate checks before
the next step begins.

### Step 1 — Extract inline modal components to dedicated files (no state moved yet)

Move the 5 modal components that are currently defined *before* `App()` to their own files.
These are pure presentational or near-pure components.

| Component | Suggested target file |
|---|---|
| `ContractTemplatesModal` | `src/components/modals/ContractTemplatesModal.tsx` |
| `LeasingContractsModal` | `src/components/modals/LeasingContractsModal.tsx` |
| `CorresponsavelModal` | `src/components/modals/CorresponsavelModal.tsx` |
| `SaveChangesModal` / `SaveProposalModal` | `src/components/modals/SaveChangesModal.tsx` |
| `EnviarPropostaModal` | `src/components/modals/EnviarPropostaModal.tsx` |

**Risk**: Low. These components only receive props from `App()`. No business logic moves.
**Anti-regression tests required**: See Section 4, Group A.

---

### Step 2 — Extract PDF render utilities to a dedicated module

Move the 4 module-level functions that create off-screen renders to a standalone service file.
These are already pure (or near-pure) functions with no React hooks.

| Function | Suggested target file |
|---|---|
| `renderPrintableProposalToHtml` | `src/lib/pdf/proposalRenderer.ts` |
| `renderPrintableBuyoutTableToHtml` | `src/lib/pdf/proposalRenderer.ts` |
| `sanitizePrintableHtml` | `src/lib/pdf/proposalRenderer.ts` |
| `buildProposalPdfDocument` | `src/lib/pdf/proposalRenderer.ts` |

**Risk**: Low. No state moves. The functions are already used via stable call signatures.
**Anti-regression tests required**: See Section 4, Group B.

---

### Step 3 — Extract Financial Analysis state into `useFinancialAnalysisState` hook

Create `src/features/simulacoes/useFinancialAnalysisState.ts`. It owns all 35+ `af*` state
variables, the `afBaseInitializedRef`, the 11 BR-number field hooks, and `aprovacaoStatus` /
`aprovacaoChecklist` / `ultimaDecisaoTimestamp`.

`App()` calls `const afState = useFinancialAnalysisState({ …base values from simulation state… })`
and spreads `afState` into `AnaliseFinanceiraSection`.

**Risk**: Medium. No data persisted to storage. All state is transient and session-scoped.
The only coupling is reading base values (`kcKwhMes`, `eficiencia`, `potenciaModulo`, etc.)
from Simulation State — these are passed in as props/arguments to the hook.
**Anti-regression tests required**: See Section 4, Group C.

---

### Step 4 — Extract Storage Hydration into `useStorageHydration` hook

Create `src/app/hooks/useStorageHydration.ts`. It wires all 14 token providers, fires
`migrateLocalStorageToServer`, fires `ensureServerStorageSync`, and returns `authSyncKey`
plus the `isHydrating` / `isHydratingRef` pair.

`App()` calls `const { authSyncKey, isHydrating, isHydratingRef } = useStorageHydration({ userId, getAccessToken })`.

**Risk**: Medium. This is side-effect-heavy but has a well-defined interface.
Wrong sequencing of token registration can cause 401s.
**Anti-regression tests required**: See Section 4, Group D.

---

### Step 5 — Extract Navigation state into `useNavigationState` hook

Create `src/app/hooks/useNavigationState.ts`. It owns `activePage`, `activeTab`,
`simulacoesSection`, sidebar visibility state, and all navigation callbacks.

`App()` calls `const nav = useNavigationState()` and passes values to `AppShell`.

**Risk**: Medium. Navigation drives which page renders, so any regression is immediately
visible. LocalStorage keys must be preserved exactly.
**Anti-regression tests required**: See Section 4, Group E.

---

### Step 6 — Extract Client state into `useClientesState` hook

Create `src/app/hooks/useClientesState.ts`. It owns `clientesSalvos`, `clientsSyncState`,
`clientsSource`, sync/error state, consultant lists, bulk-import state, and all client
CRUD handlers.

`App()` receives only what `ClientesPage` and the proposal form need.

**Risk**: High. Client state is deeply coupled to proposal state (editing a client loads its
last proposal snapshot). Requires the Proposal Orchestration boundary to be very clear first.
**Anti-regression tests required**: See Section 4, Group F.

---

### Step 7 — Extract Proposal Orchestration into `useProposalOrchestration` hook

Create `src/app/hooks/useProposalOrchestration.ts`. It owns the `orcamentosSalvos` list,
auto-save effect, `getCurrentSnapshot`, `carregarOrcamentoParaEdicao`, and all
proposal CRUD handlers.

**Risk**: High. Auto-save, hydration guards, and snapshot replay are tightly coupled.
This step should only start after Steps 4 and 6 are complete and stable.
**Anti-regression tests required**: See Section 4, Group G.

---

### Step 8 — Extract Simulation State into `useProposalFormState` hook

Create `src/app/hooks/useProposalFormState.ts`. It owns all leasing/venda form parameters,
ANEEL data, budget upload state, and derived selectors.

**Risk**: Very High. This is the core calculation engine. Every change here risks silently
breaking proposal PDFs and stored data.
This step must not begin until Steps 5, 6, and 7 are verified stable in production.
**Anti-regression tests required**: See Section 4, Group H.

---

### Step 9 — Extract PDF/Print Orchestration into `usePrintOrchestration` hook

Create `src/features/print/usePrintOrchestration.ts`. It owns `printableData` memo,
`printableRef`, print handlers, and PDF generation state.

After this step `App()` calls
`const { printableRef, printableData, handlePrint, … } = usePrintOrchestration({ …form state… })`
and passes `printableData` to the hidden `<PrintableProposal>` node.

**Risk**: Very High. `printableData` is a massive memo. Any missed dependency will silently
produce stale PDFs. This step should be last because it depends on Simulation State
being stable.
**Anti-regression tests required**: See Section 4, Group I.

---

## 4. Anti-Regression Tests Required Before Each Extraction

### Group A — Modal component extraction (Step 1)

- [ ] Each extracted modal renders correctly with all required props in a unit test
- [ ] Accessibility: `role="dialog"`, `aria-modal`, `aria-labelledby` are present
- [ ] `onClose` / backdrop click dismisses the modal (jsdom interaction test)
- [ ] `npm run typecheck` passes with zero new errors
- [ ] `npm run check:cycles` passes

---

### Group B — PDF renderer extraction (Step 2)

- [ ] `renderPrintableProposalToHtml(dados)` returns non-null HTML for a valid `PrintableProposalProps`
- [ ] `buildProposalPdfDocument(html, "Test Client")` produces an HTML string with `<html>`, `<head>`, and `<body>` tags
- [ ] `sanitizePrintableHtml` strips only the expected elements
- [ ] Existing `PrintableProposal.spec.tsx` snapshot still passes unchanged
- [ ] `npm run check:cycles` passes

---

### Group C — Financial Analysis hook (Step 3)

- [ ] `useFinancialAnalysisState` returns all expected fields in a hook test (React Testing Library `renderHook`)
- [ ] `analiseFinanceiraResult` memo updates when `afCustoKit` changes
- [ ] `aprovacaoStatus` transitions correctly via `registrarDecisaoInterna`
- [ ] Existing `calcComposicaoUFV.test.ts` still passes unchanged
- [ ] `npm run typecheck` passes
- [ ] Visual smoke test: Análise Financeira section still renders in the Simulações page

---

### Group D — Storage Hydration hook (Step 4)

- [ ] `useStorageHydration` hook registers all 14 token providers when `userId` is non-null
- [ ] `isHydrating` is `true` during form draft replay and `false` after
- [ ] `authSyncKey` increments exactly once per auth transition (unit test with mock)
- [ ] `migrateLocalStorageToServer` is called at most once per auth session
- [ ] `auth-resilience.test.ts` still passes unchanged
- [ ] `crash-recovery.test.ts` still passes unchanged

---

### Group E — Navigation state hook (Step 5)

- [ ] `useNavigationState` returns initial `activePage` from `localStorage` when set
- [ ] `setActivePage` persists the new value to `STORAGE_KEYS.activePage`
- [ ] Navigating to 'settings' via `handleSidebarNavigate` sets `activePage === 'settings'`
- [ ] `pageState.test.ts` still passes unchanged
- [ ] `app-render.test.tsx` still passes unchanged
- [ ] Sidebar active item mapping is correct for every `activePage` value

---

### Group F — Client state hook (Step 6)

- [ ] Loading clients from the server (`carregarClientesPrioritarios`) populates `clientesSalvos`
- [ ] `handleSalvarCliente` triggers the server upsert and updates local list
- [ ] `handleExcluirCliente` soft-deletes and removes from local list
- [ ] Deleted clients (non-null `deletedAt`) are filtered out of `clientesSalvos`
- [ ] `PROPOSALS_ANTI_REGRESSION_CHECKLIST.md` acceptance criteria remain met
- [ ] `npm run typecheck` passes

---

### Group G — Proposal Orchestration hook (Step 7)

- [ ] Auto-save writes a valid `OrcamentoSnapshotData` to storage within 1 s of a form change (jsdom)
- [ ] `carregarOrcamentoParaEdicao` restores all required fields from a saved snapshot
- [ ] `isHydratingRef.current` is `true` during replay and `false` after (prevents auto-save race)
- [ ] Proposal code format `SLRINVST-LSE-XXXXXXXX` / `SLRINVST-VND-XXXXXXXX` is preserved
- [ ] `orcamentoAtivoInfo` is populated after loading a proposal
- [ ] `PROPOSALS_ANTI_REGRESSION_CHECKLIST.md` acceptance criteria remain met
- [ ] `crash-recovery.test.ts` still passes unchanged

---

### Group H — Simulation State hook (Step 8)

- [ ] Derived selectors (`selectCreditoMensal`, `selectMensalidades`, etc.) return identical values
  before and after extraction, verified by a snapshot comparison test against a known fixture
- [ ] `tarifaDescontada` calculation is unchanged for a set of reference inputs
- [ ] MultiUC rateio logic (`calcularMultiUc`) produces identical results
- [ ] Changing `ufTarifa` triggers the ANEEL data load effect
- [ ] `energy.test.ts` still passes unchanged
- [ ] `phase15-requirements.test.ts` still passes unchanged
- [ ] End-to-end PDF regression: generate a leasing PDF before and after extraction and diff the HTML

---

### Group I — PDF/Print Orchestration hook (Step 9)

- [ ] `printableData` memo produces identical output for a known `OrcamentoSnapshotData` fixture
  (snapshot test — serialise with `stableStringify` and compare)
- [ ] `handlePrint()` calls `renderPrintableProposalToHtml` and then the PDF service
- [ ] Hidden `<PrintableProposal>` node is always present in the DOM (accessibility, not interactive)
- [ ] Bento Grid early-return path (`isPrintMode`) renders `<PrintPageLeasing>` without crashing
- [ ] Existing `PrintableProposal.spec.tsx` snapshot still passes unchanged
- [ ] `pdf/parser.spec.ts` still passes unchanged
- [ ] `npm run build` produces no new chunk-size warnings

---

## 5. Safe PR Sequence

Each PR is atomic, reviewed, merged, and verified in production before the next begins.
No PR touches business calculation logic.

| PR | Title | Scope | Risk |
|---|---|---|---|
| PR-A | `refactor(modals): extract inline modal components to src/components/modals/` | Step 1 | Low |
| PR-B | `refactor(pdf): extract render utilities to src/lib/pdf/proposalRenderer.ts` | Step 2 | Low |
| PR-C | `refactor(simulacoes): extract useFinancialAnalysisState hook` | Step 3 | Medium |
| PR-D | `refactor(auth): extract useStorageHydration hook` | Step 4 | Medium |
| PR-E | `refactor(nav): extract useNavigationState hook` | Step 5 | Medium |
| PR-F | `refactor(clients): extract useClientesState hook` | Step 6 | High |
| PR-G | `refactor(proposals): extract useProposalOrchestration hook` | Step 7 | High |
| PR-H | `refactor(simulation): extract useProposalFormState hook` | Step 8 | Very High |
| PR-I | `refactor(print): extract usePrintOrchestration hook` | Step 9 | Very High |

**Rules for every PR**:
1. Pass all four gates in CI: `npm run lint`, `npm run typecheck`, `npm run build`, `npm run check:cycles`
2. Pass all existing tests: `npx vitest run`
3. Pass the anti-regression tests defined in Section 4 for that step
4. No changes to business logic, stored data keys, or API contracts
5. No removal of existing tests
6. Diff must be reviewable (< 600 lines changed per PR recommended)

---

## 6. Constraints and Safety Rules

The following must be respected throughout the entire reduction effort:

- **Storage keys are immutable.** `STORAGE_KEYS.*`, `CLIENTES_STORAGE_KEY`, `BUDGETS_STORAGE_KEY`,
  `PROPOSAL_SERVER_ID_MAP_STORAGE_KEY`, `CLIENT_SERVER_ID_MAP_STORAGE_KEY`, and
  `CONSULTORES_CACHE_KEY` must not be renamed or removed.

- **`OrcamentoSnapshotData` shape is sacred.** All ~80 fields must continue to deserialise
  correctly from records stored by the current version. Any field added must be optional.

- **`printableData` memo must remain pure.** No store reads, API calls, or side effects inside
  the memo. Inputs come only from hook arguments.

- **`isHydratingRef` flag must not be lost.** Every auto-save, getCurrentSnapshot, and
  client auto-save handler checks this ref. If it is dropped the form will overwrite
  freshly loaded data.

- **No barrel exports across domain boundaries.** Each extracted module exports only what its
  consumers need. Do not create `index.ts` re-exports that create circular dependencies.

- **`App.tsx` is the orchestration shell, not a feature module.** After all extractions, it
  should only:
  - Call the extracted hooks
  - Compose props for `AppShell`, `AppRoutes`, and page components
  - Render the hidden `<PrintableProposal>` node
  - Render modals driven by state from the hooks

---

## 7. References

| File | Relevance |
|---|---|
| `src/App.tsx` | Subject of this plan |
| `src/app/config.ts` | `STORAGE_KEYS`, `INITIAL_VALUES`, `SIMULACOES_SECTIONS` |
| `src/app/Routes.tsx` | `AppRoutes` shell wrapper |
| `src/layout/AppShell.tsx` | Shell receiving nav props |
| `src/store/useLeasingStore.ts` | Leasing Zustand store |
| `src/store/useVendaStore.ts` | Venda Zustand store |
| `src/selectors.ts` | Derived selectors used throughout `App()` |
| `src/lib/persist/formDraft.ts` | Draft save/load used in hydration |
| `src/lib/persist/proposalStore.ts` | Proposal snapshot save/load |
| `src/app/services/serverStorage.ts` | Server-storage sync helpers |
| `src/lib/migrateLocalStorageToServer.ts` | One-time local → Neon migration |
| `src/lib/auth/rbac.ts` | `useStackRbac` — permission hook |
| `src/features/crm/index.ts` | Already-extracted CRM feature (model for future steps) |
| `src/features/simulacoes/AnaliseFinanceiraSection.tsx` | Consumer of Financial Analysis state |
| `docs/PROPOSALS_ANTI_REGRESSION_CHECKLIST.md` | Regression acceptance criteria |
| `src/__tests__/critical/` | Critical test suite to protect throughout extraction |
