import { describe, expect, test, vi } from 'vitest'

const loadModules = async (paths: string[]) => {
  const modules = [] as unknown[]
  for (const path of paths) {
    // eslint-disable-next-line no-await-in-loop
    const mod = await import(path)
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
    const fs = require('fs') as typeof import('fs')
    const path = require('path') as typeof import('path')
    const appSrc = fs.readFileSync(
      path.resolve(__dirname, '../../../src/App.tsx'),
      'utf8',
    )
    const declIndex = appSrc.indexOf('const [kcKwhMes, setKcKwhMesState]')
    const depsIndex = appSrc.indexOf('[simulacoesSection, kcKwhMes,')
    expect(declIndex).toBeGreaterThan(0)
    expect(depsIndex).toBeGreaterThan(0)
    expect(declIndex).toBeLessThan(depsIndex)
  })
})
