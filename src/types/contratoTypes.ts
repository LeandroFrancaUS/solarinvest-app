/**
 * contratoTypes.ts
 *
 * Shared types used by contract-generation logic in App.tsx and the
 * useContractModalState hook.
 */

export type ClienteContratoPayload = {
  nomeCompleto: string
  cpfCnpj: string
  enderecoCompleto: string
  unidadeConsumidora: string
  kWhContratado?: string
  uf?: string
  telefone?: string
  email?: string
  endereco?: string
  cidade?: string
  cep?: string
}
