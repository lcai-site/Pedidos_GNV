# 🚀 Deploy: Edge Function Webhook Ticto

## Pré-requisitos
- Acesso ao painel Supabase (produção)
- Acesso ao painel Ticto (para configurar webhook URL)

---

## Passo 1: Aplicar a Migration no Supabase

1. Acesse o **Supabase Dashboard** → Projeto Produção
2. Vá em **SQL Editor**
3. Cole o conteúdo do arquivo `supabase/migrations/030_criar_ticto_pedidos.sql`
4. Clique em **Run**
5. Verifique: deve aparecer "Tabela ticto_pedidos criada com sucesso!"

**Conferir:** Vá em **Table Editor** e verifique se a tabela `ticto_pedidos` aparece na lista.

---

## Passo 2: Deploy da Edge Function

### Opção A: Via Supabase Dashboard (mais fácil)

1. Acesse o **Supabase Dashboard** → Projeto Produção
2. Vá em **Edge Functions** (menu lateral)
3. Clique em **Create a new function**
4. Nome da função: `quick-action` *(slug da URL — não pode ser alterado após criação)*
5. Cole o conteúdo do arquivo `supabase/functions/webhook-ticto/index.ts`
6. Clique em **Deploy**

### Opção B: Via Supabase CLI (alternativa)

```bash
# Instalar CLI (se não tiver)
npm install -g supabase

# Login
supabase login

# Link ao projeto
supabase link --project-ref cgyxinpejaoadsqrxbhy

# Deploy
supabase functions deploy quick-action --no-verify-jwt
```

> ⚠️ O flag `--no-verify-jwt` é necessário porque a Ticto envia o webhook sem token JWT do Supabase. A autenticação é feita pelo token dentro do payload.

---

## Passo 3: Configurar Variáveis de Ambiente

A Edge Function usa automaticamente:
- `SUPABASE_URL` → já configurada pelo Supabase
- `SUPABASE_SERVICE_ROLE_KEY` → já configurada pelo Supabase

**Nenhuma configuração extra necessária!**

---

## Passo 4: Anotar a URL da Edge Function

Após o deploy, a URL será:

```
https://cgyxinpejaoadsqrxbhy.supabase.co/functions/v1/quick-action
```

**Guarde essa URL** — vamos usar no próximo passo.

---

## Passo 5: Configurar Webhook na Ticto

1. Acesse o **painel Ticto** → Tictools → Webhooks
2. Clique em **Adicionar Webhook**
3. Configure:
   - **URL**: `https://cgyxinpejaoadsqrxbhy.supabase.co/functions/v1/quick-action`
   - **Eventos**: Selecione TODOS os que você quer receber:
     - ✅ Venda Aprovada (authorized)
     - ✅ Reembolso (refunded)
     - ✅ Chargeback
     - ✅ Cancelada
     - ✅ Aguardando Pagamento
     - ✅ Boleto Impresso
     - ✅ Pix Gerado
     - ✅ Venda Recusada
     - ✅ Abandono de Carrinho
     - ✅ [Assinatura] - Aprovada
     - ✅ [Assinatura] - Cancelada
     - ✅ [Assinatura] - Atrasada
     - ✅ [Assinatura] - Retomada
4. Salve

---

## Passo 6: Testar Manualmente

### Teste via cURL (simula um webhook da Ticto):

```bash
curl -X POST \
  https://cgyxinpejaoadsqrxbhy.supabase.co/functions/v1/quick-action \
  -H "Content-Type: application/json" \
  -H "User-Agent: Ticto Webhooks" \
  -d '{
    "version": "2.0",
    "commission_type": "producer",
    "status": "authorized",
    "status_date": "2026-02-13 09:00:00",
    "token": "TEST_TOKEN_123",
    "payment_method": "pix",
    "query_params": {},
    "tracking": {
      "utm_source": "teste",
      "utm_medium": "manual",
      "utm_campaign": "deploy_test",
      "utm_content": "Não Informado",
      "utm_term": "Não Informado",
      "src": "Não Informado",
      "sck": "Não Informado"
    },
    "checkout_url": "https://checkout.ticto.app/TEST",
    "order": {
      "id": 9999999,
      "hash": "TEST_HASH_001",
      "transaction_hash": "TEST_TX_001",
      "paid_amount": 14700,
      "installments": 1,
      "order_date": "2026-02-13 09:00:00"
    },
    "shipping": {
      "amount": 899,
      "type": "fixed",
      "method": null,
      "delivery_days": 21
    },
    "offer": {
      "id": 999,
      "code": "TEST_OFFER",
      "name": "Oferta de Teste",
      "description": null,
      "price": 14700,
      "is_subscription": false,
      "interval": null,
      "trial_days": null,
      "first_charge_price": null
    },
    "item": {
      "product_name": "Produto Teste",
      "product_id": 99999,
      "refund_deadline": 7,
      "offer_name": "Oferta de Teste",
      "offer_id": 999,
      "offer_code": "TEST_OFFER",
      "coupon_id": null,
      "coupon_name": null,
      "coupon_value": null,
      "quantity": 1,
      "amount": 14700
    },
    "owner_commissions": [],
    "transaction": {
      "hash": "TEST_TX_001"
    },
    "customer": {
      "cpf": "00000000000",
      "cnpj": null,
      "code": "TEST_CUSTOMER",
      "name": "Cliente Teste",
      "type": "person",
      "email": "teste@teste.com",
      "phone": { "ddd": "11", "ddi": "+55", "number": "999999999" },
      "phones": [],
      "address": {
        "city": "São Paulo",
        "state": "SP",
        "street": "Rua Teste",
        "country": "Brasil",
        "zip_code": "01001000",
        "neighborhood": "Centro",
        "street_number": "123"
      },
      "is_foreign": false,
      "language": "pt-BR"
    },
    "producer": { "id": 1, "name": "Teste", "email": "teste@teste.com", "amount": 7619 },
    "affiliates": [],
    "coproducers": [],
    "marketplace_commission": 881
  }'
```

**Resposta esperada:**
```json
{
  "success": true,
  "id": "uuid-gerado",
  "transaction_hash": "TEST_TX_001",
  "status": "Aprovado",
  "duration_ms": 50
}
```

### Verificar no banco:

No **SQL Editor** do Supabase, rode:
```sql
SELECT transaction_hash, status, customer_name, paid_amount, product_name
FROM ticto_pedidos
ORDER BY created_at DESC
LIMIT 5;
```

---

## Passo 7: Desativar n8n (após confirmar que funciona)

Depois de 24-48h recebendo webhooks com sucesso:

1. **NÃO delete** o webhook do n8n imediatamente
2. Mantenha os dois em paralelo por alguns dias
3. Compare os dados: `ticto_pedidos` vs tabelas que o n8n alimenta
4. Quando tiver confiança, desative o webhook do n8n no painel Ticto

---

## Troubleshooting

| Problema | Solução |
|----------|---------|
| Erro 500 na Edge Function | Verifique logs em **Edge Functions → Logs** no Dashboard |
| Dados não aparecem na tabela | Verifique se a migration 030 foi aplicada |
| Duplicatas aparecendo | Verifique se o UNIQUE constraint `(transaction_hash, offer_code)` está ativo |
| Webhook não chega | Confira a URL no painel Ticto e teste com cURL |

---

## Resumo da Arquitetura

```
Ticto (evento) 
  → POST webhook
  → Supabase Edge Function (quick-action)
    > Nota: O nome da função no Supabase é "quick-action", que corresponde ao nome da pasta local.
    → Valida payload
    → Mapeia campos
    → UPSERT em ticto_pedidos (dedup por transaction_hash + offer_code)
    → Log em ticto_logs
    → Retorna 200 OK

Fluxo de cancelamento:
  Mesma transação → webhook com status "refunded"
  → UPSERT atualiza status de "Aprovado" → "Reembolsado"
  → Pedido NÃO é deletado, apenas marcado
```
