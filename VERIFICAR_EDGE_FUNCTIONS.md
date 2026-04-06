# Verificação das Edge Functions

## 1. Verificar se as Edge Functions estão deployadas

Acesse: https://app.supabase.com/project/_/functions

Clique no seu projeto e verifique se aparecem:
- ✅ `correios-labels` 
- ✅ `correios-cotacao`

## 2. Se NÃO aparecerem, faça o deploy:

### Opção A: Deploy via Dashboard (Manual)

Para cada função (`correios-labels` e `correios-cotacao`):

1. No Supabase Dashboard → Edge Functions → "New Function"
2. Nome: `correios-labels` (ou `correios-cotacao`)
3. Cole o código do arquivo correspondente em `supabase/functions/[nome]/index.ts`
4. Clique em "Deploy"

### Opção B: Deploy via CLI

```bash
# Na pasta do projeto
cd "c:\Users\Camila N. B. Camacho\Documents\APP\Pedidos_GNV"

# Deploy das funções
supabase functions deploy correios-labels
supabase functions deploy correios-cotacao
```

## 3. Verificar Secrets

No Dashboard → Edge Functions → [sua função] → Secrets, deve ter:

- ✅ `SUPABASE_URL`
- ✅ `SUPABASE_SERVICE_ROLE_KEY`
- ✅ `CORREIOS_BASIC_AUTH`
- ✅ `MEUSCORREIOS_TOKEN`

## 4. Testar a Função

No Dashboard → Edge Functions → `correios-labels` → Invocations

Teste com este payload:
```json
{
  "orderData": {
    "id": "teste-123",
    "cep": "01310100",
    "nome_cliente": "Teste",
    "cliente_cpf": "12345678901",
    "endereco_rua": "Rua Teste",
    "endereco_numero": "123",
    "endereco_bairro": "Centro",
    "endereco_cidade": "São Paulo",
    "endereco_estado": "SP",
    "cliente_telefone": "11999999999",
    "cliente_email": "teste@teste.com",
    "produto_nome": "Teste"
  }
}
```

## 5. Ver Logs de Erro

Se falhar, verifique os logs em:
Dashboard → Edge Functions → `correios-labels` → Logs

---

## Solução Rápida

Se você acabou de criar o projeto e nunca deployou as funções, execute no terminal:

```bash
supabase login
supabase link --project-ref SEU_PROJECT_REF
supabase functions deploy correios-labels
supabase functions deploy correios-cotacao
```

Substitua `SEU_PROJECT_REF` pelo código do seu projeto (encontrado na URL do Supabase: `https://[PROJECT_REF].supabase.co`)
