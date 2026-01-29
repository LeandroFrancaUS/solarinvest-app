# Guia de Anexos Automáticos para Contratos de Leasing

## 📋 Visão Geral

O sistema de geração de contratos de leasing agora suporta **descoberta automática de anexos** com:
- ✅ Busca por prefixo (independente do resto do nome do arquivo)
- ✅ Suporte a numeração romana (I, II, III, IV, etc.) e árabe (1, 2, 3, 4, etc.)
- ✅ Case-insensitive (ignora maiúsculas/minúsculas)
- ✅ Anexos faltantes não impedem a geração do contrato principal
- ✅ Auto-inclusão de anexos obrigatórios por tipo de contrato

## 🎯 Anexos por Tipo de Contrato

### Leasing Residencial
**Contrato Principal:**
- Contrato Unificado de Leasing

**Anexos Auto-Incluídos:**
- ✅ Anexo II – Opção de Compra da Usina
- ✅ Anexo III – Regras de Cálculo da Mensalidade
- ✅ Anexo IV – Termo de Autorização e Procuração

**Anexos Opcionais (sob demanda):**
- Anexo I – Especificações Técnicas e Proposta Comercial
- Anexo VII – Termo de Entrega e Aceite Técnico da Usina
- Outros anexos conforme necessário

### Leasing Comercial
**Contrato Principal:**
- Contrato Unificado de Leasing

**Anexos Auto-Incluídos:**
- ✅ Anexo II – Opção de Compra da Usina
- ✅ Anexo III – Regras de Cálculo da Mensalidade
- ✅ Anexo IV – Termo de Autorização e Procuração

**Anexos Opcionais (sob demanda):**
- Anexo I – Especificações Técnicas e Proposta Comercial
- Anexo VII – Termo de Entrega e Aceite Técnico da Usina
- Outros anexos conforme necessário

### Leasing Condomínio
**Contrato Principal:**
- Contrato Unificado de Leasing

**Anexos Auto-Incluídos:**
- ✅ Anexo VIII – Procuração do Condomínio

**Anexos Opcionais (sob demanda):**
- Anexo I, II, III, VII – Conforme necessário

## 📁 Estrutura de Diretórios

### Localização dos Templates

```
public/templates/contratos/leasing/
├── CONTRATO UNIFICADO DE LEASING DE SISTEMA FOTOVOLTAICO.dotx  (contrato principal)
└── anexos/
    ├── ANEXO I - ESPECIFICAÇÕES TECNICAS E PROPOSTA COMERCIAL (Residencial).docx
    ├── Anexo II – Opção de Compra da Usina (todos).docx
    ├── ANEXO III - Regras de Cálculo da Mensalidade (todos).docx
    ├── Anexo IV – Termo de Autorização e Procuração.docx
    └── ANEXO VII – TERMO DE ENTREGA E ACEITE TÉCNICO DA USINA (Residencial).docx
```

### Templates Específicos por UF (Opcional)

```
public/templates/contratos/leasing/
├── GO/
│   ├── CONTRATO UNIFICADO DE LEASING DE SISTEMA FOTOVOLTAICO.dotx
│   └── anexos/
│       ├── Anexo II – Opção de Compra da Usina (GO).docx
│       └── ... outros anexos específicos de GO
└── DF/
    ├── CONTRATO UNIFICADO DE LEASING DE SISTEMA FOTOVOLTAICO.dotx
    └── anexos/
        └── ... anexos específicos de DF
```

## 🔍 Como Funciona a Descoberta Automática

### 1. Busca por Prefixo

O sistema busca arquivos que **começam** com "Anexo" seguido do número, ignorando:
- Case (maiúsculas/minúsculas)
- O resto do nome do arquivo
- Extensão (.docx ou .dotx, ambos aceitos)

### Exemplos de Nomes Aceitos:

Todos estes nomes são válidos para o **Anexo II**:
```
✅ ANEXO II - Opção de Compra.docx
✅ Anexo II – Termo.docx
✅ anexo ii.docx
✅ ANEXO 2 - Qualquer Nome.docx
✅ Anexo 2.dotx
```

### 2. Numeração Romana ou Árabe

O sistema aceita **ambos** os formatos:

| Romano | Árabe | Descrição Comum |
|--------|-------|-----------------|
| I      | 1     | Especificações Técnicas |
| II     | 2     | Opção de Compra |
| III    | 3     | Regras de Cálculo |
| IV     | 4     | Autorização |
| V      | 5     | - |
| VI     | 6     | - |
| VII    | 7     | Termo de Entrega |
| VIII   | 8     | Procuração Condomínio |

### 3. Tratamento de Anexos Faltantes

**Comportamento Seguro:**
```
Se Anexo II não existir:
  ↓
Sistema continua normalmente
  ↓
Gera contrato principal + anexos disponíveis
  ↓
Log de aviso no servidor: "Anexo II indisponível"
  ↓
✅ Processo completo sem erros
```

## 🚀 Como Adicionar Novos Anexos

### Passo 1: Criar o Arquivo

1. Crie o template do anexo no Word/LibreOffice
2. Use variáveis Mustache para campos dinâmicos: `{{nomeCompleto}}`, `{{cpfCnpj}}`, etc.
3. Salve como `.docx` ou `.dotx`

### Passo 2: Nomear Corretamente

**Formato:** `Anexo [NÚMERO] - [DESCRIÇÃO].docx`

Exemplos:
```
Anexo II - Opção de Compra da Usina (todos).docx
ANEXO V - Garantias.docx
Anexo 9 - Termos Adicionais.docx
```

### Passo 3: Colocar no Diretório

Copie para:
```
public/templates/contratos/leasing/anexos/
```

Ou para UF específico:
```
public/templates/contratos/leasing/GO/anexos/
```

### Passo 4: Deploy

```bash
git add public/templates/contratos/leasing/anexos/
git commit -m "Adicionar Anexo V - Garantias"
git push
```

**Pronto!** O sistema detectará automaticamente o novo anexo.

## 📝 API de Geração de Contratos

### Endpoint

```
POST /api/contracts/leasing
```

### Payload de Exemplo

#### Leasing Residencial (Anexos II, III, IV incluídos automaticamente)

```json
{
  "tipoContrato": "residencial",
  "dadosLeasing": {
    "nomeCompleto": "João Silva",
    "cpfCnpj": "123.456.789-00",
    "uf": "GO",
    "enderecoCompleto": "Rua Exemplo, 100, Goiânia - GO",
    "unidadeConsumidora": "123456",
    "localEntrega": "Rua Exemplo, 100",
    "potencia": "5.5",
    "kWhContratado": "600",
    "tarifaBase": "1.20"
  },
  "anexosSelecionados": ["ANEXO_I"]  // Opcional: apenas se quiser Anexo I também
}
```

#### Resposta

- Se apenas 1 arquivo gerado: retorna PDF/DOCX diretamente
- Se múltiplos arquivos: retorna ZIP com todos os documentos

### Headers de Resposta

```
Content-Type: application/pdf (ou application/zip)
Content-Disposition: attachment; filename="leasing-residencial-12345678900.pdf"
X-Contracts-Notice: "Anexo VII: Template não encontrado" (se algum anexo faltar)
```

## 🛠️ Verificação de Disponibilidade

### Endpoint de Disponibilidade

Antes de gerar contratos, você pode verificar quais anexos estão disponíveis:

```
GET /api/contracts/leasing/availability?tipoContrato=residencial&uf=GO
```

### Resposta

```json
{
  "availability": {
    "ANEXO_I": true,
    "ANEXO_II": true,
    "ANEXO_III": true,
    "ANEXO_IV": true,
    "ANEXO_VII": false,
    "ANEXO_VIII": false
  }
}
```

## 🔧 Configuração de Auto-Inclusão

A lógica de auto-inclusão está definida em `server/leasingContracts.js`:

```javascript
const ANEXO_DEFINITIONS = [
  {
    id: 'ANEXO_II',
    number: 2,
    label: 'Anexo II – Opção de Compra',
    appliesTo: new Set(['residencial', 'comercial', 'condominio']),
    autoInclude: new Set(['residencial', 'comercial']),  // ← Auto-incluído
  },
  // ... outros anexos
]
```

Para modificar quais anexos são incluídos automaticamente, edite o campo `autoInclude`.

## 📊 Logs do Sistema

### Template Descoberto

```
[leasing-contracts] {
  scope: 'leasing-contracts',
  step: 'anexo_discovered',
  anexoNum: 2,
  fileName: 'Anexo II – Opção de Compra da Usina (todos).docx',
  uf: 'GO'
}
```

### Anexo Indisponível

```
[leasing-contracts] Anexos indisponíveis serão ignorados {
  requestId: 'abc-123',
  anexos: ['ANEXO_V', 'ANEXO_VI']
}
```

### Erro ao Processar Anexo

```
[leasing-contracts] Erro ao processar anexo {
  requestId: 'abc-123',
  anexo: 'ANEXO_II',
  errMessage: 'Template não encontrado'
}
```

## 🎓 Casos de Uso

### Caso 1: Todos os Anexos Presentes

```
Cliente: Leasing Residencial em GO
Anexos disponíveis: I, II, III, IV, VII
Auto-incluídos: II, III, IV
Resultado: Contrato + Anexos II, III, IV (ZIP com 4 PDFs)
```

### Caso 2: Anexo Faltando

```
Cliente: Leasing Residencial em SP
Anexos disponíveis: II, III (IV está faltando)
Auto-incluídos: II, III, IV
Resultado: Contrato + Anexos II, III (ZIP com 3 PDFs)
Aviso: "Anexo IV: Template não encontrado"
```

### Caso 3: Cliente Solicita Anexo Adicional

```
Cliente: Leasing Residencial em GO
Solicitação: anexosSelecionados: ["ANEXO_I"]
Auto-incluídos: II, III, IV
Resultado: Contrato + Anexos I, II, III, IV (ZIP com 5 PDFs)
```

## 🔐 Validações

### Campos Obrigatórios para Anexo I

Se o cliente solicitar o Anexo I, os seguintes campos são obrigatórios:

```json
{
  "modulosFV": "Descrição dos módulos fotovoltaicos",
  "inversoresFV": "Descrição dos inversores"
}
```

Caso contrário, retorna erro 400:
```json
{
  "code": "INVALID_PAYLOAD",
  "message": "O Anexo I exige a descrição dos módulos fotovoltaicos."
}
```

## 💡 Melhores Práticas

1. **Nomeação Consistente**: Use o padrão "Anexo [NUM] - [Descrição]"
2. **Numeração Clara**: Prefira numeração romana para anexos oficiais
3. **Descrições Claras**: Inclua descrição no nome do arquivo
4. **Versionamento**: Se criar versões, use sufixo como "Anexo II - V2.docx"
5. **Templates por UF**: Apenas crie templates específicos se houver diferenças reais

## 🚨 Troubleshooting

### Anexo Não é Encontrado

**Sintomas:** Anexo não aparece no pacote gerado

**Possíveis Causas:**
1. Nome do arquivo não começa com "Anexo" + número
2. Arquivo não está no diretório `anexos/`
3. Extensão diferente de `.docx` ou `.dotx`

**Solução:** Renomeie o arquivo seguindo o padrão correto

### Erro ao Renderizar Anexo

**Sintomas:** Erro no log "Erro ao processar anexo"

**Possíveis Causas:**
1. Variáveis Mustache incorretas no template
2. Arquivo corrompido
3. Template muito grande (> 8MB)

**Solução:** Valide o template e verifique os logs do servidor

## 📚 Referências

- `server/leasingContracts.js` - Implementação completa
- `CONTRATOS_UF_GUIDE.md` - Guia de templates por UF
- `TEMPLATE_VARIABLES.md` - Variáveis disponíveis
- `public/templates/contratos/README.md` - Estrutura de templates

## ✨ Mudanças Recentes

**Janeiro 2025:**
- ✅ Auto-descoberta de anexos por prefixo
- ✅ Suporte a numeração romana e árabe
- ✅ Busca case-insensitive
- ✅ Auto-inclusão de Anexos II, III, IV para Leasing Residencial/Comercial
- ✅ Tratamento robusto de anexos faltantes
- ✅ Suporte a "comercial" como novo tipo de contrato
- ✅ Templates específicos por UF para anexos

## 🎯 Próximos Passos

- [ ] Adicionar suporte para contratos de compra (residencial/comercial)
- [ ] Implementar auto-inclusão para outros tipos de contrato
- [ ] Adicionar mais anexos conforme necessário (IX, X, XI, etc.)
- [ ] Criar templates para outros estados brasileiros
