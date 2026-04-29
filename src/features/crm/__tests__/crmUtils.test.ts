/**
 * src/features/crm/__tests__/crmUtils.test.ts
 *
 * Validates core persistence helpers from crmUtils after Phase 1C extraction.
 *
 * Covered:
 *   1. carregarDatasetCrm returns a valid empty-leads structure when localStorage is empty
 *   2. carregarDatasetCrm rehydrates a dataset that was previously serialised to localStorage
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { carregarDatasetCrm } from '../crmUtils'
import { CRM_LOCAL_STORAGE_KEY, CRM_DATASET_VAZIO } from '../crmConstants'

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  localStorage.clear()
})

describe('carregarDatasetCrm', () => {
  it('retorna estrutura válida com leads[] vazio quando localStorage está vazio', () => {
    const dataset = carregarDatasetCrm()

    expect(dataset).toMatchObject({
      leads: [],
      timeline: [],
      contratos: [],
      custos: [],
      manutencoes: [],
    })
    expect(dataset).toEqual({ ...CRM_DATASET_VAZIO })
  })

  it('reidrata dataset serializado previamente no localStorage', () => {
    const stored = {
      leads: [
        {
          id: 'lead-test-001',
          nome: 'Maria Silva',
          telefone: '21988887777',
          cidade: 'Rio de Janeiro',
          tipoImovel: 'Residencial',
          consumoKwhMes: 300,
          origemLead: 'Indicação',
          interesse: 'Leasing',
          tipoOperacao: 'LEASING',
          valorEstimado: 18000,
          etapa: 'qualificacao',
          ultimoContatoIso: new Date().toISOString(),
          criadoEmIso: new Date().toISOString(),
          instalacaoStatus: 'planejamento',
        },
      ],
      timeline: [],
      contratos: [],
      custos: [],
      manutencoes: [],
    }
    localStorage.setItem(CRM_LOCAL_STORAGE_KEY, JSON.stringify(stored))

    const dataset = carregarDatasetCrm()

    expect(dataset.leads).toHaveLength(1)
    expect(dataset.leads[0]?.id).toBe('lead-test-001')
    expect(dataset.leads[0]?.nome).toBe('Maria Silva')
    expect(dataset.leads[0]?.etapa).toBe('qualificacao')
  })
})
