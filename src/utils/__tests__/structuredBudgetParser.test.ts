import { describe, expect, it } from 'vitest'

import {
  deriveSection,
  parseStructuredBudget,
  structuredBudgetToCsv,
  type StructuredBudget,
} from '../structuredBudgetParser'

describe('deriveSection', () => {
  it('anchors items after "Produto  Quantidade" and before "Valor total:"', () => {
    const lines = [
      'Detalhes do Orçamento',
      'Potência do sistema',
      'Produto   Quantidade',
      'Modulo X  ...',
      'Código: AAA Modelo: BBB 3',
      'Valor total: R$ 8.872,02',
    ]

    const { section } = deriveSection(lines)

    expect(section[0]).toMatch(/Modulo X/)
    expect(section[section.length - 1]).not.toMatch(/Valor total/i)
  })
})

describe('parseStructuredBudget', () => {
  it('parses code, model, and trailing quantity on a single line', () => {
    const lines = [
      'Número do Orçamento: WEB-004480742',
      'Orçamento Válido até: 12-10-2025',
      'De: Fornecedor X',
      'Para: Cliente Y',
      'Produto  Quantidade',
      'Modulo Bifacial 610W',
      'Código: MFOS-1.2-BF-132-610W Modelo: ODA610-33V-MHDRz 5',
      'Valor total: R$ 0,00',
    ]

    const result = parseStructuredBudget(lines)
    expect(result.header.validade).toBe('2025-10-12')
    expect(result.itens).toHaveLength(1)
    const item = result.itens[0]
    expect(item.produto).toBe('Modulo Bifacial 610W')
    expect(item.codigo).toBe('MFOS-1.2-BF-132-610W')
    expect(item.modelo).toBe('ODA610-33V-MHDRz')
    expect(item.quantidade).toBe(5)
    expect(item.precoUnitario).toBeNull()
    expect(item.precoTotal).toBeNull()
  })

  it('keeps precoUnitario/precoTotal null when not present; parses footer total', () => {
    const lines = [
      'Produto  Quantidade',
      'Modulo X',
      'Código: AAA Modelo: BBB 2',
      'Valor total: R$ 1.234,56',
    ]

    const data = parseStructuredBudget(lines)
    expect(data.itens).toHaveLength(1)
    expect(data.itens[0].precoUnitario).toBeNull()
    expect(data.itens[0].precoTotal).toBeNull()
    expect(data.resumo.valorTotal).toBeCloseTo(1234.56, 2)
  })

  it('merges adjacent duplicates by (codigo, modelo) summing quantity', () => {
    const lines = [
      'Produto  Quantidade',
      'Item A',
      'Código: AAA Modelo: BBB 2',
      'Item A bis',
      'Código: AAA Modelo: BBB 3',
      'Valor total: R$ 0,00',
    ]

    const data = parseStructuredBudget(lines)
    expect(data.itens.length).toBe(1)
    expect(data.itens[0].quantidade).toBe(5)
  })
})

describe('structuredBudgetToCsv', () => {
  it('builds CSV rows according to spec', () => {
    const structured: StructuredBudget = {
      header: {
        numeroOrcamento: 'WEB-004480742',
        validade: '2025-10-12',
        de: 'Fornecedor X',
        para: 'Cliente Y',
      },
      itens: [
        {
          produto: 'Item 1',
          codigo: 'COD1',
          modelo: 'MOD1',
          descricao: 'Descrição 1',
          quantidade: 2,
          unidade: 'un',
          precoUnitario: 100.5,
          precoTotal: 201,
        },
      ],
      resumo: {
        valorTotal: 201,
        moeda: 'BRL',
      },
      warnings: [],
    }

    const csv = structuredBudgetToCsv(structured)

    expect(csv.split('\n')).toEqual([
      'numeroOrcamento;validade;de;para;produto;codigo;modelo;descricao;quantidade;unidade;precoUnitario;precoTotal;valorTotal',
      'WEB-004480742;2025-10-12;Fornecedor X;Cliente Y;Item 1;COD1;MOD1;Descrição 1;2;un;100.50;201.00;201.00',
    ])
  })
})

