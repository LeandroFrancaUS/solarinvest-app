# Sistema de Templates de Contratos - SolarInvest

Este diretório contém os templates de contratos do SolarInvest com suporte a templates específicos por Estado (UF).

## Estrutura de Diretórios

```
contratos/
├── leasing/                    # Templates de contratos de leasing
│   ├── [template-padrao].docx  # Templates padrão (usados quando não há UF específico)
│   ├── GO/                     # Templates específicos para Goiás
│   │   └── [template].docx
│   ├── DF/                     # Templates específicos para Distrito Federal
│   │   └── [template].docx
│   └── SP/                     # Templates específicos para São Paulo
│       └── [template].docx
└── vendas/                     # Templates de contratos de vendas
    ├── [template-padrao].docx
    ├── GO/
    │   └── [template].docx
    └── DF/
        └── [template].docx
```

## Como Funciona

### 1. Resolução de Templates

Quando um contrato é gerado, o sistema segue esta ordem de busca:

1. **Template Específico do UF**: Procura primeiro em `categoria/UF/template.docx`
   - Exemplo: `leasing/GO/CONTRATO DE LEASING DE SISTEMA FOTOVOLTAICO - RESIDENCIA.docx`

2. **Template Padrão**: Se não encontrar o template específico, usa `categoria/template.docx`
   - Exemplo: `leasing/CONTRATO DE LEASING DE SISTEMA FOTOVOLTAICO - RESIDENCIA.docx`

### 2. Informações do Cliente

O sistema extrai automaticamente o UF dos dados do cliente:
- Para contratos via `/api/contracts/render`: campo `cliente.uf`
- Para contratos de leasing via `/api/contracts/leasing`: campo `dadosLeasing.uf`

### 3. Variáveis nos Templates

Os templates devem usar as seguintes variáveis (tags) que serão automaticamente preenchidas:

#### Templates Gerais (`/api/contracts/render`):
- `{{nomeCompleto}}` ou `{nomeCompleto}` - Nome completo do cliente
- `{{cpfCnpj}}` - CPF ou CNPJ formatado
- `{{enderecoCompleto}}` - Endereço completo do contratante
- `{{unidadeConsumidora}}` - Número da unidade consumidora (UC)
- `{{dataAtualExtenso}}` - Data atual por extenso (ex: "06 de janeiro de 2026")
- `{{telefone}}` - Telefone do cliente
- `{{email}}` - E-mail do cliente

#### Templates de Leasing (via Mustache):
- `{{nomeCompleto}}` - Nome completo / razão social do contratante
- `{{cpfCnpj}}` - CPF/CNPJ do contratante
- `{{enderecoCompleto}}` - Endereço completo do contratante
- `{{unidadeConsumidora}}` - Unidade consumidora
- `{{telefone}}` - Telefone do contratante
- `{{email}}` - E-mail do contratante
- `{{localEntrega}}` - Local de entrega/instalação da UC geradora
- `{{enderecoInstalacao}}` - Endereço de instalação da UC geradora (mesmo que localEntrega)
- `{{potencia}}` - Potência contratada (kWp)
- `{{kWhContratado}}` - Energia contratada (kWh)
- `{{tarifaBase}}` - Tarifa base (R$/kWh)
- `{{dataInicio}}` - Data de início do contrato
- `{{dataFim}}` - Data de fim do contrato
- `{{modulosFV}}` - Descrição dos módulos fotovoltaicos
- `{{inversoresFV}}` - Descrição dos inversores
- `{{dataHomologacao}}` - Data de homologação
- `{{dataAtualExtenso}}` - Data atual por extenso
- Para condomínios:
  - `{{nomeCondominio}}` - Nome do condomínio
  - `{{cnpjCondominio}}` - CNPJ do condomínio
  - `{{nomeSindico}}` - Nome do síndico
  - `{{cpfSindico}}` - CPF do síndico

**Importante**: O endereço do contratante (`{{enderecoCompleto}}`) pode ser diferente do endereço de instalação (`{{enderecoInstalacao}}` ou `{{localEntrega}}`). Certifique-se de usar a variável apropriada no contrato.

## Como Adicionar Templates por UF

### Passo 1: Criar Diretório do Estado

Crie um diretório com a sigla do estado (2 letras maiúsculas) dentro da categoria:

```bash
mkdir -p assets/templates/contratos/leasing/GO
mkdir -p assets/templates/contratos/leasing/DF
mkdir -p assets/templates/contratos/vendas/SP
```

### Passo 2: Adicionar Template

Copie o template padrão ou crie um novo template específico para o estado:

```bash
# Exemplo: copiar template padrão e personalizar para GO
cp assets/templates/contratos/leasing/CONTRATO\ DE\ LEASING\ DE\ SISTEMA\ FOTOVOLTAICO\ -\ RESIDENCIA.docx \
   assets/templates/contratos/leasing/GO/
```

### Passo 3: Personalizar o Template

1. Abra o arquivo `.docx` no Microsoft Word, LibreOffice ou editor compatível
2. Modifique o conteúdo conforme as especificidades legais do estado
3. **IMPORTANTE**: Mantenha as tags (variáveis) no formato `{{variavel}}` ou `{variavel}`
4. Salve o arquivo com o mesmo nome do template padrão

### Passo 4: Testar

O sistema automaticamente detectará e usará o template específico quando o cliente for do estado correspondente.

## Exemplos de Uso

### Exemplo 1: Cliente de Goiás

Quando um cliente de GO solicita um contrato de leasing residencial:

```javascript
// O sistema busca automaticamente:
// 1º: assets/templates/contratos/leasing/GO/CONTRATO DE LEASING DE SISTEMA FOTOVOLTAICO - RESIDENCIA.docx
// 2º: assets/templates/contratos/leasing/CONTRATO DE LEASING DE SISTEMA FOTOVOLTAICO - RESIDENCIA.docx (fallback)
```

### Exemplo 2: Cliente do Distrito Federal

Quando um cliente de DF solicita um contrato:

```javascript
// O sistema busca:
// 1º: assets/templates/contratos/leasing/DF/[template].docx
// 2º: assets/templates/contratos/leasing/[template].docx (fallback)
```

### Exemplo 3: Cliente de Estado sem Template Específico

Quando um cliente de MG (sem template específico) solicita um contrato:

```javascript
// O sistema usa diretamente:
// assets/templates/contratos/leasing/[template].docx (template padrão)
```

## Estados Suportados

Qualquer sigla de estado brasileiro (UF) de 2 letras pode ter templates específicos:

- AC, AL, AP, AM, BA, CE, DF, ES, GO, MA, MT, MS, MG, PA, PB, PR, PE, PI, RJ, RN, RS, RO, RR, SC, SP, SE, TO

## Listagem de Templates via API

### Listar todos os templates de uma categoria:

```http
GET /api/contracts/templates?categoria=leasing
```

Retorna templates padrão e específicos por UF:
```json
{
  "templates": [
    "leasing/CONTRATO DE LEASING DE SISTEMA FOTOVOLTAICO - RESIDENCIA.docx",
    "leasing/GO/CONTRATO DE LEASING DE SISTEMA FOTOVOLTAICO - RESIDENCIA.docx",
    "leasing/DF/CONTRATO DE LEASING DE SISTEMA FOTOVOLTAICO - RESIDENCIA.docx"
  ]
}
```

### Listar apenas templates de um UF específico:

```http
GET /api/contracts/templates?categoria=leasing&uf=GO
```

Retorna apenas templates de Goiás:
```json
{
  "templates": [
    "leasing/GO/CONTRATO DE LEASING DE SISTEMA FOTOVOLTAICO - RESIDENCIA.docx"
  ]
}
```

## Troubleshooting

### Template específico não é usado

Verifique:
1. O diretório tem exatamente 2 letras maiúsculas (ex: `GO`, não `go` ou `Goiás`)
2. O nome do arquivo é exatamente igual ao template padrão
3. O arquivo tem extensão `.docx` (minúsculas)
4. O campo `uf` está sendo enviado corretamente na requisição

### Logs do sistema

O sistema registra no console quando usa templates específicos:

```
[contracts] Usando template específico para UF GO: leasing/GO/CONTRATO DE LEASING DE SISTEMA FOTOVOLTAICO - RESIDENCIA.docx
```

Ou quando faz fallback para template padrão:

```
[contracts] Template específico para UF GO não encontrado, usando template padrão: leasing/CONTRATO DE LEASING DE SISTEMA FOTOVOLTAICO - RESIDENCIA.docx
```

## Boas Práticas

1. **Mantenha consistência**: Use os mesmos nomes de arquivo entre template padrão e específicos
2. **Teste antes de produção**: Gere contratos de teste para cada novo UF
3. **Documentação legal**: Inclua comentários no template sobre mudanças legais específicas do estado
4. **Versionamento**: Considere incluir data ou versão no nome do arquivo (ex: `template-v2.docx`)
5. **Backup**: Mantenha cópias dos templates originais antes de personalizações

## Suporte Técnico

Para dúvidas sobre:
- Estrutura de templates: consulte `server/contracts.js` e `server/leasingContracts.js`
- Variáveis disponíveis: veja funções `buildPlaceholderMap` e `sanitizeDadosLeasing`
- Formato de documentos: os templates usam formato DOCX (OpenXML)
