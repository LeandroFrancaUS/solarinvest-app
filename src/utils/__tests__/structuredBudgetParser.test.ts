import { describe, expect, it } from 'vitest'

import {
  parseStructuredBudget,
  structuredBudgetToCsv,
  type StructuredBudget,
} from '../structuredBudgetParser'

describe('parseStructuredBudget', () => {
  it('extracts header, items and totals from well-formed lines', () => {
    const lines = [
      'Número do Orçamento: WEB-004480742',
      'Orçamento Válido até: 12-10-2025',
      'De: 60.434.015 LEANDRO LIMA RIBEIRO FRANCA',
      'Para: Ricardo df',
      'Detalhes do Orçamento',
      'Modulo Bifacial 132 Cel. N Type 610w Cabo 1.2m Osda - Painel solar de alta eficiência',
      'Código: MFOS-1.2-BF-132-610W',
      'Modelo: ODA610-33V-MHDRz',
      'Quantidade: 5 un',
      'R$ 1.774,40 R$ 8.872,00',
      'Valor total: R$ 8.872,02',
    ]

    const result = parseStructuredBudget(lines)

    expect(result.header).toEqual({
      numeroOrcamento: 'WEB-004480742',
      validade: '2025-10-12',
      de: '60.434.015 LEANDRO LIMA RIBEIRO FRANCA',
      para: 'Ricardo df',
    })

    expect(result.itens).toHaveLength(1)
    const item = result.itens[0]
    expect(item.produto).toBe(
      'Modulo Bifacial 132 Cel. N Type 610w Cabo 1.2m Osda',
    )
    expect(item.descricao).toBe('Painel solar de alta eficiência')
    expect(item.codigo).toBe('MFOS-1.2-BF-132-610W')
    expect(item.modelo).toBe('ODA610-33V-MHDRz')
    expect(item.quantidade).toBe(5)
    expect(item.unidade).toBe('un')
    expect(item.precoUnitario).toBeCloseTo(1774.4)
    expect(item.precoTotal).toBeCloseTo(8872)

    expect(result.resumo).toEqual({ valorTotal: 8872.02, moeda: 'BRL' })
  })

  it('merges duplicate items that share codigo and modelo', () => {
    const lines = [
      'Detalhes do Orçamento',
      'Inversor Solar Premium',
      'Código: INV-123',
      'Modelo: X1',
      'Quantidade: 2',
      'R$ 3.000,00 R$ 6.000,00',
      'Inversor Solar Premium',
      'Código: INV-123',
      'Modelo: X1',
      'Quantidade: 1',
      'R$ 3.000,00 R$ 3.000,00',
      'Valor total: R$ 9.000,00',
    ]

    const result = parseStructuredBudget(lines)

    expect(result.itens).toHaveLength(1)
    expect(result.itens[0].quantidade).toBe(3)
    expect(result.itens[0].precoUnitario).toBe(3000)
    expect(result.itens[0].precoTotal).toBe(6000)
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

