# Templates Específicos para Distrito Federal (DF)

Este diretório contém templates de contratos personalizados para clientes do Distrito Federal.

## Templates Disponíveis

Para adicionar templates específicos para DF, coloque os arquivos `.docx` neste diretório com os mesmos nomes dos templates padrão.

Por exemplo:
- `CONTRATO DE LEASING DE SISTEMA FOTOVOLTAICO - RESIDENCIA.docx`
- `CONTRATO DE LEASING DE SISTEMA FOTOVOLTAICO - CONDOMINIO.docx`

## Observações Legais

Ao criar templates específicos para o Distrito Federal, considere:
- Legislação distrital específica sobre energia solar
- Regulamentações da distribuidora local (CEB)
- Requisitos contratuais específicos do DF

## Como Funciona

Quando um cliente com `uf: "DF"` solicitar um contrato, o sistema:
1. Primeiro tenta usar o template deste diretório
2. Se não encontrar, usa o template padrão da categoria pai
