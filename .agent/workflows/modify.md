---
description: Modificar qualquer funcionalidade do projeto com segurança, sem regredir o que já funciona.
---

# /modify — Fluxo de Modificação Segura

> Ativado quando o usuário digita: `/modify [descrição do que deseja alterar]`

Este workflow garante que NENHUMA modificação seja feita sem primeiro entender
o que já existe e o que pode ser impactado.

---

## Passo 1 — Ler o Índice do Projeto

Ler o arquivo `CODEBASE.md` na raiz do projeto.

Objetivo: identificar quais funções/arquivos estão envolvidos no pedido do usuário
e quais dependências podem ser afetadas.

**O que verificar no CODEBASE.md:**
- 🗄️ Tabela **SQL — Funções Críticas** → funções RPC e migrations
- 🖥️ Tabela **Frontend — Arquivos Críticos** → componentes, hooks, services
- ⚡ Tabela **Edge Functions** → funções serverless (zapi-proxy, webhooks, etc.)
- 🗃️ Tabela **Tabelas Principais** → schema do banco de dados

---

## Passo 2 — Identificar o Escopo

Com base no pedido do usuário e no CODEBASE.md, responder internamente:

### Para SQL:
1. **Qual função RPC precisa mudar?**
2. **Qual migration contém essa função?** (coluna "Arquivo de Origem")
3. **Quem chama essa função?** (coluna "Chamado por")
4. **Que regras de negócio existem?** (ex: `foi_editado`, Hard Lock, RLS, etc.)

### Novas Funções Críticas (Migrations 108-125):
| Função | Migration | Permissões | Risco |
|--------|-----------|------------|-------|
| `aprovar_usuario()` | `108_login_aprovacao_producao.sql` | Apenas ADM | 🔴 ALTO |
| `get_current_user_role()` | `108_login_aprovacao_producao.sql` | SECURITY DEFINER | 🔴 ALTO |
| `gerar_numero_solicitacao()` | `109_solicitacoes_numero_sequencial.sql` | authenticated | 🟡 MÉDIO |
| `duplicar_pedido_como_reenvio()` | `110_reenvio_solicitacoes.sql` | authenticated, service_role | 🔴 ALTO |
| `criar_pedido_manual()` | `112_criar_pedido_manual_completo.sql` | authenticated | 🟡 MÉDIO |
| `atribuir_atendimento()` | `113_crm_chat_zapi.sql` | authenticated | 🟡 MÉDIO |
| `cancelar_pedido_logistica()` | `115_excluir_pedido.sql` | authenticated, service_role | 🟡 MÉDIO |
| `unificar_pedidos()` | `116_corrigir_unificacao_produtos.sql` | authenticated, service_role | 🟡 MÉDIO |
| `unificar_pedidos_mesmo_endereco()` | `116_corrigir_unificacao_produtos.sql` | authenticated, service_role | 🟡 MÉDIO |
| `restaurar_pedido_logistica()` | `117_restaurar_pedido.sql` | authenticated, service_role | 🟡 MÉDIO |
| `usuario_pode_ver_mensagem()` | `118_fix_realtime_rls_mensagens.sql` | authenticated | 🟡 MÉDIO |
| `sigla_produto()` | `121_atualizar_siglas_produtos.sql` | anon, authenticated, service_role | 🟢 BAIXO |

### Novas Tabelas Críticas:
| Tabela | Propósito | RLS |
|--------|-----------|-----|
| `zapi_config` | Credenciais Z-API | Apenas ADM |
| `whatsapp_templates` | Templates de mensagens | ADM, Gestor |
| `solicitacoes` (colunas novas) | Numeração sequencial, reenvio | RLS existente |
| `crm_atendimentos` | Tickets de atendimento WhatsApp (+ coluna `email`) | ADM, Gestor, Atendente (por responsavel_id) |
| `crm_mensagens` | Histórico de mensagens do CRM | Vinculado a `crm_atendimentos` |
| `feriados` | Bloqueio de consolidação e cron jobs | Leitura pública |

### Para Edge Functions:
1. **Qual Edge Function precisa mudar?** (ex: `zapi-proxy`, `webhook-ticto`)
2. **Como é chamada no frontend?** (ex: `supabase.functions.invoke('zapi-proxy')`)
3. **Quais hooks/services usam essa função?** (ex: `useZAPIConfig.ts`)
4. **Que autenticação é necessária?** (ex: apenas ADM, JWT, token no payload)

### Para Frontend:
1. **Qual componente/hook/service precisa mudar?**
2. **Quais permissões RBAC são necessárias?** (ver `lib/rbac/permissions.ts`)
3. **Que contexto é afetado?** (ex: `AuthContext`, `NotificationContext`)

---

## Passo 3 — Ler o Arquivo de Origem

Ler o arquivo de origem identificado no Passo 2 **na íntegra** antes de qualquer modificação.

**Fontes canônicas por tipo:**

| Tipo | Onde Ler | Exemplo |
|------|----------|---------|
| Função SQL RPC | `supabase/migrations/XXX_*.sql` | `107_fix_foi_editado_flexivel.sql` |
| Edge Function | `supabase/functions/[nome]/index.ts` | `zapi-proxy/index.ts` |
| Hook React | `lib/hooks/[nome].ts` | `useZAPIConfig.ts` |
| Service | `lib/services/[nome].ts` | `zapiService.ts` |
| Componente | `pages/` ou `components/` | `pages/Settings.tsx` |
| Contexto | `lib/contexts/[nome].tsx` | `AuthContext.tsx` |

**Regra de Ouro:** Nunca reescrever uma função de memória. Partir sempre do código atual.

---

## Passo 4 — Apresentar o Plano ao Usuário

Antes de escrever qualquer código, apresentar em formato resumido:

```
📋 PLANO DE MODIFICAÇÃO
──────────────────────
🎯 O que será alterado: [função/arquivo]
✂️  Mudança cirúrgica: [qual trecho específico]
🔗 Pode impactar: [lista de dependentes]
🛡️  Regras preservadas: [lista das regras de negócio que serão mantidas]
```

**Aguardar confirmação do usuário antes de prosseguir.**

---

## Passo 5 — Implementar Cirurgicamente

Aplicar APENAS a mudança necessária no trecho identificado.

### Regras Gerais:
- ❌ Nunca reescrever o arquivo inteiro
- ❌ Nunca simplificar lógica complexa sem entender por que ela existe
- ✅ Alterar apenas o trecho identificado no Passo 2
- ✅ Manter todos os comentários explicativos existentes
- ✅ Adicionar comentário explicando a nova mudança e o motivo

### Regras Específicas por Tipo:

#### SQL (Migrations)
- ✅ Se for correção de função existente: editar a migration **mais recente** que a contém
- ✅ Se for nova funcionalidade: criar **nova migration** numerada (ex: `111_*.sql`)
- ✅ Manter comentários de cabeçalho explicando o propósito
- ✅ Incluir `GRANT EXECUTE` para permissões
- ✅ Testar com `SELECT function_name()` no SQL Editor

#### Edge Functions
- ✅ Manter padrão de resposta `jsonResponse()` (sempre 200, com `ok: true/false`)
- ✅ Preservar verificação de autenticação e autorização (RBAC)
- ✅ Manter logs com `console.log()` para debugging
- ✅ Tratar erros com `try/catch` e retornar `{ error, ok: false }`
- ✅ Testar via `supabase.functions.invoke()` no frontend

#### Frontend (Hooks/Services/Components)
- ✅ Manter tipagem TypeScript consistente
- ✅ Preservar tratamento de erro com `toast` (sonner)
- ✅ Usar `useQuery`/`useMutation` do React Query quando apropriado
- ✅ Manter permissões RBAC via `useAuth().can()`
- ✅ Seguir convenção de nomenclatura (PascalCase componentes, camelCase hooks)

---

## Passo 6 — Atualizar o CODEBASE.md (se necessário)

Se a mudança alterar o arquivo de origem de uma função ou criar nova dependência,
atualizar a tabela correspondente no `CODEBASE.md`.

### Quando Atualizar:

| Mudança | O que Atualizar no CODEBASE.md |
|---------|-------------------------------|
| Nova função SQL | Adicionar linha em **SQL — Funções Críticas** |
| Nova Edge Function | Adicionar linha em **Edge Functions** |
| Nova tabela | Adicionar linha em **Tabelas Principais** |
| Novo hook/service | Adicionar linha em **Frontend — Arquivos Críticos** |
| Mudança de arquivo de origem | Atualizar coluna "Arquivo de Origem" |
| Nova dependência | Atualizar coluna "Chamado por" |

### Exemplo de Atualização:

```markdown
| `duplicar_pedido_como_reenvio()` | `supabase/migrations/110_reenvio_solicitacoes.sql` | `DetalhesSolicitacao.tsx` | 🟡 MÉDIO |
```

---

## 📚 Exemplos de Uso

### Exemplo 1: Modificar Função SQL

```
Usuário: /modify quero que pedidos sem endereço não bloqueiem a consolidação

Agente:
1. Lê CODEBASE.md → identifica `consolidar_pedidos_ticto()`
2. Abre `107_fix_foi_editado_flexivel.sql` → lê o loop principal
3. Apresenta plano:
   🎯 Alterar: sub-loop de filhos em `consolidar_pedidos_ticto`
   ✂️  Mudança: adicionar condição de skip quando `address_zip_code IS NULL`
   🔗 Impacta: `BotaoConsolidar.tsx` (consumidor)
   🛡️  Preserva: Hard Lock, Soft Lock, `foi_editado`, `dia_despacho`
4. Aguarda confirmação
5. Modifica apenas a condição dentro do loop
6. Atualiza CODEBASE.md com nota sobre a nova regra
```

### Exemplo 2: Modificar Edge Function

```
Usuário: /modify quero adicionar ação "send-message" no zapi-proxy

Agente:
1. Lê CODEBASE.md → identifica `zapi-proxy` em **Edge Functions**
2. Verifica `lib/hooks/useZAPIConfig.ts` → vê como hook chama o proxy
3. Abre `supabase/functions/zapi-proxy/index.ts` → lê switch de ações
4. Apresenta plano:
   🎯 Alterar: `zapi-proxy/index.ts` → switch/case
   ✂️  Mudança: adicionar case "send-message" com POST para Z-API
   🔗 Impacta: `useZAPIConfig.ts` (precisa criar hook), `Settings.tsx` (UI)
   🛡️  Preserva: autenticação ADM, padrão `jsonResponse()`, logs
5. Aguarda confirmação
6. Adiciona case no switch + validação de parâmetros (phone, message)
7. Atualiza CODEBASE.md: adiciona "send-message" na descrição da Edge Function
```

### Exemplo 3: Modificar Hook React

```
Usuário: /modify quero que useZAPIConfig invalide cache após salvar

Agente:
1. Lê CODEBASE.md → identifica `useZAPIConfig` em **Frontend**
2. Abre `lib/hooks/useZAPIConfig.ts` → lê hook `useSaveZAPIConfig`
3. Apresenta plano:
   🎯 Alterar: `useSaveZAPIConfig` → opção `onSuccess`
   ✂️  Mudança: adicionar `queryClient.invalidateQueries(['zapi-status'])`
   🔗 Impacta: `Settings.tsx` (exibe status atualizado)
   🛡️  Preserva: estrutura React Query, toast de sucesso
4. Aguarda confirmação
5. Adiciona linha no `onSuccess`
6. CODEBASE.md: sem alteração (mença interna do hook)
```

### Exemplo 4: Modificar Componente com RBAC

```
Usuário: /modify quero permitir que gestores aprovem usuários

Agente:
1. Lê CODEBASE.md → identifica `aprovar_usuario()` e `Usuarios/index.tsx`
2. Abre `108_login_aprovacao_producao.sql` → lê função RPC
3. Verifica `lib/rbac/permissions.ts` → vê permissões de gestor vs adm
4. Apresenta plano:
   🎯 Alterar: `aprovar_usuario()` → condição de permissão
   ✂️  Mudança: permitir `role IN ('adm', 'gestor')` além de apenas 'adm'
   🔗 Impacta: `Usuarios/index.tsx`, `AuthContext.tsx` (permissões)
   🛡️  Preserva: `SECURITY DEFINER`, validação de ativo, log de aprovação
5. Aguarda confirmação
6. Modifica condição IF na função SQL
7. Atualiza `permissions.ts` se necessário
8. CODEBASE.md: atualiza descrição de `aprovar_usuario()`
```

---

## 🆕 Novas Funcionalidades Protegidas (Migrations 108-117)

### Migration 108: Login & Aprovação de Usuários
| Função | Propósito | Permissão | Risco |
|--------|-----------|-----------|-------|
| `get_current_user_role()` | Verificar role sem recursão RLS | SECURITY DEFINER | 🔴 ALTO |
| `aprovar_usuario(UUID)` | ADM ativa contas de usuários | Apenas ADM | 🔴 ALTO |

**Regras de Negócio:**
- Novo usuário nasce com `ativo = FALSE` e `role = 'atendente'`
- Apenas ADM pode aprovar usuários via `aprovar_usuario()`
- Políticas RLS usam `get_current_user_role()` para evitar recursão
- **Nunca modificar** as políticas RLS sem testar exaustivamente

**Arquivos Relacionados:**
- `supabase/migrations/108_login_aprovacao_producao.sql`
- `pages/Usuarios/index.tsx` → chama `aprovar_usuario()`
- `lib/contexts/AuthContext.tsx` → verifica `ativo` antes de logar

---

### Migration 109: Numeração Sequencial de Solicitações
| Função | Propósito | Permissão | Risco |
|--------|-----------|-----------|-------|
| `gerar_numero_solicitacao(TEXT)` | Gera números REE-00001, REC-00001, CAN-00001 | authenticated | 🟡 MÉDIO |
| `trigger_set_numero_solicitacao()` | Trigger antes de INSERT | authenticated | 🟡 MÉDIO |

**Regras de Negócio:**
- Prefixos por tipo: `REE` (reembolso), `REC` (reclamação), `CAN` (cancelamento)
- Numeração sequencial com 5 dígitos: `REE-00001`, `REE-00002`...
- Trigger só gera se `numero_solicitacao IS NULL`

**Arquivos Relacionados:**
- `supabase/migrations/109_solicitacoes_numero_sequencial.sql`
- Tabela `solicitacoes` → coluna `numero_solicitacao`

---

### Migration 109: CRM Z-API Config + WhatsApp Templates
| Tabela | Propósito | RLS |
|--------|-----------|-----|
| `zapi_config` | Credenciais e status da instância Z-API | Apenas ADM |
| `whatsapp_templates` | Templates de mensagens com variáveis | ADM, Gestor |

**Regras de Negócio:**
- `zapi_config`: apenas ADM pode ver/editar credenciais
- `whatsapp_templates`: ADM e Gestor podem gerenciar templates
- Templates padrão: `Pedido Postado`, `Em Trânsito`, `Saiu para Entrega`, etc.

**Arquivos Relacionados:**
- `supabase/migrations/109_crm_rodada1.sql`
- `pages/CRM/Mensagens.tsx` → gerencia templates
- `lib/hooks/useZAPIConfig.ts` → lê configuração Z-API

---

### Migration 110: Reenvio Vinculado à Solicitação
| Função | Propósito | Permissão | Risco |
|--------|-----------|-----------|-------|
| `duplicar_pedido_como_reenvio(UUID, UUID, TEXT)` | Cria cópia do pedido como reenvio | authenticated, service_role | 🔴 ALTO |

**Regras de Negócio:**
- Reenvio nasce com `is_reenvio = TRUE` e `foi_editado = TRUE`
- Linka ao pedido original via `pedido_origem_id`
- Linka à solicitação via `solicitacao_reenvio_id`
- Atualiza `solicitacoes.pedido_reenvio_id` com o novo pedido

**Campos Novos:**
- `solicitacoes`: `necessita_reenvio`, `pedido_reenvio_id`, `responsavel_reenvio_id`
- `pedidos_consolidados_v3`: `is_reenvio`, `pedido_origem_id`, `solicitacao_reenvio_id`

**Arquivos Relacionados:**
- `supabase/migrations/110_reenvio_solicitacoes.sql`
- `pages/Solicitacoes/Reembolsos.tsx` → aciona reenvio

---

### Migrations 111-112: Criar Pedido Manual
| Função | Propósito | Permissão | Risco |
|--------|-----------|-----------|-------|
| `criar_pedido_manual(...)` | Cria pedido em `ticto_pedidos` e `pedidos_consolidados_v3` | authenticated | 🟡 MÉDIO |

**Regras de Negócio:**
- Cria registro em `ticto_pedidos` com `plataforma = 'Manual'`
- Cria em `pedidos_consolidados_v3` com `status_envio = 'pronto'`
- `foi_editado = TRUE` → protege de sobrescrita pela consolidação
- Gera `codigo_transacao` único: `MANUAL-<timestamp>`

**Parâmetros:**
- Dados do cliente: nome, CPF, telefone, email, endereço completo
- Produto: `p_produto_principal`, `p_descricao_pacote`

**Arquivos Relacionados:**
- `supabase/migrations/112_criar_pedido_manual_completo.sql`
- `components/BotaoCriarPedidoManual.tsx` → chama a função

---

### Migration 113: CRM Chat via Z-API (WhatsApp)
| Função | Propósito | Permissão | Risco |
|--------|-----------|-----------|-------|
| `atribuir_atendimento(p_atendimento_id, p_responsavel_id)` | Atribui ticket de atendimento a responsável | authenticated | 🟡 MÉDIO |

| Tabela | Propósito | RLS |
|--------|-----------|-----|
| `crm_atendimentos` | Tickets de atendimento (WhatsApp) | ADM/Gestor veem todos; Atendente vê não atribuídos ou seus |
| `crm_mensagens` | Histórico de mensagens (in/out) | Vinculado à visão de `crm_atendimentos` |

**Migrations Relacionadas:**
- `114_enable_realtime_chat.sql` → Habilita Realtime para `crm_atendimentos` e `crm_mensagens`

**Regras de Negócio:**
- Ticket nasce com `status = 'novo'` e `responsavel_id = NULL`
- Ao atribuir responsável, status muda para `'em_andamento'`
- Atendente não pode pegar ticket de outro atendente
- Trigger `trg_update_atendimento_timestamp` atualiza `ultima_mensagem_em` ao inserir mensagem
- Mensagens têm direcao: `'in'` (cliente) ou `'out'` (loja)
- Apenas ADM pode deletar mensagens

**Arquivos Relacionados:**
- `supabase/migrations/113_crm_chat_zapi.sql`
- `pages/CRM/Chat.tsx` → interface de chat
- `lib/hooks/useCRM.ts` → hooks para CRM
- `lib/hooks/useCRMKanban.ts` → kanban de etapas
- `lib/hooks/useCRMAutomacao.ts` → automações

**Permissões RBAC:**
- `crm:view` → Visualizar tickets e mensagens
- `crm:edit` → Editar/atribuir tickets
- `crm:config` → Configurar automações (apenas ADM/Gestor)

---

### Migration 115: Cancelamento de Pedidos (Logística)
| Função | Propósito | Permissão | Risco |
|--------|-----------|-----------|-------|
| `cancelar_pedido_logistica(p_pedido_id, p_motivo)` | Cancela pedido com motivo | authenticated, service_role | 🟡 MÉDIO |

**Campos Novos:**
- `pedidos_consolidados_v3.motivo_cancelamento` → Texto do motivo

**Regras de Negócio:**
- Não permite cancelar pedido já cancelado
- Atualiza `status_aprovacao = 'Cancelado'` e `status_envio = 'Cancelado'`
- Motivo é obrigatório

**Arquivos Relacionados:**
- `supabase/migrations/115_excluir_pedido.sql`
- `pages/Logistics.tsx` → botão de cancelar (lixeira)

---

### Migration 116: Correção de Unificação de Produtos
| Função | Propósito | Permissão | Risco |
|--------|-----------|-----------|-------|
| `unificar_pedidos(p_manter_id, p_absorver_id, p_nova_descricao)` | Unificação manual via Bulk Action | authenticated, service_role | 🟡 MÉDIO |
| `unificar_pedidos_mesmo_endereco(p_principal, p_secundario)` | Unificação via botão "Verificar" | authenticated, service_role | 🟡 MÉDIO |

**Regras de Negócio:**
- Pedido absorvido recebe `status_aprovacao = 'Unificado'`
- Pedido principal recebe `foi_editado = TRUE` (protege de re-consolidação)
- `descricao_pacote` é concatenada com siglas dos produtos
- `codigos_agrupados` e `codigos_filhos` são mesclados
- `quantidade_pedidos` é somada

**Arquivos Relacionados:**
- `supabase/migrations/116_corrigir_unificacao_produtos.sql`
- `components/SimilarOrdersModal.tsx` → unificação manual
- `components/ModalUnificarEndereco.tsx` → unificação por endereço

---

### Migration 117: Restaurar Pedidos Excluídos
| Função | Propósito | Permissão | Risco |
|--------|-----------|-----------|-------|
| `restaurar_pedido_logistica(p_pedido_id)` | Restaura pedido cancelado | authenticated, service_role | 🟡 MÉDIO |

**Regras de Negócio:**
- Restaura `status_aprovacao = 'Aprovado'` e `status_envio = 'pronto'`
- Limpa `motivo_cancelamento = NULL`
- Define `foi_editado = TRUE` para proteger de sobrescrita

**Arquivos Relacionados:**
- `supabase/migrations/117_restaurar_pedido.sql`
- `pages/Logistics.tsx` → botão de restaurar (lixeira)

---

### Migration 118: Fix Realtime RLS de Mensagens
| Função | Propósito | Permissão | Risco |
|--------|-----------|-----------|-------|
| `usuario_pode_ver_mensagem(p_atendimento_id)` | Helper SECURITY DEFINER para leitura de `crm_atendimentos` sem recursão RLS | authenticated | 🟡 MÉDIO |

**Regras de Negócio:**
- Função bypassa RLS de `crm_atendimentos` para evitar recursão em policies
- Necessário para o Supabase Realtime entregar eventos INSERT corretamente
- ADM e Gestor veem tudo; Atendente vê tickets sem responsável ou seus próprios

**Arquivos Relacionados:**
- `supabase/migrations/118_fix_realtime_rls_mensagens.sql`
- `pages/CRM/Chat.tsx` → recebe eventos realtime de mensagens

---

### Migration 119: Email em CRM Atendimentos
| Tabela | Coluna Nova | Propósito |
|--------|-------------|-----------|
| `crm_atendimentos` | `email TEXT` | Armazenar email do cliente diretamente no ticket |

**Regras de Negócio:**
- Email pode ser preenchido manualmente ou via merge de `pedidos_consolidados_v3`
- Backfill automático tenta preencher emails cruzando por telefone (últimos 8 dígitos)

**Arquivos Relacionados:**
- `supabase/migrations/119_crm_atendimentos_email.sql`
- `pages/CRM/Chat.tsx` → exibe/edita email do cliente

---

### Migration 120: Formatar Telefones com DDI 55
| Tabelas Afetadas | Ação |
|------------------|------|
| `pedidos_consolidados_v3`, `ticto_pedidos`, `crm_atendimentos`, `crm_leads` | Adiciona prefixo '55' em telefones com 10-11 dígitos |

**Regras de Negócio:**
- Aplica DDI Brasil (55) em números que não começam com '55'
- Normaliza removendo caracteres não numéricos antes de adicionar DDI

**Arquivos Relacionados:**
- `supabase/migrations/120_formatar_telefones_ddi.sql`

---

### Migration 121: Atualizar Sigla de Produtos
| Função | Propósito | Permissão | Risco |
|--------|-----------|-----------|-------|
| `sigla_produto(nome TEXT)` | Retorna sigla padronizada por nome do produto | anon, authenticated, service_role | 🟢 BAIXO |

**Novos Produtos Suportados:**
| Produto | Sigla |
|---------|-------|
| Desejo Proibido Gotas | `DP GTS` |
| Desejo Proibido Cápsulas | `DP CPS` |
| Desejo Proibido (genérico) | `DP` |
| Bela Lumi | `BL` |
| Bela Forma | `BF` |
| BelaBloom Hair | `BH` |
| SekaShot | `SS` |
| Mounjalis | `ME` |

**Arquivos Relacionados:**
- `supabase/migrations/121_atualizar_siglas_produtos.sql`
- `consolidar_pedidos_ticto()` → usa para gerar `descricao_pacote`

---

### Migrations 122-125: Cron Job de Relatório Diário
| Migration | Propósito | Horário |
|-----------|-----------|---------|
| **122** | Teste inicial (15:00 BRT) | 18:00 UTC |
| **123** | Correção: usar Anon Key | 11:30 UTC (08:30 BRT) |
| **124** | Remover autenticação (pós `--no-verify-jwt`) | 11:30 UTC (08:30 BRT) |
| **125** | Ajuste fino de horário | **11:35 UTC (08:35 BRT)** |

**Configuração Atual (Migration 125):**
- Job name: `job_relatorio_diario_automatizado`
- Schedule: `35 11 * * 1-5` (Segunda a Sexta, 08:35 BRT)
- Edge Function: `relatorio-envios`
- Headers: `{"Content-Type": "application/json"}` (sem Authorization)
- Body: `{"automated": true}`

**Regras de Negócio:**
- Extensões necessárias: `pg_net`, `pg_cron`
- Não envia header `Authorization` (função deployada com `--no-verify-jwt`)
- Edge Function filtra: ignora feriados e dias sem pedidos 'pronto'

**Arquivos Relacionados:**
- `supabase/migrations/125_cron_relatorio_0835.sql` (mais recente)
- `supabase/functions/relatorio-envios/index.ts`

---

## 🔗 Documentos Relacionados

| Documento | Propósito |
|-----------|-----------|
| `CODEBASE.md` | Índice central do projeto — **sempre consultar primeiro** |
| `FUNCIONALIDADES_PROTEGIDAS.md` | Lista de módulos que NÃO devem ser modificados |
| `CODIGO_PROTECAO_POLICY.md` | Política completa de proteção com matriz RBAC |
| `ARCHITECTURE.md` | Estrutura de pastas e convenções de import |
| `DEPLOY_EDGE_FUNCTION.md` | Guia de deploy de Edge Functions |
| `lib/rbac/permissions.ts` | Definição de permissões e roles |
| `CONFIRMAR_EMAIL.md` | Guia de confirmação de email e aprovação de usuários |

---

## ⚠️ Checklist Pré-Modificação

Antes de começar, marque mentalmente:

- [ ] Li o `CODEBASE.md` e identifiquei a função/arquivo
- [ ] Li o arquivo de origem **na íntegra**
- [ ] Identifiquei quem chama essa função (dependentes)
- [ ] Entendi as regras de negócio envolvidas
- [ ] Verifiquei permissões RBAC necessárias
- [ ] Apresentei o plano e aguardei confirmação
- [ ] Sei qual migration/tabela/atualizar se criar nova funcionalidade
- [ ] **Verifiquei se é uma das novas funções (108-117)** → extrema cautela!

---

## 🚨 Sinais de Alerta (Pare e Consulte)

Se encontrar qualquer um destes sinais, **pare** e consulte o usuário:

| Sinal | Ação |
|-------|------|
| Função tem comentário explicando "por que existe" | Não remova — há razão histórica |
| Migration tem `🔴 ALTO` no CODEBASE.md | Extrema cautela — testar muito |
| Edge Function tem verificação de ADM | Não remover — é segurança |
| Tabela tem RLS (Row Level Security) | Não modificar policies sem entender |
| Hook tem `useQuery` com `staleTime` | Há motivo de performance |
| Componente é listado em **Protegidos** | Não modificar — consultar `FUNCIONALIDADES_PROTEGIDAS.md` |
| **Função é `aprovar_usuario()` ou `get_current_user_role()`** | **NÃO MODIFICAR SEM APROVAÇÃO** |
| **Função é `duplicar_pedido_como_reenvio()`** | **Testar exaustivamente fluxo de reenvio** |
| **Tabela é `zapi_config`** | **Apenas ADM pode modificar** |
| **Função é `atribuir_atendimento()`** | **Verificar RLS de crm_atendimentos** |
| **Função é `cancelar_pedido_logistica()` ou `restaurar_pedido_logistica()`** | **Verificar status antes/after** |
| **Função é `unificar_pedidos()` ou `unificar_pedidos_mesmo_endereco()`** | **Preservar logica de concatenação de descrição** |
| **Função é `usuario_pode_ver_mensagem()`** | **Não remover SECURITY DEFINER — quebra Realtime** |
| **Tabela é `crm_atendimentos` ou `crm_mensagens`** | **Verificar impacto no Chat WhatsApp** |
| **Job é `job_relatorio_diario_automatizado`** | **Testar cron antes de modificar horário** |
