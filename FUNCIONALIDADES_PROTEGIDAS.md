# 🔒 FUNCIONALIDADES PROTEGIDAS — NÃO MODIFICAR

> **Data da Última Atualização:** 25 de março de 2026  
> **Versão do Sistema:** 2.0 - CRM e Gestão de Pedidos Integrados

---

## [CONTEXTO DO SISTEMA]

Estou trabalhando em uma plataforma modular de CRM e Gestão de Pedidos. Todas as funcionalidades listadas abaixo estão 100% funcionando e não devem ser alteradas, removidas ou refatoradas salvo instrução explícita minha.

⚠️ **REGRA PRINCIPAL:** Qualquer ajuste, nova feature ou correção deve ser feita de forma **cirúrgica**, sem tocar nos módulos já funcionais abaixo.

---

## 🔒 MÓDULOS PROTEGIDOS CLÁSSICOS

### 1. Geração Correios (Nativo)
- **Descrição:** Integração direta com servidor oficial dos Correios
- **Funcionalidade:** Conversão do suplemento no formato contratual e geração de PDF de etiqueta
- **Arquivos relacionados:** `modules/logistics/`, `api/correios/`

### 2. Sincronização Melhor Envio
- **Descrição:** Monitoramento automático de etiquetas pagas
- **Funcionalidade:** Detecção da mudança de status "Paga → Disponível" e importação automática do código de rastreio
- **Arquivos relacionados:** `api/melhor-envio/`, `sync_correios_tracking.sql`

### 3. Cálculo de Totais (Dashboard)
- **Descrição:** Soma de gastos com frete por período
- **Funcionalidade:** Separação por modalidade (PAC, SEDEX) para métricas do dashboard
- **Arquivos relacionados:** `pages/Dashboard.tsx`, RPCs de métricas

### 4. Edição Inline de Endereço/Nome
- **Descrição:** Edição por duplo clique na tabela de pedidos
- **Funcionalidade:** Sincronização imediata com banco de dados e flag `foi_editado` para proteger de sobrescrita
- **Proteção:** Pedidos com `foi_editado=true` não são sobrescritos pela consolidação

### 5. Unificação de Pedidos (Merge)
- **Descrição:** Detecção e sugestão de unificação de pedidos do mesmo cliente
- **Funcionalidade:** Geração de etiqueta única para pedidos múltiplos
- **Arquivos relacionados:** `049_unificar_pedidos.sql`

### 6. Pós-Venda Inteligente (Regra de 1 Dia)
- **Descrição:** Bloqueio de pedido por 24h na aba Pós-Venda
- **Funcionalidade:** Função `calcular_janela_pv()` que define prazo antes de liberar para etiquetagem
- **Regra:** Pedido com CC só aparece após 1 dia útil da compra

### 7. Análise de Erros por IA
- **Descrição:** Leitura do endereço com erro via IA
- **Funcionalidade:** Sugestão de correção (CEP, bairro, etc.) exibida no painel de observações
- **Integração:** OpenRouter (chave `sk-or-v1-...`)
- **Arquivos relacionados:** `api/openrouter/`

---

## 🆕 NOVAS FUNCIONALIDADES PROTEGIDAS (2026)

### 8. Detecção Inteligente de Duplicatas
- **Descrição:** Sistema que identifica pedidos com mesmo CPF mas dados divergentes
- **Divergências detectadas:** Nome, e-mail, telefone diferentes
- **Interface:** Notificações em tempo real via sino de notificações + modal comparativo
- **Arquivos relacionados:**
  - `lib/contexts/NotificationContext.tsx` (função `detectSimilarPairs()`)
  - `components/SimilarOrdersModal.tsx`
  - `components/NotificationMenu.tsx`
- **Migrations:** Integrado ao sistema de notificações

### 9. Unificação por Mesmo Endereço (Refinada - v106)
- **Descrição:** Funções RPC para detectar e unificar pedidos inconsistentes (Mesmo CPF/Dif Endereço ou Mesmo Endereço/Dif CPF)
- **Robustez:** Consulta direta na `pedidos_consolidados_v3` (mais fiel ao CRM) e ignora `status_aprovacao = 'Unificado'` para evitar loop
- **Nomenclatura Uniforme:** Segue o padrão dos robôs: `Produto Original + 1 SIGLA` (ex: `Bela Lumi + 1 DP`)
- **Filtro de Fraude:** Ignora automaticamente UPSELL e BUMP para evitar falsos-positivos na logística
- **Funções RPC:**
  - `encontrar_pedidos_mesmo_endereco(p_pedido_id UUID)`
  - `unificar_pedidos_mesmo_endereco(p_pedido_principal UUID, p_pedido_secundario UUID)`
- **Migration:** `106_corrigir_modal_unificacao.sql`

### 10. Suporte Multi-Plataforma (Ticto + ViralMart)
- **Descrição:** Motor de consolidação unificado para múltiplas origens de webhook
- **Funcionalidade:** Adição da coluna `plataforma` em `ticto_pedidos` e `pedidos_consolidados_v3`
- **Isolamento:** Uso de `order_hash` + `plataforma` para evitar colisões de IDs entre plataformas diferentes
- **Migration:** `095_add_plataforma_viralmart.sql`

### 11. Smart Filter de Unificados (Frontend)
- **Descrição:** Lógica de interface que remove automaticamente pedidos marcados como `Unificado` da visão do CRM
- **Impacto:** Limpa a poluição visual do Kanban/Listagem e remove automaticamente o alerta "VERIFICAR: MESMO ENDEREÇO" do pedido mestre assim que a unificação é concluída
- **Arquivo:** `pages/Logistics.tsx` (Filtro no `fetchOrders`)

### 12. CRM Kanban Completo
- **Descrição:** Sistema de gestão de leads inspirado em Bitrix24/Pipedrive
- **Tabelas:**
  - `crm_pipelines` — Funis/Kanbans
  - `crm_etapas` — Colunas do Kanban
  - `crm_tags` — Tags categorizadas
  - `crm_leads` — Base de leads
  - `crm_lead_tags` — Relacionamento N:N
  - `crm_historico` — Timeline de eventos
  - `crm_tarefas` — Follow-ups e tarefas
  - `crm_produtos` — Catálogo de produtos
  - `crm_lead_produtos` — Interesses do lead
- **Funcionalidades:**
  - Drag-and-drop com `@hello-pangea/dnd`
  - Cards ricos com foto, nome, valor, tags, avatar
  - Filtros avançados (prioridade, tags, valor, período, busca)
  - Modal de lead com abas (Detalhes, Histórico, Tarefas, Anotações)
  - Dashboard de estatísticas (total, valor em aberto, ticket médio)
- **Arquivos relacionados:**
  - `lib/hooks/useCRMKanban.ts`
  - `components/crm/KanbanBoard.tsx`, `LeadModal.tsx`
  - `pages/CRM/` (Leads, Config, Pipelines, Etapas, Tags)
- **Migration:** `070_crm_kanban_completo_final.sql`

### 13. Automações de CRM
- **Descrição:** Sistema de regras automáticas para etiquetas e pipelines
- **Tabelas:**
  - `crm_automacao_regras` — Definição de gatilhos e ações
  - `crm_automacao_logs` — Auditoria de execuções
- **Gatilhos disponíveis:**
  - `lead_criado`, `status_alterado`, `etapa_alterada`
  - `secao_alterada`, `tempo_na_etapa`, `compra_realizada`, `compra_cancelada`
- **Ações disponíveis:**
  - `aplicar_tag`, `remover_tag`, `mover_pipeline`
  - `criar_tarefa`, `enviar_notificacao`, `atualizar_campo`
- **Função RPC:** `executar_regras_automacao(p_lead_id, p_gatilho_tipo, p_contexto)`
- **Migration:** `081_criar_automacoes_crm.sql`

### 14. Sistema de Notificações em Tempo Real
- **Descrição:** Contexto React para notificações push do sistema
- **Tipos de notificação:**
  - `possivel_duplicata` — Pedidos com mesmo CPF e dados divergentes
  - `warning` — Alertas gerais (ex: estoque baixo)
  - `info`, `error`, `success`
- **Funcionalidades:**
  - Contador de não lidas com badge animado
  - Realtime via Supabase (estoque, pedidos_consolidados_v3)
  - Priorização de duplicatas não lidas no topo
  - Modal integrado para revisão de duplicatas
  - Arquivo: `lib/contexts/NotificationContext.tsx`

### 15. Consolidação com Janela de 5 Dias
- **Descrição:** Função `consolidar_pedidos_v3()` atualizada
- **Mudança:** Redução de janela de detecção de endereço compartilhado para 5 dias
- **Proteção:** Preserva registros com `codigo_rastreio`, `foi_editado=true` ou `data_envio`
- **Status de consolidação:**
  - `Aprovado` — Pedido principal consolidado
  - `Mesmo End` — Endereço compartilhado com divergência
  - `Unificado` — Pedido absorvido por unificação
- **Migration:** `104_janela_5dias_verificar_endereco.sql`

### 16. Proteção de Etiquetas Geradas
- **Descrição:** Sistema que bloqueia edição de pedidos já etiquetados
- **Gatilhos de proteção:**
  - `codigo_rastreio IS NOT NULL`
  - `foi_editado = TRUE`
  - `data_envio IS NOT NULL`
- **Implementação:** Tabela temporária `_locked_ids` na consolidação
- **Migrations:** `087_protect_etiquetados.sql`, `088_complete_label_protection.sql`

### 17. Gestão de Permissões RBAC (Produção)
- **Descrição:** Controle de acesso baseado em papéis (Role-Based Access Control)
- **Tabelas:**
  - `profiles` — Perfis de usuário com cargos
  - Políticas RLS específicas por tabela
- **Cargos:** `admin`, `user`, `viewer`
- **Proteção:** RPCs e tabelas com verificação de permissão
- **Migrations:** `086_fix_consolidar_button.sql` + Políticas de RLS de Produção.

### 18. Login & Aprovação de Usuários (Migration 108)
- **Descrição:** Sistema de aprovação de usuários com RLS segura
- **Funções RPC:**
  - `get_current_user_role()` — Verifica role sem recursão RLS (SECURITY DEFINER)
  - `aprovar_usuario(UUID)` — Apenas ADM pode ativar contas
- **Regras de Negócio:**
  - Novo usuário nasce com `ativo = FALSE` e `role = 'atendente'`
  - Trigger `on_auth_user_created` cria perfil automaticamente
  - Políticas RLS usam `get_current_user_role()` para evitar recursão
- **Proteção:** Modificar RLS apenas com teste exaustivo
- **Migrations:** `108_login_aprovacao_producao.sql`
- **Arquivos Relacionados:**
  - `pages/Usuarios/index.tsx` → chama `aprovar_usuario()`
  - `lib/contexts/AuthContext.tsx` → verifica `ativo` antes de logar

### 19. Numeração Sequencial de Solicitações (Migration 109)
- **Descrição:** Geração automática de números sequenciais por tipo
- **Funções RPC:**
  - `gerar_numero_solicitacao(TEXT)` — Gera REE-00001, REC-00001, CAN-00001
  - `trigger_set_numero_solicitacao()` — Trigger antes de INSERT
- **Regras de Negócio:**
  - Prefixos: `REE` (reembolso), `REC` (reclamação), `CAN` (cancelamento)
  - Numeração com 5 dígitos: `REE-00001`, `REE-00002`...
  - Trigger só gera se `numero_solicitacao IS NULL`
- **Migrations:** `109_solicitacoes_numero_sequencial.sql`
- **Arquivos Relacionados:**
  - `pages/Solicitacoes/` → usa numeração sequencial

### 20. CRM Z-API Config + WhatsApp Templates (Migration 109)
- **Descrição:** Configuração Z-API e templates de mensagens WhatsApp
- **Tabelas:**
  - `zapi_config` — Credenciais e status da instância Z-API (RLS: Apenas ADM)
  - `whatsapp_templates` — Templates com variáveis dinâmicas (RLS: ADM, Gestor)
- **Templates Padrão:**
  - `Pedido Postado`, `Em Trânsito`, `Saiu para Entrega`, `Pedido Entregue`
  - `Boas-vindas Compra`, `Carrinho Abandonado`
- **Proteção:** `zapi_config` apenas ADM pode ver/editar
- **Migrations:** `109_crm_rodada1.sql`
- **Arquivos Relacionados:**
  - `pages/CRM/Mensagens.tsx` → gerencia templates
  - `lib/hooks/useZAPIConfig.ts` → lê configuração Z-API

### 21. Reenvio Vinculado à Solicitação (Migration 110)
- **Descrição:** Sistema de reenvio de pedidos vinculado a solicitações
- **Funções RPC:**
  - `duplicar_pedido_como_reenvio(UUID, UUID, TEXT)` — Cria cópia do pedido como reenvio
- **Regras de Negócio:**
  - Reenvio nasce com `is_reenvio = TRUE` e `foi_editado = TRUE`
  - Linka ao pedido original via `pedido_origem_id`
  - Linka à solicitação via `solicitacao_reenvio_id`
  - Atualiza `solicitacoes.pedido_reenvio_id` com o novo pedido
- **Campos Novos:**
  - `solicitacoes`: `necessita_reenvio`, `pedido_reenvio_id`, `responsavel_reenvio_id`
  - `pedidos_consolidados_v3`: `is_reenvio`, `pedido_origem_id`, `solicitacao_reenvio_id`
- **Proteção:** Testar exaustivamente fluxo de reenvio antes de modificar
- **Migrations:** `110_reenvio_solicitacoes.sql`
- **Arquivos Relacionados:**
  - `pages/Solicitacoes/Reembolsos.tsx` → aciona reenvio

### 22. Criar Pedido Manual (Migrations 111-112)
- **Descrição:** Criação de pedidos manuais fora do webhook
- **Funções RPC:**
  - `criar_pedido_manual(...)` — Cria em `ticto_pedidos` e `pedidos_consolidados_v3`
- **Regras de Negócio:**
  - Cria registro em `ticto_pedidos` com `plataforma = 'Manual'`
  - Cria em `pedidos_consolidados_v3` com `status_envio = 'pronto'`
  - `foi_editado = TRUE` → protege de sobrescrita pela consolidação
  - Gera `codigo_transacao` único: `MANUAL-<timestamp>`
- **Proteção:** Manter `foi_editado = TRUE` para pedidos manuais
- **Migrations:** `112_criar_pedido_manual_completo.sql`
- **Arquivos Relacionados:**
  - `components/BotaoCriarPedidoManual.tsx` → chama a função

---

## 📋 RESUMO DE ARQUIVOS CRÍTICOS

### Migrations SQL (Supabase)
```
supabase/migrations/
├── 049_unificar_pedidos.sql
├── 070_crm_kanban_completo_final.sql
├── 081_criar_automacoes_crm.sql
├── 087_protect_etiquetados.sql
├── 088_complete_label_protection.sql
├── 095_add_plataforma_viralmart.sql
├── 104_janela_5dias_verificar_endereco.sql
├── 105_unificacao_mesmo_endereco.sql
├── 106_corrigir_modal_unificacao.sql
├── 108_login_aprovacao_producao.sql       ← Aprovação de usuários
├── 109_solicitacoes_numero_sequencial.sql  ← Numeração sequencial
├── 109_crm_rodada1.sql                     ← Z-API Config + Templates
├── 110_reenvio_solicitacoes.sql            ← Reenvio vinculado
└── 112_criar_pedido_manual_completo.sql    ← Pedido manual
```

### Componentes React
```
components/
├── crm/
│   ├── KanbanBoard.tsx
│   └── LeadModal.tsx
├── ModalUnificarEndereco.tsx
├── SimilarOrdersModal.tsx
└── NotificationMenu.tsx
```

### Contextos e Hooks
```
lib/
├── contexts/
│   └── NotificationContext.tsx
└── hooks/
    └── useCRMKanban.ts
```

### Páginas
```
pages/
├── CRM/
│   ├── index.tsx
│   ├── Leads.tsx
│   ├── Config.tsx
│   ├── Pipelines.tsx
│   ├── Etapas.tsx
│   └── Tags.tsx
├── Logistics.tsx
└── Dashboard.tsx
```

---

## ⚠️ INSTRUÇÕES PARA NOVAS FUNCIONALIDADES

Ao adicionar uma nova funcionalidade:

1. **Crie documentação** similar a este arquivo
2. **Isole o código** em módulos/componentes separados
3. **Use migrations SQL** numeradas para mudanças no banco
4. **Siga o padrão Staging First** (testar antes de produzir)
5. **Adicione este arquivo** na lista de módulos protegidos

---

## 📞 SUPORTE

Em caso de dúvida sobre qual módulo está protegido:
- Consulte este arquivo
- Verifique o histórico de migrations
- Analise os imports/dependências do código

**Princípio:** Na dúvida, não modifique. Consulte o responsável.

---

## 🔗 DOCUMENTOS RELACIONADOS

- **`CODIGO_PROTECAO_POLICY.md`** — Política completa de proteção de código com matriz de permissões RBAC detalhada
- **`.qwen/rules.md`** — Regras para assistentes de IA
- **`.agent/rules/PROTECAO.md`** — Regras rápidas para agentes

---

## 📊 RESUMO DA PROTEÇÃO

| Categoria | Quantidade | Status |
|-----------|------------|--------|
| Módulos Protegidos | 22 | ✅ |
| Permissões RBAC | 40+ | ✅ |
| Migrations Críticas | 15+ | ✅ |
| Arquivos Core | 5 | ✅ |
| Componentes UI | 8 | ✅ |

**Todas as funcionalidades listadas estão 100% operacionais e protegidas por esta política.**

---

## 🔄 HISTÓRICO DE REVISÕES

| Versão | Data | Descrição | Autor |
|--------|------|-----------|-------|
| 2.1 | 27/03/2026 | Adicionado Migrations 108-112 (Login, Solicitações, Z-API, Reenvio, Pedido Manual) | Sistema |
| 2.0 | 25/03/2026 | Versão inicial com 17 módulos protegidos | Sistema |
