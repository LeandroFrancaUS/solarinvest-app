# PDF Generation System - @react-pdf/renderer

Sistema profissional de geração de PDFs para contratos usando @react-pdf/renderer no backend.

## Visão Geral

Este sistema substitui a conversão DOCX → PDF por geração direta de PDF no backend usando @react-pdf/renderer, eliminando dependências nativas (LibreOffice, Word, etc.).

## Estrutura de Arquivos

```
src/pdf/
├── components/          # Componentes reutilizáveis
│   ├── Header.tsx      # Cabeçalho com título
│   ├── Footer.tsx      # Rodapé com paginação
│   ├── Section.tsx     # Seção com título
│   ├── Paragraph.tsx   # Parágrafo com texto
│   ├── Table.tsx       # Tabela com linhas/colunas
│   └── SignatureBlock.tsx  # Bloco de assinaturas
├── templates/          # Templates de documentos
│   ├── contratoLeasing.tsx  # Contrato de leasing
│   ├── contratoBundle.tsx   # Contrato + anexos
│   ├── anexoI.tsx      # Anexo I - Especificações
│   ├── anexoII.tsx     # Anexo II - Condições comerciais
│   └── index.ts        # Registro de templates
├── styles/             # Estilos e formatação
│   ├── theme.ts        # Estilos globais e tema
│   ├── fonts.ts        # Registro de fontes
│   └── formatters.ts   # Formatadores (datas, moeda, CPF/CNPJ)
├── schemas/            # Schemas de validação
│   └── contrato.schema.ts  # Schema Zod para contratos
├── render.ts           # Utilitário de renderização
└── __tests__/          # Testes unitários
    └── pdf-generation.test.ts
```

## API Endpoint

### POST /api/pdf/contrato

Gera um PDF de contrato a partir de dados JSON.

**Request Body:**
```json
{
  "cliente": {
    "nomeCompleto": "João Silva",
    "cpfCnpj": "12345678901",
    "endereco": "Rua Teste, 123",
    "cidade": "São Paulo",
    "uf": "SP",
    "cep": "01234-567",
    "telefone": "(11) 98765-4321",
    "email": "joao@example.com"
  },
  "dadosTecnicos": {
    "unidadeConsumidora": "123456789",
    "potencia": "10.5",
    "kWhContratado": "1200",
    "modulosFV": "20x 545W Jinko Solar",
    "inversoresFV": "1x 10kW Growatt"
  },
  "dadosContratuais": {
    "prazoContratual": "240",
    "diaVencimento": "10"
  },
  "tipoContrato": "leasing",
  "incluirAnexos": false
}
```

**Response:**
- Content-Type: `application/pdf`
- Content-Disposition: `inline; filename="Contrato_JoaoSilva_2026-01-08.pdf"`
- Status: 200 OK (PDF binary data)

**Campos Obrigatórios:**
- `cliente.nomeCompleto`
- `cliente.cpfCnpj`
- `cliente.endereco`
- `cliente.cidade`
- `cliente.uf` (2 caracteres)
- `cliente.cep`

**Campos Opcionais:**
Todos os outros campos são opcionais. Se omitidos, não aparecerão no PDF.

## Tipos de Templates

### 1. Contrato de Leasing (`contrato_leasing`)
Template padrão para contratos de leasing de sistemas fotovoltaicos.

### 2. Contrato de Venda (`contrato_venda`)
Template para contratos de venda direta (atualmente reutiliza o template de leasing).

### 3. Anexo I (`anexo_I`)
Especificações técnicas detalhadas do sistema.

### 4. Anexo II (`anexo_II`)
Condições comerciais e financeiras.

### 5. Contrato Bundle (`contrato_bundle`)
Documento consolidado com contrato principal + anexos I e II em um único PDF com paginação contínua.

## Seleção Automática de Templates

O sistema seleciona automaticamente o template baseado em:

- `incluirAnexos: true` → `contrato_bundle`
- `tipoContrato: "venda"` → `contrato_venda`
- Padrão → `contrato_leasing`

## Formatadores Disponíveis

### Datas
```typescript
formatDate('2026-01-08') // "08/01/2026"
formatDateExtended('2026-01-08') // "08 de janeiro de 2026"
```

### Moeda
```typescript
formatCurrency(1234.56) // "R$ 1.234,56"
```

### CPF/CNPJ
```typescript
maskCpfCnpj('12345678901') // "123.456.789-01"
maskCpfCnpj('12345678000199') // "12.345.678/0001-99"
```

### Telefone
```typescript
formatPhone('11987654321') // "(11) 98765-4321"
```

### CEP
```typescript
formatCep('01234567') // "01234-567"
```

## Validação de Dados

Todos os dados são validados com Zod antes da geração do PDF. Erros de validação retornam:

```json
{
  "error": "Dados inválidos no contrato.",
  "details": [
    {
      "field": "cliente.cpfCnpj",
      "message": "CPF/CNPJ é obrigatório"
    }
  ]
}
```

## Testando Localmente

### Método 1: Script Manual
```bash
node scripts/test-pdf-generation.mjs
```

### Método 2: curl
```bash
curl -X POST http://localhost:5173/api/pdf/contrato \
  -H "Content-Type: application/json" \
  -d @test-data.json \
  --output contrato.pdf
```

### Método 3: Testes Unitários
```bash
npm run test -- src/pdf/__tests__/pdf-generation.test.ts
```

## Características Importantes

### ✅ Campos Opcionais
- Campos não preenchidos são omitidos do PDF
- Nenhum placeholder ({{tag}}) aparece no documento final
- Renderização condicional automática

### ✅ Layout Consistente
- Formato A4 padronizado (595.28 x 841.89 pts)
- Margens de 50pts em todos os lados
- Fontes Noto Sans (embedded) com suporte completo a PT-BR
- Paginação automática

### ✅ Suporte Completo PT-BR
- Fonte Noto Sans com todos os caracteres portugueses
- Acentos: á, é, í, ó, ú, â, ê, ô, ã, õ
- Cedilha: ç, Ç
- Aspas tipográficas: „ "
- Travessão: — e outros caracteres especiais
- Fontes embedded em `public/fonts/` (não depende do sistema operacional)
- **IMPORTANTE**: Fontes carregadas via filesystem paths (`process.cwd() + '/public/fonts/'`), não URLs web
- Uso de `getFontPath()` e `getImagePath()` utilities para paths corretos no serverless

### ✅ Performance
- Geração em menos de 5-10 segundos
- Runtime Node.js (não Edge)
- Sem dependências nativas

### ✅ Segurança
- Validação de entrada com Zod
- Sem exposição de dados sensíveis em logs
- Sem armazenamento permanente no servidor

## Configuração Vercel

O endpoint está configurado para Node.js runtime:

```javascript
export const config = {
  runtime: 'nodejs',
  maxDuration: 30,
};
```

## Próximos Passos

1. **Integração com Fluxo Existente**: Substituir chamadas de conversão DOCX→PDF pelo novo endpoint
2. **Templates UF-específicos**: Adaptar templates por estado quando necessário
3. **Fontes Customizadas**: Adicionar fontes corporativas se desejado
4. **Armazenamento**: Implementar salvamento de PDFs em storage (S3/R2) se necessário
5. **Assinatura Digital**: Adicionar suporte para assinaturas digitais quando aplicável

## Troubleshooting

### Erro: "Cannot find module @react-pdf/renderer"
```bash
npm install @react-pdf/renderer zod
```

### Erro: "Runtime not supported"
Verifique que o endpoint está configurado com `runtime: 'nodejs'` no `export const config`.

### PDF com fontes erradas ou caracteres PT-BR incorretos
**Causa**: Fontes sendo carregadas via URLs web (`/fonts/...`) em vez de filesystem paths.

**Solução**: O código já usa `getFontPath()` que resolve paths via `process.cwd()`. Verifique que:
1. Fontes estão em `public/fonts/`
2. `fonts.ts` usa `getFontPath()` do `assetPaths.ts`
3. Não há caminhos web como `/fonts/` ou `/public/fonts/` no código

### PDF não gera ou fica em branco
1. Verifique os dados de entrada com o schema Zod
2. Confirme que campos obrigatórios estão presentes
3. Verifique logs do servidor para erros de renderização
4. Confirme que fontes foram carregadas corretamente (sem fallback para Helvetica)

## Suporte

Para questões ou problemas, consulte:
- [Documentação @react-pdf/renderer](https://react-pdf.org/)
- [Zod Documentation](https://zod.dev/)
- Issues do repositório
