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
    // Reads App.tsx as raw text and asserts that the `kcKwhMes` useState declaration
    // appears in the source BEFORE the useEffect that lists it in its dependency array.
    // This prevents a regression of the production TDZ crash where Terser would evaluate
    // the deps array before the `const [kcKwhMes, ...]` initializer had run.
    const appSrc = readFileSync(
      resolve(__dirname, '../../../src/App.tsx'),
      'utf8',
    )
    const declIndex = appSrc.indexOf('const kcKwhMes = useConsumoBaseStore(')
    // After the fix, simulacoesSection was removed from this dep array so that
    // auto-population of afCustoKit/afFrete runs regardless of the active section.
    // The guard here now checks for the updated dep array pattern.
    const depsIndex = appSrc.indexOf('[kcKwhMes, afConsumoOverride,')
    expect(declIndex).toBeGreaterThan(0)
    expect(depsIndex).toBeGreaterThan(0)
    expect(declIndex).toBeLessThan(depsIndex)
  })
})
