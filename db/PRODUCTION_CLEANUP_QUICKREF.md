# Quick Reference - Execução Produção

## ✅ Checklist Pré-Execução

- [ ] Backup completo realizado (pg_dump)
- [ ] Script testado em staging/development
- [ ] Equipe informada sobre a manutenção
- [ ] Acesso ao Neon SQL Editor confirmado
- [ ] Documentação revisada e compreendida

## 🚀 Sequência de Execução

### 1. BLOCO A - Preview e Backup
```sql
-- Copiar e executar seção BLOCO A
-- Revisar quantidades:
-- - Clientes duplicados
-- - Clientes inválidos
-- - Propostas duplicadas
-- - Propostas com código inválido
```

### 2. BLOCO B - Clientes Duplicados
```sql
-- Copiar seção BLOCO B
-- 1ª vez: trocar COMMIT por ROLLBACK
-- Executar e revisar
-- 2ª vez: usar COMMIT
```

### 3. BLOCO C - Clientes Inválidos
```sql
-- Copiar seção BLOCO C
-- 1ª vez: trocar COMMIT por ROLLBACK
-- Executar e revisar
-- 2ª vez: usar COMMIT
```

### 4. BLOCO D - Propostas Duplicadas
```sql
-- Copiar seção BLOCO D
-- 1ª vez: trocar COMMIT por ROLLBACK
-- Executar e revisar
-- 2ª vez: usar COMMIT
```

### 5. BLOCO E - Propostas Código Inválido
```sql
-- Copiar seção BLOCO E
-- 1ª vez: trocar COMMIT por ROLLBACK
-- Executar e revisar
-- 2ª vez: usar COMMIT
```

### 6. BLOCO F - Verificação Final
```sql
-- Copiar e executar seção BLOCO F
-- Confirmar que todos os checks passaram
-- Revisar estatísticas finais
```

## 📊 Resultados Esperados (BLOCO F)

Após execução completa, as seguintes queries devem retornar **0**:

- ✅ Clientes duplicados remanescentes: **0**
- ✅ Clientes com nomes inválidos remanescentes: **0**
- ✅ Propostas duplicadas remanescentes: **0**
- ✅ Propostas com códigos inválidos remanescentes: **0**

## 🔍 Tabelas de Auditoria

Dados deletados preservados em:
- `_cleanup_audit_clientes_deletados`
- `_cleanup_audit_propostas_deletadas`

## ⚠️ Em Caso de Erro

1. **Durante transação com ROLLBACK**: Nada foi modificado
2. **Após COMMIT**: Restaurar do backup pg_dump
3. **Investigar**: Consultar tabelas `_cleanup_audit_*`

## 📞 Suporte

Em caso de dúvidas ou problemas, **PARAR** e consultar a equipe de desenvolvimento.

---

**Arquivo principal**: `db/production_cleanup_script.sql`
**Documentação completa**: `db/PRODUCTION_CLEANUP_README.md`
