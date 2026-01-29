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
})
