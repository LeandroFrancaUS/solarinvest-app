# Guia Rápido: Como Adicionar Contratos Específicos por Estado (UF)

## ✅ Sistema Já Implementado!

O sistema de contratos agora suporta **templates específicos por estado (UF)** automaticamente. Quando um cliente solicita um contrato, o sistema:

1. **Primeiro** procura por um template específico do estado do cliente (ex: `GO/contrato.docx`)
2. **Se não encontrar**, usa automaticamente o template padrão

## 📦 Como Adicionar os Contratos de GO e DF

### Passo 1: Localize os arquivos de template

Os templates atualizados para GO e DF que foram mencionados devem ser copiados para os diretórios corretos:

```bash
# Para contratos de leasing de Goiás:
assets/templates/contratos/leasing/GO/

# Para contratos de leasing do Distrito Federal:
assets/templates/contratos/leasing/DF/

# Para contratos de vendas de Goiás:
assets/templates/contratos/vendas/GO/

# Para contratos de vendas do Distrito Federal:
assets/templates/contratos/vendas/DF/
```

### Passo 2: Nomes dos Arquivos

Os arquivos devem ter **exatamente o mesmo nome** dos templates padrão. Exemplos:

#### Para Leasing:
- `CONTRATO DE LEASING DE SISTEMA FOTOVOLTAICO - RESIDENCIA.docx`
- `CONTRATO DE LEASING DE SISTEMA FOTOVOLTAICO - CONDOMINIO.docx`
- `ANEXO I - ESPECIFICAÇÕES TECNICAS E PROPOSTA COMERCIAL (Residencial).docx`
- `ANEXO I - ESPECIFICAÇÕES TECNICAS E PROPOSTA COMERCIAL (Condominio).docx`
- E outros anexos...

### Passo 3: Upload dos Arquivos

#### Opção A: Via Git/GitHub
```bash
# Copie os arquivos para os diretórios corretos
cp "CONTRATO GO.docx" "assets/templates/contratos/leasing/GO/CONTRATO DE LEASING DE SISTEMA FOTOVOLTAICO - RESIDENCIA.docx"
cp "CONTRATO DF.docx" "assets/templates/contratos/leasing/DF/CONTRATO DE LEASING DE SISTEMA FOTOVOLTAICO - RESIDENCIA.docx"

# Commit e push
git add assets/templates/contratos/
git commit -m "Adicionar templates específicos de GO e DF"
git push
```

#### Opção B: Via Interface Web do GitHub
1. Navegue até `assets/templates/contratos/leasing/GO/` no GitHub
2. Clique em "Add file" → "Upload files"
3. Arraste os arquivos `.docx` de GO
4. Repita para `assets/templates/contratos/leasing/DF/`

### Passo 4: Verificação

Após upload, teste gerando um contrato para um cliente de GO ou DF. O sistema automaticamente:
- Detectará o UF do cliente
- Carregará o template específico do estado
- Preencherá com os dados do cliente

## 🔍 Como o Sistema Funciona

### Exemplo 1: Cliente de Goiás
```javascript
// Cliente com uf: "GO"
{
  "cliente": {
    "nomeCompleto": "João Silva",
    "cpfCnpj": "123.456.789-00",
    "uf": "GO",  // ← Sistema detecta automaticamente
    // ... outros campos
  }
}

// Sistema busca nesta ordem:
// 1. assets/templates/contratos/leasing/GO/CONTRATO DE LEASING... (SE EXISTIR)
// 2. assets/templates/contratos/leasing/CONTRATO DE LEASING... (FALLBACK)
```

### Exemplo 2: Cliente do Distrito Federal
```javascript
// Cliente com uf: "DF"
{
  "cliente": {
    "nomeCompleto": "Maria Santos",
    "cpfCnpj": "987.654.321-00",
    "uf": "DF",  // ← Sistema detecta automaticamente
    // ... outros campos
  }
}

// Sistema busca:
// 1. assets/templates/contratos/leasing/DF/CONTRATO DE LEASING... (SE EXISTIR)
// 2. assets/templates/contratos/leasing/CONTRATO DE LEASING... (FALLBACK)
```

### Exemplo 3: Cliente de São Paulo (sem template específico)
```javascript
// Cliente com uf: "SP" (sem template específico)
{
  "cliente": {
    "nomeCompleto": "Pedro Costa",
    "uf": "SP",
    // ... outros campos
  }
}

// Sistema usa diretamente o template padrão:
// assets/templates/contratos/leasing/CONTRATO DE LEASING...
```

## 📋 Checklist de Implementação

- [x] Sistema de resolução de templates por UF implementado
- [x] Estrutura de diretórios criada (GO/ e DF/)
- [x] Documentação completa adicionada
- [x] Fallback automático para templates padrão
- [x] Logs informativos no console do servidor
- [ ] **→ PRÓXIMO PASSO: Upload dos templates de GO e DF**
- [ ] Teste com dados reais
- [ ] Deploy em produção

## 🎯 Variáveis Disponíveis nos Templates

Ao criar ou modificar templates, use estas variáveis que serão automaticamente preenchidas:

### Contratos Gerais:
- `{{nomeCompleto}}` - Nome completo do cliente
- `{{cpfCnpj}}` - CPF ou CNPJ formatado
- `{{enderecoCompleto}}` - Endereço completo
- `{{unidadeConsumidora}}` - Número da UC
- `{{dataAtualExtenso}}` - Data por extenso

### Contratos de Leasing (adicionais):
- `{{potencia}}` - Potência em kWp
- `{{kWhContratado}}` - Energia em kWh
- `{{tarifaBase}}` - Tarifa em R$/kWh
- `{{dataInicio}}` e `{{dataFim}}` - Datas do contrato
- `{{modulosFV}}` e `{{inversoresFV}}` - Equipamentos
- `{{nomeCondominio}}`, `{{nomeSindico}}`, etc. (para condomínios)

## 🚀 Logs do Sistema

Quando templates específicos são usados, o servidor registra:

```
[contracts] Usando template específico para UF GO: leasing/GO/CONTRATO DE LEASING...
```

Quando usa fallback:
```
[contracts] Template específico para UF GO não encontrado, usando template padrão: leasing/CONTRATO...
```

## 🛠️ Suporte

Para mais detalhes técnicos, consulte:
- `assets/templates/contratos/README.md` - Documentação completa
- `server/contracts.js` - Implementação para contratos gerais
- `server/leasingContracts.js` - Implementação para contratos de leasing

## 💡 Dicas

1. **Mantenha os nomes idênticos**: O arquivo em `GO/` deve ter exatamente o mesmo nome do template padrão
2. **Teste localmente**: Use o servidor de desenvolvimento para testar antes do deploy
3. **Documentação no template**: Adicione comentários no próprio documento sobre mudanças específicas do estado
4. **Versionamento**: Considere incluir data no nome se criar múltiplas versões

## ✨ Benefícios

- ✅ **Automático**: Sistema detecta o UF e escolhe o template correto
- ✅ **Sem código**: Basta adicionar os arquivos `.docx` nos diretórios corretos
- ✅ **Fallback seguro**: Se template específico não existir, usa o padrão
- ✅ **Escalável**: Fácil adicionar templates para outros estados (SP, MG, RJ, etc.)
- ✅ **Manutenção simples**: Atualizar templates é só substituir os arquivos
