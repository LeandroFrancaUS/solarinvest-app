# Guia de Templates de Procuração

Este guia detalha como criar e atualizar os templates DOCX de procuração (power of attorney) para diferentes estados (UFs) e distribuidoras de energia.

## Localização dos Templates

Os templates de procuração devem ser colocados em:

```
public/templates/contratos/leasing/anexos/{UF}/
```

Por exemplo:
- GO (Equatorial): `public/templates/contratos/leasing/anexos/GO/Procuracao Equatorial - PF.docx`
- DF (Neoenergia): `public/templates/contratos/leasing/anexos/DF/Procuracao Neoenergia - PF.docx`

## Variáveis Mustache Disponíveis

O backend passa automaticamente os seguintes dados para os templates de procuração:

### Dados do Outorgante (Cliente)

| Variável Mustache | Descrição | Exemplo | Formato |
|------------------|-----------|---------|---------|
| `{{procuracaoNome}}` | Nome completo do cliente | JOÃO DA SILVA | UPPERCASE |
| `{{procuracaoCPF}}` | CPF do cliente | 123.456.789-00 | Com formatação |
| `{{procuracaoRG}}` | RG do cliente | 1234567 SSP/GO | Texto livre |
| `{{procuracaoEndereco}}` | Endereço completo formatado | RUA EXEMPLO, 100, GOIÂNIA - GO, 74000-000 | UPPERCASE |

### Outras Variáveis Disponíveis

Todos os outros campos do contrato também estão disponíveis:
- `{{nomeCompleto}}` - Nome do cliente (igual a procuracaoNome)
- `{{cpfCnpj}}` - CPF/CNPJ (igual a procuracaoCPF)
- `{{rg}}` - RG (igual a procuracaoRG)
- `{{enderecoCompleto}}` - Endereço completo
- `{{cidade}}` - Cidade
- `{{uf}}` - Estado (UF)
- `{{dataAtualExtenso}}` - Data por extenso (ex: "22 de janeiro de 2026")

## Instruções para Criar/Editar Templates no Microsoft Word

### REGRA CRÍTICA: Placeholders em um Único "Run"

**IMPORTANTE:** O Word frequentemente quebra texto em múltiplos "runs" (fragmentos) quando você:
- Cola texto de outro lugar
- Aplica formatação em partes do texto
- O corretor ortográfico marca erros

Para garantir que os placeholders funcionem:

1. **APAGUE completamente** o texto onde o placeholder será inserido
2. **DIGITE a tag de uma vez só**, sem parar: `{{procuracaoNome}}`
   - NÃO copie e cole de outro lugar
   - NÃO digite `{{`, depois `procuracaoNome`, depois `}}`
   - Digite tudo de uma vez sem parar
3. **Depois** de digitar, selecione e aplique formatação (negrito, etc.)

### Como Preservar Negrito

Se você quer que o valor substituído apareça em **negrito**:

1. Digite o placeholder completo: `{{procuracaoNome}}`
2. Selecione o texto inteiro (incluindo `{{` e `}}`)
3. Pressione Ctrl+B (ou ⌘+B no Mac) para aplicar negrito
4. NÃO aplique negrito em apenas parte do placeholder

### Exemplo: Template GO (Equatorial)

**Texto a ser editado:**
```
Outorgante , BRASILEIRO, portador do CPF nº , RG nº , residente na
```

**Texto correto com placeholders:**
```
Outorgante {{procuracaoNome}}, BRASILEIRO, portador do CPF nº {{procuracaoCPF}}, RG nº {{procuracaoRG}}, residente na {{procuracaoEndereco}}
```

**Na parte da assinatura:**
```
Proprietário: _______________________________________________

CPF nº {{procuracaoCPF}}
```

### Exemplo: Template DF (Neoenergia)

**Parte superior** (pode já ter dados fixos, sem problemas)

**Parte inferior (assinatura):**
```
Proprietário: {{procuracaoNome}}

CPF nº {{procuracaoCPF}}
```

## Como o Backend Processa os Templates

1. **Carregamento**: O sistema busca o template na pasta específica da UF primeiro, depois na pasta padrão
2. **Normalização**: O sistema tenta consertar placeholders fragmentados pelo Word automaticamente
3. **Renderização**: Mustache substitui todas as tags `{{variável}}` pelos valores reais
4. **Validação**: O sistema verifica se sobraram placeholders não substituídos
5. **Erro**: Se sobrarem placeholders, o sistema lança erro detalhado

## Validação Automática

O backend implementa validação automática que:

- ✅ Verifica se todos os placeholders `{{...}}` foram substituídos
- ✅ Registra erro com requestId, UF e nome do template
- ✅ Bloqueia geração se houver placeholders não substituídos
- ✅ Fornece mensagem clara: "Placeholders não substituídos: {{procuracaoNome}}"

### Exemplo de Log de Erro

```json
{
  "scope": "leasing-contracts",
  "step": "template_validation_failed",
  "requestId": "abc-123",
  "template": "Procuracao Equatorial - PF.docx",
  "uf": "GO",
  "placeholders": ["{{procuracaoNome}}", "{{procuracaoCPF}}"]
}
```

## Verificação de Dados (Backend)

O backend registra os dados de procuração enviados para o template:

```json
{
  "scope": "leasing-contracts",
  "step": "procuracao_render",
  "requestId": "abc-123",
  "procuracaoNome": "JOÃO DA SILVA",
  "procuracaoCPF": "123.456.789-00",
  "procuracaoRG": "1234567 SSP/GO",
  "procuracaoEndereco": "RUA EXEMPLO, 100, GOIÂNIA - GO, 74000-000"
}
```

## Troubleshooting

### Problema: Placeholders não são substituídos

**Causa**: O Word fragmentou o placeholder em múltiplos "runs"

**Solução**:
1. Abra o template no Word
2. Encontre o placeholder problemático
3. DELETE todo o texto (inclusive espaços ao redor)
4. Digite o placeholder novamente, de uma vez só
5. Salve o arquivo

### Problema: Formatação (negrito) não é preservada

**Causa**: Formatação foi aplicada em parte do placeholder

**Solução**:
1. Selecione o placeholder COMPLETO (incluindo `{{` e `}}`)
2. Aplique a formatação desejada (negrito)
3. Salve o arquivo

### Problema: Template não é encontrado

**Causa**: Arquivo está no lugar errado ou com nome incorreto

**Solução**:
1. Verifique se o arquivo está em `public/templates/contratos/leasing/anexos/{UF}/`
2. Verifique se o nome contém "Procura" ou "procuracao" (case-insensitive)
3. Verifique a extensão: deve ser `.docx`

## Checklist de Criação de Template

- [ ] Template está na pasta correta (`anexos/{UF}/`)
- [ ] Nome do arquivo contém "Procuracao" ou identificador da distribuidora
- [ ] Todos os placeholders estão presentes:
  - [ ] `{{procuracaoNome}}`
  - [ ] `{{procuracaoCPF}}`
  - [ ] `{{procuracaoRG}}`
  - [ ] `{{procuracaoEndereco}}`
- [ ] Placeholders foram digitados de uma vez (não copiados/colados)
- [ ] Formatação (negrito) aplicada ao placeholder completo
- [ ] Template testado com dados reais
- [ ] Nenhum erro de validação no backend

## Referências

- Código backend: `server/leasingContracts.js`
- Função de sanitização: `sanitizeDadosLeasing()`
- Função de validação: `validateRenderedTemplate()`
- Mapeamento de variáveis: linhas 676-689 em `leasingContracts.js`
