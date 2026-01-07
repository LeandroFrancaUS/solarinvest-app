# Templates Específicos para Goiás (GO)

Este diretório contém templates de contratos personalizados para clientes do estado de Goiás.

## Variáveis de Template Disponíveis

Para usar nos contratos, veja o arquivo `TEMPLATE_VARIABLES.md` na raiz do projeto. As principais variáveis são:

### Endereços (Formatados em MAIÚSCULAS)
- `{enderecoContratante}` - Endereço do contratante em ALL CAPS
- `{enderecoUCGeradora}` - Endereço de instalação da UC geradora em ALL CAPS

### Exemplo de Uso

**Cláusula do Contratante:**
```
CONTRATANTE: {nomeCompleto}, inscrito(a) no CPF/CNPJ nº {cpfCnpj}, residente e 
domiciliado(a) no endereço {enderecoContratante}, titular da Unidade Consumidora 
(UC) nº {unidadeConsumidora}, doravante denominado(a) simplesmente CONTRATANTE.
```

**Cláusula de Localização da UG:**
```
Quando aplicável, declara ainda ser o responsável pela Unidade Geradora (UG) nº 
{unidadeConsumidora}, localizada em {enderecoUCGeradora} conforme regras de 
geração compartilhada / remoto (Lei 14.300/2022).
```

## Templates Disponíveis

Para adicionar templates específicos para GO, coloque os arquivos `.docx` neste diretório com os mesmos nomes dos templates padrão.

Por exemplo:
- `CONTRATO UNIFICADO DE LEASING DE SISTEMA FOTOVOLTAICO.docx`

## Observações Legais

Ao criar templates específicos para Goiás, considere:
- Legislação estadual específica sobre energia solar
- Regulamentações da distribuidora local (ENEL/Equatorial Goiás)
- Requisitos contratuais específicos do estado
- ICMS e impostos estaduais

## Como Funciona

Quando um cliente com `uf: "GO"` solicitar um contrato, o sistema:
1. Primeiro tenta usar o template deste diretório
2. Se não encontrar, usa o template padrão da categoria pai

## Formato do Endereço

Os endereços são automaticamente formatados em ALL CAPS com a seguinte estrutura:
- `LOGRADOURO, CIDADE - UF, CEP`
- Exemplo: `RUA GOIANAZ, QD 15 L 5, CONJ MIRRAGE, ANAPOLIS - GO, 75070-180`

