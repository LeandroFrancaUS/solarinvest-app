# Templates de Procuração - DF (Neoenergia)

Coloque os templates de procuração específicos para Distrito Federal (distribuidora Neoenergia) neste diretório.

## Templates Necessários

### Procuração Pessoa Física
- **Nome sugerido**: `Procuracao Neoenergia - PF.docx`
- **Variáveis obrigatórias**:
  - `{{procuracaoNome}}` - Nome completo do cliente (UPPERCASE)
  - `{{procuracaoCPF}}` - CPF formatado
  - `{{procuracaoRG}}` - RG do cliente (opcional, mas recomendado)
  - `{{procuracaoEndereco}}` - Endereço completo (UPPERCASE, opcional)

## Pontos de Substituição

### Parte Superior
O template DF pode ter dados fixos na parte superior (sem problemas).

### Parte Inferior (Assinatura - **CRÍTICO**)
Esta é a parte onde os problemas foram relatados. Certifique-se de adicionar:

```
Proprietário: {{procuracaoNome}}

CPF nº {{procuracaoCPF}}
```

**IMPORTANTE**: No template atual, esses campos estavam vazios sem tags. Agora eles DEVEM conter as tags Mustache.

## Instruções

Consulte o guia completo em `/PROCURACAO_TEMPLATE_GUIDE.md` para instruções detalhadas sobre:
- Como criar templates sem erros de "run fragmentado"
- Como preservar formatação (negrito)
- Como testar templates
- Troubleshooting

## Problema Relatado

> "DF só falha embaixo" - O template tinha dados fixos na parte superior, mas os campos de assinatura (nome e CPF) no rodapé estavam vazios SEM tags Mustache.

**Solução**: Adicionar `{{procuracaoNome}}` e `{{procuracaoCPF}}` nos campos de assinatura/rodapé.

## Status

❌ **Template não encontrado** - Este template ainda precisa ser criado/atualizado com as tags Mustache corretas na parte inferior.

Quando o template estiver pronto:
1. Verifique que as tags estão na parte inferior (assinatura)
2. Teste gerando um contrato para DF
3. Verifique os logs do backend para confirmar que não há erros de validação
