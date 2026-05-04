import { readFileSync } from 'fs'
import { resolve } from 'path'
import { describe, expect, test, vi } from 'vitest'

const loadModules = async (paths: string[]) => {
  const modules: unknown[] = []
  for (const path of paths) {
    const mod: unknown = await import(/* @vite-ignore */ path)
    modules.push(mod)
  }
  return modules
}

describe('cycles and TDZ guard rails', () => {
  test('importar stores antes dos componentes não gera ReferenceError', async () => {
    vi.resetModules()
    await expect(
      loadModules([
        '../../store/useVendaStore.ts',
        '../../store/useLeasingStore.ts',
        '../../components/print/PrintableProposal.tsx',
      ]),
    ).resolves.toBeTruthy()
  })

  test('importar componentes antes das stores não gera ReferenceError', async () => {
    vi.resetModules()
    await expect(
      loadModules([
        '../../components/print/PrintableProposal.tsx',
        '../../store/useVendaStore.ts',
        '../../store/useLeasingStore.ts',
      ]),
    ).resolves.toBeTruthy()
  })

  test('kcKwhMes é declarado antes do useEffect que o usa como dep (guard TDZ)', () => {
    // Reads App.tsx and the hook file as raw text to assert:
    // 1. The `kcKwhMes` useState declaration still appears early in App.tsx.
    // 2. The kit/frete auto-populate effect (with kcKwhMes in its deps) lives in
    //    the extracted hook — not in App.tsx — so TDZ in App.tsx is no longer possible.
    // 3. App.tsx passes kcKwhMes to the hook AFTER declaring it (no TDZ path).
    const appSrc = readFileSync(
      resolve(__dirname, '../../../src/App.tsx'),
      'utf8',
    )
    const hookSrc = readFileSync(
      resolve(__dirname, '../../features/simulacoes/useAnaliseFinanceiraState.ts'),
      'utf8',
    )
    // 1. kcKwhMes must still be declared early in App.tsx
    const declIndex = appSrc.indexOf('const [kcKwhMes, setKcKwhMesState]')
    expect(declIndex).toBeGreaterThan(0)

    // 2. The kit/frete effect deps now live in the hook, not App.tsx
    expect(appSrc.indexOf('[kcKwhMes, afConsumoOverride,')).toBe(-1)
    expect(hookSrc.indexOf('[kcKwhMes, afConsumoOverride,')).toBeGreaterThan(0)

    // 3. App.tsx passes kcKwhMes to the hook after declaring it
    const hookCallIndex = appSrc.indexOf('} = useAnaliseFinanceiraState({')
    expect(hookCallIndex).toBeGreaterThan(declIndex)
  })
})
