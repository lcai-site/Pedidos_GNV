# Integração Webhook Ticto → Supabase (sem n8n)

## Goal
Receber webhooks da Ticto diretamente no Supabase via Edge Function, armazenando TODOS os dados do payload para analytics futuro (faturamento bruto, comissões, desempenho comercial). Deduplicação por `transaction_hash`, cancelamentos/reembolsos atualizam status sem deletar.

## Decisões Arquiteturais

### Tabela `ticto_pedidos` (nova, completa)
- Campos normalizados para queries rápidas (filtros, dashboards)
- `payload_completo JSONB` com backup integral do webhook
- UNIQUE em `(transaction_hash, offer_code)` → UPSERT = deduplicação automática, pedido pai e OB coexistem
- Comissões em arrays JSONB para flexibilidade total

### Edge Function `quick-action` *(código local: `supabase/functions/webhook-ticto/`)*
- Recebe POST → Valida → UPSERT no banco → Log
- Usa `service_role` key (acesso total, sem RLS)
- Tabelas mantidas em paralelo: `pedidos` (legado) + `ticto_pedidos` (nova)

## Tasks

- [x] **Task 1**: Criar migration `030_criar_ticto_pedidos.sql`
  - Tabela `ticto_pedidos` com TODOS os campos do payload normalizados
  - UNIQUE em `transaction_hash`, índices para queries comuns
  - RLS + policies
  - → Verificar: SQL executa sem erro no SQL Editor do Supabase

- [x] **Task 2**: Criar Edge Function `supabase/functions/webhook-ticto/index.ts`
  - Recebe POST da Ticto
  - Valida headers (User-Agent = "Ticto Webhooks")
  - Mapeia payload → colunas da tabela
  - UPSERT por `transaction_hash` (dedup automática)
  - Loga em `ticto_logs`
  - Retorna 200 OK (ou 400/500 com erro)
  - → Verificar: `curl -X POST` com payload de teste retorna 200

- [x] **Task 3**: Criar documentação de deploy `DEPLOY_EDGE_FUNCTION.md`
  - Passo a passo para deploy via Supabase Dashboard (sem CLI)
  - Como configurar a URL do webhook no painel da Ticto
  - Como testar manualmente
  - → Verificar: Arquivo legível com passos claros

- [x] **Task 4**: Testar fluxo completo
  - [x] Enviar payload de teste simulando `authorized` → registro criado ✅
  - [x] Enviar mesmo payload novamente → confirmar dedup (sem duplicata) ✅
  - [x] Enviar payload OB (mesmo tx_hash, offer_code diferente) → 2 registros ✅
  - [x] Enviar payload com `status: refunded` → confirmar update sem deletar ✅
  - → Verificado: 14/14 testes passou via `test-webhook-flow.mjs`

## Schema da Tabela `ticto_pedidos`

```sql
-- Campos de identificação
transaction_hash TEXT NOT NULL           -- PK lógica / dedup (composta com offer_code)
offer_code TEXT                          -- Diferencia PAI de Order Bump
order_id INTEGER
order_hash TEXT

-- Status
status TEXT                            -- authorized, refunded, chargeback, canceled...
status_date TIMESTAMPTZ
commission_type TEXT                   -- producer, affiliate...

-- Pagamento
payment_method TEXT                    -- pix, credit_card, boleto...
paid_amount NUMERIC(10,2)             -- em reais (convertido de centavos)
installments INTEGER
shipping_amount NUMERIC(10,2)
shipping_type TEXT
shipping_method TEXT
shipping_delivery_days INTEGER
marketplace_commission NUMERIC(10,2)

-- Produto / Oferta
product_name TEXT
product_id INTEGER
offer_name TEXT
offer_id INTEGER
offer_code TEXT
offer_price NUMERIC(10,2)
is_subscription BOOLEAN
item_quantity INTEGER
item_amount NUMERIC(10,2)
coupon_id TEXT
coupon_name TEXT
coupon_value TEXT
refund_deadline INTEGER

-- Cliente
customer_name TEXT
customer_email TEXT
customer_cpf TEXT
customer_cnpj TEXT
customer_code TEXT
customer_phone TEXT                    -- ddi+ddd+number concatenado
customer_type TEXT                     -- person, company

-- Endereço
address_street TEXT
address_number TEXT
address_neighborhood TEXT
address_city TEXT
address_state TEXT
address_zip_code TEXT
address_country TEXT

-- Comissões (JSONB para flexibilidade)
producer JSONB                         -- {id, name, email, amount, cms, document}
affiliates JSONB                       -- [{id, name, email, amount, ...}]
coproducers JSONB                      -- [{id, name, email, amount, ...}]

-- Tracking / UTM
utm_source TEXT
utm_medium TEXT
utm_campaign TEXT
utm_content TEXT
utm_term TEXT
checkout_url TEXT

-- Meta
webhook_version TEXT                   -- "2.0"
token TEXT
query_params JSONB
tracking JSONB

-- Datas
order_date TIMESTAMPTZ
created_at TIMESTAMPTZ DEFAULT now()
updated_at TIMESTAMPTZ DEFAULT now()

-- Backup integral
payload_completo JSONB                 -- payload inteiro sem perda
```

## Done When
- [x] Migration aplicada no Supabase produção
- [x] Edge Function deployada e acessível via URL pública (`quick-action`)
- [x] URL configurada no painel Ticto como webhook
- [x] Pedidos chegam automaticamente sem n8n
- [x] Duplicatas são tratadas (UPSERT com chave composta)
- [x] Order Bumps coexistem com pedido pai (mesma transação)
- [x] Cancelamentos/reembolsos atualizam status sem deletar
