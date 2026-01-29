import { describe, expect, it } from 'vitest'

import {
  parseStructuredBudget,
  structuredBudgetToCsv,
  type StructuredBudget,
} from '../structuredBudgetParser'

describe('parseStructuredBudget', () => {
  it('extrai itens principais entre cabeçalho e valor total', () => {
    const lines = [
      'Número do Orçamento: WEB-004480742',
      'Orçamento Válido até: 12-10-2025',
      'De: Fornecedor X',
      'Para: Cliente Y',
      'Produto Quantidade',
      'MÓDULO BIFACIAL 610W LONGI',
      'Qtd: 8 un',
      'Inversor Deye 8KW trifásico',
      'Quantidade: 1',
      'Valor total: R$ 23.580,00',
    ]

    const result = parseStructuredBudget(lines)

    expect(result.header.numeroOrcamento).toBe('WEB-004480742')
    expect(result.header.validade).toBe('2025-10-12')
    expect(result.header.de).toBe('Fornecedor X')
    expect(result.header.para).toBe('Cliente Y')

    expect(result.itens).toHaveLength(2)
    expect(result.itens[0]).toMatchObject({
      produto: 'MÓDULO BIFACIAL 610W LONGI',
      quantidade: 8,
      unidade: 'UN',
    })
    expect(result.itens[1]).toMatchObject({
      produto: 'Inversor Deye 8KW trifásico',
      quantidade: 1,
    })

    expect(result.resumo.valorTotal).toBeCloseTo(23580, 2)
    expect(result.meta.ignoredByNoise).toBe(0)
    expect(result.meta.ignoredByValidation).toBe(0)
    expect(result.warnings).toHaveLength(0)
  })

  it('ignora linhas de contato e contabiliza itens invalidados', () => {
    const lines = [
      'Produto Quantidade',
      'Telefone: (62) 99999-9999',
      'MODULO BIFACIAL 610W',
      'Quantidade: 8',
      'email: vendas@empresa.com',
      'Observações comerciais',
      'Inversor Trifásico 8kW',
      'Valor total: R$ 0,00',
    ]

    const result = parseStructuredBudget(lines)

    expect(result.itens).toHaveLength(2)
    expect(result.meta.ignoredByNoise).toBeGreaterThan(0)
    expect(result.meta.ignoredByValidation).toBe(0)
    expect(result.warnings).toEqual([])
  })

  it('emite aviso quando nenhum item é identificado', () => {
    const lines = ['Produto Quantidade', 'Telefone: (11) 0000-0000', 'Valor total: R$ 0,00']

    const result = parseStructuredBudget(lines)

    expect(result.itens).toHaveLength(0)
    expect(result.warnings).toContain('Não foi possível identificar a lista de itens.')
  })
})

describe('structuredBudgetToCsv', () => {
  it('gera CSV com cabeçalho padrão', () => {
    const structured: StructuredBudget = {
      header: {
        numeroOrcamento: 'ABC-123',
        validade: '2025-05-10',
        de: 'Fornecedor X',
        para: 'Cliente Y',
      },
      itens: [
        {
          produto: 'Módulo 550W',
          codigo: null,
          modelo: null,
          fabricante: null,
          descricao: '—',
          quantidade: 8,
          unidade: 'UN',
          precoUnitario: null,
          precoTotal: null,
        },
      ],
      resumo: { valorTotal: 15000, moeda: 'BRL' },
      warnings: [],
      meta: { ignoredByNoise: 0, ignoredByValidation: 0 },
    }

    const csv = structuredBudgetToCsv(structured)
    expect(csv.split('\n')).toHaveLength(2)
    expect(csv).toContain('ABC-123;2025-05-10;Fornecedor X;Cliente Y;Módulo 550W')
  })
})
