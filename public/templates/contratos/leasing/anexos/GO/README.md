# Templates de Procuração - GO (Equatorial)

Coloque os templates de procuração específicos para Goiás (distribuidora Equatorial) neste diretório.

## Templates Necessários

### Procuração Pessoa Física
- **Nome sugerido**: `Procuracao Equatorial - PF.docx`
- **Variáveis obrigatórias**:
  - `{{procuracaoNome}}` - Nome completo do cliente (UPPERCASE)
  - `{{procuracaoCPF}}` - CPF formatado
  - `{{procuracaoRG}}` - RG do cliente
  - `{{procuracaoEndereco}}` - Endereço completo (UPPERCASE)

## Pontos de Substituição

### 1. Primeira Parte (Outorgante)
```
Outorgante {{procuracaoNome}}, BRASILEIRO, portador do CPF nº {{procuracaoCPF}}, RG nº {{procuracaoRG}}, residente na {{procuracaoEndereco}}
```

### 2. Parte Inferior (Assinatura/Proprietário)
```
Proprietário: _______________________________________________

CPF nº {{procuracaoCPF}}
```

## Instruções

Consulte o guia completo em `/PROCURACAO_TEMPLATE_GUIDE.md` para instruções detalhadas sobre:
- Como criar templates sem erros de "run fragmentado"
- Como preservar formatação (negrito)
- Como testar templates
- Troubleshooting

## Status

❌ **Template não encontrado** - Este template ainda precisa ser criado com as tags Mustache corretas.

Quando o template estiver pronto:
1. Verifique que todas as variáveis estão presentes
2. Teste gerando um contrato
3. Verifique os logs do backend para confirmar que não há erros de validação
