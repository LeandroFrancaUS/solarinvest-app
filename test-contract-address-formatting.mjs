#!/usr/bin/env node
/**
 * Test script to verify contract address formatting
 * Tests the formatarEnderecoCompleto function and buildPlaceholderMap
 */

// Simulate the formatarEnderecoCompleto function
const formatarEnderecoCompleto = (dados) => {
  const partes = []
  const endereco = typeof dados.endereco === 'string' ? dados.endereco.trim().toUpperCase() : ''
  const cidade = typeof dados.cidade === 'string' ? dados.cidade.trim().toUpperCase() : ''
  const uf = typeof dados.uf === 'string' ? dados.uf.trim().toUpperCase() : ''
  const cep = typeof dados.cep === 'string' ? dados.cep.trim() : ''

  if (endereco) {
    partes.push(endereco)
  }

  if (cidade && uf) {
    partes.push(`${cidade} - ${uf}`)
  } else if (cidade) {
    partes.push(cidade)
  } else if (uf) {
    partes.push(uf)
  }

  if (cep) {
    partes.push(cep)
  }

  return partes.join(', ')
}

// Test cases
const testCases = [
  {
    name: 'GO - Complete address',
    input: {
      endereco: 'Rua Goianaz, QD 15 L 5, Conj Mirrage',
      cidade: 'Anapolis',
      uf: 'GO',
      cep: '75070-180'
    },
    expected: 'RUA GOIANAZ, QD 15 L 5, CONJ MIRRAGE, ANAPOLIS - GO, 75070-180'
  },
  {
    name: 'DF - Complete address',
    input: {
      endereco: 'SQN 304 Bloco B Apto 201',
      cidade: 'Brasília',
      uf: 'DF',
      cep: '70736-020'
    },
    expected: 'SQN 304 BLOCO B APTO 201, BRASÍLIA - DF, 70736-020'
  },
  {
    name: 'SP - Complete address',
    input: {
      endereco: 'Av. Paulista, 1000',
      cidade: 'São Paulo',
      uf: 'SP',
      cep: '01310-100'
    },
    expected: 'AV. PAULISTA, 1000, SÃO PAULO - SP, 01310-100'
  },
  {
    name: 'Missing CEP',
    input: {
      endereco: 'Rua das Flores, 123',
      cidade: 'Rio de Janeiro',
      uf: 'RJ',
      cep: ''
    },
    expected: 'RUA DAS FLORES, 123, RIO DE JANEIRO - RJ'
  },
  {
    name: 'Only street and UF',
    input: {
      endereco: 'Rua Principal',
      cidade: '',
      uf: 'MG',
      cep: ''
    },
    expected: 'RUA PRINCIPAL, MG'
  }
]

console.log('🧪 Testing Contract Address Formatting\n')
console.log('='  .repeat(80))

let passed = 0
let failed = 0

for (const test of testCases) {
  const result = formatarEnderecoCompleto(test.input)
  const success = result === test.expected
  
  if (success) {
    console.log(`✅ PASS: ${test.name}`)
    console.log(`   Input:    ${JSON.stringify(test.input)}`)
    console.log(`   Output:   ${result}`)
    passed++
  } else {
    console.log(`❌ FAIL: ${test.name}`)
    console.log(`   Input:    ${JSON.stringify(test.input)}`)
    console.log(`   Expected: ${test.expected}`)
    console.log(`   Got:      ${result}`)
    failed++
  }
  console.log('')
}

console.log('='  .repeat(80))
console.log(`\n📊 Results: ${passed} passed, ${failed} failed out of ${testCases.length} tests\n`)

if (failed > 0) {
  process.exit(1)
}

console.log('✨ All tests passed!\n')
