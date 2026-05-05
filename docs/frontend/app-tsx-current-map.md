# App.tsx Responsibility Map

**Generated**: 2026-05-05  
**Branch**: `copilot/doc-app-tsx-responsibility-map`  
**File**: `src/App.tsx`  
**Total lines**: 15,855  

---

## 1. File Structure Overview

| Zone | Lines | Description |
|------|-------|-------------|
| Imports | 1–386 | 143 import statements |
| Module-level helpers / types / consts | 387–1823 | Pure functions, type aliases, constants, inline hooks (`useTarifaInputField`) |
| `App()` function body | 1824–15854 | All state, effects, logic, and JSX |
| ↳ — Hooks & state (pre-return) | 1824–14428 | ~12,600 lines of declarations |
| ↳ — JSX `return` block | 14429–15854 | ~1,400 lines |

---

## 2. Hook Counts (inside `App()` function)

| Hook | Count | Line range examples |
|------|------:|---------------------|
| `useState` | 127 | 1906–13316 |
| `useEffect` | 76 | 1958–13040 |
| `useMemo` | 94 | 1900–13293 |
| `useCallback` | 173 | 1908–13316 |
| **Total** | **470** | |

---

## 3. Custom Hooks Called Inside `App()`

| Hook | Source | Lines | Purpose |
|------|--------|-------|---------|
| `useTheme` | `src/hooks/useTheme` | 1825 | App theme / dark-mode |
| `useStackUser` | Stack Auth SDK | 1826 | Authenticated user object |
| `useStackRbac` | `src/hooks/useStackRbac` | 1840 | Role-based permissions from Stack |
| `useAuthSession` | `src/hooks/useAuthSession` | 1859 | `/api/auth/me` DB role |
| `useAuthorizationSnapshot` | `src/hooks/useAuthorizationSnapshot` | 1862 | `/api/authz/me` capability RBAC |
| `useVendaStore` | Zustand | 1938–1944 | Venda (sales proposal) state |
| `useLeasingStore` | Zustand | 1945, 2707–2708 | Leasing proposal + contract state |
| `useNavigationState` | `src/hooks/useNavigationState` | 2069 | Page/tab/sidebar nav state |
| `useVendasConfigStore` | Zustand | 2085–2086 | Sales configuration store |
| `useTusdState` | `src/features/simulacoes/useTusdState` | 2233 | TUSD/ANEEL parameters |
| `useLeasingSimulacaoState` | `src/features/simulacoes/useLeasingSimulacaoState` | 2250 | Leasing simulation state |
| `useVendasSimulacoesStore` | Zustand | 2306, 2341–2343 | Saved vendas simulations |
| `useBudgetUploadState` | `src/features/simulacoes/useBudgetUploadState` | 2340 | Budget PDF upload state |
| `useCrm` | `src/features/crm` | 2563 | Full CRM state & callbacks |
| `useStorageHydration` | `src/hooks/useStorageHydration` | 2574 | Auth token wiring + hydration |
| `useClientState` | `src/hooks/useClientState` | 2617 | Clients list, sync, refs, DB ops |
| `useProposalOrchestration` | `src/hooks/useProposalOrchestration` | 2676 | Saved proposals list & load |
| `useMultiUcState` | `src/features/simulacoes/useMultiUcState` | 2910 | Multi-UC beneficiary logic |
| `useBRNumberField` (×4) | `src/hooks/useBRNumberField` | 3207, 3281, 6334–6352 | Numeric field formatting helpers |
| `useTarifaInputField` (×2) | Module-level (App.tsx:1120) | 3595–3596 | Tariff input field handlers |
| `useAnaliseFinanceiraState` | `src/features/simulacoes/useAnaliseFinanceiraState` | 6085 | Financial analysis state |
| `useLeasingValorDeMercadoEstimado` | `src/hooks/useLeasingValorDeMercadoEstimado` | 6666 | Market value estimate |
| `usePrintOrchestration` | `src/lib/pdf/usePrintOrchestration` | 9413 | Print lifecycle orchestration |

---

## 4. useState — Grouped by Domain

### 4.1 UI / Theme / Display (→ **should stay** or move to hook)
| State | Line | Classification |
|-------|------|----------------|
| `theme` | 1946 | Should stay (root concern) |
| `isLoggingOut` | 1906 | Should stay (auth action) |
| `settingsTab` | 2194 | → Move to `useSettingsState` hook |
| `density` | 4561 | → Move to `useDisplayPreferences` hook |
| `mobileSimpleView` | 4598 | → Move to `useDisplayPreferences` hook |
| `desktopSimpleView` | 4605 | → Move to `useDisplayPreferences` hook |
| `useBentoGridPdf` | 4554 | → Move to `useDisplayPreferences` hook |

### 4.2 Notifications
| State | Line | Classification |
|-------|------|----------------|
| `notificacoes` | 2534 | → Move to `useNotifications` hook |

### 4.3 Confirm / Save-decision / Precheck Dialogs
| State | Line | Classification |
|-------|------|----------------|
| `saveDecisionPrompt` | 2120 | → Move to `useDialogOrchestration` hook |
| `confirmDialog` | 2148 | → Move to `useDialogOrchestration` hook |
| `precheckModalData` | 3671 | → Move to `usePrecheckNormativo` hook |
| `precheckModalClienteCiente` | 3672 | → Move to `usePrecheckNormativo` hook |
| `precheckClienteCiente` | 3670 | → Move to `usePrecheckNormativo` hook |

### 4.4 Tariff / Grid Parameters (simulation inputs)
| State | Line | Classification |
|-------|------|----------------|
| `ufTarifa` | 2196 | → Move to `useTariffParams` hook |
| `distribuidoraTarifa` | 2197 | → Move to `useTariffParams` hook |
| `ufsDisponiveis` | 2198 | → Move to `useTariffParams` hook |
| `distribuidorasPorUf` | 2199 | → Move to `useTariffParams` hook |
| `mesReajuste` | 2207 | → Move to `useTariffParams` hook |
| `tarifaCheia` | 2214 | → Move to `useTariffParams` hook |
| `desconto` | 2215 | → Move to `useTariffParams` hook |
| `taxaMinima` | 2216 | → Move to `useTariffParams` hook |
| `taxaMinimaInputEmpty` | 2217 | → Move to `useTariffParams` hook |
| `encargosFixosExtras` | 2218 | → Move to `useTariffParams` hook |
| `kcKwhMes` | 2084 | → Move to `useTariffParams` hook |
| `consumoManual` | 2212 | → Move to `useTariffParams` hook |

### 4.5 System / Installation Configuration
| State | Line | Classification |
|-------|------|----------------|
| `potenciaModulo` | 2259 | → Move to `useSystemConfig` hook |
| `tipoRede` | 2260 | → Move to `useSystemConfig` hook |
| `tipoRedeControle` | 2261 | → Move to `useSystemConfig` hook |
| `potenciaModuloDirty` | 2266 | → Move to `useSystemConfig` hook |
| `tipoInstalacao` | 2268 | → Move to `useSystemConfig` hook |
| `tipoInstalacaoOutro` | 2271 | → Move to `useSystemConfig` hook |
| `tipoSistema` | 2274 | → Move to `useSystemConfig` hook |
| `segmentoCliente` | 2275 | → Move to `useSystemConfig` hook |
| `tipoEdificacaoOutro` | 2280 | → Move to `useSystemConfig` hook |
| `tipoInstalacaoDirty` | 2283 | → Move to `useSystemConfig` hook |
| `numeroModulosManual` | 2284 | → Move to `useSystemConfig` hook |
| `potenciaFonteManual` | 2213 | → Move to `useSystemConfig` hook |
| `composicaoTelhado` | 2296 | → Move to `useSystemConfig` hook |
| `composicaoSolo` | 2299 | → Move to `useSystemConfig` hook |
| `configuracaoUsinaObservacoes` | 2287 | → Move to `useSystemConfig` hook |

### 4.6 CEP / City / IBGE Lookups
| State | Line | Classification |
|-------|------|----------------|
| `cidadeBloqueadaPorCep` | 2648 | → Move to `useCepLookup` hook |
| `ucGeradoraCidadeBloqueadaPorCep` | 2649 | → Move to `useCepLookup` hook |
| `ibgeMunicipiosPorUf` | 2650 | → Move to `useCepLookup` hook |
| `ibgeMunicipiosLoading` | 2651 | → Move to `useCepLookup` hook |
| `cidadeSearchTerm` | 2653 | → Move to `useCepLookup` hook |
| `cidadeSelectOpen` | 2654 | → Move to `useCepLookup` hook |
| `verificandoCidade` | 3198 | → Move to `useCepLookup` hook |
| `buscandoCep` | 3199 | → Move to `useCepLookup` hook |
| `ucsBeneficiarias` | 2655 | Managed by `useMultiUcState` — should stay wired here |

### 4.7 Integration Availability Flags
| State | Line | Classification |
|-------|------|----------------|
| `oneDriveIntegrationAvailable` | 2173 | → Move to `useIntegrationFlags` hook |
| `proposalPdfIntegrationAvailable` | 2176 | → Move to `useIntegrationFlags` hook |

### 4.8 Proposal / Simulation Inputs
| State | Line | Classification |
|-------|------|----------------|
| `propostaImagens` | 2103 | → Move to `usePropostaImagens` hook |
| `parsedVendaPdf` | 3203 | → Move to `useBudgetParsing` hook |
| `capexManualOverride` | 3200 | → Move to `useCapexState` hook |
| `aprovadoresText` | 2302 | → Move to `useVendasConfigDraft` hook |
| `impostosOverridesDraft` | 2303 | → Move to `useVendasConfigDraft` hook |
| `pageSharedState` | 2398 | → Move to `usePageSharedSettings` hook |

### 4.9 Financing Parameters
| State | Line | Classification |
|-------|------|----------------|
| `jurosFinAa` | 4545 | → Move to `useFinanciamentoState` hook |
| `prazoFinMeses` | 4546 | → Move to `useFinanciamentoState` hook |
| `entradaFinPct` | 4549 | → Move to `useFinanciamentoState` hook |
| `mostrarFinanciamento` | 4550 | → Move to `useFinanciamentoState` hook |
| `mostrarGrafico` | 4553 | → Move to `useFinanciamentoState` hook |
| `prazoMeses` | 4639 | → Move to `useFinanciamentoState` hook |
| `bandeiraEncargo` | 4640 | → Move to `useFinanciamentoState` hook |
| `cipEncargo` | 4641 | → Move to `useFinanciamentoState` hook |
| `entradaRs` | 4642 | → Move to `useFinanciamentoState` hook |
| `entradaModo` | 4643 | → Move to `useFinanciamentoState` hook |

### 4.10 Leasing Display / View Config
| State | Line | Classification |
|-------|------|----------------|
| `mostrarValorMercadoLeasing` | 4644 | → Move to `useLeasingViewConfig` hook |
| `mostrarTabelaParcelas` | 4647 | → Move to `useLeasingViewConfig` hook |
| `mostrarTabelaBuyout` | 4650 | → Move to `useLeasingViewConfig` hook |
| `mostrarTabelaParcelasConfig` | 4652 | → Move to `useLeasingViewConfig` hook |
| `mostrarTabelaBuyoutConfig` | 4655 | → Move to `useLeasingViewConfig` hook |
| `exibirLeasingLinha` | 4716 | → Move to `useLeasingViewConfig` hook |
| `exibirFinLinha` | 4719 | → Move to `useLeasingViewConfig` hook |

### 4.11 OEM / Insurance / Portfolio Costs
| State | Line | Classification |
|-------|------|----------------|
| `oemBase` | 4707 | → Move to `useLeasingCostConfig` hook |
| `oemInflacao` | 4708 | → Move to `useLeasingCostConfig` hook |
| `seguroModo` | 4709 | → Move to `useLeasingCostConfig` hook |
| `seguroReajuste` | 4710 | → Move to `useLeasingCostConfig` hook |
| `seguroValorA` | 4711 | → Move to `useLeasingCostConfig` hook |
| `seguroPercentualB` | 4712 | → Move to `useLeasingCostConfig` hook |
| `cashbackPct` | 4721 | → Move to `useLeasingCostConfig` hook |
| `depreciacaoAa` | 4722 | → Move to `useLeasingCostConfig` hook |
| `inadimplenciaAa` | 4723 | → Move to `useLeasingCostConfig` hook |
| `tributosAa` | 4724 | → Move to `useLeasingCostConfig` hook |
| `ipcaAa` | 4725 | → Move to `useLeasingCostConfig` hook |
| `custosFixosM` | 4726 | → Move to `useLeasingCostConfig` hook |
| `opexM` | 4727 | → Move to `useLeasingCostConfig` hook |
| `seguroM` | 4728 | → Move to `useLeasingCostConfig` hook |
| `duracaoMeses` | 4729 | → Move to `useLeasingCostConfig` hook |
| `pagosAcumAteM` | 4731 | → Move to `useLeasingCostConfig` hook |

### 4.12 Contract / Leasing Contract State
| State | Line | Classification |
|-------|------|----------------|
| `salvandoPropostaLeasing` | 4658 | → Move to `useContractActions` hook |
| `salvandoPropostaPdf` | 4659 | → Move to `useContractActions` hook |
| `gerandoContratos` | 4660 | → Move to `useContractActions` hook |
| `gerandoTabelaTransferencia` | 4651 | → Move to `useContractActions` hook |
| `isContractTemplatesModalOpen` | 4661 | → Move to `useContractActions` hook |
| `isLeasingContractsModalOpen` | 4662 | → Move to `useContractActions` hook |
| `leasingAnexosSelecionados` | 4664 | → Move to `useContractActions` hook |
| `leasingAnexosAvailability` | 4667 | → Move to `useContractActions` hook |
| `leasingAnexosLoading` | 4670 | → Move to `useContractActions` hook |
| `contractTemplates` | 4673 | → Move to `useContractActions` hook |
| `selectedContractTemplates` | 4674 | → Move to `useContractActions` hook |
| `contractTemplatesLoading` | 4675 | → Move to `useContractActions` hook |
| `contractTemplatesError` | 4676 | → Move to `useContractActions` hook |
| `clientReadinessErrors` | 4663 | → Move to `useContractActions` hook |
| `ucGeradoraTitularPanelOpen` | 2252 | → Move to `useUcGeradoraTitular` hook |

### 4.13 Client Import / Backup State
| State | Line | Classification |
|-------|------|----------------|
| `isImportandoClientes` | 3146 | → Move to `useClientImportExport` hook |
| `isGerandoBackupBanco` | 3147 | → Move to `useClientImportExport` hook |
| `isBackupModalOpen` | 3148 | → Move to `useClientImportExport` hook |
| `bulkImportPreviewRows` | 3150 | → Move to `useClientImportExport` hook |
| `isBulkImportPreviewOpen` | 3151 | → Move to `useClientImportExport` hook |
| `bulkImportAutoMerge` | 3152 | → Move to `useClientImportExport` hook |
| `isBulkImportConfirming` | 3153 | → Move to `useClientImportExport` hook |

### 4.14 Corresponsável / UC Geradora Titular
| State | Line | Classification |
|-------|------|----------------|
| `clienteHerdeirosExpandidos` | 3141 | → Move to `useUcGeradoraTitular` hook |
| `isCorresponsavelModalOpen` | 3142 | → Move to `useUcGeradoraTitular` hook |
| `corresponsavelDraft` | 3144 | → Move to `useUcGeradoraTitular` hook |
| `corresponsavelErrors` | 3145 | → Move to `useUcGeradoraTitular` hook |

### 4.15 Proposal Send / Share
| State | Line | Classification |
|-------|------|----------------|
| `isEnviarPropostaModalOpen` | 7694 | → Move to `useProposalSend` hook |
| `contatoEnvioSelecionadoId` | 7695 | → Move to `useProposalSend` hook |

---

## 5. useEffect — Grouped by Domain

### 5.1 Anti-overlay / browser-compat (→ **should stay** — root concern)
| Lines | Purpose |
|-------|---------|
| 1958–1961 | `removeFogOverlays` + `watchFogReinjection` on mount |
| 1969–2016 | Safari popup blocker workaround: pre-opens print window |

### 5.2 Theme / OS dark-mode sync (→ **should stay**)
| Lines | Purpose |
|-------|---------|
| 2018–2040 | `matchMedia` listener for `prefers-color-scheme: dark` |

### 5.3 Navigation / RBAC guard (→ **should stay** or move to hook)
| Lines | Purpose |
|-------|---------|
| 2077–2082 | Sync `modo_venda` into venda store when `isVendaDiretaTab` changes |

### 5.4 ANEEL / Distribuidoras / IBGE (→ **move to `useTariffParams` or `useCepLookup` hook**)
| Lines | Purpose |
|-------|---------|
| 2778–2814 | Load ANEEL distribuidoras when `ufTarifa` changes |
| 2841–2857 | Reset distribuidora when UF changes |
| 2852–2858 | Load IBGE cities when UF changes |
| 2874 | Sync `distribuidoraAneelEfetiva` ref |
| 2926 | Sync `procuracaoUf` ref |

### 5.5 Shared settings sync (→ **move to `usePageSharedSettings` hook**)
| Lines | Purpose |
|-------|---------|
| 2351–2353 | Sync `aprovadoresText` from `vendasConfig` |
| 2355–2357 | Sync `impostosOverridesDraft` from `vendasConfig` |
| 2359–2362 | Initialize venda simulation on `currentBudgetId` change |
| 3059–3094 | Re-apply `pageSharedState` snapshot to local state when `activeTab` changes |
| 3095–3132 | Multiple ref-sync effects for `cliente`, `kcKwhMes`, `pageSharedState`, `budgetId` |

### 5.6 Client / CEP field sync (→ **move to `useCepLookup` hook**)
| Lines | Purpose |
|-------|---------|
| 3161–3196 | Various client form field sync effects (distribuidora default, city refresh, etc.) |
| 3181, 3191 | Additional city/CEP-triggered effects |

### 5.7 Recalc triggers (→ **move to `useSimulationEngine` hook**)
| Lines | Purpose |
|-------|---------|
| 3549–3556 | Recalculate returns when tariff changes |
| 3588–3602 | Tariff field sync when UF/distribuidora changes |
| 3799–3852 | `taxaMinimaCalculadaBase` derivation and suggestion effect |

### 5.8 Display preference persistence (→ **move to `useDisplayPreferences` hook**)
| Lines | Purpose |
|-------|---------|
| 4570–4584 | Persist `density` to `localStorage` |
| 4586–4596 | Persist `useBentoGridPdf` to `localStorage` |
| 4613–4623 | Persist `mobileSimpleView` to `localStorage` |
| 4624–4637 | Persist `desktopSimpleView` to `localStorage` |

### 5.9 Leasing cost config defaults / sync (→ **move to `useLeasingCostConfig` hook**)
| Lines | Purpose |
|-------|---------|
| 4679–4705 | Load contract templates availability on modal open |
| 4735–4906 | Multiple effects: OEM sync, cost propagation, leasing store sync |

### 5.10 Solar generation / normative precheck (→ **move to `useSimulationEngine` or `usePrecheckNormativo` hook**)
| Lines | Purpose |
|-------|---------|
| 5095–5141 | Normative precheck effects — tipoRede auto-adjustment |
| 5223–5235 | Auto-apply `tipoRedeAutoSugestao` |
| 5263–5394 | Budget auto-fill / module quantity effects |
| 5395–5430 | Generation parameter updates |
| 5512–5610 | Multi-UC generation calculation sync |
| 5611–5966 | Series of solar calc effects (generation, area, module count, potência) |

### 5.11 CAPEX / cost calculation effects (→ **move to `useCapexState` hook**)
| Lines | Purpose |
|-------|---------|
| 6358–6393 | CAPEX dirty flag effects |
| 6539–6562 | CAPEX base resolution |
| 6668–6700 | `capexSolarInvest` sync to leasing store |

### 5.12 Print / PDF / preview (→ **move to `usePrintOrchestration` hook or keep in lib**)
| Lines | Purpose |
|-------|---------|
| 7193–7207 | `economiaEstimativa` sync effect |
| 7647–7692 | Print window lifetime / polling effects |

### 5.13 Proposal send (→ **move to `useProposalSend` hook**)
| Lines | Purpose |
|-------|---------|
| 7787–7807 | Auto-select first contact when proposal send modal opens |

### 5.14 Client save / auto-save (→ **move to `useClientAutoSave` hook**)
| Lines | Purpose |
|-------|---------|
| 9438–9522 | Auto-save client on change with debounce (5s) |
| 9790–10004 | Idle sync interval (2 min) for clients + proposals |

### 5.15 Unsaved-changes tracking (→ **should stay** — orchestrates cross-domain guards)
| Lines | Purpose |
|-------|---------|
| 11576–11648 | `beforeunload` + history-push guard for unsaved changes |

### 5.16 Leasing contract field effects (→ **move to `useUcGeradoraTitular` or `useLeasingContractFields` hook**)
| Lines | Purpose |
|-------|---------|
| 12393–12426 | UC geradora titular city/state autocomplete |
| 12705–12713 | Sync leasing contract titularity fields |
| 12784–12932 | Leasing contract proprietario/herdeiro sync effects |
| 12933–13039 | Additional leasing form sync effects |
| 13040–13134 | Draft persistence / reload effects |

---

## 6. useMemo — Grouped by Domain

### 6.1 Auth / Permissions (→ **should stay**)
| Name | Line | Classification |
|------|------|----------------|
| `showAdminDiagnostics` | 1900 | Should stay |
| `isPrintMode` | 1931 | Should stay |
| `distribuidorasFallback` | 1937 | → Move to module-level const |

### 6.2 Theme
| Name | Line | Classification |
|------|------|----------------|
| `chartTheme` | 2041 | → Move to `useTheme` hook return |

### 6.3 System / Config Derivations (→ **move to `useSystemConfig` hook**)
| Name | Lines | Classification |
|------|-------|----------------|
| `tipoRedeLabel` | 2262 | → `useSystemConfig` |
| `arredondarPasso` | 2368 | → `useVendasConfigDraft` |
| `aprovadoresResumo` | 2372 | → `useVendasConfigDraft` |
| `corresponsavelAtivo` | 2709 | → `useUcGeradoraTitular` |
| `distribuidorasDisponiveis` | 2717 | → `useTariffParams` |
| `clienteDistribuidorasDisponiveis` | 2815 | → `useTariffParams` |
| `cidadesDisponiveis` | 2820 | → `useCepLookup` |
| `cidadesFiltradas` | 2827 | → `useCepLookup` |
| `distribuidoraAneelEfetiva` | 2859 | → `useTariffParams` |
| `procuracaoUf` | 2911 | → `useUcGeradoraTitular` |
| `ucGeradoraTitularDistribuidorasDisponiveis` | 2934 | → `useUcGeradoraTitular` |

### 6.4 Normative Precheck (→ **move to `usePrecheckNormativo` hook**)
| Name | Lines | Classification |
|------|-------|----------------|
| `ufNorma` | 4993 | → `usePrecheckNormativo` |
| `_tipoLigacaoNorma` | 5006 | → `usePrecheckNormativo` |
| `precheckNormativo` | 5007 | → `usePrecheckNormativo` |
| `tipoRedeCompatMessage` | 5017 | → `usePrecheckNormativo` |
| `normComplianceBanner` | 5028 | → `usePrecheckNormativo` |
| `taxaMinimaCalculadaBase` | 3789 | → `useTariffParams` |

### 6.5 Solar Generation (→ **move to `useSimulationEngine` hook**)
| Name | Lines | Classification |
|------|-------|----------------|
| `eficienciaNormalizada` | 4907 | → `useSimulationEngine` |
| `baseIrradiacao` | 4913 | → `useSimulationEngine` |
| `diasMesNormalizado` | 4918 | → `useSimulationEngine` |
| `vendaPotenciaCalculada` | 4923 | → `useSimulationEngine` |
| `numeroModulosInformado` | 4934 | → `useSimulationEngine` |
| `numeroModulosCalculado` | 4940 | → `useSimulationEngine` |
| `potenciaInstaladaKwp` | 4971 | → `useSimulationEngine` |
| `tipoRedeAutoSugestao` | 5210 | → `useSimulationEngine` |
| `installTypeNormalized` | 5194 | → `useSimulationEngine` |
| `systemTypeNormalized` | 5200 | → `useSimulationEngine` |
| `potenciaKwpElegivel` | 5205 | → `useSimulationEngine` |
| `margemLucroPadraoFracao` | 5236 | → `useSimulationEngine` |
| `comissaoPadraoFracao` | 5242 | → `useSimulationEngine` |
| `autoBudgetFallbackMessage` | 5248 | → `useSimulationEngine` |
| `_vendaQuantidadeModulos` | 5378 | → `useSimulationEngine` |
| `vendaGeracaoParametros` | 5387 | → `useSimulationEngine` |
| `areaInstalacao` | 5427 | → `useSimulationEngine` |
| `geracaoMensalKwh` | 5433 | → `useSimulationEngine` |
| `numeroModulosEstimado` | 5185 | → `useSimulationEngine` |
| `vendaAutoPotenciaKwp` | 5190 | → `useSimulationEngine` |
| `fatorGeracaoMensalCompleto` | 5576 | → `useSimulationEngine` |
| `geracaoDiariaKwh` | 5996 | → `useSimulationEngine` |
| `encargosFixos` | 6001 | → `useSimulationEngine` |
| `cidKwhBase` | 6005 | → `useSimulationEngine` |

### 6.6 CAPEX / Cost (→ **move to `useCapexState` hook**)
| Name | Lines | Classification |
|------|-------|----------------|
| `modoEntradaNormalizado` | 6113 | → `useCapexState` |
| `composicaoTelhadoCalculo` | 6121 | → `useCapexState` |
| `composicaoSoloCalculo` | 6181 | → `useCapexState` |
| `capexBaseResumoValor` | 6261 | → `useCapexState` |
| `margemOperacionalResumoValor` | 6270 | → `useCapexState` |
| `composicaoTelhadoTotal` | 6394 | → `useCapexState` |
| `composicaoSoloTotal` | 6401 | → `useCapexState` |
| `valorVendaTelhado` | 6428 | → `useCapexState` |
| `valorVendaSolo` | 6474 | → `useCapexState` |
| `capex` | 6563 | → `useCapexState` |
| `custoFinalProjetadoCanonico` | 6596 | → `useCapexState` |
| `capexSolarInvest` | 6661 | → `useCapexState` |

### 6.7 Simulation State / Financial (→ **move to `useSimulationEngine` or `useFinanciamentoState` hook**)
| Name | Lines | Classification |
|------|-------|----------------|
| `simulationState` | 6701 | → `useSimulationEngine` (master useMemo) |
| `inflacaoMensal` | 6801 | → selector, should be inline |
| `mensalidades` | 6802 | → selector |
| `mensalidadesPorAno` | 6803 | → selector |
| `creditoEntradaMensal` | 6804 | → selector |
| `kcAjustado` | 6805 | → selector |
| `buyoutLinhas` | 6806 | → selector |
| `leasingBeneficios` | 6816 | → `useSimulationEngine` |
| `leasingROI` | 6903 | → `useSimulationEngine` |
| `taxaMensalFin` | 6913 | → `useFinanciamentoState` |
| `entradaFin` | 6914 | → `useFinanciamentoState` |
| `valorFinanciado` | 6915 | → `useFinanciamentoState` |
| `pmt` | 6916 | → `useFinanciamentoState` |
| `financiamentoFluxo` | 6932 | → `useFinanciamentoState` |
| `financiamentoROI` | 6950 | → `useFinanciamentoState` |
| `financiamentoMensalidades` | 6960 | → `useFinanciamentoState` |
| `parcelaMensalFin` | 6966 | → `useFinanciamentoState` |
| `parcelasSolarInvest` | 6973 | → `useSimulationEngine` |
| `leasingMensalidades` | 7063 | → `useSimulationEngine` |
| `tabelaBuyout` | 7081 | → `useSimulationEngine` |
| `buyoutReceitaRows` | 7135 | → `useSimulationEngine` |
| `anosArray` | 7153 | → `useSimulationEngine` |
| `vendaRetornoAuto` | 7158 | → `useSimulationEngine` |
| `economiaEstimativaValorCalculado` | 7177 | → `useSimulationEngine` |

### 6.8 Print / PDF (→ **move to `usePrintOrchestration` lib hook**)
| Name | Lines | Classification |
|------|-------|----------------|
| `printableData` | 7208 | → `usePrintableData` hook |
| `contatosEnvio` | 7696 | → `useProposalSend` hook |
| `contatoEnvioSelecionado` | 7780 | → `useProposalSend` hook |
| `budgetCodeDisplay` | 13293 | → `useProposalOrchestration` (already exists) |

### 6.9 Client Form Derived State (→ **move to `useClientForm` hook**)
| Name | Lines | Classification |
|------|-------|----------------|
| `clienteRegistroEmEdicao` | 8800 | → `useClientForm` |
| `clienteFormularioAlterado` | 8807 | → `useClientForm` |
| `clienteTemDadosNaoSalvos` | 8819 | → `useClientForm` |
| `clientIsDirty` | 8834 | → `useClientForm` |

---

## 7. useCallback — Grouped by Domain

### 7.1 Auth (→ **should stay**)
| Name | Lines | Classification |
|------|-------|----------------|
| `getAccessToken` | 1852 | Should stay (stable ref pattern) |
| `handleLogout` | 1908 | Should stay |

### 7.2 Notifications (→ **move to `useNotifications` hook**)
| Name | Lines | Classification |
|------|-------|----------------|
| `adicionarNotificacao` | 2548 | → `useNotifications` |
| `removerNotificacao` | 2538 | → `useNotifications` |

### 7.3 Save / Unsaved-changes Guards (→ **should stay** — cross-domain orchestrator)
| Name | Lines | Classification |
|------|-------|----------------|
| `scheduleMarkStateAsSaved` | 2108 | Should stay |
| `requestSaveDecision` | 2122 | Should stay |
| `resolveSaveDecisionPrompt` | 2138 | Should stay |
| `requestConfirmDialog` | 2150 | Should stay |
| `resolveConfirmDialog` | 2163 | Should stay |
| `hasUnsavedChanges` | 11564 | Should stay |
| `runWithUnsavedChangesGuard` | 11649 | Should stay |
| `confirmarAlertasAntesDeSalvar` | 11318 | → `useContractActions` |

### 7.4 Tariff / UF Params (→ **move to `useTariffParams` hook**)
| Name | Lines | Classification |
|------|-------|----------------|
| `setUfTarifa` | 2505 | → `useTariffParams` |
| `setDistribuidoraTarifa` | 2519 | → `useTariffParams` |
| `setConsumoManual` | 2415 | → `useTariffParams` |
| `setKcKwhMes` | 2428 | → `useTariffParams` |
| `setPotenciaFonteManual` | 2444 | → `useTariffParams` |
| `setTarifaCheia` | 2457 | → `useTariffParams` |
| `setTaxaMinima` | 2472 | → `useTariffParams` |
| `normalizeTaxaMinimaInputValue` | 2488 | → pure helper |
| `handleParametrosUfChange` | 12170 | → `useTariffParams` |
| `handleParametrosDistribuidoraChange` | 12185 | → `useTariffParams` |

### 7.5 System Config (→ **move to `useSystemConfig` hook**)
| Name | Lines | Classification |
|------|-------|----------------|
| `setPotenciaModulo` | 2949 | → `useSystemConfig` |
| `setPotenciaModuloDirty` | 2964 | → `useSystemConfig` |
| `setTipoInstalacao` | 2977 | → `useSystemConfig` |
| `setTipoInstalacaoOutro` | 2990 | → `useSystemConfig` |
| `setTipoSistema` | 3003 | → `useSystemConfig` |
| `setTipoInstalacaoDirty` | 3018 | → `useSystemConfig` |
| `setSegmentoCliente` | 3031 | → `useSystemConfig` |
| `setNumeroModulosManual` | 3045 | → `useSystemConfig` |
| `handleComposicaoTelhadoChange` | 3213 | → `useSystemConfig` |
| `handleComposicaoSoloChange` | 3231 | → `useSystemConfig` |
| `handleSegmentoClienteChange` | 3905 | → `useSystemConfig` |
| `handleTusdTipoClienteChange` | 3930 | → `useSystemConfig` |
| `handleTipoSistemaChange` | 3947 | → `useSystemConfig` |
| `updateSegmentoCliente` | 3854 | → `useSystemConfig` |
| `updateTusdTipoCliente` | 3867 | → `useSystemConfig` |
| `handleTipoRedeSelection` | 3635 | → `useSystemConfig` |

### 7.6 Budget / Venda Form (→ **move to `useBudgetActions` hook**)
| Name | Lines | Classification |
|------|-------|----------------|
| `autoFillVendaFromBudget` | 3955 | → `useBudgetActions` |
| `handleCondicaoPagamentoChange` | 4253 | → `useBudgetActions` |
| `handleBudgetFileChange` | 4314 | → `useBudgetActions` |
| `handleMissingInfoManualEdit` | 4454 | → `useBudgetActions` |
| `handleMissingInfoUploadClick` | 4541 | → `useBudgetActions` |
| `handleRecalcularVendas` | 3557 | → `useBudgetActions` |
| `handleCalcularRetorno` | 3565 | → `useBudgetActions` |
| `handlePotenciaInstaladaChange` | 3604 | → `useBudgetActions` |
| `handleMargemManualInput` | 3249 | → `useBudgetActions` |
| `handleDescontosConfigChange` | 3272 | → `useBudgetActions` |
| `handleCapexBaseResumoChange` | 3287 | → `useBudgetActions` |
| `handleMargemOperacionalResumoChange` | 6288 | → `useBudgetActions` |

### 7.7 Validation (→ **move to `useProposalValidation` hook**)
| Name | Lines | Classification |
|------|-------|----------------|
| `validateVendaForm` | 3299 | → `useProposalValidation` |
| `buildRequiredClientFields` | 3407 | → `useProposalValidation` |
| `validateConsumoMinimoLeasing` | 3424 | → `useProposalValidation` |
| `validateTipoRedeLeasing` | 3436 | → `useProposalValidation` |
| `validatePropostaLeasingMinimal` | 3447 | → `useProposalValidation` |
| `guardClientFieldsOrReturn` | 3461 | → `useProposalValidation` |
| `validateClienteParaSalvar` | 3486 | → `useProposalValidation` |
| `coletarAlertasProposta` | 5446 | → `useProposalValidation` |
| `confirmarAlertasGerarProposta` | 5464 | → `useProposalValidation` |

### 7.8 Precheck / Normative (→ **move to `usePrecheckNormativo` hook**)
| Name | Lines | Classification |
|------|-------|----------------|
| `applyNormativeAdjustment` | 3658 | → `usePrecheckNormativo` |
| `buildPrecheckObservationText` | 3675 | → `usePrecheckNormativo` |
| `isPrecheckObservationTextValid` | 3724 | → `usePrecheckNormativo` |
| `buildPrecheckObservationBlock` | 3735 | → `usePrecheckNormativo` |
| `cleanPrecheckObservation` | 3746 | → `usePrecheckNormativo` |
| `upsertPrecheckObservation` | 3756 | → `usePrecheckNormativo` |
| `removePrecheckObservation` | 3769 | → `usePrecheckNormativo` |
| `requestPrecheckDecision` | 3773 | → `usePrecheckNormativo` |
| `resolvePrecheckDecision` | 3783 | → `usePrecheckNormativo` |
| `ensureNormativePrecheck` | 5142 | → `usePrecheckNormativo` |

### 7.9 IBGE / CEP (→ **move to `useCepLookup` hook**)
| Name | Lines | Classification |
|------|-------|----------------|
| `ensureIbgeMunicipios` | 2722 | → `useCepLookup` |

### 7.10 Solar Calc Helpers (→ **move to pure helpers in `src/utils/` or `useSimulationEngine` hook**)
| Name | Lines | Classification |
|------|-------|----------------|
| `normalizarPotenciaKwp` | 5530 | → pure helper |
| `normalizarGeracaoMensal` | 5537 | → pure helper |
| `calcularPotenciaSistemaKwp` | 5544 | → pure helper |
| `estimarGeracaoPorPotencia` | 5561 | → pure helper |
| `calcularModulosPorGeracao` | 5583 | → pure helper |
| `handleMultiUcToggle` | 5478 | → `useMultiUcState` (already exists) |

### 7.11 Client Import / Export (→ **move to `useClientImportExport` hook**)
| Name | Lines | Classification |
|------|-------|----------------|
| `downloadClientesArquivo` | 7809 | → `useClientImportExport` |
| `buildClientesFileName` | 7824 | → `useClientImportExport` |
| `handleExportarClientesJson` | 7832 | → `useClientImportExport` |
| `handleExportarClientesCsv` | 7876 | → `useClientImportExport` |
| `handleClientesImportarClick` | 7910 | → `useClientImportExport` |
| `handleBackupUploadArquivo` | 7921 | → `useClientImportExport` |
| `handleBackupBancoDados` | 7969 | → `useClientImportExport` |
| `handleBackupModalUpload` | 7975 | → `useClientImportExport` |
| `handleBackupModalDownload` | 7981 | → `useClientImportExport` |
| `handleClientesImportarArquivo` | 8062 | → `useClientImportExport` |
| `handleBulkImportConfirm` | 8183 | → `useClientImportExport` |
| `handleBulkImportRowSelection` | 8301 | → `useClientImportExport` |
| `handleBulkImportRowAction` | 8307 | → `useClientImportExport` |
| `handleBulkImportSelectAllValid` | 8313 | → `useClientImportExport` |
| `handleBulkImportSelectAll` | 8324 | → `useClientImportExport` |
| `handleBulkImportClearSelection` | 8328 | → `useClientImportExport` |
| `handleBulkImportClose` | 8332 | → `useClientImportExport` |

### 7.12 Client Save / Delete / Form (→ **move to `useClientForm` hook**)
| Name | Lines | Classification |
|------|-------|----------------|
| `buildClientUpsertPayload` | 8843 | → `useClientForm` |
| `handleSalvarCliente` | 8914 | → `useClientForm` |
| `handleExcluirCliente` | 9524 | → `useClientForm` |
| `handleExportarParaCarteira` | 9671 | → `useClientForm` |
| `handleEditarCliente` | 10005 | → `useClientForm` |
| `syncClienteField` | 12157 | → `useClientForm` |
| `fecharClientesPainel` | 3157 | → `useClientForm` |
| `abrirClientesPainel` | 11730 | → should stay (nav orchestration) |

### 7.13 Image Upload (→ **move to `usePropostaImagens` hook**)
| Name | Lines | Classification |
|------|-------|----------------|
| `handleAbrirUploadImagens` | 10044 | → `usePropostaImagens` |
| `handleImagensSelecionadas` | 10048 | → `usePropostaImagens` |
| `handleRemoverPropostaImagem` | 10068 | → `usePropostaImagens` |

### 7.14 Print / Transfer Table (→ **move to `usePrintOrchestration` lib or component**)
| Name | Lines | Classification |
|------|-------|----------------|
| `handleImprimirTabelaTransferencia` | 10107 | → `usePrintOrchestration` |
| `resolvePreviewToolbarMessage` | 7352 | → `usePrintOrchestration` |
| `openBudgetPreviewWindow` | 7369 | → `usePrintOrchestration` |

### 7.15 Contract Generation (→ **move to `useContractActions` hook**)
| Name | Lines | Classification |
|------|-------|----------------|
| `prepararDadosContratoCliente` | 10189 | → `useContractActions` |
| `prepararPayloadContratosLeasing` | 10285 | → `useContractActions` |
| `carregarTemplatesContrato` | 10558 | → `useContractActions` |
| `carregarDisponibilidadeAnexos` | 10625 | → `useContractActions` |
| `handleToggleContractTemplate` | 10660 | → `useContractActions` |
| `handleSelectAllContractTemplates` | 10669 | → `useContractActions` |
| `handleToggleLeasingAnexo` | 10676 | → `useContractActions` |
| `handleSelectAllLeasingAnexos` | 10689 | → `useContractActions` |
| `handleFecharModalContratos` | 10712 | → `useContractActions` |
| `handleFecharLeasingContractsModal` | 10717 | → `useContractActions` |
| `salvarContratoNoOneDrive` | 10721 | → `useContractActions` |
| `abrirSelecaoContratos` | 10750 | → `useContractActions` |
| `handleGerarContratoLeasing` | 10770 | → `useContractActions` |
| `handleGerarContratoVendas` | 10809 | → `useContractActions` |
| `handleConfirmarGeracaoContratosVendas` | 10825 | → `useContractActions` |
| `handleConfirmarGeracaoLeasing` | 11153 | → `useContractActions` |
| `handleGerarContratosComConfirmacao` | 11689 | → `useContractActions` |

### 7.16 Proposal Save (→ **move to `useProposalSaveActions` hook**)
| Name | Lines | Classification |
|------|-------|----------------|
| `handleSalvarPropostaLeasing` | 11341 | → `useProposalSaveActions` |
| `handleSalvarPropostaPdf` | 11423 | → `useProposalSaveActions` |

### 7.17 Navigation / Proposal Lifecycle (→ **should stay** or move to `useNavigationState`)
| Name | Lines | Classification |
|------|-------|----------------|
| `abrirConfiguracoes` | 11781 | Should stay (nav orchestration) |
| `iniciarNovaProposta` | 11794 | Should stay (nav + reset orchestration) |
| `handleNovaProposta` | 12039 | Should stay |
| `handleNavigateToProposalTab` | 12073 | → `useNavigationState` |
| `voltarParaPaginaPrincipal` | 13283 | → `useNavigationState` |
| `createPageSharedSettings` | 2380 | → `usePageSharedSettings` |
| `updatePageSharedState` | 2402 | → `usePageSharedSettings` |

### 7.18 UC Beneficiária (→ belongs in `useMultiUcState`)
| Name | Lines | Classification |
|------|-------|----------------|
| `handleAdicionarUcBeneficiaria` | 12132 | → `useMultiUcState` |
| `handleAtualizarUcBeneficiaria` | 12136 | → `useMultiUcState` |
| `handleRemoverUcBeneficiaria` | 12153 | → `useMultiUcState` |

### 7.19 UC Geradora Titular / Corresponsável (→ **move to `useUcGeradoraTitular` hook**)
| Name | Lines | Classification |
|------|-------|----------------|
| `clearUcGeradoraTitularError` | 12304 | → `useUcGeradoraTitular` |
| `updateUcGeradoraTitularDraft` | 12318 | → `useUcGeradoraTitular` |
| `handleUcGeradoraTitularUfChange` | 12334 | → `useUcGeradoraTitular` |
| `handleUcGeradoraTitularDistribuidoraChange` | 12365 | → `useUcGeradoraTitular` |
| `buildUcGeradoraTitularErrors` | 12427 | → `useUcGeradoraTitular` |
| `handleImportEnderecoClienteParaUcGeradora` | 12504 | → `useUcGeradoraTitular` |
| `handleToggleUcGeradoraTitularDiferente` | 12592 | → `useUcGeradoraTitular` |
| `handleCancelarUcGeradoraTitular` | 12622 | → `useUcGeradoraTitular` |
| `handleSalvarUcGeradoraTitular` | 12642 | → `useUcGeradoraTitular` |
| `handleEditarUcGeradoraTitular` | 12691 | → `useUcGeradoraTitular` |
| `updateCorresponsavelDraft` | 12450 | → `useUcGeradoraTitular` |
| `updateCorresponsavelEndereco` | 12463 | → `useUcGeradoraTitular` |
| `buildCorresponsavelErrors` | 12476 | → `useUcGeradoraTitular` |
| `handleAbrirCorresponsavelModal` | 12540 | → `useUcGeradoraTitular` |
| `handleFecharCorresponsavelModal` | 12546 | → `useUcGeradoraTitular` |
| `handleSalvarCorresponsavel` | 12551 | → `useUcGeradoraTitular` |
| `handleDesativarCorresponsavel` | 12584 | → `useUcGeradoraTitular` |

### 7.20 Leasing Contract Proprietário / Herdeiros (→ **move to `useLeasingContractFields` hook**)
| Name | Lines | Classification |
|------|-------|----------------|
| `handleLeasingContratoCampoChange` | 12297 | → `useLeasingContractFields` |
| `handleLeasingContratoProprietarioChange` | 12714 | → `useLeasingContractFields` |
| `handleAdicionarContratoProprietario` | 12724 | → `useLeasingContractFields` |
| `handleRemoverContratoProprietario` | 12730 | → `useLeasingContractFields` |
| `handleHerdeiroChange` | 12742 | → `useLeasingContractFields` |
| `handleAdicionarHerdeiro` | 12758 | → `useLeasingContractFields` |
| `handleRemoverHerdeiro` | 12765 | → `useLeasingContractFields` |

### 7.21 Proposal Send (→ **move to `useProposalSend` hook**)
| Name | Lines | Classification |
|------|-------|----------------|
| `selecionarContatoEnvio` | 13297 | → `useProposalSend` |
| `fecharEnvioPropostaModal` | 13301 | → `useProposalSend` |
| `abrirEnvioPropostaModal` | 13305 | → `useProposalSend` |
| `handleEnviarProposta` | 13316 | → `useProposalSend` |

### 7.22 Saved Proposals / Budget Load (→ **move to `useProposalOrchestration` hook — already exists**)
| Name | Lines | Classification |
|------|-------|----------------|
| `abrirOrcamentoSalvo` | 13135 | → `useProposalOrchestration` |
| `confirmarRemocaoOrcamento` | 13182 | → `useProposalOrchestration` |
| `limparDadosModalidade` | 13205 | → `useProposalOrchestration` |
| `carregarOrcamentoSalvo` | 13217 | → `useProposalOrchestration` |

---

## 8. Inline JSX / Render Functions

| Name | Lines | Size | Classification |
|------|-------|------|----------------|
| `renderConfiguracaoUsinaSection` | 13414–13665 | ~251 lines | → `ConfiguracaoUsinaSection` component |
| `renderVendaParametrosSection` | 13666–13987 | ~321 lines | → `VendaParametrosSection` component |
| `renderVendaResumoPublicoSection` | 13988–14240 | ~252 lines | → `VendaResumoPublicoSection` component |
| `renderSimulacoesPage` | 14241–14428 | ~187 lines | → `SimulacoesPage` component (partially exists already via `SimulacoesTab`) |
| Main `return()` | 14429–15854 | ~1,425 lines | Root shell; **should stay** but decompose inner branches |

---

## 9. Business Logic Remaining in App.tsx

### 9.1 Direct API Calls (→ **move to service modules**)

| Endpoint | Lines | Target |
|----------|-------|--------|
| `GET /api/distribuidoras` (ANEEL) | 2738–2810 | → `useAneel` or `src/app/services/aneelService.ts` |
| `GET /api/contracts/templates` | 10564–10624 | → `useContractActions` |
| `GET /api/contracts/leasing/availability` | 10632–10659 | → `useContractActions` |
| `POST /api/contracts/render` | 11064 | → `useContractActions` |
| `POST /api/contracts/leasing` | 11235 | → `useContractActions` |
| `GET/POST /api/admin/database-backup` | 7938, 7998 | → `useClientImportExport` |
| `POST /api/proposals` (bulk load) | 13074 | → `useProposalOrchestration` |

### 9.2 Client Save Orchestration (→ **move to `useClientForm` hook**)
- Lines 8914–9412: full `handleSalvarCliente` with localStorage fallback, Neon upsert, form draft save/clear, auto-save scheduling, and sync state updates.

### 9.3 Contract Payload Builders (→ **move to `src/app/services/contractService.ts`**)
- Lines 10189–10284: `prepararDadosContratoCliente` — builds `ClienteContratoPayload` from client + leasing form state.
- Lines 10285–10557: `prepararPayloadContratosLeasing` — ~272 lines, builds full leasing contract payload.

### 9.4 Proposal Save (→ **move to `useProposalSaveActions` hook**)
- Lines 11341–11562: `handleSalvarPropostaLeasing` — multi-step save with validate, persist, OneDrive, notification.
- Lines 11423–11563: `handleSalvarPropostaPdf` — PDF render, blob creation, OneDrive upload.

### 9.5 `iniciarNovaProposta` (→ **should stay as orchestrator; internals can move**)
- Lines 11794–12038: resets all simulation state, clears form drafts, reloads stored proposals. Currently 244 lines; internal reset logic could move to `useProposalOrchestration`.

---

## 10. Storage Logic Remaining in App.tsx

| Location | Lines | Type | Classification |
|----------|-------|------|----------------|
| `density` → `localStorage` | 4570–4596 | Read/write UI pref | → `useDisplayPreferences` |
| `useBentoGridPdf` → `localStorage` | 4554–4595 | Read/write UI pref | → `useDisplayPreferences` |
| `mobileSimpleView` → `localStorage` | 4598–4623 | Read/write UI pref | → `useDisplayPreferences` |
| `desktopSimpleView` → `localStorage` | 4605–4637 | Read/write UI pref | → `useDisplayPreferences` |
| Client localStorage fallback in `handleSalvarCliente` | 9211–9244 | Fallback persist | → `useClientForm` |
| `handleClientesImportarArquivo` localStorage import | 8248–8279 | Import fallback | → `useClientImportExport` |
| `saveFormDraft` / `clearFormDraft` calls | 9278, 9287 | Draft persist | → `useClientForm` |

---

## 11. Modal Logic Remaining in App.tsx

| Modal State | Lines | Classification |
|-------------|-------|----------------|
| `saveDecisionPrompt` / `requestSaveDecision` / `resolveSaveDecisionPrompt` | 2120–2147 | → `useDialogOrchestration` |
| `confirmDialog` / `requestConfirmDialog` / `resolveConfirmDialog` | 2148–2172 | → `useDialogOrchestration` |
| `precheckModal*` | 3670–3792 | → `usePrecheckNormativo` |
| `isCorresponsavelModalOpen` | 3142 | → `useUcGeradoraTitular` |
| `isBackupModalOpen` | 3148 | → `useClientImportExport` |
| `isBulkImportPreviewOpen` | 3151 | → `useClientImportExport` |
| `isContractTemplatesModalOpen` | 4661 | → `useContractActions` |
| `isLeasingContractsModalOpen` | 4662 | → `useContractActions` |
| `clientReadinessErrors` | 4663 | → `useContractActions` |
| `isEnviarPropostaModalOpen` | 7694 | → `useProposalSend` |

Modal JSX rendering in `return()`:

| JSX Modal Block | Lines | Classification |
|-----------------|-------|----------------|
| `SaveChangesDialog` | ~15800–15810 | Should stay in return (global) |
| `ConfirmDialog` | ~15811–15821 | Should stay in return (global) |
| `ClientReadinessErrorModal` | ~15822–15830 | Should stay in return (global) |
| `EnviarPropostaModal` | ~15649–15658 | → `SimulacoesPage` or `useProposalSend` |
| `CorresponsavelModal` | ~15659–15692 | → `SimulacoesPage` leasing section |
| `BackupModal` | ~15693–15702 | → `ClientesPage` |
| `BulkImportPreview` | ~15703–15719 | → `ClientesPage` |
| `LeasingContractsModal` | ~15720–15734 | → `SimulacoesPage` leasing section |
| `ContractTemplatesModal` | ~15735–15758 | → `SimulacoesPage` |

---

## 12. Module-Level Helpers (387–1823) — Classification

These exist at module scope (outside `App()`). Most are correctly placed as pure helpers or constants.

| Category | Examples | Lines | Classification |
|----------|---------|-------|----------------|
| Pure normalizers | `normalizeCidade`, `normalizeTipoInstalacao`, `normalizeUfForProcuracao` | 391–925 | ✅ Stay as module helpers |
| Constants | `TUSD_TO_SEGMENTO`, `SEGMENTO_TO_TUSD`, `LUCRO_BRUTO_PADRAO`, `ECONOMIA_ESTIMATIVA_PADRAO_ANOS` | 480–590 | ✅ Stay or move to domain constants |
| Pure formatters | `formatQuantityInputValue`, `formatCurrencyInputValue`, `formatFileSize`, `formatList` | 619–737 | ✅ Move to `src/utils/formatters` |
| Budget computation | `computeBudgetItemsTotalValue`, `computeBudgetMissingInfo` | 696–723 | ✅ Stay or move to `src/utils/budget` |
| Image helpers | `loadImageDimensions`, `readPrintableImageFromFile`, `readBlobAsBase64` | 937–1012 | → Move to `src/lib/pdf/imageUtils` |
| Tariff input field | `useTarifaInputField` (a hook defined at module level!) | 1120–1248 | → Move to `src/hooks/useTarifaInputField.ts` |
| Stale stringify | `stableStringify` | 1013–1047 | → Move to `src/utils/serialize` |
| CSV/JSON export helpers | `buildClientesCsvRow`, `parseClientesCsvFile`, etc. | ~1380–1820 | → Move to `src/app/services/clientImportExport.ts` |
| Lazy component declarations | `PrintableProposal`, `PrintPageLeasing`, `LeasingBeneficioChart`, `SimulacoesTab` | 407–411 | ✅ Stay or move to lazy index |

---

## 13. Responsibility Classification Summary

| Responsibility Domain | Current State | Recommended Target |
|-----------------------|---------------|-------------------|
| Auth / RBAC / session | In App() | Should stay (already extracted helpers) |
| Theme / dark-mode | In App() | Should stay |
| Navigation / routing | Partially extracted (useNavigationState) | Should stay / small cleanup |
| Storage hydration | Extracted (useStorageHydration) | ✅ Done |
| Client state / CRUD | Partially extracted (useClientState) | → Complete useClientForm hook |
| Client import/export | In App() — ~40 callbacks | → useClientImportExport hook |
| Proposal orchestration | Partially extracted (useProposalOrchestration) | → Complete extraction |
| Proposal save | In App() — large async flows | → useProposalSaveActions hook |
| Proposal send (email/share) | In App() | → useProposalSend hook |
| Solar simulation engine | In App() — ~3,000 lines | → useSimulationEngine hook |
| CAPEX / Cost | In App() — ~600 lines | → useCapexState hook |
| Tariff params | In App() — ~400 lines | → useTariffParams hook |
| System config (tipoRede, etc.) | In App() — ~400 lines | → useSystemConfig hook |
| TUSD state | Extracted (useTusdState) | ✅ Done |
| Leasing simulation | Extracted (useLeasingSimulacaoState) | ✅ Done |
| Budget upload | Extracted (useBudgetUploadState) | ✅ Done |
| Multi-UC | Extracted (useMultiUcState) | ✅ Done |
| Financial analysis | Extracted (useAnaliseFinanceiraState) | ✅ Done |
| CRM | Extracted (useCrm) | ✅ Done |
| IBGE / CEP | In App() | → useCepLookup hook |
| Normative precheck | In App() — ~500 lines | → usePrecheckNormativo hook |
| UC Geradora / Corresponsável | In App() — ~400 lines | → useUcGeradoraTitular hook |
| Contract generation | In App() — ~1,200 lines | → useContractActions hook |
| Leasing contract fields | In App() — ~300 lines | → useLeasingContractFields hook |
| Print / PDF | Partially extracted (usePrintOrchestration) | → usePrintableData hook |
| Image upload | In App() | → usePropostaImagens hook |
| Dialog orchestration | In App() | → useDialogOrchestration hook |
| Notifications | In App() | → useNotifications hook |
| Display preferences | In App() | → useDisplayPreferences hook |
| Financing inputs | In App() | → useFinanciamentoState hook |
| Leasing cost config | In App() | → useLeasingCostConfig hook |
| Leasing view config | In App() | → useLeasingViewConfig hook |
| Render functions | In App() — 4 inline render fns | → Dedicated page/section components |
| Module-level helpers | Some misplaced (useTarifaInputField, CSV builders) | → Proper modules |
| Direct API calls | In App() callbacks | → Service modules |

---

## 14. What Should Stay in App.tsx

The following concerns are legitimately App-level and should remain:

1. **Auth / RBAC bootstrap** — `useStackUser`, `useStackRbac`, `useAuthSession`, `useAuthorizationSnapshot`, `isAdmin`, `getAccessToken`, `handleLogout`
2. **Theme** — `useTheme`, `theme` state, OS dark-mode `matchMedia` listener
3. **Anti-overlay** — `removeFogOverlays` / `watchFogReinjection` on mount
4. **Unsaved-changes guard** — `hasUnsavedChanges`, `runWithUnsavedChangesGuard`, `beforeunload` listener
5. **Save / confirm dialog orchestration** — `requestSaveDecision`, `requestConfirmDialog` and their resolve callbacks (cross-domain)
6. **Top-level navigation** — `abrirClientesPainel`, `abrirConfiguracoes`, `iniciarNovaProposta` (these cross domain boundaries)
7. **`guardRef.current` / `applyDraftRef.current` wiring** — late-binding refs for hook communication
8. **Root JSX shell** — `AppShell` + `AppRoutes` + global modals (`SaveChangesDialog`, `ConfirmDialog`, `ClientReadinessErrorModal`) + toast stack

---

## 15. Suggested Next Extraction Priorities

Ordered by impact / risk:

| Priority | Target Hook/Module | Current lines freed | Risk |
|----------|-------------------|---------------------|------|
| 1 | `useNotifications` | ~120 | Low |
| 2 | `useDisplayPreferences` | ~120 | Low |
| 3 | `useDialogOrchestration` | ~80 | Low |
| 4 | `useCepLookup` | ~300 | Medium |
| 5 | `useUcGeradoraTitular` | ~450 | Medium |
| 6 | `useClientImportExport` | ~700 | Medium |
| 7 | `useProposalSend` | ~200 | Medium |
| 8 | `useContractActions` | ~1,500 | High |
| 9 | `useSystemConfig` + `useTariffParams` | ~900 | High |
| 10 | `useSimulationEngine` (umbrella) | ~3,000+ | High |

---

*This map is a snapshot. Update it after each extraction PR.*
