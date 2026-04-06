# 🚨 GUIA RÁPIDO: Corrigir Erro 403 na Sincronização de Rastreios

## Problema
Ao clicar em "SINCRONIZAR RASTREIOS" na aba ENVIADOS, aparece erro 403 (permission error).

## ⚠️ SEU CASO ESPECÍFICO

Pelos prints, os secrets **JÁ ESTÃO CONFIGURADOS** (desde 18 Mar):
- ✅ `MELHOR_ENVIO_TOKEN`
- ✅ `MELHOR_ENVIO_USER_AGENT`

**Provável causa:** A Edge Function não foi redeployada após configurar os secrets.

---

## ✅ SOLUÇÃO IMEDIATA (5 minutos)

### Opção 1: Reimplantar a Edge Function (RECOMENDADO)

1. **Acesse o Dashboard do Supabase:**
   - https://supabase.com/dashboard/project/cgyxinpejaoadsqrxbhy/functions

2. **Encontre a função:**
   - Procure por `sync-melhor-envio-tracking`

3. **Faça o Deploy/Redeploy:**
   - Clique nos 3 pontos (⋮) ao lado da função
   - Selecione **Deploy**
   - Aguarde a confirmação "Deployment successful"

4. **Teste:**
   - Volte para o app
   - Selecione pedidos na aba ENVIADOS
   - Clique em "SINCRONIZAR RASTREIOS"

---

### Opção 2: Script de Emergência (Imediato)

Se não conseguir acessar o Supabase agora:

**Passo 1:** Obtenha seu token do Melhor Envio
- https://www.melhorenvio.com.br/minha-conta/token

**Passo 2:** Abra o console do navegador (F12)

**Passo 3:** Cole este código (substitua SEU_TOKEN_AQUI):

```javascript
(async function() {
  const MELHOR_ENVIO_TOKEN = 'SEU_TOKEN_AQUI'; // ← COLOQUE SEU TOKEN
  const selectedOrders = new Set(); // Deixe vazio para todos ou adicione IDs
  
  const { data: pedidos } = await supabase
    .from('pedidos_consolidados_v3')
    .select('id, codigo_rastreio')
    .eq('logistica_provider', 'Melhor Envio')
    .is('data_postagem', null)
    .in('status_envio', ['Processando', 'Etiquetado', 'Pago']);
  
  const pedidosParaChecar = pedidos.filter(p => 
    p.codigo_rastreio && p.codigo_rastreio.length === 36
  );
  
  const response = await fetch('https://www.melhorenvio.com.br/api/v2/me/shipment/tracking', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${MELHOR_ENVIO_TOKEN}`,
      'User-Agent': 'GnutraVita/1.0 (camila@gnutravita.com.br)'
    },
    body: JSON.stringify({ orders: pedidosParaChecar.map(p => p.codigo_rastreio) })
  });
  
  const trackingData = await response.json();
  
  let atualizados = 0;
  for (const pedido of pedidosParaChecar) {
    const info = trackingData[pedido.codigo_rastreio];
    if (info?.tracking && info.tracking !== pedido.codigo_rastreio) {
      await supabase
        .from('pedidos_consolidados_v3')
        .update({
          codigo_rastreio: info.tracking,
          melhor_envio_id: pedido.codigo_rastreio,
          status_envio: 'Postado',
          data_postagem: new Date().toISOString()
        })
        .eq('id', pedido.id);
      atualizados++;
      console.log(`✅ ${pedido.id}: ${info.tracking}`);
    }
  }
  
  console.log(`🎉 ${atualizados} pedidos atualizados!`);
  location.reload();
})();
```

**Passo 4:** Pressione Enter e aguarde

---

## 🔍 Como Verificar se Funcionou

1. **No banco de dados:**
   ```sql
   SELECT id, codigo_rastreio, status_envio, data_postagem
   FROM pedidos_consolidados_v3
   WHERE logistica_provider = 'Melhor Envio'
     AND data_postagem IS NOT NULL
   ORDER BY data_postagem DESC
   LIMIT 10;
   ```

2. **Na interface:**
   - Vá para aba ENVIADOS
   - Verifique se os pedidos aparecem com código de rastreio (ex: LGI-ME2625R0XQ5BR)

---

## 📋 Arquivos Úteis Criados

| Arquivo | Descrição |
|---------|-----------|
| `CORRECAO_ERRO_403_SINCRONIZACAO.md` | Guia completo de correção |
| `scripts/sync_rastreios_emergencia.js` | Script para console do navegador |
| `scripts/sync_rastreios.mjs` | Script Node.js para execução local |
| `.env.local.example` | Modelo de configuração |

---

## ❓ Ainda com Problemas?

1. **Verifique os logs no Supabase:**
   - https://supabase.com/dashboard/project/cgyxinpejaoadsqrxbhy/logs

2. **Teste o token manualmente:**
   ```bash
   curl -H "Authorization: Bearer SEU_TOKEN" \
        https://www.melhorenvio.com.br/api/v2/me/account
   ```

3. **Veja o arquivo completo:** `CORRECAO_ERRO_403_SINCRONIZACAO.md`

---

**Última atualização:** 23/03/2026
