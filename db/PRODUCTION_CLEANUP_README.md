# Script de Limpeza de Produção - Guia de Uso

## Visão Geral

O script `production_cleanup_script.sql` foi criado para executar uma limpeza abrangente no banco de dados de produção do Neon, atendendo aos seguintes requisitos:

1. ✅ Deletar permanentemente todos os nomes duplicados, mantendo apenas o registro mais importante (com mais informações além do nome)
2. ✅ Eliminar permanentemente todos os nomes inválidos ou com caracteres inválidos (null, 0, [], {}, etc)
3. ✅ Deletar permanentemente todas as propostas com nomes de cliente duplicados
4. ✅ Eliminar permanentemente todas as propostas com códigos inválidos (códigos válidos devem começar com "SLRINVST-VND" ou "SLRINVST-LSE")

## ⚠️ ATENÇÃO - OPERAÇÃO DESTRUTIVA

Este script executa **HARD DELETE permanente**. Os dados deletados **NÃO PODEM ser recuperados** após o COMMIT.

### Pré-requisitos Obrigatórios

1. **BACKUP COMPLETO**: Executar `pg_dump` do banco de produção antes de qualquer operação
2. **TESTE EM STAGING**: Testar o script completo em ambiente de staging/development primeiro
3. **REVISÃO**: Ler e entender cada bloco antes de executar
4. **ACESSO**: Ter acesso ao Neon SQL Editor de produção

## Estrutura do Script

O script está organizado em 6 blocos sequenciais:

### BLOCO A - Backup e Auditoria Inicial
- Preview de quantidades que serão deletadas
- Criação de tabelas de backup para auditoria
- **Ação**: Apenas leitura, sem modificações

### BLOCO B - Limpeza de Clientes Duplicados por Nome
- Identifica grupos de clientes com mesmo nome normalizado
- Calcula score de "valor" para cada cliente
- Mantém apenas o cliente com maior score
- Migra todas as FKs dependentes para o canônico
- **Ação**: DELETE permanente dos duplicados

**Critérios de Score (em ordem de prioridade):**
- Estar em portfólio: +500
- Ter contrato ativo/assinado/suspenso: +400
- Ter perfil de cobrança ativo: +300
- Ter proposta ativa: +200
- Ter documento (CPF ou CNPJ): +50
- Ter email válido: +30
- Ter telefone válido: +20
- Não estar soft-deleted: +10

### BLOCO C - Limpeza de Clientes com Nomes Inválidos
- Remove clientes com nomes NULL, vazios ou placeholders inválidos
- Apenas deleta clientes sem vínculos importantes (sem portfólio, contrato, billing, etc)
- **Ação**: DELETE permanente de clientes inválidos

**Nomes considerados inválidos:**
- NULL ou vazio
- Placeholders: '0', 'null', 'undefined', '[object object]', '{}', '[]', 'nan', 'n/a', 'na', '-', '—', '__', '??'
- Sem caracteres alfabéticos válidos

### BLOCO D - Limpeza de Propostas Duplicadas por Nome de Cliente
- Identifica grupos de propostas com mesmo nome de cliente
- Calcula score baseado em status, dados preenchidos, etc
- Mantém apenas a proposta mais completa/importante por nome
- **Ação**: DELETE permanente das propostas duplicadas

**Critérios de Score:**
- Status approved: +500
- Status sent: +400
- Status draft: +100
- Tem proposal_code: +200
- Tem capex_total: +100
- Tem consumption_kwh_month: +50
- Tem client_id: +30
- Tem contract_value: +20

### BLOCO E - Limpeza de Propostas com Códigos Inválidos
- Remove propostas cujo código não segue o padrão vigente
- **Códigos válidos**: SLRINVST-VND-* ou SLRINVST-LSE-*
- **Códigos inválidos**: NULL, UUID, formatos legados sem tipo, etc
- **Ação**: DELETE permanente de propostas com código inválido

### BLOCO F - Verificação Final
- Resumo da limpeza executada
- Verificação de que não restam duplicados ou inválidos
- Estatísticas finais do banco
- **Ação**: Apenas leitura, sem modificações

## Como Usar

### 1. Preparação

```bash
# Fazer backup completo do banco
pg_dump -h your-neon-host -U your-user -d your-database > backup_before_cleanup_$(date +%Y%m%d_%H%M%S).sql
```

### 2. Testar em Staging/Development

Executar o script completo em um ambiente de teste primeiro para validar o comportamento.

### 3. Execução em Produção

**IMPORTANTE**: Cada bloco deve ser executado separadamente no Neon SQL Editor.

#### 3.1. Executar BLOCO A (Preview e Backup)
Copiar e colar apenas a seção do BLOCO A no SQL Editor e executar. Revisar as quantidades reportadas.

#### 3.2. Executar BLOCO B (Clientes Duplicados)
1. Copiar e colar apenas a seção do BLOCO B
2. **PRIMEIRA EXECUÇÃO**: Trocar `COMMIT` por `ROLLBACK` no final do bloco
3. Executar e revisar os resultados
4. Se tudo estiver correto, trocar `ROLLBACK` por `COMMIT` e executar novamente

#### 3.3. Executar BLOCO C (Clientes Inválidos)
1. Copiar e colar apenas a seção do BLOCO C
2. **PRIMEIRA EXECUÇÃO**: Trocar `COMMIT` por `ROLLBACK`
3. Executar e revisar
4. Trocar por `COMMIT` e executar novamente

#### 3.4. Executar BLOCO D (Propostas Duplicadas)
1. Copiar e colar apenas a seção do BLOCO D
2. **PRIMEIRA EXECUÇÃO**: Trocar `COMMIT` por `ROLLBACK`
3. Executar e revisar
4. Trocar por `COMMIT` e executar novamente

#### 3.5. Executar BLOCO E (Propostas com Código Inválido)
1. Copiar e colar apenas a seção do BLOCO E
2. **PRIMEIRA EXECUÇÃO**: Trocar `COMMIT` por `ROLLBACK`
3. Executar e revisar
4. Trocar por `COMMIT` e executar novamente

#### 3.6. Executar BLOCO F (Verificação Final)
Copiar e colar a seção do BLOCO F e executar. Revisar todos os resultados de verificação.

## Tabelas de Backup Criadas

O script cria duas tabelas de auditoria que preservam os dados deletados:

- `public._cleanup_audit_clientes_deletados`: Backup de todos os clientes deletados
- `public._cleanup_audit_propostas_deletadas`: Backup de todas as propostas deletadas

Estas tabelas incluem o motivo da deleção e timestamp, permitindo auditoria completa da operação.

## Verificações Importantes

Após executar cada bloco, verificar:

1. ✅ A quantidade de registros deletados está dentro do esperado?
2. ✅ As tabelas de backup foram populadas corretamente?
3. ✅ Não houve erros de foreign key ou constraint violation?
4. ✅ As verificações finais (BLOCO F) confirmam a limpeza bem-sucedida?

## Em Caso de Problemas

Se algo der errado durante a execução:

1. **Durante a transação**: Se usou `ROLLBACK`, nada foi commitado
2. **Após COMMIT**: Restaurar do backup do pg_dump
3. **Investigar**: Consultar as tabelas `_cleanup_audit_*` para entender o que foi deletado

## Limpeza das Tabelas de Backup

Após confirmar que a limpeza foi bem-sucedida e não há necessidade de auditoria adicional:

```sql
-- Opcional: Remover tabelas de backup após alguns dias/semanas
DROP TABLE IF EXISTS public._cleanup_audit_clientes_deletados;
DROP TABLE IF EXISTS public._cleanup_audit_propostas_deletadas;
```

## Contato e Suporte

Em caso de dúvidas ou problemas, consultar a equipe de desenvolvimento antes de executar em produção.

---

**Última atualização**: 2026-04-24
**Versão do script**: 1.0
