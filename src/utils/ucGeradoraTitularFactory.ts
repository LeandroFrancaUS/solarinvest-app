import type { LeasingCorresponsavel, LeasingEndereco, LeasingUcGeradoraTitular } from '../store/useLeasingStore'

export const createEmptyUcGeradoraTitularEndereco = (): LeasingEndereco => ({
  logradouro: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  uf: '',
  cep: '',
})

export const createEmptyUcGeradoraTitular = (): LeasingUcGeradoraTitular => ({
  nomeCompleto: '',
  cpf: '',
  rg: '',
  endereco: createEmptyUcGeradoraTitularEndereco(),
})

export const cloneUcGeradoraTitular = (
  input: LeasingUcGeradoraTitular,
): LeasingUcGeradoraTitular => ({
  ...input,
  endereco: { ...input.endereco },
})

export const createEmptyCorresponsavel = (): LeasingCorresponsavel => ({
  nome: '',
  nacionalidade: '',
  estadoCivil: '',
  cpf: '',
  endereco: createEmptyUcGeradoraTitularEndereco(),
  email: '',
  telefone: '',
})
