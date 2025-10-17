import { describe, expect, it } from 'vitest'

import { analyzeEssentialInfo, classifyBudgetItem, sumModuleQuantities } from '../moduleDetection'

describe('moduleDetection utilities', () => {
  it('classifyBudgetItem identifica módulos e inversores', () => {
    expect(
      classifyBudgetItem({
        product: 'Módulo Solar 550W',
        description: 'Painel fotovoltaico',
      }),
    ).toBe('module')

    expect(
      classifyBudgetItem({
        product: 'Inversor Solar 5kW',
        description: 'String inverter',
      }),
    ).toBe('inverter')

    expect(
      classifyBudgetItem({
        product: 'Estrutura modular',
        description: 'Estrutura para módulos',
      }),
    ).toBeNull()
  })

  it('sumModuleQuantities soma apenas itens de módulos', () => {
    const structured = [
      {
        produto: 'Módulo 550W',
        descricao: 'Módulo monocristalino',
        modelo: 'XYZ',
        fabricante: 'SolarX',
        quantidade: 8,
      },
      {
        produto: 'Estrutura modular',
        descricao: 'Estrutura para telhado',
        modelo: null,
        fabricante: null,
        quantidade: 20,
      },
      {
        produto: 'Inversor Solar',
        descricao: 'Inversor 5kW',
        modelo: null,
        fabricante: null,
        quantidade: 1,
      },
    ] as any

    expect(sumModuleQuantities(structured)).toBe(8)
  })

  it('analyzeEssentialInfo detecta campos ausentes por categoria', () => {
    const analysis = analyzeEssentialInfo([
      {
        id: 'module-1',
        product: 'Módulo 550W',
        description: '',
        quantity: 8,
      },
      {
        id: 'inversor-1',
        product: 'Inversor Solar',
        description: 'Inversor monofásico',
        quantity: null,
      },
    ])

    expect(analysis.modules.hasAny).toBe(true)
    expect(analysis.modules.hasProduct).toBe(true)
    expect(analysis.modules.hasDescription).toBe(false)
    expect(analysis.modules.missingFields).toContain('descrição')

    expect(analysis.inverter.hasAny).toBe(true)
    expect(analysis.inverter.hasQuantity).toBe(false)
    expect(analysis.inverter.missingFields).toContain('quantidade')
  })
})

