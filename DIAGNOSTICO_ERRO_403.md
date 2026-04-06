# 🔍 DIAGNÓSTICO: Erro 403 na Sincronização

## Seu Cenário (Pelos Prints)

✅ **Secrets configurados em 18 Mar 2026:**
- `MELHOR_ENVIO_TOKEN` = `f0a8aca51ebcfe5c8e0204d27aeb959ed0aa660183d8...`
- `MELHOR_ENVIO_USER_AGENT` = `f678354e0a2ac2ba49c27603e8dae72d1a159655175...`

❌ **Erro ocorrendo:**
```
code: 403
msg: 'permission error'
error: 'exceptions.UserAuthError'
```

---

## 🎯 Causa Mais Provável

### Edge Function Não Foi Redeployada

**Quando você adiciona/edita secrets no Supabase, precisa fazer deploy novamente da função.**

Os secrets são injetados no momento do deploy. Se a função foi deployada antes de 18 Mar, ela não tem acesso aos secrets.

---

## 🔍 Como Diagnosticar

### 1. Verificar Data do Último Deploy

1. Acesse: https://supabase.com/dashboard/project/cgyxinpejaoadsqrxbhy/functions
2. Olhe a coluna "Last deployed" para `sync-melhor-envio-tracking`
3. **Se for anterior a 18 Mar 2026** → Precisa redeployar

### 2. Verificar Logs da Função

1. Acesse: https://supabase.com/dashboard/project/cgyxinpejaoadsqrxbhy/logs
2. Filtre por:
   - Function: `sync-melhor-envio-tracking`
   - Data: Hoje
3. Procure por erros de autenticação

**Se ver logs como:**
```
MELHOR_ENVIO_TOKEN is undefined
ou
Authorization header is missing
```
→ Confirma que a função não está acessando os secrets.

### 3. Testar Token Manualmente

No seu terminal:

```bash
# Substitua SEU_TOKEN pelo valor real (pegue no Supabase)
curl -X GET "https://www.melhorenvio.com.br/api/v2/me/account" \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "User-Agent: GnutraVita/1.0 (camila@gnutravita.com.br)"
```

**Resultado esperado:**
```json
{
  "id": "...",
  "email": "...",
  "name": "..."
}
```

**Se der 401/403:** Token inválido → Precisa gerar novo token no Melhor Envio.

---

## ✅ Soluções

### Solução 1: Reimplantar a Função (90% dos casos)

**Pelo Dashboard:**
1. https://supabase.com/dashboard/project/cgyxinpejaoadsqrxbhy/functions
2. `sync-melhor-envio-tracking` → 3 pontos → **Deploy**
3. Aguarde "Deployment successful"
4. Teste no app

**Pelo CLI (alternativo):**
```bash
npx supabase login
npx supabase link --project-ref cgyxinpejaoadsqrxbhy
npx supabase functions deploy sync-melhor-envio-tracking
```

### Solução 2: Regenerar o Token

Se o token estiver inválido:

1. Acesse: https://www.melhorenvio.com.br/minha-conta/token
2. Gere um novo token
3. Atualize no Supabase Secrets
4. **Redeploy da função** (obrigatório!)

### Solução 3: Verificar Permissões RLS

Execute no SQL Editor:

```sql
-- Verificar se RLS está ativo
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename = 'pedidos_consolidados_v3';

-- Se rowsecurity = true, criar política
DROP POLICY IF EXISTS "Allow service role" ON pedidos_consolidados_v3;
CREATE POLICY "Allow service role" ON pedidos_consolidados_v3
  FOR ALL
  TO service_role
  USING (true);
```

---

## 🧪 Teste Após Correção

### Teste 1: Invocar Função Manualmente

No console do navegador (F12):

```javascript
const { data, error } = await supabase.functions.invoke('sync-melhor-envio-tracking', {
  method: 'POST',
  body: { order_ids: [] }
});
console.log('Resultado:', data, error);
```

**Sucesso:**
```json
{
  "success": true,
  "message": "Verificação concluída..."
}
```

### Teste 2: Verificar Atualização

No SQL Editor:

```sql
SELECT 
  id,
  codigo_rastreio,
  melhor_envio_id,
  status_envio,
  data_postagem
FROM pedidos_consolidados_v3
WHERE logistica_provider = 'Melhor Envio'
  AND data_postagem IS NOT NULL
ORDER BY data_postagem DESC
LIMIT 5;
```

**Sucesso:** Deve mostrar pedidos com `data_postagem` preenchida.

---

## 📊 Checklist de Verificação

- [ ] Última data de deploy é posterior a 18 Mar 2026?
- [ ] Logs não mostram erros de autenticação?
- [ ] Token é válido (teste curl funcionou)?
- [ ] Política RLS criada para service_role?
- [ ] Teste manual da função retornou sucesso?

---

## 🆘 Se Nada Funcionar

### Coletar Informações

1. **Logs completos da função:**
   - https://supabase.com/dashboard/project/cgyxinpejaoadsqrxbhy/logs

2. **Status da função:**
   ```sql
   SELECT 
     name,
     version,
     created_at,
     updated_at
   FROM vault.decrypted_secrets
   WHERE name LIKE '%MELHOR_ENVIO%';
   ```

3. **Teste com função simplificada:**
   - Criar função de teste que apenas retorna os secrets (para debug)

---

**Data:** 23/03/2026  
**Status:** Aguardando redeploy da função
