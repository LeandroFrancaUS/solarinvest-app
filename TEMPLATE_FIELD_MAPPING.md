# Complete Template Field Mapping for Leasing Contracts

This document shows the complete mapping between contract template tags and form fields.

## All Template Tags - Status

### ✅ Core Client Information
| Template Tag | Form Field | Location | Type |
|-------------|-----------|----------|------|
| `{{nomeCompleto}}` | Nome ou Razão social | Dados do cliente | text input |
| `{{cpfCnpj}}` | CPF/CNPJ | Dados do cliente | text input |
| `{{email}}` | E-mail | Dados do cliente | email input |
| `{{telefone}}` | Telefone | Dados do cliente | tel input |

### ✅ Personal Information (for individuals)
| Template Tag | Form Field | Location | Type |
|-------------|-----------|----------|------|
| `{{rg}}` | RG | Dados do cliente | text input |
| `{{estadoCivil}}` | Estado Civil | Dados do cliente | select dropdown |
| `{{nacionalidade}}` | Nacionalidade | Dados do cliente | text input |
| `{{profissao}}` | Profissão | Dados do cliente | text input |

### ✅ Company Information (for legal entities)
| Template Tag | Form Field | Location | Type |
|-------------|-----------|----------|------|
| `{{razaoSocial}}` | Razão Social | Dados do cliente | text input |
| `{{representanteLegal}}` | Representante Legal | Dados do cliente | text input |
| `{{cnpj}}` | CNPJ (empresa) | Dados do cliente | text input |

### ✅ Address Information
| Template Tag | Form Field | Location | Type | Notes |
|-------------|-----------|----------|------|-------|
| `{{cidade}}` | Cidade | Dados do cliente | text input | |
| `{{uf}}` | UF ou Estado | Dados do cliente | select dropdown | |
| `{{cep}}` | CEP | Dados do cliente | text input | Auto-fills address |
| `{{endereco}}` | Endereço do Contratante | Dados do cliente | text input | |
| `{{enderecoCompleto}}` | - | - | computed | Built from: endereco, cidade, uf, cep |
| `{{enderecoCliente}}` | - | - | alias | Same as enderecoCompleto |
| `{{enderecoContratante}}` | - | - | computed | ALL CAPS format of contractor address |
| `{{enderecoUCGeradora}}` | Endereço de instalação da UC geradora | Dados do cliente | text input | ALL CAPS format |
| `{{localEntrega}}` | Endereço de instalação da UC geradora | Dados do cliente | text input | Original case |

### ✅ UC (Consumer Unit) Information
| Template Tag | Form Field | Location | Type |
|-------------|-----------|----------|------|
| `{{unidadeConsumidora}}` | UC Geradora (número) | Dados do cliente | text input |

### ✅ Contract Dates
| Template Tag | Form Field | Location | Type |
|-------------|-----------|----------|------|
| `{{dataInicio}}` | Data de início do contrato | Dados contratuais | date input |
| `{{dataFim}}` | Data de término do contrato | Dados contratuais | date input |
| `{{dataHomologacao}}` | Data da homologação | Dados contratuais | date input (optional) |
| `{{dataAtualExtenso}}` | - | - | auto-generated | e.g., "07 de janeiro de 2026" |
| `{{anoContrato}}` | - | - | computed | Extracted from dataInicio |

### ✅ Contract Terms
| Template Tag | Form Field | Location | Type |
|-------------|-----------|----------|------|
| `{{diaVencimento}}` | Dia de vencimento da mensalidade | Dados contratuais | select (1-28) |
| `{{prazoContratual}}` | - | - | computed | e.g., "20 anos (240 meses)" |

### ✅ Technical Specifications
| Template Tag | Form Field | Location | Type | Notes |
|-------------|-----------|----------|------|-------|
| `{{potencia}}` | - | Calculadora | auto-calculated | kWp |
| `{{kWhContratado}}` | - | Calculadora | auto-calculated | kWh/mês |
| `{{tarifaBase}}` | - | Calculadora | auto-calculated | R$/kWh |
| `{{modulosFV}}` | Módulos fotovoltaicos instalados | Dados contratuais | textarea |
| `{{inversoresFV}}` | Inversores instalados | Dados contratuais | textarea |

### ✅ SolarInvest Company Information
| Template Tag | Form Field | Location | Type | Notes |
|-------------|-----------|----------|------|-------|
| `{{cnpjContratada}}` | - | - | constant | SOLARINVEST_CNPJ |
| `{{enderecoContratada}}` | - | - | constant | SOLARINVEST_ENDERECO |

## Implementation Details

### Constants in src/App.tsx
```javascript
const SOLARINVEST_CNPJ = '00.000.000/0000-00' // TODO: Replace with actual CNPJ
const SOLARINVEST_ENDERECO = 'Endereço da SolarInvest, Cidade - UF, CEP' // TODO: Replace with actual address
```

### New Fields in CLIENTE_INICIAL
- `rg: ''`
- `estadoCivil: ''`
- `nacionalidade: ''`
- `profissao: ''`
- `razaoSocial: ''`
- `representanteLegal: ''`
- `cnpj: ''`
- `diaVencimento: '10'` (default)

### Computed/Auto-Generated Fields
1. **enderecoCompleto** - Built from: `endereco + cidade + uf + cep`
2. **enderecoContratante** - ALL CAPS version of enderecoCompleto
3. **enderecoUCGeradora** - ALL CAPS version of localEntrega (or enderecoContratante if same)
4. **dataAtualExtenso** - Current date in Portuguese full format
5. **anoContrato** - Year extracted from dataInicio
6. **prazoContratual** - Formatted as "X anos (Y meses)"

## Form Organization

Fields are organized in logical groups for a professional layout:

1. **Dados do cliente** section:
   - Basic info: Nome, CPF/CNPJ
   - Personal info: RG, Estado Civil, Nacionalidade, Profissão
   - Company info: Razão Social, Representante Legal, CNPJ
   - Contact: E-mail, Telefone
   - Location: CEP, Distribuidora, Tipo de Edificação
   - UC: UC Geradora, Endereços

2. **Dados contratuais do leasing** section:
   - Contract dates: dataInicio, dataFim, dataHomologacao
   - Payment: diaVencimento
   - Equipment: modulosFV, inversoresFV

## Address Formatting

All addresses are automatically formatted in ALL CAPS for legal contract compliance:

**Input Format:**
```
endereco: "Rua Goianaz, QD 15 L 5, Conj Mirrage"
cidade: "Anapolis"
uf: "GO"
cep: "75070-180"
```

**Output Format (in contract):**
```
RUA GOIANAZ, QD 15 L 5, CONJ MIRRAGE, ANAPOLIS - GO, 75070-180
```

## Next Steps

1. Update `SOLARINVEST_CNPJ` and `SOLARINVEST_ENDERECO` constants with actual company information
2. Test contract generation with all fields populated
3. Verify all template tags are replaced correctly in generated contracts
4. Consider making company info configurable via settings/environment variables
