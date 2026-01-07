#!/usr/bin/env node
/**
 * Test script to verify contract payload generation
 * Simulates what the frontend sends to the backend
 */

// Sample client data matching the problem statement
const testClienteGO = {
  nomeCompleto: 'test again',
  cpfCnpj: '974.553.001-82',
  endereco: 'RUA GOIANAZ, QD 15 L 5, CONJ MIRRAGE',
  cidade: 'Anapolis',
  uf: 'GO',
  cep: '75070-180',
  unidadeConsumidora: '1541154',
  telefone: '(62) 99999-9999',
  email: 'test@example.com'
}

const testClienteDF = {
  nomeCompleto: 'Cliente Brasília',
  cpfCnpj: '123.456.789-00',
  endereco: 'SQN 304 Bloco B Apto 201',
  cidade: 'Brasília',
  uf: 'DF',
  cep: '70736-020',
  unidadeConsumidora: '9876543',
  telefone: '(61) 98888-8888',
  email: 'cliente@example.com'
}

// Test case 1: Contractor address same as UC generator address
const testCase1 = {
  name: 'GO - Same address for contractor and UC generator',
  cliente: testClienteGO,
  localEntrega: 'RUA GOIANAZ, QD 15 L 5, CONJ MIRRAGE, ANAPOLIS - GO, 75070-180',
  expectedContratante: 'CONTRATANTE: test again, inscrito(a) no CPF/CNPJ nº 974.553.001-82, residente e domiciliado(a) no endereço RUA GOIANAZ, QD 15 L 5, CONJ MIRRAGE, ANAPOLIS - GO, 75070-180, titular da Unidade Consumidora (UC) nº 1541154, doravante denominado(a) simplesmente CONTRATANTE.',
  expectedUG: 'Quando aplicável, declara ainda ser o responsável pela Unidade Geradora (UG) nº 1541154, localizada em RUA GOIANAZ, QD 15 L 5, CONJ MIRRAGE, ANAPOLIS - GO, 75070-180 conforme regras de geração compartilhada / remoto (Lei 14.300/2022).'
}

// Test case 2: Different addresses
const testCase2 = {
  name: 'DF - Different address for contractor and UC generator',
  cliente: testClienteDF,
  localEntrega: 'Área Rural Fazenda Modelo, KM 25, BRAZLÂNDIA - DF, 72720-000',
  expectedContratante: 'CONTRATANTE: Cliente Brasília, inscrito(a) no CPF/CNPJ nº 123.456.789-00, residente e domiciliado(a) no endereço SQN 304 BLOCO B APTO 201, BRASÍLIA - DF, 70736-020, titular da Unidade Consumidora (UC) nº 9876543, doravante denominado(a) simplesmente CONTRATANTE.',
  expectedUG: 'Quando aplicável, declara ainda ser o responsável pela Unidade Geradora (UG) nº 9876543, localizada em ÁREA RURAL FAZENDA MODELO, KM 25, BRAZLÂNDIA - DF, 72720-000 conforme regras de geração compartilhada / remoto (Lei 14.300/2022).'
}

console.log('🧪 Testing Contract Payload Generation\n')
console.log('='  .repeat(100))

function buildContractPayload(cliente, localEntrega) {
  // Format address for contractor (from individual fields)
  const enderecoContratante = [
    cliente.endereco,
    `${cliente.cidade} - ${cliente.uf}`,
    cliente.cep
  ].filter(Boolean).join(', ').toUpperCase()
  
  // Format address for UC generator
  const enderecoUCGeradora = localEntrega.toUpperCase()
  
  return {
    nomeCompleto: cliente.nomeCompleto,
    cpfCnpj: cliente.cpfCnpj,
    unidadeConsumidora: cliente.unidadeConsumidora,
    enderecoContratante,
    enderecoUCGeradora,
    uf: cliente.uf
  }
}

function buildContractText(payload) {
  const contratante = `CONTRATANTE: ${payload.nomeCompleto}, inscrito(a) no CPF/CNPJ nº ${payload.cpfCnpj}, residente e domiciliado(a) no endereço ${payload.enderecoContratante}, titular da Unidade Consumidora (UC) nº ${payload.unidadeConsumidora}, doravante denominado(a) simplesmente CONTRATANTE.`
  
  const ug = `Quando aplicável, declara ainda ser o responsável pela Unidade Geradora (UG) nº ${payload.unidadeConsumidora}, localizada em ${payload.enderecoUCGeradora} conforme regras de geração compartilhada / remoto (Lei 14.300/2022).`
  
  return { contratante, ug }
}

// Test both cases
const testCases = [testCase1, testCase2]
let passed = 0
let failed = 0

for (const test of testCases) {
  console.log(`\n📋 ${test.name}\n`)
  console.log('-'.repeat(100))
  
  const payload = buildContractPayload(test.cliente, test.localEntrega)
  const { contratante, ug } = buildContractText(payload)
  
  console.log('Generated Payload:')
  console.log(JSON.stringify(payload, null, 2))
  console.log('')
  
  console.log('Generated Contract Text:')
  console.log(`\nContratante Clause:\n${contratante}\n`)
  console.log(`UG Clause:\n${ug}\n`)
  
  // Verify contratante clause
  const contratanteMatch = contratante === test.expectedContratante
  if (contratanteMatch) {
    console.log('✅ Contratante clause matches expected format')
    passed++
  } else {
    console.log('❌ Contratante clause does NOT match expected format')
    console.log(`\nExpected:\n${test.expectedContratante}`)
    console.log(`\nGot:\n${contratante}`)
    failed++
  }
  
  // Verify UG clause
  const ugMatch = ug === test.expectedUG
  if (ugMatch) {
    console.log('✅ UG clause matches expected format')
    passed++
  } else {
    console.log('❌ UG clause does NOT match expected format')
    console.log(`\nExpected:\n${test.expectedUG}`)
    console.log(`\nGot:\n${ug}`)
    failed++
  }
  
  console.log('')
}

console.log('='  .repeat(100))
console.log(`\n📊 Results: ${passed} passed, ${failed} failed out of ${passed + failed} tests\n`)

if (failed > 0) {
  console.log('⚠️  Some tests failed. Review the output above.\n')
  process.exit(1)
}

console.log('✨ All contract payload tests passed!\n')
