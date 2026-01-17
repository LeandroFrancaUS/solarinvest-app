# Testing Guide - Six Feature Requests
## How to Verify Each Implementation

This document provides step-by-step instructions to verify that all six feature requests have been properly addressed.

---

## REQUEST 1: "Ver propostas" Button - List & Load Existing Proposals

### How to Test
1. Navigate to the main application
2. Click on the "Ver propostas" button in the menu (📂 icon)
3. Verify that the "Consultar orçamentos" page opens
4. Check that existing proposals are displayed in the table

### Expected Behavior
✅ Page opens successfully without errors
✅ Proposals from DB and/or localStorage are displayed
✅ If OneDrive is not configured, see console.info message (not a blocking error)
✅ Can search, view, load, and delete proposals

### Success Criteria
- **With DB connected**: Proposals load from database
- **Without DB**: Proposals load from localStorage
- **Without OneDrive**: Console shows info message, but proposals still display
- **Empty state**: Shows "Nenhum orçamento foi salvo ainda"

### Code Reference
- Function: `abrirPesquisaOrcamentos()` at line 14160
- Page render: `renderBudgetSearchPage()` at line 19970
- Load logic: `carregarOrcamentosPrioritarios()` at line 12112

---

## REQUEST 2: Fix "Atualizar cliente" Not Saving Latest Changes

### How to Test
1. Load an existing cliente or create a new one
2. Fill in multiple fields (nome, documento, endereço, consumo, etc.)
3. Click "Atualizar cliente" or "Salvar cliente"
4. Navigate away or reload the app
5. Load the same cliente again
6. Verify all changes were saved

### Test Scenarios
**Scenario A: Quick Sequential Changes**
1. Load cliente
2. Change endereço field
3. Immediately change consumo field
4. Click save within 1 second
5. Verify both changes saved

**Scenario B: Checkbox and Text Fields**
1. Load cliente
2. Toggle "Mesmo endereço do contratante" checkbox
3. Change endereço da instalação
4. Click save
5. Reload → verify both saved

**Scenario C: Complex Fields**
1. Add multiple herdeiros
2. Change síndico information
3. Modify vencimento date
4. Click save
5. Reload → verify all saved

### Expected Behavior
✅ All field changes persist after save
✅ No "rollback" of any field values
✅ Works both online (DB) and offline (localStorage)
✅ `lastSavedClienteRef` tracks saved state accurately

### Success Criteria
- After save: `lastSavedClienteRef.current` matches saved data
- After load: All fields display saved values
- No console errors about persistence

### Code Reference
- Save function: `handleSalvarCliente()` at line 11561
- Ref tracking: Lines 11726, 11802, 11893, 12204, 14336

---

## REQUEST 3: Proposal Snapshot - Save ALL Fields Without Exception

### How to Test
1. Create a comprehensive proposal with:
   - Cliente data (all fields filled)
   - UC beneficiárias (multiple UCs)
   - Budget items (manual or OCR)
   - Tarifa and distribuidora settings
   - Sistema configuration (ON_GRID/HYBRID/OFF_GRID)
   - Número de módulos (manual override)
   - Leasing or Vendas specific fields
   - Multi-UC configuration (if applicable)
   - Financial parameters (juros, prazo, entrada)
   - Composição UFV (telhado/solo)
   - Impostos overrides
   - Proposta images

2. Save the proposal
3. Close and reopen the app
4. Load the saved proposal
5. Verify EVERY field is restored exactly

### Fields to Verify
**Core Cliente:**
- ✅ Nome, documento, RG, email, telefone
- ✅ Endereço completo (CEP, cidade, UF)
- ✅ Distribuidora, UC, dia vencimento
- ✅ Herdeiros (all entries)
- ✅ Síndico information

**System Configuration:**
- ✅ Tipo instalação, tipo sistema, segmento
- ✅ Potência módulo, número módulos
- ✅ Irradiação, eficiência

**Financial:**
- ✅ Tarifa, desconto, taxa mínima
- ✅ TUSD percentual, tipo cliente, subtipo
- ✅ Prazo leasing/financiamento
- ✅ Juros, entrada (Rs and %)
- ✅ Cashback, depreciação, inadimplência

**Advanced:**
- ✅ Multi-UC rows and rateio
- ✅ Composição telhado/solo
- ✅ Budget structured items
- ✅ Proposta images (base64)
- ✅ Vendas/Leasing specific configs

### Expected Behavior
✅ All 80+ snapshot fields restored perfectly
✅ No field "resets" or "disappears"
✅ Complex nested objects preserved (multi-UC, composição)
✅ Arrays maintained (UC beneficiárias, herdeiros, images)

### Success Criteria
- Open saved proposal → all fields match what was saved
- No console warnings about missing fields
- TypeScript compile succeeds (type safety)

### Code Reference
- Snapshot creation: `getCurrentSnapshot()` at line 11419
- Type definition: `OrcamentoSnapshotData` at line 876
- Apply snapshot: `aplicarSnapshot()` at line 12178

---

## REQUEST 4: Save Generated Contracts to OneDrive Folder

### How to Test

**Test A: With Native Bridge (Electron/WebView)**
1. Configure native bridge: `window.solarinvestNative.saveFile`
2. Generate a contract (Vendas or Leasing)
3. Check that file appears in: `/Users/leandrofranca/Library/CloudStorage/OneDrive-Personal/Contratos gerados`

**Test B: With OneDrive Endpoint**
1. Set `VITE_ONEDRIVE_SYNC_ENDPOINT` environment variable
2. Generate a contract
3. Verify POST request sent to endpoint with base64 PDF

**Test C: Without OneDrive (Browser Download)**
1. No bridge, no endpoint configured
2. Generate a contract
3. Browser download dialog appears
4. User manually saves PDF file

### Expected Behavior
✅ **Native bridge active**: File saved to OneDrive folder automatically
✅ **Endpoint active**: File sent via HTTP POST
✅ **Neither available**: Browser download triggered
✅ User notified of save status with appropriate message

### Notification Messages
- ✅ Success: "Contrato salvo com sucesso"
- ℹ️ Warning: "Integração com o OneDrive indisponível..."
- ❌ Error: "Não foi possível salvar o contrato..."

### Success Criteria
- Contract always generated (never fails completely)
- Fallback chain executes correctly
- No JavaScript errors in console

### Code Reference
- Save function: `salvarContratoNoOneDrive()` at line 13300
- OneDrive persist: `persistContratoToOneDrive()` in utils/onedrive.ts at line 368
- Fallback download: Lines 13647-13653, 13822-13828

---

## REQUEST 5: Show "Atualizar cliente" Button Only When Changed

### How to Test

**Test A: Load Existing Cliente**
1. Click "Ver clientes"
2. Select and load an existing cliente
3. **Verify**: "Atualizar cliente" button is HIDDEN
4. Change any field (e.g., email)
5. **Verify**: "Atualizar cliente" button APPEARS
6. Click save
7. **Verify**: Button DISAPPEARS again

**Test B: Create New Cliente**
1. Start with empty form (new cliente)
2. **Verify**: "Salvar cliente" button is VISIBLE
3. Fill in required fields
4. **Verify**: Button still shows "Salvar cliente"
5. Click save
6. **Verify**: Button changes to hidden (now editing mode)

**Test C: Multiple Edits**
1. Load cliente
2. Change field → button appears
3. Change back to original value → button disappears
4. Change to different value → button appears again

### Visual States
```
New Cliente:
  [Salvar cliente]  [Ver clientes]

Editing (No Changes):
  [Ver clientes]

Editing (Has Changes):
  [Atualizar cliente]  [Ver clientes]
```

### Expected Behavior
✅ Button hidden when editing without changes
✅ Button appears immediately when field changes
✅ Button label reflects context: "Salvar" vs "Atualizar"
✅ Smooth UX with no flickering

### Success Criteria
- `clienteFormularioAlterado` accurately detects changes
- Button visibility updates in real-time
- No "phantom" button states

### Code Reference
- Button rendering: Lines 15768-15776
- Dirty check: `clienteFormularioAlterado` at lines 11818-11835
- Ref tracking: `lastSavedClienteRef` usage

---

## REQUEST 6: Always-On Local Persistence with DB Sync

### How to Test

**Test A: Offline Persistence**
1. Disconnect from network (airplane mode)
2. Create/edit cliente or proposal
3. Click save
4. Close browser
5. Reopen browser (still offline)
6. **Verify**: Data is still there (localStorage)

**Test B: Online Sync**
1. Connect to network
2. Create/edit cliente or proposal
3. Click save
4. **Verify**: Data saved to both localStorage AND DB
5. Open app on different device/browser
6. **Verify**: Data syncs from DB

**Test C: Conflict Resolution**
1. Device A: Edit cliente offline → save locally
2. Device B: Edit same cliente offline → save locally
3. Device A: Go online → syncs to DB
4. Device B: Go online → syncs to DB
5. **Verify**: Last update wins (timestamp-based)

**Test D: Quota Management**
1. Create many large proposals (with images)
2. Save until localStorage quota nearly full
3. **Verify**: Oldest proposals pruned automatically
4. **Verify**: Current proposal always saves
5. **Verify**: User notified of pruned proposals

### Expected Behavior
✅ **Offline**: Always saves to localStorage
✅ **Online**: Saves to localStorage + DB
✅ **Sync**: Fetches from DB on load
✅ **Conflicts**: Last-write-wins by `updatedAt`
✅ **Quota**: Automatic pruning with user notification

### Storage Keys
- Proposals: `solarinvest-orcamentos`
- Clientes: `solarinvest-clientes`

### Success Criteria
- Never lose data (localStorage always works)
- Multi-device sync works when online
- Graceful degradation when DB unavailable
- No infinite sync loops

### Code Reference
- Local persist: `persistBudgetsToLocalStorage()` at line 1101
- DB sync: `persistRemoteStorageEntry()` calls at lines 11689, 12128
- DB fetch: `fetchRemoteStorageEntry()` calls at lines 12119
- Conflict resolution: Implicit in sync logic (timestamp comparison)

---

## Visual Verification Checklist

### UI Elements to Check
- [ ] "Ver propostas" button in menu (📂)
- [ ] "Consultar orçamentos" page with search
- [ ] Proposals table with actions (👁, 📂, ⤓, 🗑)
- [ ] "Atualizar cliente" button visibility toggle
- [ ] "Salvar cliente" button (new cliente)
- [ ] Contract generation success messages
- [ ] OneDrive integration warnings (if applicable)

### Console Messages (Acceptable)
- ℹ️ `"Leitura via OneDrive ignorada: integração não configurada."` - INFO only
- ℹ️ `"Sincronização com o OneDrive ignorada: integração não configurada."` - INFO only
- ⚠️ `"Não foi possível carregar orçamentos do banco de dados."` - Falls back to local

### Console Messages (Should NOT Appear)
- ❌ Uncaught errors
- ❌ Failed state updates
- ❌ Missing snapshot fields
- ❌ Quota errors (unless legitimately full)

---

## Automated Testing Commands

```bash
# Build check
npm run build

# Type check
npm run typecheck

# Lint check
npm run lint

# Run tests (note: jsdom dependency issue exists)
npm run test

# Check circular dependencies
npm run check:cycles

# Check locale usage
npm run check:locale
```

---

## Success Criteria Summary

All six requests are **PASSED** if:
1. ✅ "Ver propostas" opens and lists proposals from any available source
2. ✅ Cliente save persists all fields without loss
3. ✅ Proposal snapshot restores 100% of form state
4. ✅ Contracts save to OneDrive or download as fallback
5. ✅ "Atualizar cliente" button appears only when dirty
6. ✅ Offline-first persistence always works, syncs when online

---

*Testing Guide*
*Generated: January 17, 2026*
*Branch: copilot/add-view-proposals-button*
