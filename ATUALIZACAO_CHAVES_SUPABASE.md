# 🔑 Atualização das Chaves de API do Supabase

## ⚠️ Problema Identificado

As chaves de API do projeto Supabase foram alteradas/rotacionadas, causando:
- ❌ Erro "Token JWT inválido ou expirado" no botão **RELATÓRIO DIÁRIO**
- ❌ Erro 401 "Invalid JWT" no agendamento automático (cron)
- ❌ Todos os usuários logados têm sessões inválidas

---

## 📋 Solução Completa

### **Passo 1: Copiar as Chaves Atuais**

1. Acesse: https://supabase.com/dashboard/project/cgyxinpejaoadsqrxbhy/settings/api
2. Em **Project access tokens**, copie as chaves:

```
ANON KEY (public):
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (copiar completa)

SERVICE ROLE KEY (secret):
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (copiar completa)
```

---

### **Passo 2: Atualizar .env.local**

Edite o arquivo `.env.local` na raiz do projeto:

```bash
# =================================================================
# CONFIGURAÇÕES SUPABASE (ATUALIZADO)
# =================================================================

VITE_SUPABASE_URL=https://cgyxinpejaoadsqrxbhy.supabase.co
VITE_SUPABASE_ANON_KEY=COLE_A_ANON_KEY_COMPLETA_AQUI

# =================================================================
# INSTRUÇÕES:
# 1. Substitua COLE_A_ANON_KEY_COMPLETA_AQUI pela chave real
# 2. Salve o arquivo
# 3. Reinicie o servidor de desenvolvimento (se estiver rodando)
# 4. Faça logout e login novamente
# =================================================================
```

---

### **Passo 3: Atualizar Migration do Cron**

Edite o arquivo:
```
supabase/migrations/123_fix_cron_relatorio_diario_final.sql
```

Substitua a linha com a Anon Key:

```sql
-- ANTES (chave antiga):
'{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNneHhpbmBlamFvYWRzcXJ4Ymh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwMDI5MzgsImV4cCI6MjA4MzU3ODkzOH0.RWzmWALEDjEn-1abD-IIFB30hIJViDm662kKj6rnzwA"}'::jsonb,

-- DEPOIS (chave nova):
'{"Content-Type": "application/json", "Authorization": "Bearer COLE_A_ANON_KEY_COMPLETA_AQUI"}'::jsonb,
```

Depois execute o migration no SQL Editor do Supabase.

---

### **Passo 4: Testar o Funcionamento**

#### **Teste 1: Disparo Manual (Botão)**

1. Faça **logout** e **login novamente** no sistema
2. Acesse a tela de **Logística & Envios**
3. Clique no botão **RELATÓRIO DIÁRIO**
4. ✅ Deve funcionar sem erro de JWT

#### **Teste 2: Disparo Automático (Cron)**

Execute no SQL Editor:

```sql
-- Testar chamada do cron
SELECT net.http_post(
    'https://cgyxinpejaoadsqrxbhy.supabase.co/functions/v1/relatorio-envios'::text,
    '{"automated": true}'::jsonb,
    '{}'::jsonb,
    '{"Content-Type": "application/json", "Authorization": "Bearer COLE_A_ANON_KEY_COMPLETA_AQUI"}'::jsonb,
    30000::int
) AS request_id;

-- Verificar resultado
SELECT 
    id,
    status_code,
    LEFT(content, 500) AS content_preview,
    created
FROM net._http_response
ORDER BY created DESC
LIMIT 3;
```

✅ Deve retornar `status_code = 200` com mensagem *"Relatório disparado com sucesso"*

---

### **Passo 5: Comunicar aos Usuários**

Envie uma mensagem para todos os usuários:

```
⚠️ ATUALIZAÇÃO DE SEGURANÇA

Devido a uma atualização das chaves de API do Supabase, 
todos os usuários precisam:

1. Fazer LOGOUT no sistema
2. Fazer LOGIN novamente

Isso é necessário para que seus tokens de sessão sejam 
atualizados.

Pedimos desculpas pelo transtorno.
```

---

## ✅ Checklist de Verificação

- [ ] Copiar Anon Key atual do dashboard
- [ ] Copiar Service Role Key atual do dashboard
- [ ] Atualizar arquivo `.env.local`
- [ ] Atualizar migration `123_fix_cron_relatorio_diario_final.sql`
- [ ] Executar migration no SQL Editor
- [ ] Testar disparo manual (botão)
- [ ] Testar disparo automático (cron)
- [ ] Fazer logout e login
- [ ] Comunicar aos usuários

---

## 📊 Resumo das Chaves

| Chave | Uso | Status |
|-------|-----|--------|
| Anon Key (antiga) | Frontend + Cron | ❌ Inválida |
| Service Role (antiga) | Operações internas | ❌ Inválida |
| **Anon Key (nova)** | Frontend + Cron | ✅ **Copiar do dashboard** |
| **Service Role (nova)** | Operações internas | ✅ **Copiar do dashboard** |

---

## 🆘 Suporte

Se após seguir todos os passos o erro persistir:

1. Verificar se as chaves foram copiadas **completamente** (sem cortar)
2. Verificar se não há espaços em branco no início/fim
3. Testar com um navegador em modo anônimo
4. Limpar cache e cookies do navegador

---

**Data:** 31/03/2026  
**Status:** Aguardando atualização das chaves
