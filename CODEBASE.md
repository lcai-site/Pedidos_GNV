# 🗺️ CODEBASE.md — Índice do Projeto Pedidos GNV

> **Para o Agente:** LEIA este arquivo antes de qualquer modificação.
> Ele indica ONDE estão as peças críticas e quais dependências existem.
> Nunca modifique uma função sem antes ler seu arquivo de origem.

---

## ⚠️ Regra de Ouro

Antes de modificar qualquer função listada abaixo:
1. Abra e leia o arquivo de origem indicado
2. Identifique quem chama essa função (coluna "Chamado por")
3. Faça alteração cirúrgica — nunca reescreva do zero

---

## 🗄️ SQL — Funções Críticas

| Função | Arquivo de Origem (SEMPRE ler) | Chamado por | Risco |
|--------|-------------------------------|-------------|-------|
| `consolidar_pedidos_ticto()` | `supabase/migrations/127_fix_nomenclatura_geral.sql` | `BotaoConsolidar.tsx` | 🔴 ALTO |
| `atualizar_descricao_pacote()` | `supabase/migrations/107_fix_foi_editado_flexivel.sql` | `Logistics.tsx → saveDescricao()` | 🟡 MÉDIO |
| `update_pedidos_consolidados()` | `supabase/migrations/037_update_pedidos_consolidados.sql` | `modules/logistics/services/orderService.ts → updateOrderData()` | 🔴 ALTO |
| `proximo_dia_util()` | `supabase/migrations/086_fix_consolidar_button.sql` | `consolidar_pedidos_ticto()` | 🟡 MÉDIO |
| `unificar_pedidos()` | `supabase/migrations/049_unificar_pedidos.sql` | `Logistics.tsx → handleMergeOrders()`, `SimilarOrdersModal.tsx` | 🟡 MÉDIO |
| `marcar_pv_realizado()` | `supabase/migrations/036_pv_realizado.sql` | `Logistics.tsx` | 🟢 BAIXO |
| `desmarcar_pv_realizado()` | `supabase/migrations/036_pv_realizado.sql` | `Logistics.tsx` | 🟢 BAIXO |
| `criar_pedido_manual()` | `supabase/migrations/112_criar_pedido_manual_completo.sql` | `BotaoCriarPedidoManual.tsx` | 🟡 MÉDIO |
| **`aprovar_usuario()`** | **`supabase/migrations/108_login_aprovacao_producao.sql`** | **`Usuarios/index.tsx → handleToggleStatus()`** | **🔴 ALTO** |
| **`get_current_user_role()`** | **`supabase/migrations/108_login_aprovacao_producao.sql`** | **Políticas RLS da tabela `profiles`** | **🔴 ALTO** |
| `gerar_numero_solicitacao()` | `supabase/migrations/109_solicitacoes_numero_sequencial.sql` | `solicitacoes → INSERT` | 🟡 MÉDIO |
| `duplicar_pedido_como_reenvio()` | `supabase/migrations/110_reenvio_solicitacoes.sql` | `Solicitacoes/Reembolsos.tsx` | 🔴 ALTO |
| `atribuir_atendimento()` | `supabase/migrations/113_crm_chat_zapi.sql` | `CRM/Chat` | 🟡 MÉDIO |
| `cancelar_pedido_logistica()` | `supabase/migrations/115_excluir_pedido.sql` | `Logistics.tsx` (lixeira) | 🟡 MÉDIO |
| `unificar_pedidos()` (atualizada) | `supabase/migrations/116_corrigir_unificacao_produtos.sql` | `SimilarOrdersModal.tsx` | 🟡 MÉDIO |
| `unificar_pedidos_mesmo_endereco()` | `supabase/migrations/116_corrigir_unificacao_produtos.sql` | `ModalUnificarEndereco.tsx` | 🟡 MÉDIO |
| `restaurar_pedido_logistica()` | `supabase/migrations/117_restaurar_pedido.sql` | `Logistics.tsx` (lixeira) | 🟡 MÉDIO |
| `usuario_pode_ver_mensagem()` | `supabase/migrations/118_fix_realtime_rls_mensagens.sql` | Realtime do Chat | 🟡 MÉDIO |
| `sigla_produto()` | `supabase/migrations/121_atualizar_siglas_produtos.sql` | `consolidar_pedidos_ticto()` | 🟢 BAIXO |

### Regras de negócio SQL críticas (não quebrar):
- `foi_editado = TRUE` → setado APENAS por `update_pedidos_consolidados()`. Nunca por `atualizar_descricao_pacote()`.
- Pedidos com `codigo_rastreio IS NOT NULL` → **intocáveis** (Hard Lock)
- Pedidos com `foi_editado = TRUE` → preservam dados do cliente, mas recebem novos filhos (Soft Lock)
- `dia_despacho` → não sobrescrever se `pv_realizado = TRUE`

---

## 🖥️ Frontend — Arquivos Críticos

| Arquivo | Função Principal | Dependências Chave |
|---------|-----------------|-------------------|
| `pages/Logistics.tsx` | Tela principal de logística (137KB — maior arquivo) | `modules/logistics/*`, `components/BotaoConsolidar`, `components/SimilarOrdersModal`, `renderChangeBadges()` |
| `pages/Customers.tsx` | Base de Clientes e Edição em Lote | `pedidos_consolidados_v3` (Update por email) |
| `modules/logistics/hooks/useOrderEdit.ts` | Modal de edição de pedido | `orderService.ts → updateOrderData()` → seta `foi_editado=TRUE` |
| `modules/logistics/services/orderService.ts` | CRUD de pedidos | `supabase.rpc('update_pedidos_consolidados')` |
| `modules/logistics/services/addressPatchService.ts` | Correção de endereços em lote | `supabase` direto |
| `components/BotaoConsolidar.tsx` | Botão que aciona consolidação | `supabase.rpc('consolidar_pedidos_ticto')` |
| `components/BotaoCriarPedidoManual.tsx` | Novo Pedido / Reenvio / Influenciador | `supabase.rpc('criar_pedido_manual')` |
| `components/SimilarOrdersModal.tsx` | Modal de unificação manual | `supabase.rpc('unificar_pedidos')`, seta `foi_editado=TRUE` |
| `components/ModalUnificarEndereco.tsx` | Modal de unificação por endereço | `supabase.rpc('unificar_pedidos')` |
| **`lib/contexts/AuthContext.tsx`** | **Sessão, perfil e RBAC — bloqueia inativos** | `lib/rbac/permissions.ts`, tabela `profiles` |
| **`lib/rbac/permissions.ts`** | **Definição de roles e permissões** | Importado por `AuthContext`, `Layout`, guards |
| **`pages/LoginPage.tsx`** | **Fluxo de login e solicitação de acesso** | `supabase.auth.signUp()`, tabela `profiles` |
| **`pages/Usuarios/index.tsx`** | **Gerenciamento de usuários (aprovar/bloquear)** | `lib/hooks/useUsuarios`, `toggleStatus` |
| `pages/CRM/DashboardCRM.tsx` | Dashboard CRM com métricas e funil | `lib/hooks/useCRMKanban` |
| `pages/CRM/Mensagens.tsx` | Templates de mensagens WhatsApp | `lib/hooks/useWhatsAppTemplates` |
| **`pages/CRM/Chat.tsx`** | **Chat de atendimento via WhatsApp (Z-API)** | **`crm_atendimentos`, `crm_mensagens`, realtime** |
| `pages/Settings.tsx` | Configurações + Z-API WhatsApp | `lib/hooks/useZAPIConfig`, `useAuth` |
| **`lib/hooks/useZAPIConfig.ts`** | **Hooks para Z-API (QR Code, status, config)** | `callZAPIProxy()` → envia token explícito no header |
| **`lib/hooks/useCRM.ts`** | **Hooks para CRM (Leads, Templates, Campanhas, Mensagens)** | `pages/CRM/*`, React Query |
| **`lib/hooks/useCRMKanban.ts`** | **Hooks para Kanban do CRM (etapas, pipelines)** | `pages/CRM/Kanban.tsx` |
| **`lib/hooks/useCRMAutomacao.ts`** | **Hooks para Automações de CRM** | `pages/CRM/Automacoes.tsx` |

---

## ⚡ Edge Functions (Supabase)

| Pasta | Slug em Produção | O que faz | Arquivo de Origem |
|-------|-----------------|-----------|------------------|
| `supabase/functions/zapi-proxy/` | `zapi-proxy` | Proxy para Z-API (WhatsApp) com autenticação ADM | `index.ts` + `lib/hooks/useZAPIConfig.ts` |
| `supabase/functions/webhook-ticto/` | `quick-action` | Recebe webhooks da Ticto e insere em `ticto_pedidos` | `index.ts` dentro da pasta |
| `supabase/functions/webhook-viralmart/` | `webhook-viralmart` | Recebe webhooks da ViralMart | `index.ts` |
| `supabase/functions/webhook-melhor-envio/` | `webhook-melhor-envio` | Recebe callbacks de rastreio da Melhor Envio | `index.ts` |
| `supabase/functions/correios-labels/` | `correios-labels` | Geração de etiquetas Correios | `index.ts` |
| `supabase/functions/sync-melhor-envio-tracking/` | `sync-melhor-envio-tracking` | Sincroniza rastreios Melhor Envio | `index.ts` |
| `supabase/functions/sync-correios-tracking/` | `sync-correios-tracking` | Sincroniza rastreios Correios | `index.ts` |
| `supabase/functions/relatorio-envios/` | `relatorio-envios` | Envia relatório diário de envios por email (cron job) | `index.ts` |

---

## 🗃️ Tabelas Principais do Banco

| Tabela | Papel | Escrita por |
|--------|-------|-------------|
| `ticto_pedidos` | Dados brutos dos webhooks + pedidos manuais | `webhook-ticto`, `webhook-viralmart`, `criar_pedido_manual()` |
| `pedidos_consolidados_v3` | Pedidos processados exibidos na tela | `consolidar_pedidos_ticto()`, `unificar_pedidos()` |
| `feriados` | Feriados que bloqueiam consolidação | Manual via Dashboard |
| `decisoes_unificacao` | Decisões manuais de UNIR/SEPARAR pedidos | `SimilarOrdersModal.tsx` |
| `profiles` | Usuários e roles (adm, gestor, logística) | `Settings.tsx`, Supabase Auth |
| `zapi_config` | Credenciais e status da instância Z-API | `Settings.tsx` (Z-API section) |
| `whatsapp_templates` | Templates de mensagens com variáveis | `pages/CRM/Mensagens.tsx` |
| `solicitacoes` | Solicitações de reembolso/reclamação com numeração sequencial | `pages/Solicitacoes/`, `duplicar_pedido_como_reenvio()` |
| `crm_atendimentos` | Tickets do chat via WhatsApp (+ coluna `email`) | CRM / WhatsApp, gerido por RLS e ADMs |
| `crm_mensagens` | Mensagens in/out do chat via WhatsApp Z-API | Webhook Z-API e CRM (Realtime) |
| `crm_leads` | Leads de marketing e vendas | `pages/CRM/Leads.tsx`, importação recuperação |
| `crm_templates` | Templates de email/mensagem | `pages/CRM/Mensagens.tsx` |
| `crm_campanhas` | Campanhas de marketing automatizadas | `pages/CRM/Automacoes.tsx` |
| `crm_etapas` | Etapas do Kanban CRM | `pages/CRM/Etapas.tsx` |
| `crm_pipelines` | Pipelines do CRM | `pages/CRM/Pipelines.tsx` |

---

## 🔗 Fluxo de Dados Principal

```
Webhook Ticto/ViralMart
       ↓
ticto_pedidos (dado bruto)
       ↓
[BotaoConsolidar] → consolidar_pedidos_ticto()
       ↓
pedidos_consolidados_v3 (tela Logistics.tsx)
       ↓
[Edição manual] → update_pedidos_consolidados() → foi_editado = TRUE
[Etiqueta]     → correios-labels → codigo_rastreio = '...' → Hard Lock

Pedido Manual (novo fluxo):
[BotaoCriarPedidoManual] → criar_pedido_manual()
       ↓
ticto_pedidos (plataforma='Manual')
       ↓
pedidos_consolidados_v3 (status_envio='pronto', foi_editado=TRUE)
       ↓
[Aba ENVIOS] → gerar etiqueta imediatamente

Reenvio de Pedido:
[Solicitacao] → necessita_reenvio = TRUE
       ↓
[duplicar_pedido_como_reenvio()] → cópia com is_reenvio=TRUE
       ↓
pedidos_consolidados_v3 (status_envio='aguardando', foi_editado=TRUE)
       ↓
[Linkado ao original] → pedido_origem_id, solicitacao_reenvio_id
```

---

## 📂 Scripts de Deploy

| Script | Uso |
|--------|-----|
| `node scripts/deploy-migration.mjs production <arquivo.sql>` | Rodar migration em produção |
| `node scripts/deploy-function.mjs production <pasta>` | Deploy de Edge Function |
| `npm run deploy:staging` | Deploy migration em staging |

> ⚠️ `deploy-migration.mjs` depende de `exec_sql` no banco — **não existe em produção**.
> Em produção: copiar SQL e colar no SQL Editor do Dashboard Supabase.

---

## 🕐 Cron Jobs (pg_cron + pg_net)

| Job | Horário | Edge Function | Migration |
|-----|---------|---------------|-----------|
| `job_relatorio_diario_automatizado` | Seg-Sex 08:35 BRT (11:35 UTC) | `relatorio-envios` | `125_cron_relatorio_0835.sql` |

**Configuração:**
- Headers: `{"Content-Type": "application/json"}` (sem Authorization)
- Body: `{"automated": true}`
- Filtra: feriados e dias sem pedidos 'pronto'

> ⚠️ Para modificar horário: editar migration `125_cron_relatorio_0835.sql` e rodar no SQL Editor.

---

## 🩺 Diagnóstico Rápido de Erros

| Sintoma | Causa Provável | Onde Investigar |
|---------|---------------|-----------------|
| Consolidação retorna erro 400 | Sintaxe SQL na função ou dependência ausente | SQL Editor → `SELECT consolidar_pedidos_ticto()` |
| Perfis retornam 500 | RLS recursiva na tabela `profiles` | Dashboard → Auth → Policies → profiles |
| Pedido não recebe Pós-venda | `foi_editado=TRUE` em lock, ou janela de tempo expirada | Campo `foi_editado` e `dia_despacho` do pedido pai |
| Etiqueta quebra após alteração | `codigo_rastreio` presente → Hard Lock ativo | Verificar `codigo_rastreio` na `pedidos_consolidados_v3` |
| **Chat não recebe mensagens em tempo real** | **Policy RLS de `crm_mensagens` quebrada** | **Verificar função `usuario_pode_ver_mensagem()`** |
| **Relatório diário não envia** | **Cron job falhou ou Edge Function erro** | **`net._http_response` ou logs da função** |
