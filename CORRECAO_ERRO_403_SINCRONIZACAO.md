# 🚨 CORREÇÃO: Erro 403 na Sincronização de Rastreios (Aba ENVIOS)

## Problema Identificado

Ao executar a sincronização de rastreio nos pedidos na aba **ENVIOS**, o sistema apresenta:

### Erros no Console:
```javascript
Uncaught (in promise) Object
  code: 403
  data: {
    code: 403, 
    msg: 'permission error', 
    error: 'exceptions.UserAuthError'
  }
```

### Sintomas:
1. ❌ Não troca o ID do carrinho pelo código de rastreio real
2. ❌ Erro de permissão 403 ao invocar Edge Function
3. ❌ Pedidos permanecem com UUID do carrinho no campo `codigo_rastreio`

---

## 📋 Causas Raiz

### 1. **Edge Function Não Foi Reimplantada Após Configurar Secrets** ⚠️ (MAIS PROVÁVEL)

Os secrets foram configurados em 18 Mar, mas a Edge Function pode não ter sido redeployada.

**Sintoma:** A função não consegue acessar os secrets porque eles só estão disponíveis após o deploy.

### 2. **Permissões de Banco de Dados (RLS)**

A Edge Function pode não ter permissão para atualizar a tabela `pedidos_consolidados_v3`.

### 3. **Token do Melhor Envio Inválido ou Expirado**

O token configurado pode estar incorreto ou sem permissões adequadas.

### 4. **User-Agent Mal Formatado**

O campo `MELHOR_ENVIO_USER_AGENT` deve estar no formato correto.

---

## ✅ SOLUÇÃO PASSO A PASSO

### Passo 1: Verificar se Secrets Estão Ativos

1. Acesse: https://supabase.com/dashboard/project/cgyxinpejaoadsqrxbhy/functions/secrets
2. Confirme que os secrets estão listados (veja sua imagem - já estão!)
3. **Importante:** Os secrets só funcionam após **redeploy** da função

### Passo 2: Reimplantar a Edge Function (CRUCIAL) ⭐

Os secrets foram atualizados em 18 Mar, mas a função precisa ser redeployada:

**Opção A - Pelo Dashboard do Supabase:**
1. Vá para: https://supabase.com/dashboard/project/cgyxinpejaoadsqrxbhy/functions
2. Encontre `sync-melhor-envio-tracking`
3. Clique nos 3 pontos > **Deploy** (ou "Redeploy")
4. Aguarde a confirmação

**Opção B - Pelo CLI (se tiver instalado):**
```bash
supabase login
supabase link --project-ref cgyxinpejaoadsqrxbhy
supabase functions deploy sync-melhor-envio-tracking
```

### Passo 3: Verificar Permissões no Banco de Dados

Execute no SQL Editor do Supabase:

```sql
-- Verificar RLS (Row Level Security)
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename = 'pedidos_consolidados_v3';

-- Se RLS estiver ativo, criar política para service role
DROP POLICY IF EXISTS "Service role full access" ON pedidos_consolidados_v3;
CREATE POLICY "Service role full access" ON pedidos_consolidados_v3
  FOR ALL 
  USING (true);
```

---

## 🔍 DEBUG: Verificando se Funcionou

### Teste 1: Invocar Manualmente pelo Console

No console do navegador (F12), execute:

```javascript
const { data, error } = await supabase.functions.invoke('sync-melhor-envio-tracking', {
  method: 'POST',
  body: { order_ids: [] } // Vazio para testar CRON
});
console.log('Resultado:', data, error);
```

**Resultado esperado:**
```json
{
  "success": true,
  "message": "Verificação concluída. X pedidos transferidos para 'Enviados'."
}
```

### Teste 2: Verificar Logs da Edge Function

1. No Dashboard do Supabase
2. Vá para **Logs** > **Edge Functions**
3. Filtre por `sync-melhor-envio-tracking`
4. Verifique se há erros de autenticação

### Teste 3: Verificar Pedidos Atualizados

Execute no SQL Editor:

```sql
-- Verificar pedidos com UUID (36 chars) ainda pendentes
SELECT id, codigo_rastreio, status_envio, data_postagem
FROM pedidos_consolidados_v3
WHERE logistica_provider = 'Melhor Envio'
  AND LENGTH(codigo_rastreio) = 36
  AND data_postagem IS NULL
ORDER BY updated_at DESC
LIMIT 10;
```

**Resultado esperado:** Nenhuma linha (todos foram atualizados)

---

## 🛠️ SOLUÇÃO ALTERNATIVA (Enquanto Corrige)

Se precisar sincronizar urgentemente, use o serviço direto pelo frontend:

### Opção A: Usar o Serviço `melhorEnvioService`

No console do navegador:

```javascript
// Importar o serviço
const { melhorEnvioService } = await import('./lib/services/melhorEnvioService.js');

// Sincronizar todos os pedidos pendentes
const resultado = await melhorEnvioService.sincronizarRastreios();
console.log('Sincronização concluída:', resultado);
```

### Opção B: Script Node.js Local

Crie o arquivo `scripts/sync_rastreios.mjs`:

```javascript
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

const MELHOR_ENVIO_TOKEN = process.env.VITE_MELHOR_ENVIO_TOKEN;

async function sincronizarRastreios() {
  console.log('🔄 Iniciando sincronização...');
  
  // 1. Buscar pedidos pendentes
  const { data: pedidos } = await supabase
    .from('pedidos_consolidados_v3')
    .select('id, codigo_rastreio')
    .eq('logistica_provider', 'Melhor Envio')
    .is('data_postagem', null)
    .limit(100);
  
  if (!pedidos?.length) {
    console.log('✅ Nenhum pedido pendente.');
    return;
  }
  
  console.log(`📦 ${pedidos.length} pedidos para sincronizar.`);
  
  // 2. Chamar API do Melhor Envio
  const response = await fetch('https://www.melhorenvio.com.br/api/v2/me/shipment/tracking', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${MELHOR_ENVIO_TOKEN}`,
      'User-Agent': 'GnutraVita/1.0 (camila@gnutravita.com.br)'
    },
    body: JSON.stringify({
      orders: pedidos.map(p => p.codigo_rastreio)
    })
  });
  
  const trackingData = await response.json();
  console.log('📡 Resposta API:', trackingData);
  
  // 3. Atualizar banco
  let atualizados = 0;
  for (const pedido of pedidos) {
    const info = trackingData[pedido.codigo_rastreio];
    if (info?.tracking && info.tracking !== pedido.codigo_rastreio) {
      await supabase
        .from('pedidos_consolidados_v3')
        .update({
          codigo_rastreio: info.tracking,
          melhor_envio_id: pedido.codigo_rastreio,
          status_envio: 'Postado',
          data_postagem: info.posted_at || new Date().toISOString()
        })
        .eq('id', pedido.id);
      atualizados++;
      console.log(`✅ ${pedido.id}: ${pedido.codigo_rastreio} → ${info.tracking}`);
    }
  }
  
  console.log(`🎉 ${atualizados} pedidos atualizados.`);
}

sincronizarRastreios();
```

Execute:
```bash
node scripts/sync_rastreios.mjs
```

---

## 📝 Checklist de Verificação

- [ ] Variável `MELHOR_ENVIO_TOKEN` configurada no Supabase
- [ ] Variável `MELHOR_ENVIO_USER_AGENT` configurada no Supabase
- [ ] Edge Function `sync-melhor-envio-tracking` implantada
- [ ] Permissões de banco verificadas
- [ ] Teste de invocação manual bem-sucedido
- [ ] Pedidos sendo atualizados corretamente

---

## 🚀 Prevenção Futura

### 1. Adicionar Validação de Erro 403

No `Logistics.tsx`, linha ~920:

```typescript
if (error) {
  console.error(error);
  
  // Verificar se é erro de permissão
  if (error.code === 403 || error.message?.includes('permission')) {
    toast.error(
      'Erro de permissão! Configure as variáveis MELHOR_ENVIO_TOKEN no Supabase.',
      { id: toastId, duration: 10000 }
    );
  } else {
    toast.error(`Erro ao sincronizar rastreios: ${error.message}`, { 
      id: toastId, 
      duration: 8000 
    });
  }
}
```

### 2. Adicionar Health Check

Criar endpoint de verificação:

```typescript
// supabase/functions/check-melhor-envio-health/index.ts
Deno.serve(async () => {
  const token = Deno.env.get('MELHOR_ENVIO_TOKEN');
  
  if (!token) {
    return new Response(JSON.stringify({
      ok: false,
      error: 'MELHOR_ENVIO_TOKEN não configurado'
    }), { status: 500 });
  }
  
  // Testar conexão com API
  const response = await fetch('https://www.melhorenvio.com.br/api/v2/me/account', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  return new Response(JSON.stringify({
    ok: response.ok,
    status: response.status
  }));
});
```

---

## 📞 Suporte

Se o problema persistir após seguir todos os passos:

1. Verifique os logs completos no Supabase
2. Teste o token manualmente:
   ```bash
   curl -H "Authorization: Bearer SEU_TOKEN" \
        -H "User-Agent: GnutraVita/1.0" \
        https://www.melhorenvio.com.br/api/v2/me/account
   ```
3. Contate o suporte do Melhor Envio se o token estiver inválido

---

**Data da Correção:** 23/03/2026  
**Responsável:** Sistema de Logística GNV  
**Status:** ⚠️ Aguardando Configuração
