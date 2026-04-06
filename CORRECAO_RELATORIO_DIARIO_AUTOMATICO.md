# Correção do Relatório Diário Automático

## Problema Identificado

O disparo automático do relatório diário não estava funcionando corretamente devido a:

1. **Jobs conflitantes**: Existiam 2 jobs do pg_cron agendados:
   - `job_relatorio_diario_envios` (Migration 065): 11:30 UTC (08:30 BRT) - **Sem parâmetro `automated`**
   - `job_relatorio_diario_oficial` (Migration 122): 18:00 UTC (15:00 BRT) - Com parâmetro `automated: true`

2. **Parâmetro `automated` ausente**: O job 065 chamava a função sem o parâmetro `automated: true`, o que fazia com que a lógica de filtro por `status_envio = 'pronto'` não fosse acionada corretamente.

3. **Falta de logs**: A função não tinha logs suficientes para debugar problemas.

## Solução Implementada

### 1. Novo Migration 123 - Unificação do Cron Job

**Arquivo:** `supabase/migrations/123_fix_cron_relatorio_diario.sql`

Este migration:
- Remove TODOS os jobs antigos conflitantes
- Cria um único job `job_relatorio_diario_automatizado`
- Agenda para Seg-Sex às 11:30 UTC (08:30 BRT)
- Envia o parâmetro `automated: true` corretamente
- Usa a `service_role_key` do vault para autenticação

### 2. Melhorias na Função Edge

**Arquivo:** `supabase/functions/relatorio-envios/index.ts`

Melhorias implementadas:
- ✅ Logs detalhados em cada etapa do processo
- ✅ Tratamento de erro melhorado na consulta de feriados
- ✅ Query otimizada com ordenação e campos adicionais
- ✅ Validação do status_envio dos pedidos encontrados
- ✅ Resposta mais informativa quando não há pedidos
- ✅ Logs detalhados no envio do webhook
- ✅ Tratamento de erro no webhook com throw de exceção

### 3. Atualização do Componente do Botão

**Arquivo:** `components/BotaoRelatorioEnvios.tsx`

- Atualizado texto para "Automático: 8h (Seg-Sex)" para refletir o funcionamento correto

## Como Aplicar a Correção

### Passo 1: Executar o Migration 123

No SQL Editor do Supabase:

```sql
-- Opção A: Executar o arquivo de migration
-- Copie e cole o conteúdo de: supabase/migrations/123_fix_cron_relatorio_diario.sql
```

### Passo 2: Verificar se o Vault está configurado

O migration usa `current_setting('vault.service_role_key', true)` para obter a chave de serviço.

Se você receber um aviso de que o vault não está disponível, será necessário:

1. Ir em **Project Settings** → **Vault** no dashboard do Supabase
2. Habilitar o Vault se não estiver habilitado
3. Ou usar a alternativa manual abaixo:

### Alternativa Manual (se Vault não disponível)

Execute este SQL manualmente, substituindo `SUA_SERVICE_ROLE_KEY_AQUI`:

```sql
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Remover jobs antigos
SELECT cron.unschedule('job_relatorio_diario_envios');
SELECT cron.unschedule('job_relatorio_diario_retry');
SELECT cron.unschedule('job_relatorio_diario_oficial');

-- Criar novo job
SELECT cron.schedule(
    'job_relatorio_diario_automatizado',
    '30 11 * * 1-5',
    $cron$
    SELECT net.http_post(
        url := 'https://cgyxinpejaoadsqrxbhy.supabase.co/functions/v1/relatorio-envios',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer SUA_SERVICE_ROLE_KEY_AQUI"}',
        body := '{"automated": true}'::jsonb,
        timeout_milliseconds := 30000
    )
    $cron$
);
```

## Verificação e Debug

### Verificar jobs agendados

```sql
SELECT * FROM cron.job;
```

### Verificar logs de execução

```sql
SELECT * FROM cron.job_run_details 
ORDER BY start_time DESC 
LIMIT 20;
```

### Testar execução manual

```sql
SELECT net.http_post(
    url := 'https://cgyxinpejaoadsqrxbhy.supabase.co/functions/v1/relatorio-envios',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer SUA_SERVICE_ROLE_KEY"}',
    body := '{"automated": true}'::jsonb
);
```

### Verificar logs da Edge Function

No dashboard do Supabase:
1. Vá em **Edge Functions** → **relatorio-envios**
2. Clique em **Logs**
3. Filtre por data/hora do disparo

## Comportamento Esperado

### Disparo Automático (Cron)
- **Horário:** Seg-Sex às 08:30 BRT
- **Filtro:** `status_envio = 'pronto'`
- **Parâmetro:** `automated: true`
- **Pula:** Fins de semana e feriados (tabela `feriados`)

### Disparo Manual (Botão)
- **Acionamento:** Clique no botão "RELATÓRIO DIÁRIO"
- **Filtro:** IDs dos pedidos selecionados na UI
- **Parâmetro:** `pedidoIds: [...]`

## Estrutura da Resposta

### Sucesso
```json
{
  "success": true,
  "message": "Relatório disparado com sucesso",
  "result": "📦 *RELATÓRIO DIÁRIO DE ENVIOS*..."
}
```

### Fim de Semana (Automático)
```json
{
  "message": "Desativado aos fins de semana.",
  "automated": true,
  "skipped": true,
  "reason": "fim_de_semana"
}
```

### Feriado (Automático)
```json
{
  "message": "Feriado detectado: Natal",
  "automated": true,
  "skipped": true,
  "reason": "feriado"
}
```

### Sem Pedidos
```json
{
  "message": "Nenhum pedido para despacho hoje.",
  "automated": true,
  "status_envio_filter": "pronto"
}
```

## Próximos Passos

1. ✅ Executar migration 123 no Supabase
2. ✅ Verificar se o job foi criado: `SELECT * FROM cron.job;`
3. ✅ Aguardar próximo horário de disparo (08:30 BRT)
4. ✅ Verificar logs após o disparo
5. ✅ Confirmar recebimento no webhook (WhatsApp)

## Contingência

Se o pg_cron não estiver funcionando:

1. Verificar se a extensão está habilitada:
```sql
SELECT * FROM pg_extension WHERE extname = 'pg_cron';
```

2. Se não existir, habilitar no dashboard do Supabase (Database → Extensions)

3. Se persistir, usar alternativa com GitHub Actions ou serviço externo de cron

---

**Data da Correção:** 31/03/2026  
**Responsável:** Correção automática do sistema  
**Status:** ✅ Implementado
