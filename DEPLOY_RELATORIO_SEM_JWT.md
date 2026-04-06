# 🚀 Deploy da Edge Function sem Verificação JWT

## ⚠️ Problema

A Edge Function `relatorio-envios` está exigindo validação de JWT, mas o pg_cron não consegue fornecer um token JWT válido (com claim `sub`).

## ✅ Solução: Deploy com `--no-verify-jwt`

### **Opção 1: Via Supabase CLI (Recomendado)**

1. **Instalar o Supabase CLI** (se não tiver):
```bash
npm install -g supabase
```

2. **Fazer login:**
```bash
supabase login
```

3. **Navegar até a pasta do projeto:**
```bash
cd "c:\Users\Camila N. B. Camacho\Documents\APP\Pedidos_GNV"
```

4. **Deploy da função sem verificação JWT:**
```bash
supabase functions deploy relatorio-envios --no-verify-jwt
```

### **Opção 2: Pelo Dashboard**

1. Acesse: https://supabase.com/dashboard/project/cgyxinpejaoadsqrxbhy/functions
2. Clique em **relatorio-envios**
3. Vá em **Settings**
4. Desabilite **"JWT Verification"** ou **"Authentication Required"**
5. Salve as alterações

## 🧪 Testar Após o Deploy

Execute no SQL Editor:

```sql
-- Testar chamada SEM header Authorization
SELECT net.http_post(
    'https://cgyxinpejaoadsqrxbhy.supabase.co/functions/v1/relatorio-envios'::text,
    '{"automated": true}'::jsonb,
    '{}'::jsonb,
    '{"Content-Type": "application/json"}'::jsonb,
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

**Se retornar `status_code = 200`** com *"Relatório disparado com sucesso"*, funcionou!

## 📋 Atualizar o Cron Job

Após o deploy, atualize o migration do cron para não enviar o header Authorization:

```sql
-- Migration 123 atualizado
SELECT cron.schedule(
    'job_relatorio_diario_automatizado',
    '30 11 * * 1-5',
    $cron$
    SELECT net.http_post(
        'https://cgyxinpejaoadsqrxbhy.supabase.co/functions/v1/relatorio-envios'::text,
        '{"automated": true}'::jsonb,
        '{}'::jsonb,
        '{"Content-Type": "application/json"}'::jsonb,
        30000::int
    );
    $cron$
);
```

## ✅ Checklist

- [ ] Instalar Supabase CLI
- [ ] Fazer login (`supabase login`)
- [ ] Executar deploy com `--no-verify-jwt`
- [ ] Testar chamada manual
- [ ] Atualizar migration do cron
- [ ] Verificar logs no dashboard

---

**Data:** 31/03/2026  
**Status:** Aguardando deploy
