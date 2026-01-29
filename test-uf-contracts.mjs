#!/usr/bin/env node
/**
 * Script de Teste - Sistema de Contratos por UF
 * 
 * Este script demonstra como o sistema de contratos específicos por estado funciona.
 * Pode ser executado com: node test-uf-contracts.mjs
 */

import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Simulação de dados de cliente para diferentes estados
const clientesExemplo = [
  {
    estado: 'GO',
    dados: {
      cliente: {
        nomeCompleto: 'João Silva Energia Solar LTDA',
        cpfCnpj: '12.345.678/0001-90',
        endereco: 'Rua das Flores, 123',
        cidade: 'Goiânia',
        uf: 'GO',
        cep: '74000-000',
        uc: '12345678',
        enderecoCompleto: 'Rua das Flores, 123, Goiânia/GO, 74000-000',
        unidadeConsumidora: '12345678'
      }
    },
    descricao: 'Cliente de Goiás - deve usar template específico de GO se disponível'
  },
  {
    estado: 'DF',
    dados: {
      cliente: {
        nomeCompleto: 'Maria Santos Consultoria',
        cpfCnpj: '98.765.432/0001-10',
        endereco: 'SQN 308 Bloco A',
        cidade: 'Brasília',
        uf: 'DF',
        cep: '70747-010',
        uc: '87654321',
        enderecoCompleto: 'SQN 308 Bloco A, Brasília/DF, 70747-010',
        unidadeConsumidora: '87654321'
      }
    },
    descricao: 'Cliente do Distrito Federal - deve usar template específico de DF se disponível'
  },
  {
    estado: 'SP',
    dados: {
      cliente: {
        nomeCompleto: 'Pedro Costa Empreendimentos',
        cpfCnpj: '11.222.333/0001-44',
        endereco: 'Av. Paulista, 1000',
        cidade: 'São Paulo',
        uf: 'SP',
        cep: '01310-000',
        uc: '99887766',
        enderecoCompleto: 'Av. Paulista, 1000, São Paulo/SP, 01310-000',
        unidadeConsumidora: '99887766'
      }
    },
    descricao: 'Cliente de São Paulo - usará template padrão (não há template específico de SP)'
  },
  {
    estado: 'MG',
    dados: {
      cliente: {
        nomeCompleto: 'Ana Oliveira Solar',
        cpfCnpj: '55.666.777/0001-88',
        endereco: 'Rua da Bahia, 500',
        cidade: 'Belo Horizonte',
        uf: 'MG',
        cep: '30160-011',
        uc: '44556677',
        enderecoCompleto: 'Rua da Bahia, 500, Belo Horizonte/MG, 30160-011',
        unidadeConsumidora: '44556677'
      }
    },
    descricao: 'Cliente de Minas Gerais - usará template padrão (não há template específico de MG)'
  }
]

// Simulação de payload para leasing
const leasingExemplo = {
  tipoContrato: 'residencial',
  dadosLeasing: {
    nomeCompleto: 'João Silva Energia Solar LTDA',
    cpfCnpj: '12.345.678/0001-90',
    enderecoCompleto: 'Rua das Flores, 123, Goiânia/GO, 74000-000',
    unidadeConsumidora: '12345678',
    uf: 'GO', // ← Campo crítico para resolução de template
    potencia: '10,50',
    kWhContratado: '1.200',
    tarifaBase: '0,8950',
    dataInicio: '01/01/2026',
    dataFim: '01/01/2046',
    localEntrega: 'Rua das Flores, 123, Goiânia/GO',
    modulosFV: '20 módulos Canadian Solar 525W',
    inversoresFV: '1 inversor Growatt 10kW',
    dataHomologacao: '15/12/2025',
    dataAtualExtenso: '06 de janeiro de 2026',
    proprietarios: [],
    ucsBeneficiarias: []
  },
  anexosSelecionados: ['ANEXO_I', 'ANEXO_II', 'ANEXO_III', 'ANEXO_VII']
}

console.log('╔════════════════════════════════════════════════════════════════╗')
console.log('║  TESTE: Sistema de Contratos por UF - SolarInvest            ║')
console.log('╚════════════════════════════════════════════════════════════════╝\n')

console.log('📋 EXEMPLOS DE CLIENTES E RESOLUÇÃO DE TEMPLATES\n')
console.log('─'.repeat(70))

clientesExemplo.forEach((exemplo, index) => {
  console.log(`\n${index + 1}. ${exemplo.descricao}`)
  console.log(`   Estado: ${exemplo.estado}`)
  console.log(`   Cliente: ${exemplo.dados.cliente.nomeCompleto}`)
  console.log(`   UF no payload: "${exemplo.dados.cliente.uf}"`)
  console.log('\n   Ordem de busca de template:')
  console.log(`   1️⃣  leasing/${exemplo.estado}/CONTRATO DE LEASING DE SISTEMA FOTOVOLTAICO - RESIDENCIA.docx`)
  console.log(`   2️⃣  leasing/CONTRATO DE LEASING DE SISTEMA FOTOVOLTAICO - RESIDENCIA.docx (fallback)`)
})

console.log('\n' + '─'.repeat(70))
console.log('\n📤 EXEMPLO DE REQUISIÇÃO HTTP - Contrato Geral\n')

const contratoGeralRequest = {
  method: 'POST',
  url: '/api/contracts/render',
  headers: {
    'Content-Type': 'application/json'
  },
  body: {
    template: 'leasing/CONTRATO DE LEASING DE SISTEMA FOTOVOLTAICO - RESIDENCIA.docx',
    cliente: clientesExemplo[0].dados.cliente // Cliente de GO
  }
}

console.log(JSON.stringify(contratoGeralRequest, null, 2))

console.log('\n' + '─'.repeat(70))
console.log('\n📤 EXEMPLO DE REQUISIÇÃO HTTP - Contrato de Leasing\n')

const leasingRequest = {
  method: 'POST',
  url: '/api/contracts/leasing',
  headers: {
    'Content-Type': 'application/json'
  },
  body: leasingExemplo
}

console.log(JSON.stringify(leasingRequest, null, 2))

console.log('\n' + '─'.repeat(70))
console.log('\n🔍 COMO O BACKEND RESOLVE O TEMPLATE\n')

console.log(`
Quando o backend recebe a requisição:

1. Extrai o UF do cliente: "${leasingExemplo.dadosLeasing.uf}"
   
2. Normaliza para maiúsculas: "GO"

3. Constrói o caminho do template específico:
   assets/templates/contratos/leasing/GO/[nome-do-template].docx

4. Verifica se o arquivo existe:
   ✓ Se SIM → usa o template específico de GO
   ✗ Se NÃO → usa o template padrão (leasing/[nome-do-template].docx)

5. Preenche as variáveis do template:
   {{nomeCompleto}} → "${leasingExemplo.dadosLeasing.nomeCompleto}"
   {{cpfCnpj}} → "${leasingExemplo.dadosLeasing.cpfCnpj}"
   {{uf}} → "${leasingExemplo.dadosLeasing.uf}"
   {{potencia}} → "${leasingExemplo.dadosLeasing.potencia} kWp"
   ... e outras variáveis

6. Gera o PDF ou DOCX final
`)

console.log('─'.repeat(70))
console.log('\n📁 ESTRUTURA DE DIRETÓRIOS ATUAL\n')

console.log(`
assets/templates/contratos/
├── leasing/
│   ├── CONTRATO DE LEASING... (template padrão) ✅
│   ├── GO/
│   │   ├── README.md ✅
│   │   └── [templates específicos de GO] 📝 (adicione aqui)
│   └── DF/
│       ├── README.md ✅
│       └── [templates específicos de DF] 📝 (adicione aqui)
└── vendas/
    ├── GO/
    │   └── README.md ✅
    └── DF/
        └── README.md ✅
`)

console.log('─'.repeat(70))
console.log('\n✅ CHECKLIST DE IMPLEMENTAÇÃO\n')

console.log(`
[✓] Backend: Resolução de templates por UF implementada
[✓] Backend: Fallback para templates padrão
[✓] Backend: Logs informativos no console
[✓] Frontend: Campo UF incluído no payload
[✓] Estrutura: Diretórios GO/ e DF/ criados
[✓] Documentação: README.md completo
[✓] Documentação: Guia rápido em português

[ ] Próximos passos:
    → Adicionar arquivos .docx de GO em assets/templates/contratos/leasing/GO/
    → Adicionar arquivos .docx de DF em assets/templates/contratos/leasing/DF/
    → Testar geração de contrato para cliente de GO
    → Testar geração de contrato para cliente de DF
    → Verificar logs do servidor para confirmar uso dos templates corretos
`)

console.log('─'.repeat(70))
console.log('\n💡 DICAS IMPORTANTES\n')

console.log(`
1. NOME DO ARQUIVO deve ser IDÊNTICO ao template padrão
   ✅ Correto: "CONTRATO DE LEASING DE SISTEMA FOTOVOLTAICO - RESIDENCIA.docx"
   ❌ Errado: "Contrato GO.docx"
   ❌ Errado: "contrato-go.docx"

2. DIRETÓRIO do UF deve ter EXATAMENTE 2 LETRAS MAIÚSCULAS
   ✅ Correto: GO/, DF/, SP/
   ❌ Errado: go/, Go/, Goias/

3. VARIÁVEIS devem usar formato Mustache: {{variavel}} ou {variavel}
   ✅ Correto: {{nomeCompleto}}, {{cpfCnpj}}
   ❌ Errado: {nomeCompleto} (sem chaves duplas para Mustache)

4. TESTE primeiro com um template copiando o padrão
   → Copie o template padrão para GO/
   → Faça pequenas alterações
   → Teste a geração
   → Se funcionar, faça as alterações completas

5. MONITORE os logs do servidor:
   [contracts] Usando template específico para UF GO: ...
   [contracts] Template específico para UF GO não encontrado...
`)

console.log('─'.repeat(70))
console.log('\n🎯 EXEMPLO DE TESTE RÁPIDO\n')

console.log(`
Para testar rapidamente se o sistema está funcionando:

1. Copie um template padrão para GO:
   
   cp "assets/templates/contratos/leasing/CONTRATO DE LEASING DE SISTEMA FOTOVOLTAICO - RESIDENCIA.docx" \\
      "assets/templates/contratos/leasing/GO/CONTRATO DE LEASING DE SISTEMA FOTOVOLTAICO - RESIDENCIA.docx"

2. Edite o arquivo em GO/ e adicione uma marca única (ex: "VERSÃO GO" no cabeçalho)

3. Inicie o servidor: npm run dev

4. Crie um cliente com uf: "GO"

5. Gere o contrato

6. Verifique:
   - O PDF gerado contém "VERSÃO GO"?
   - Os logs mostram "Usando template específico para UF GO"?
   
   Se SIM → Sistema funcionando! ✅
   Se NÃO → Verifique nome do arquivo e logs de erro
`)

console.log('─'.repeat(70))
console.log('\n🚀 SISTEMA PRONTO PARA USO!\n')
console.log('Agora basta adicionar os templates específicos de GO e DF.')
console.log('O sistema detectará automaticamente e os usará para os clientes desses estados.\n')
console.log('═'.repeat(70))
