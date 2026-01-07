# Template Variables for Contracts

This document describes the template variables available for use in contract DOCX templates.

## Address Fields (ALL CAPS Format)

The system now provides properly formatted address fields in ALL CAPS for use in contracts:

### Primary Address Fields

- `{enderecoContratante}` - **Contractor Address (ALL CAPS)**
  - Format: `LOGRADOURO, CIDADE - UF, CEP`
  - Example: `RUA GOIANAZ, QD 15 L 5, CONJ MIRRAGE, ANAPOLIS - GO, 75070-180`
  - Use this in the main contractor clause

- `{enderecoUCGeradora}` - **UC Generator Installation Address (ALL CAPS)**
  - Format: Same as `enderecoContratante`
  - Example: `ÁREA RURAL FAZENDA MODELO, KM 25, BRAZLÂNDIA - DF, 72720-000`
  - Use this in the clause about where the UC generator will be installed
  - If not specified separately, defaults to `enderecoContratante`

### Individual Address Components

For custom formatting needs, these components are also available:

- `{endereco}` - Street address (original case)
- `{cidade}` - City name (original case)
- `{uf}` - State code (uppercase, e.g., "GO", "DF", "SP")
- `{cep}` - CEP/ZIP code

### Legacy Address Fields (Deprecated)

- `{enderecoCompleto}` - Legacy complete address (original case)
- `{enderecoCliente}` - Alias for `enderecoCompleto`

## Client Information

- `{nomeCompleto}` - Full name or company name
- `{cpfCnpj}` - CPF or CNPJ (automatically formatted with dots and dashes)
- `{cnpj}` - CNPJ only
- `{rg}` - RG number
- `{razaoSocial}` - Company legal name
- `{representanteLegal}` - Legal representative name

## Personal Information

- `{estadoCivil}` - Marital status
- `{nacionalidade}` - Nationality
- `{profissao}` - Profession/occupation

## Contact Information

- `{telefone}` - Phone number
- `{email}` - Email address

## Installation & Energy

- `{unidadeConsumidora}` - Consumer Unit (UC) number
- `{localEntrega}` - Delivery/installation location (original case)
- `{potencia}` - System power capacity
- `{kWhContratado}` - Contracted energy (kWh)
- `{tarifaBase}` - Base tariff

## Equipment

- `{modulosFV}` - Photovoltaic modules description
- `{inversoresFV}` - Inverters description

## Dates

- `{dataAtualExtenso}` - Current date in extended format (e.g., "07 de janeiro de 2026")
- `{dataInicio}` - Contract start date
- `{dataFim}` - Contract end date
- `{dataHomologacao}` - Homologation date
- `{anoContrato}` - Contract year
- `{diaVencimento}` - Payment due day
- `{prazoContratual}` - Contract term/duration

## Contractor Company

- `{cnpjContratada}` - Contracted company CNPJ
- `{enderecoContratada}` - Contracted company address

## Example Usage in Contract Template

### Contractor Clause (CONTRATANTE)

```
CONTRATANTE: {nomeCompleto}, inscrito(a) no CPF/CNPJ nº {cpfCnpj}, residente e 
domiciliado(a) no endereço {enderecoContratante}, titular da Unidade Consumidora 
(UC) nº {unidadeConsumidora}, doravante denominado(a) simplesmente CONTRATANTE.
```

### UC Generator Location Clause

```
Quando aplicável, declara ainda ser o responsável pela Unidade Geradora (UG) nº 
{unidadeConsumidora}, localizada em {enderecoUCGeradora} conforme regras de 
geração compartilhada / remoto (Lei 14.300/2022).
```

## Notes

1. All template variables are case-sensitive
2. Use double curly braces `{{variable}}` or single `{variable}` - both formats are supported
3. Empty/missing values are replaced with empty strings
4. The system automatically selects state-specific templates when available (e.g., `leasing/GO/template.docx`)
5. If a state-specific template is not found, the system falls back to the default template in the category root

## State-Specific Templates

Templates can be organized by state (UF) in subdirectories:

```
assets/templates/contratos/
  leasing/
    CONTRATO UNIFICADO DE LEASING DE SISTEMA FOTOVOLTAICO.docx  (default)
    GO/
      CONTRATO UNIFICADO DE LEASING DE SISTEMA FOTOVOLTAICO.docx  (GO-specific)
    DF/
      CONTRATO UNIFICADO DE LEASING DE SISTEMA FOTOVOLTAICO.docx  (DF-specific)
  vendas/
    (similar structure)
```

When a client with `uf: "GO"` requests a contract, the system will:
1. First try to use `leasing/GO/CONTRATO UNIFICADO DE LEASING DE SISTEMA FOTOVOLTAICO.docx`
2. If not found, fall back to `leasing/CONTRATO UNIFICADO DE LEASING DE SISTEMA FOTOVOLTAICO.docx`
