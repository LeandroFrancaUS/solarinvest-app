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
      'Produto  Quantidade',
      'MODULO BIFACIAL 610W CABO 1.2M OSDA',
      'Código: MFOS-1.2-BF-132-610W Modelo: ODA610-33V-MHDRz',
      'Fabricante: OSDA',
      '8',
      'Valor total: R$ 9.008,41',
      'Dados do cliente',
    ]

    const { section } = deriveSection(lines)

    expect(section[0]).toMatch(/MODULO BIFACIAL/)
    expect(section[section.length - 1]).not.toMatch(/Valor total/i)
    expect(section.some((line) => /Dados do cliente/i.test(line))).toBe(false)
  })
})

describe('parseStructuredBudget', () => {
  it('parses code, model, and trailing quantity on a single line', () => {
    const lines = [
      'Número do Orçamento: WEB-004480742',
      'Orçamento Válido até: 12-10-2025',
      'De: Fornecedor X',
      'Para: Cliente Y',
      'Detalhes do Orçamento',
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
    expect(item.descricao).toContain('Código: MFOS-1.2-BF-132-610W')
    expect(item.descricao).toContain('Modelo: ODA610-33V-MHDRz')
    expect(item.precoUnitario).toBeNull()
    expect(item.precoTotal).toBeNull()
  })

  it('keeps precoUnitario/precoTotal null when not present; parses footer total', () => {
    const lines = [
      'Detalhes do Orçamento',
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

  it('does not infer quantity when it is absent', () => {
    const lines = [
      'Detalhes do Orçamento',
      'Produto  Quantidade',
      'Estrutura de fixação',
      'Descrição: Componentes para instalação',
      'Valor total: R$ 0,00',
    ]

    const data = parseStructuredBudget(lines)
    expect(data.itens).toHaveLength(1)
    expect(data.itens[0].quantidade).toBeNull()
  })

  it('merges adjacent duplicates by (codigo, modelo) summing quantity', () => {
    const lines = [
      'Detalhes do Orçamento',
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

  it('reconstructs produto, descricao e quantidade ignorando dados do cliente', () => {
    const lines = [
      'Detalhes do Orçamento',
      'Dados do cliente',
      'Produto Quantidade',
      'Cliente: Fulano da Silva',
      'MODULO BIFACIAL 132 CEL. N TYPE 610W CABO 1.2M OSDA',
      'Código: MFOS-1.2-BF-132-610W',
      'Modelo: ODA610-33V-MHDRz',
      'Fabricante: OSDA',
      '8',
      'brsolarinvest@gmail.com',
      'Valor total: R$ 10.000,00',
    ]

    const data = parseStructuredBudget(lines)
    expect(data.itens).toHaveLength(1)
    const item = data.itens[0]
    expect(item.produto).toBe('MODULO BIFACIAL 132 CEL. N TYPE 610W CABO 1.2M OSDA')
    expect(item.descricao).toContain('Código: MFOS-1.2-BF-132-610W')
    expect(item.descricao).toContain('Modelo: ODA610-33V-MHDRz')
    expect(item.descricao).toContain('Fabricante: OSDA')
    expect(item.quantidade).toBe(8)
  })

  it('descarta blocos quando somente dados de contato são encontrados', () => {
    const lines = [
      'Detalhes do Orçamento',
      'Produto Quantidade',
      'Telefone: (62) 99999-9999',
      'E-mail: teste@dominio.com',
      'Anápolis - GO',
      'Valor total: R$ 0,00',
    ]

    const data = parseStructuredBudget(lines)
    expect(data.itens).toHaveLength(0)
  })

  it('interpreta quantidades com unidade e ignora seções extras do orçamento', () => {
    const lines = [
      'Proposta Comercial',
      'Cotação WEB-004504319',
      'Entrega Escolhida',
      'Detalhes do Orçamento',
      'Produto  Quantidade',
      'MODULO BIFACIAL 132 CEL. HJT 700W CABO 1.4M RISEN',
      'Código: RSN700 Modelo: ABC123',
      'Fabricante: RISEN',
      '8 JG',
      'ESTRUTURA PERFIL C DE MONTAGEM 2 PEÇAS',
      'Modelo: PERFIL-C',
      'Quantidade: 32 JG',
      'Potência do sistema: 32,9 kWp',
      'Valor total: R$ 123.456,78',
      'Condição de Pagamento: PIX',
    ]

    const data = parseStructuredBudget(lines)
    expect(data.itens).toHaveLength(2)

    const [modulo, estrutura] = data.itens
    expect(modulo.produto).toBe('MODULO BIFACIAL 132 CEL. HJT 700W CABO 1.4M RISEN')
    expect(modulo.quantidade).toBe(8)
    expect(modulo.unidade).toBe('JG')
    expect(modulo.descricao).toContain('Código: RSN700')
    expect(modulo.descricao).toContain('Modelo: ABC123')
    expect(modulo.descricao).toContain('Fabricante: RISEN')

    expect(estrutura.produto).toBe('ESTRUTURA PERFIL C DE MONTAGEM 2 PEÇAS')
    expect(estrutura.quantidade).toBe(32)
    expect(estrutura.unidade).toBe('JG')
    expect(estrutura.descricao).toContain('Modelo: PERFIL-C')

    expect(data.resumo.valorTotal).toBeCloseTo(123456.78, 2)
  })

  it('falls back to pattern detection when anchors are missing (OCR layout)', () => {
    const lines = [
      'Orçamento WEB-0001',
      'KIT GERADOR 5K',
      'Código: KIT-5K Modelo: REV1 4',
      'Inversor monofásico 5kW',
      'Fabricante: SolarX',
      'Descrição adicional das características',
      'Aceite da Proposta',
      'Valor total: R$ 15.000,00',
    ]

    const data = parseStructuredBudget(lines)
    expect(data.itens).toHaveLength(2)
    expect(data.itens[0].produto).toBe('KIT GERADOR 5K')
    expect(data.itens[0].quantidade).toBe(4)
    expect(data.itens[1].produto).toBe('Inversor monofásico 5kW')
    expect(data.resumo.valorTotal).toBeCloseTo(15000, 2)
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
          fabricante: 'Fabricante 1',
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

