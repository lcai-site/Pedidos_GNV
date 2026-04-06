# 🛡️ POLÍTICA DE PROTEÇÃO DE CÓDIGO

> **Data de Criação:** 26 de março de 2026  
> **Versão do Sistema:** 2.0 - CRM e Gestão de Pedidos Integrados  
> **Status:** ✅ ATIVO - Todas as funcionalidades listadas estão 100% operacionais

---

## 📋 ÍNDICE

1. [Princípios Fundamentais](#princípios-fundamentais)
2. [Módulos Protegidos](#módulos-protegidos)
3. [Regras de Modificação](#regras-de-modificação)
4. [Checklist para Novas Funcionalidades](#checklist-para-novas-funcionalidades)
5. [Matriz de Permissões RBAC](#matriz-de-permissões-rbac)
6. [Arquivos Críticos do Sistema](#arquivos-críticos-do-sistema)
7. [Fluxo de Implantação](#fluxo-de-implantação)

---

## 🎯 PRINCÍPIOS FUNDAMENTAIS

### Princípio #1: Não Quebre o Que Funciona
> **Qualquer ajuste, nova feature ou correção deve ser feito de forma CIRÚRGICA, sem tocar nos módulos já funcionais.**

### Princípio #2: Isolamento de Módulos
> **Cada módulo é independente — não importe de outros módulos diretamente.**

### Princípio #3: Staging First
> **Sempre teste em staging antes de produzir.**

### Princípio #4: Documentação Obrigatória
> **Nova funcionalidade = Nova documentação + Migration numerada.**

---

## 🔒 MÓDULOS PROTEGIDOS

### MÓDULO 1: GERAÇÃO CORREIOS (NATIVO)
| Campo | Descrição |
|-------|-----------|
| **Descrição** | Integração direta com servidor oficial dos Correios |
| **Funcionalidade** | Conversão do suplemento no formato contratual e geração de PDF de etiqueta |
| **Localização** | `modules/logistics/`, `api/correios/` |
| **Status** | ✅ PROTEGIDO |
| **Permissões RBAC** | `logistics:generate_labels` (gestor, adm) |

---

### MÓDULO 2: SINCRONIZAÇÃO MELHOR ENVIO
| Campo | Descrição |
|-------|-----------|
| **Descrição** | Monitoramento automático de etiquetas pagas |
| **Funcionalidade** | Detecção da mudança de status "Paga → Disponível" e importação automática do código de rastreio |
| **Localização** | `api/melhor-envio/`, `sync_correios_tracking.sql` |
| **Status** | ✅ PROTEGIDO |
| **Permissões RBAC** | `logistics:view`, `logistics:edit` |

---

### MÓDULO 3: CÁLCULO DE TOTAIS (DASHBOARD)
| Campo | Descrição |
|-------|-----------|
| **Descrição** | Soma de gastos com frete por período |
| **Funcionalidade** | Separação por modalidade (PAC, SEDEX) para métricas do dashboard |
| **Localização** | `pages/Dashboard.tsx`, RPCs de métricas |
| **Status** | ✅ PROTEGIDO |
| **Permissões RBAC** | `dashboard:view` |

---

### MÓDULO 4: EDIÇÃO INLINE DE ENDEREÇO/NOME
| Campo | Descrição |
|-------|-----------|
| **Descrição** | Edição por duplo clique na tabela de pedidos |
| **Funcionalidade** | Sincronização imediata com banco de dados e flag `foi_editado` para proteger de sobrescrita |
| **Proteção** | Pedidos com `foi_editado=true` não são sobrescritos pela consolidação |
| **Localização** | `pages/Logistics.tsx`, `pedidos_consolidados_v3` |
| **Status** | ✅ PROTEGIDO |
| **Permissões RBAC** | `pedidos:edit`, `clientes:edit` |

---

### MÓDULO 5: UNIFICAÇÃO DE PEDIDOS (MERGE)
| Campo | Descrição |
|-------|-----------|
| **Descrição** | Detecção e sugestão de unificação de pedidos do mesmo cliente |
| **Funcionalidade** | Geração de etiqueta única para pedidos múltiplos |
| **Migrations** | `049_unificar_pedidos.sql` |
| **Status** | ✅ PROTEGIDO |
| **Permissões RBAC** | `logistics:edit` |

---

### MÓDULO 6: PÓS-VENDA INTELIGENTE (REGRA DE 1 DIA)
| Campo | Descrição |
|-------|-----------|
| **Descrição** | Bloqueio de pedido por 24h na aba Pós-Venda |
| **Funcionalidade** | Função `calcular_janela_pv()` que define prazo antes de liberar para etiquetagem |
| **Regra** | Pedido com CC só aparece após 1 dia útil da compra |
| **Migrations** | `009_funcao_janela_pv.sql`, `099_fix_foi_editado_pv.sql` |
| **Status** | ✅ PROTEGIDO |
| **Permissões RBAC** | `dashboard_posvenda:view_own` (atendente), `dashboard_posvenda:view_all` (gestor, adm) |

---

### MÓDULO 7: ANÁLISE DE ERROS POR IA
| Campo | Descrição |
|-------|-----------|
| **Descrição** | Leitura do endereço com erro via IA |
| **Funcionalidade** | Sugestão de correção (CEP, bairro, etc.) exibida no painel de observações |
| **Integração** | OpenRouter (chave `sk-or-v1-...`) |
| **Localização** | `api/openrouter/` |
| **Status** | ✅ PROTEGIDO |

---

### MÓDULO 8: DETECÇÃO INTELIGENTE DE DUPLICATAS
| Campo | Descrição |
|-------|-----------|
| **Descrição** | Sistema que identifica pedidos com mesmo CPF mas dados divergentes |
| **Divergências detectadas** | Nome, e-mail, telefone diferentes |
| **Interface** | Notificações em tempo real via sino de notificações + modal comparativo |
| **Localização** | `lib/contexts/NotificationContext.tsx` (função `detectSimilarPairs()`), `components/SimilarOrdersModal.tsx`, `components/NotificationMenu.tsx` |
| **Status** | ✅ PROTEGIDO |
| **Permissões RBAC** | `clientes:view`, `pedidos:view` |

---

### MÓDULO 9: UNIFICAÇÃO POR MESMO ENDEREÇO (REFINADA - V106)
| Campo | Descrição |
|-------|-----------|
| **Descrição** | Funções RPC para detectar e unificar pedidos inconsistentes |
| **Tipos** | Mesmo CPF/Dif Endereço ou Mesmo Endereço/Dif CPF |
| **Robustez** | Consulta direta na `pedidos_consolidados_v3`, ignora `status_aprovacao = 'Unificado'` |
| **Nomenclatura** | Padrão: `Produto Original + 1 SIGLA` (ex: `Bela Lumi + 1 DP`) |
| **Filtro de Fraude** | Ignora UPSELL e BUMP automaticamente |
| **Funções RPC** | `encontrar_pedidos_mesmo_endereco()`, `unificar_pedidos_mesmo_endereco()` |
| **Migration** | `106_corrigir_modal_unificacao.sql`, `105_unificacao_mesmo_endereco.sql` |
| **Status** | ✅ PROTEGIDO |
| **Permissões RBAC** | `logistics:edit` |

---

### MÓDULO 10: SUPORTE MULTI-PLATAFORMA (TICTO + VIRALMART)
| Campo | Descrição |
|-------|-----------|
| **Descrição** | Motor de consolidação unificado para múltiplas origens de webhook |
| **Funcionalidade** | Coluna `plataforma` em `ticto_pedidos` e `pedidos_consolidados_v3` |
| **Isolamento** | `order_hash` + `plataforma` para evitar colisões de IDs |
| **Migration** | `095_add_plataforma_viralmart.sql` |
| **Status** | ✅ PROTEGIDO |
| **Permissões RBAC** | `pedidos:view`, `pedidos:edit` |

---

### MÓDULO 11: SMART FILTER DE UNIFICADOS
| Campo | Descrição |
|-------|-----------|
| **Descrição** | Lógica de interface que remove pedidos `Unificado` da visão do CRM |
| **Impacto** | Limpa poluição visual do Kanban/Listagem |
| **Localização** | `pages/Logistics.tsx` (filtro no `fetchOrders`) |
| **Status** | ✅ PROTEGIDO |

---

### MÓDULO 12: CRM KANBAN COMPLETO
| Campo | Descrição |
|-------|-----------|
| **Descrição** | Sistema de gestão de leads inspirado em Bitrix24/Pipedrive |
| **Tabelas** | `crm_pipelines`, `crm_etapas`, `crm_tags`, `crm_leads`, `crm_lead_tags`, `crm_historico`, `crm_tarefas`, `crm_produtos`, `crm_lead_produtos` |
| **Funcionalidades** | Drag-and-drop, cards ricos, filtros avançados, modal de lead, dashboard de estatísticas |
| **Localização** | `lib/hooks/useCRMKanban.ts`, `components/crm/KanbanBoard.tsx`, `components/crm/LeadModal.tsx`, `pages/CRM/` |
| **Migration** | `070_crm_kanban_completo_final.sql` |
| **Status** | ✅ PROTEGIDO |
| **Permissões RBAC** | `crm:view`, `crm:edit`, `crm:config` (adm) |

---

### MÓDULO 13: AUTOMAÇÕES DE CRM
| Campo | Descrição |
|-------|-----------|
| **Descrição** | Sistema de regras automáticas para etiquetas e pipelines |
| **Tabelas** | `crm_automacao_regras`, `crm_automacao_logs` |
| **Gatilhos** | `lead_criado`, `status_alterado`, `etapa_alterado`, `secao_alterado`, `tempo_na_etapa`, `compra_realizada`, `compra_cancelada` |
| **Ações** | `aplicar_tag`, `remover_tag`, `mover_pipeline`, `criar_tarefa`, `enviar_notificacao`, `atualizar_campo` |
| **Função RPC** | `executar_regras_automacao(p_lead_id, p_gatilho_tipo, p_contexto)` |
| **Migration** | `081_criar_automacoes_crm.sql` |
| **Status** | ✅ PROTEGIDO |
| **Permissões RBAC** | `crm:config` (adm) |

---

### MÓDULO 14: SISTEMA DE NOTIFICAÇÕES EM TEMPO REAL
| Campo | Descrição |
|-------|-----------|
| **Descrição** | Contexto React para notificações push do sistema |
| **Tipos** | `possivel_duplicata`, `warning`, `info`, `error`, `success` |
| **Funcionalidades** | Contador de não lidas, realtime via Supabase, priorização de duplicatas |
| **Localização** | `lib/contexts/NotificationContext.tsx` |
| **Status** | ✅ PROTEGIDO |
| **Permissões RBAC** | Global (todos os roles) |

---

### MÓDULO 15: CONSOLIDAÇÃO COM JANELA DE 5 DIAS
| Campo | Descrição |
|-------|-----------|
| **Descrição** | Função `consolidar_pedidos_v3()` atualizada |
| **Mudança** | Redução de janela de detecção para 5 dias |
| **Proteção** | Preserva registros com `codigo_rastreio`, `foi_editado=true` ou `data_envio` |
| **Status de Consolidação** | `Aprovado`, `Mesmo End`, `Unificado` |
| **Migration** | `104_janela_5dias_verificar_endereco.sql` |
| **Status** | ✅ PROTEGIDO |

---

### MÓDULO 16: PROTEÇÃO DE ETIQUETAS GERADAS
| Campo | Descrição |
|-------|-----------|
| **Descrição** | Sistema que bloqueia edição de pedidos já etiquetados |
| **Gatilhos de Proteção** | `codigo_rastreio IS NOT NULL`, `foi_editado = TRUE`, `data_envio IS NOT NULL` |
| **Implementação** | Tabela temporária `_locked_ids` na consolidação |
| **Migrations** | `087_protect_etiquetados.sql`, `088_complete_label_protection.sql` |
| **Status** | ✅ PROTEGIDO |
| **Permissões RBAC** | `logistics:edit` (com restrições) |

---

### MÓDULO 17: GESTÃO DE PERMISSÕES RBAC
| Campo | Descrição |
|-------|-----------|
| **Descrição** | Controle de acesso baseado em papéis (Role-Based Access Control) |
| **Tabelas** | `profiles` com colunas de role e permissões |
| **Cargos** | `atendente`, `gestor`, `adm` |
| **Proteção** | RPCs e tabelas com verificação de permissão via RLS |
| **Localização** | `lib/rbac/permissions.ts`, `lib/contexts/AuthContext.tsx`, `components/RBAC/` |
| **Migrations** | `001_add_rbac_to_profiles.sql`, `002_fix_rls_policies.sql`, `083_fix_profiles_permissions.sql`, `084_user_custom_permissions.sql`, `085_complete_permissions_system.sql` |
| **Status** | ✅ PROTEGIDO |

---

### MÓDULO 18: GESTÃO DE ESTOQUE
| Campo | Descrição |
|-------|-----------|
| **Descrição** | Controle de estoque de produtos com alertas automáticos |
| **Funcionalidades** | Adição, edição, ajuste, exclusão, configuração de limites |
| **Localização** | `pages/Estoque.tsx`, `estoque` (tabela) |
| **Status** | ✅ PROTEGIDO |
| **Permissões RBAC** | `estoque:view`, `estoque:edit`, `estoque:add`, `estoque:adjust`, `estoque:delete`, `estoque:config` |

---

### MÓDULO 19: SISTEMA DE SOLICITAÇÕES
| Campo | Descrição |
|-------|-----------|
| **Descrição** | Fluxo de solicitações de reembolso e aprovações |
| **Funcionalidades** | Criação, aprovação, notificação WhatsApp |
| **Localização** | `pages/Solicitacoes/`, `solicitacoes` (tabela) |
| **Status** | ✅ PROTEGIDO |
| **Permissões RBAC** | `solicitacoes:create`, `solicitacoes:approve`, `reembolsos:create`, `reembolsos:approve`, `reembolsos:notify_whatsapp` |

---

### MÓDULO 20: GESTÃO DE USUÁRIOS
| Campo | Descrição |
|-------|-----------|
| **Descrição** | Administração de usuários do sistema |
| **Funcionalidades** | Criar, editar, remover, gerenciar permissões |
| **Localização** | `pages/Usuarios.tsx`, `profiles` (tabela) |
| **Status** | ✅ PROTEGIDO |
| **Permissões RBAC** | `usuarios:manage_atendentes` (gestor), `usuarios:manage_all` (adm) |

---

### MÓDULO 21: LOGIN & APROVAÇÃO DE USUÁRIOS (Migration 108)
| Campo | Descrição |
|-------|-----------|
| **Descrição** | Sistema de aprovação de usuários com RLS segura |
| **Funções RPC** | `get_current_user_role()`, `aprovar_usuario(UUID)` |
| **Regras de Negócio** | Novo usuário nasce com `ativo = FALSE`, apenas ADM aprova |
| **Proteção** | Modificar RLS apenas com teste exaustivo |
| **Migrations** | `108_login_aprovacao_producao.sql` |
| **Status** | ✅ PROTEGIDO |
| **Permissões RBAC** | `usuarios:manage_all` (adm) |

---

### MÓDULO 22: NUMERAÇÃO SEQUENCIAL DE SOLICITAÇÕES (Migration 109)
| Campo | Descrição |
|-------|-----------|
| **Descrição** | Geração automática de números sequenciais por tipo |
| **Funções RPC** | `gerar_numero_solicitacao(TEXT)`, `trigger_set_numero_solicitacao()` |
| **Regras de Negócio** | Prefixos: REE (reembolso), REC (reclamação), CAN (cancelamento) |
| **Migrations** | `109_solicitacoes_numero_sequencial.sql` |
| **Status** | ✅ PROTEGIDO |
| **Permissões RBAC** | `solicitacoes:create` |

---

### MÓDULO 23: CRM Z-API CONFIG + WHATSAPP TEMPLATES (Migration 109)
| Campo | Descrição |
|-------|-----------|
| **Descrição** | Configuração Z-API e templates de mensagens WhatsApp |
| **Tabelas** | `zapi_config` (credenciais), `whatsapp_templates` (templates) |
| **RLS** | `zapi_config`: Apenas ADM; `whatsapp_templates`: ADM, Gestor |
| **Templates** | Pedido Postado, Em Trânsito, Saiu para Entrega, etc. |
| **Migrations** | `109_crm_rodada1.sql` |
| **Status** | ✅ PROTEGIDO |
| **Permissões RBAC** | `settings:edit` (zapi_config), `crm:config` (templates) |

---

### MÓDULO 24: REENVIO VINCULADO À SOLICITAÇÃO (Migration 110)
| Campo | Descrição |
|-------|-----------|
| **Descrição** | Sistema de reenvio de pedidos vinculado a solicitações |
| **Funções RPC** | `duplicar_pedido_como_reenvio(UUID, UUID, TEXT)` |
| **Regras de Negócio** | Reenvio nasce com `is_reenvio = TRUE`, `foi_editado = TRUE` |
| **Campos Novos** | `solicitacoes`: `necessita_reenvio`, `pedido_reenvio_id`; `pedidos_consolidados_v3`: `is_reenvio`, `pedido_origem_id` |
| **Proteção** | Testar exaustivamente fluxo de reenvio antes de modificar |
| **Migrations** | `110_reenvio_solicitacoes.sql` |
| **Status** | ✅ PROTEGIDO |
| **Permissões RBAC** | `solicitacoes:approve`, `reembolsos:create` |

---

### MÓDULO 25: CRIAR PEDIDO MANUAL (Migrations 111-112)
| Campo | Descrição |
|-------|-----------|
| **Descrição** | Criação de pedidos manuais fora do webhook |
| **Funções RPC** | `criar_pedido_manual(...)` |
| **Regras de Negócio** | Cria em `ticto_pedidos` e `pedidos_consolidados_v3` com `plataforma = 'Manual'`, `foi_editado = TRUE` |
| **Proteção** | Manter `foi_editado = TRUE` para pedidos manuais |
| **Migrations** | `112_criar_pedido_manual_completo.sql` |
| **Status** | ✅ PROTEGIDO |
| **Permissões RBAC** | `logistics:add` (gestor, adm) |

---

## 📝 REGRAS DE MODIFICAÇÃO

### ✅ PERMITIDO

1. **Adicionar novas permissões** ao arquivo `lib/rbac/permissions.ts`
2. **Criar novos módulos** em `modules/[nome-modulo]/`
3. **Adicionar novas migrations** numeradas sequencialmente
4. **Criar novos componentes** em `components/`
5. **Adicionar novos hooks** em `lib/hooks/`
6. **Estender contextos existentes** com novas funcionalidades (sem quebrar as existentes)
7. **Criar novas páginas** seguindo o padrão de Lazy Loading do `App.tsx`
8. **Adicionar novas rotas** protegidas com `ProtectedRoute` e `RoleGuard`

### ❌ PROIBIDO

1. **Modificar migrations existentes** — crie uma nova migration de correção
2. **Alterar funções RPC protegidas** sem criar versão nova (ex: `consolidar_pedidos_v4()`)
3. **Remover colunas de tabelas** sem migração de dados e backup
4. **Modificar permissões RBAC existentes** — apenas adicione novas
5. **Quebrar isolamento de módulos** — não importe diretamente de `modules/[outro-modulo]/`
6. **Alterar estrutura do `App.tsx`** — rotas existentes são imutáveis
7. **Modificar `NotificationContext.tsx`** — a função `detectSimilarPairs()` é crítica
8. **Alterar `AuthContext.tsx`** — o fallback seguro é essencial para estabilidade
9. **Remover proteções de etiquetas** — gatilhos `codigo_rastreio`, `foi_editado`, `data_envio`
10. **Modificar janela de consolidação** sem aprovação explícita

---

## ✅ CHECKLIST PARA NOVAS FUNCIONALIDADES

Ao adicionar uma nova funcionalidade, siga este checklist:

### Fase 1: Planejamento
- [ ] Documentar a funcionalidade em arquivo `.md` dedicado
- [ ] Identificar qual módulo existente será afetado (se houver)
- [ ] Definir permissões RBAC necessárias
- [ ] Criar issue/tarefa no sistema de versionamento

### Fase 2: Desenvolvimento
- [ ] Criar migration SQL numerada (ex: `107_nova_funcionalidade.sql`)
- [ ] Isolar código em módulo/componente separado
- [ ] Adicionar permissões em `lib/rbac/permissions.ts`
- [ ] Seguir convenções de nomenclatura do projeto
- [ ] Escrever testes unitários (se aplicável)

### Fase 3: Testes
- [ ] Testar em ambiente Staging primeiro
- [ ] Verificar permissões RBAC para todos os roles
- [ ] Testar fluxo completo da funcionalidade
- [ ] Verificar se não quebrou funcionalidades existentes
- [ ] Rodar `npm run lint` e `npm run build`

### Fase 4: Documentação
- [ ] Atualizar `FUNCIONALIDADES_PROTEGIDAS.md`
- [ ] Atualizar `CODIGO_PROTECAO_POLICY.md` (este arquivo)
- [ ] Adicionar nota de release
- [ ] Documentar no `README.md` (se aplicável)

### Fase 5: Implantação
- [ ] Aplicar migration em Staging
- [ ] Testar em Staging
- [ ] Agendar implantação em Produção
- [ ] Aplicar migration em Produção
- [ ] Verificar funcionamento em Produção
- [ ] Comunicar usuários (se necessário)

---

## 🔐 MATRIZ DE PERMISSÕES RBAC

### Legenda
- ✅ = Possui permissão
- ❌ = Não possui permissão

### Tabela de Permissões por Módulo

| Permissão | Atendente | Gestor | Adm |
|-----------|-----------|--------|-----|
| **Dashboard** |
| `dashboard:view` | ✅ | ✅ | ✅ |
| `dashboard_posvenda:view_own` | ✅ | ❌ | ❌ |
| `dashboard_posvenda:view_all` | ❌ | ✅ | ✅ |
| **Logística** |
| `logistics:view` | ✅ | ✅ | ✅ |
| `logistics:edit` | ❌ | ✅ | ✅ |
| `logistics:generate_labels` | ❌ | ✅ | ✅ |
| **Clientes** |
| `clientes:view` | ✅ | ✅ | ✅ |
| `clientes:edit` | ✅ | ✅ | ✅ |
| **Pedidos** |
| `pedidos:view` | ✅ | ✅ | ✅ |
| `pedidos:edit` | ✅ | ✅ | ✅ |
| **Solicitações** |
| `solicitacoes:create` | ✅ | ✅ | ✅ |
| `solicitacoes:approve` | ❌ | ✅ | ✅ |
| **Reembolsos** |
| `reembolsos:create` | ✅ | ✅ | ✅ |
| `reembolsos:approve` | ❌ | ✅ | ✅ |
| `reembolsos:notify_whatsapp` | ❌ | ✅ | ✅ |
| **Usuários** |
| `usuarios:manage_atendentes` | ❌ | ✅ | ❌ |
| `usuarios:manage_all` | ❌ | ❌ | ✅ |
| **Metas** |
| `metas:define` | ❌ | ✅ | ✅ |
| **Relatórios** |
| `relatorios:export` | ❌ | ✅ | ✅ |
| **Configurações** |
| `settings:view` | ✅ | ✅ | ✅ |
| `settings:edit` | ❌ | ❌ | ✅ |
| **Estoque** |
| `estoque:view` | ✅ | ✅ | ✅ |
| `estoque:edit` | ❌ | ✅ | ✅ |
| `estoque:add` | ❌ | ✅ | ✅ |
| `estoque:adjust` | ❌ | ✅ | ✅ |
| `estoque:delete` | ❌ | ❌ | ✅ |
| `estoque:config` | ❌ | ❌ | ✅ |
| **CRM** |
| `crm:view` | ✅ | ✅ | ✅ |
| `crm:edit` | ❌ | ✅ | ✅ |
| `crm:config` | ❌ | ❌ | ✅ |
| **Assinaturas** |
| `assinaturas:view` | ❌ | ✅ | ✅ |
| `assinaturas:edit` | ❌ | ✅ | ✅ |
| **Recuperação** |
| `recuperacao:view` | ❌ | ✅ | ✅ |
| `recuperacao:edit` | ❌ | ✅ | ✅ |

---

## 📁 ARQUIVOS CRÍTICOS DO SISTEMA

### Core do Sistema (NÃO MODIFICAR SEM APROVAÇÃO)

| Arquivo | Descrição | Risco |
|---------|-----------|-------|
| `App.tsx` | Entry point com rotas e proteção | 🔴 ALTO |
| `lib/contexts/AuthContext.tsx` | Autenticação e RBAC | 🔴 ALTO |
| `lib/contexts/NotificationContext.tsx` | Notificações em tempo real | 🔴 ALTO |
| `lib/rbac/permissions.ts` | Matriz de permissões | 🔴 ALTO |
| `lib/supabase.ts` | Cliente Supabase | 🔴 ALTO |

### Módulos Protegidos (MODIFICAR COM CAUTELA)

| Arquivo | Descrição | Risco |
|---------|-----------|-------|
| `pages/Logistics.tsx` | Gestão de pedidos e etiquetas | 🟡 MÉDIO |
| `pages/Dashboard.tsx` | Métricas e totais | 🟡 MÉDIO |
| `pages/CRM/Leads.tsx` | Kanban de leads | 🟡 MÉDIO |
| `components/crm/KanbanBoard.tsx` | Drag-and-drop CRM | 🟡 MÉDIO |
| `components/crm/LeadModal.tsx` | Modal de detalhes do lead | 🟡 MÉDIO |
| `components/SimilarOrdersModal.tsx` | Modal de duplicatas | 🟡 MÉDIO |
| `components/NotificationMenu.tsx` | Menu de notificações | 🟡 MÉDIO |
| `components/ModalUnificarEndereco.tsx` | Unificação de pedidos | 🟡 MÉDIO |

### Migrations SQL (NÃO MODIFICAR — CRIE NOVAS)

| Migration | Descrição | Risco |
|-----------|-----------|-------|
| `001_add_rbac_to_profiles.sql` | Base do RBAC | 🔴 ALTO |
| `049_unificar_pedidos.sql` | Unificação de pedidos | 🔴 ALTO |
| `070_crm_kanban_completo_final.sql` | CRM Kanban | 🔴 ALTO |
| `081_criar_automacoes_crm.sql` | Automações | 🔴 ALTO |
| `087_protect_etiquetados.sql` | Proteção de etiquetas | 🔴 ALTO |
| `088_complete_label_protection.sql` | Proteção completa | 🔴 ALTO |
| `095_add_plataforma_viralmart.sql` | Multi-plataforma | 🔴 ALTO |
| `104_janela_5dias_verificar_endereco.sql` | Janela de consolidação | 🔴 ALTO |
| `105_unificacao_mesmo_endereco.sql` | Unificação por endereço | 🔴 ALTO |
| `106_corrigir_modal_unificacao.sql` | Correção unificação | 🔴 ALTO |

---

## 🚀 FLUXO DE IMPLANTAÇÃO

### Ambiente de Desenvolvimento
```bash
npm run dev
```

### Ambiente de Staging
```bash
# Build
npm run build:staging

# Preview
npm run preview:staging

# Deploy (se configurado)
npm run deploy:staging
```

### Ambiente de Produção
```bash
# Build
npm run build

# Deploy (se configurado)
npm run deploy:production
```

### Regras de Implantação

1. **Sempre teste em Staging primeiro**
2. **Nunca faça deploy direto em Produção**
3. **Aplique migrations em ordem sequencial**
4. **Faça backup antes de qualquer migration em Produção**
5. **Verifique logs após cada deploy**

---

## 📞 SUPORTE E ESCALONAMENTO

### Nível 1: Dúvidas de Implementação
1. Consulte este arquivo
2. Verifique `FUNCIONALIDADES_PROTEGIDAS.md`
3. Analise o histórico de migrations
4. Examine imports/dependências do código

### Nível 2: Problemas Técnicos
1. Verifique logs do Supabase
2. Analise console do navegador (F12)
3. Execute testes unitários (se disponíveis)
4. Consulte documentação do módulo afetado

### Nível 3: Modificações Críticas
**Contate o responsável antes de:**
- Modificar qualquer arquivo marcado como 🔴 ALTO
- Alterar estrutura de tabelas do banco de dados
- Remover ou modificar funções RPC existentes
- Mudar permissões RBAC existentes

---

## 📊 MÉTRICAS DE PROTEÇÃO

| Métrica | Valor | Status |
|---------|-------|--------|
| Módulos Protegidos | 25 | ✅ |
| Migrations Críticas | 15+ | ✅ |
| Permissões RBAC | 45+ | ✅ |
| Arquivos Core | 5 | ✅ |
| Última Atualização | 27/03/2026 | ✅ |

---

## 🔄 HISTÓRICO DE REVISÕES

| Versão | Data | Descrição | Autor |
|--------|------|-----------|-------|
| 2.0 | 27/03/2026 | Adicionado Módulos 21-25 (Login, Numeração, Z-API, Reenvio, Pedido Manual) | Sistema |
| 1.0 | 26/03/2026 | Criação inicial da política | Sistema |

---

**PRINCÍPIO FINAL:** Na dúvida, **NÃO MODIFIQUE**. Consulte o responsável.
