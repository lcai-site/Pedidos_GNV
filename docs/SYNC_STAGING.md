# Guia de Sincronização: Produção → Staging

Este guia mostra como copiar dados do banco de **produção** para o banco de **staging**.

## 📋 Pré-requisitos

1. Acesso ao painel Supabase de ambos os projetos
2. Credenciais de administrador

---

## 🔧 Método 1: Via Painel Supabase (Recomendado)

### Passo 1: Exportar dados de Produção

1. Acesse o Supabase de **Produção**: https://supabase.com/dashboard/project/cgyxinpejaoadsqrxbhy
2. Vá em **SQL Editor**
3. Execute este SQL para exportar cada tabela:

```sql
-- Exportar tabela pedidos (copie o resultado)
SELECT * FROM pedidos;
```

4. Clique em **Export** → **CSV** para baixar

### Passo 2: Importar no Staging

1. Acesse o Supabase de **Staging**: https://supabase.com/dashboard/project/vkeshyusimduiwjaijjv
2. Vá em **Table Editor**
3. Selecione a tabela `pedidos`
4. Clique em **Insert** → **Import data from CSV**
5. Faça upload do arquivo exportado

### Passo 3: Repetir para outras tabelas

Repita os passos para as tabelas importantes:
- `pedidos`
- `pedidos_unificados`
- `profiles`
- `estoque`
- `assinaturas`
- `carrinhos_abandonados`

---

## 🔧 Método 2: Via SQL (Avançado)

### No banco de PRODUÇÃO, execute:

```sql
-- Gerar INSERT statements para copiar (execute no SQL Editor de PRODUÇÃO)
-- Copie o resultado e execute no STAGING

-- Para pedidos (limite 100 para teste)
SELECT 'INSERT INTO pedidos (id, codigo_transacao, status, nome_cliente, email_cliente, cpf_cliente, telefone_cliente, cep, rua, numero, complemento, bairro, cidade, estado, nome_produto, nome_oferta, valor_total, forma_pagamento, parcelas, data_venda, created_at, updated_at) VALUES (' ||
  quote_literal(id) || ',' ||
  quote_literal(codigo_transacao) || ',' ||
  quote_literal(status) || ',' ||
  quote_literal(nome_cliente) || ',' ||
  quote_literal(email_cliente) || ',' ||
  quote_literal(cpf_cliente) || ',' ||
  quote_literal(telefone_cliente) || ',' ||
  quote_literal(cep) || ',' ||
  quote_literal(rua) || ',' ||
  quote_literal(numero) || ',' ||
  quote_literal(COALESCE(complemento, '')) || ',' ||
  quote_literal(bairro) || ',' ||
  quote_literal(cidade) || ',' ||
  quote_literal(estado) || ',' ||
  quote_literal(nome_produto) || ',' ||
  quote_literal(nome_oferta) || ',' ||
  valor_total || ',' ||
  quote_literal(forma_pagamento) || ',' ||
  COALESCE(parcelas::text, 'NULL') || ',' ||
  quote_literal(data_venda) || ',' ||
  quote_literal(created_at) || ',' ||
  quote_literal(updated_at) || ');'
FROM pedidos
LIMIT 100;
```

---

## 🔧 Método 3: Via Supabase CLI

### Instalar Supabase CLI
```bash
npm install -g supabase
```

### Fazer dump do banco de produção
```bash
# Conectar ao projeto de produção
supabase db dump -p cgyxinpejaoadsqrxbhy --data-only > producao_data.sql
```

### Restaurar no staging
```bash
# Conectar ao projeto de staging
supabase db push -p vkeshyusimduiwjaijjv < producao_data.sql
```

---

## ⚠️ Cuidados

1. **IDs duplicados**: Se o staging já tiver dados, pode haver conflitos de ID
2. **Foreign Keys**: Importe tabelas na ordem correta (tabelas base primeiro)
3. **RLS**: Desabilite temporariamente RLS durante importação
4. **Secrets**: Nunca commite as credenciais de produção

---

## ✅ Verificação

Após importar, verifique no SQL Editor do Staging:

```sql
SELECT 
  'pedidos' as tabela, COUNT(*) as registros FROM pedidos
UNION ALL
SELECT 'pedidos_unificados', COUNT(*) FROM pedidos_unificados
UNION ALL  
SELECT 'profiles', COUNT(*) FROM profiles;
```

Se os números baterem com produção, a sincronização foi bem-sucedida!
