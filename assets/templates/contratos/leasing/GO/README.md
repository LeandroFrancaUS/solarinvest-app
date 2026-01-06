# Templates Específicos para Goiás (GO)

Este diretório contém templates de contratos personalizados para clientes do estado de Goiás.

## Templates Disponíveis

Para adicionar templates específicos para GO, coloque os arquivos `.docx` neste diretório com os mesmos nomes dos templates padrão.

Por exemplo:
- `CONTRATO DE LEASING DE SISTEMA FOTOVOLTAICO - RESIDENCIA.docx`
- `CONTRATO DE LEASING DE SISTEMA FOTOVOLTAICO - CONDOMINIO.docx`

## Observações Legais

Ao criar templates específicos para Goiás, considere:
- Legislação estadual específica sobre energia solar
- Regulamentações da distribuidora local
- Requisitos contratuais específicos do estado

## Como Funciona

Quando um cliente com `uf: "GO"` solicitar um contrato, o sistema:
1. Primeiro tenta usar o template deste diretório
2. Se não encontrar, usa o template padrão da categoria pai
