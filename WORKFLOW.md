# Workflow de Desenvolvimento — Staging First

> **Regra de ouro:** Toda mudança vai para Staging primeiro. Só vai para Produção depois de testada e aprovada.

## Fluxo Visual

```
┌─────────────┐    ┌─────────────────┐    ┌──────────┐    ┌──────────────┐
│ Desenvolver │───▸│ Deploy Staging   │───▸│  Testar  │───▸│  Promover    │
│ localmente  │    │ npm run          │    │  npm run │    │  npm run     │
│             │    │ deploy:staging   │    │  dev     │    │  promote     │
└─────────────┘    └─────────────────┘    └──────────┘    └──────────────┘
```

## Ambientes

| Ambiente | Supabase | Quando usar |
|----------|----------|-------------|
| **Staging** | `vkeshyusimduiwjaijjv` | Testar mudanças, dev local |
| **Produção** | `cgyxinpejaoadsqrxbhy` | Sistema real, dados reais |

## Comandos Disponíveis

### Desenvolvimento

```bash
npm run dev              # Frontend conecta ao STAGING
npm run dev:prod         # Frontend conecta à PRODUÇÃO (read-only)
```

### Deploy

```bash
# Migrations SQL
npm run deploy:staging -- supabase/migrations/047_example.sql
npm run deploy:production -- supabase/migrations/047_example.sql

# Edge Functions
npm run deploy:fn:staging -- webhook-ticto
npm run deploy:fn:production -- webhook-ticto
```

### Testar

```bash
npm run test:run         # Testes unitários
npm run test:staging     # Teste de integração webhook
```

### Promover para Produção

```bash
npm run promote          # Verifica staging, confirma, gera instruções
```

### Sincronizar Dados

```bash
npm run sync:staging     # Copia dados Produção → Staging
```

## Fluxo Passo-a-Passo

### 1. Nova Feature / Migration

```bash
# 1. Crie o arquivo SQL
# supabase/migrations/047_minha_feature.sql

# 2. Aplique no staging
npm run deploy:staging -- supabase/migrations/047_minha_feature.sql

# 3. Teste localmente (conecta ao staging)
npm run dev

# 4. Se tudo OK, aplique em produção
npm run deploy:production -- supabase/migrations/047_minha_feature.sql

# 5. Sincronize dados
npm run sync:staging
```

### 2. Atualizar Edge Function

```bash
# 1. Edite o código em supabase/functions/webhook-ticto/index.ts

# 2. Deploy no staging
npm run deploy:fn:staging -- webhook-ticto

# 3. Teste
npm run test:staging

# 4. Se tudo OK, deploy em produção
npm run deploy:fn:production -- webhook-ticto
```

### 3. Promoção Completa

```bash
# Verifica tudo e gera instruções
npm run promote
```

## Fluxo de Dados vs Código

```
DADOS:   Produção ──────▸ Staging   (sync:staging)
CÓDIGO:  Staging  ──────▸ Produção  (promote)
```

## Edge Functions

| Pasta Local | Slug Produção | Slug Staging | Descrição |
|-------------|--------------|-------------|-----------|
| `webhook-ticto` | `quick-action` | `hyper-function` | Webhook Ticto → ticto_pedidos |
| `webhook-melhor-envio` | `webhook-melhor-envio` | `webhook-melhor-envio` | Webhook rastreamento |
