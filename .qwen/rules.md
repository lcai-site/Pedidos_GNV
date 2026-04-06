# 🛡️ REGRAS DE PROTEÇÃO DO CÓDIGO - Pedidos GNV

> **Data de Criação:** 26 de março de 2026
> **Status:** ✅ ATIVO

---

## ⚠️ REGRAS OBRIGATÓRIAS PARA ASSISTENTES DE IA

### REGRA #0: SEMPRE CONSULTE modify.md ANTES DE MODIFICAÇÕES

**Antes de qualquer modificação de código**, consulte obrigatoriamente:

1. `.agent/workflows/modify.md` — Fluxo de modificação segura (6 passos)
2. `CODEBASE.md` — Índice do projeto (funções, dependências, arquivos de origem)

**O workflow modify.md exige:**
- ✅ Ler o CODEBASE.md primeiro
- ✅ Identificar arquivo de origem canônico
- ✅ Ler o arquivo na íntegra antes de modificar
- ✅ Apresentar plano ao usuário e aguardar confirmação
- ✅ Implementar cirurgicamente (não reescrever)
- ✅ Atualizar CODEBASE.md se necessário

**Atalho:** O usuário pode ativar o workflow digitando `/modify [descrição]`

---

### REGRA #1: NUNCA MODIFIQUE MÓDULOS PROTEGIDOS SEM EXPLÍCITA PERMISSÃO

Os seguintes módulos estão **100% funcionais** e **NÃO DEVEM SER ALTERADOS** salvo instrução explícita do usuário:

#### Módulos Críticos (Risco 🔴 ALTO)
- `App.tsx` - Estrutura de rotas e ProtectedRoute
- `lib/contexts/AuthContext.tsx` - Autenticação e RBAC
- `lib/contexts/NotificationContext.tsx` - Notificações em tempo real (inclui `detectSimilarPairs()`)
- `lib/rbac/permissions.ts` - Matriz de permissões (apenas adicione novas permissões, não modifique existentes)
- `lib/supabase.ts` - Configuração do cliente Supabase

#### Módulos de Negócio (Risco 🟡 MÉDIO)
- `pages/Logistics.tsx` - Gestão de pedidos e etiquetas
- `pages/Dashboard.tsx` - Métricas e totais
- `pages/CRM/Leads.tsx` - Kanban de leads
- `components/crm/KanbanBoard.tsx` - Drag-and-drop CRM
- `components/crm/LeadModal.tsx` - Modal de detalhes do lead
- `components/SimilarOrdersModal.tsx` - Modal de duplicatas
- `components/NotificationMenu.tsx` - Menu de notificações
- `components/ModalUnificarEndereco.tsx` - Unificação de pedidos

---

### REGRA #2: SEMPRE SIGA O PADRÃO DE ISOLAMENTO DE MÓDULOS

```typescript
// ✅ CERTO - Import do módulo
import { DashboardMetrics } from '@/modules/dashboard';
import { useLeads } from '@/modules/crm';

// ✅ CERTO - Import do core
import { Button, Modal } from '@/core/components';
import { useAuth } from '@/core/hooks';

// ❌ ERRADO - Import direto de outro módulo (NUNCA FAÇA ISSO)
import { SomeComponent } from '@/modules/logistics/components/SomeComponent';
```

---

### REGRA #3: NUNCA MODIFIQUE MIGRATIONS EXISTENTES

- ❌ **NÃO** edite arquivos `.sql` em `supabase/migrations/` que já foram aplicados
- ✅ **CRIE** uma nova migration numerada sequencialmente para correções
- ✅ **SIGA** o padrão de nomenclatura: `NNN_descricao_curta.sql`

Exemplo:
```
❌ ERRADO: Editar `049_unificar_pedidos.sql`
✅ CERTO: Criar `107_correcao_unificacao.sql`
```

---

### REGRA #4: PROTEJA FUNÇÕES RPC CRÍTICAS

NÃO modifique estas funções RPC sem aprovação explícita:

- `consolidar_pedidos_v3()` - Consolidação de pedidos
- `calcular_janela_pv()` - Janela de pós-venda
- `executar_regras_automacao()` - Automações de CRM
- `encontrar_pedidos_mesmo_endereco()` - Detecção de duplicatas
- `unificar_pedidos_mesmo_endereco()` - Unificação

Se precisar modificar, **crie uma nova versão**: `consolidar_pedidos_v4()`

---

### REGRA #5: RESPEITE O SISTEMA RBAC

Ao adicionar novas funcionalidades:

1. **Defina permissões** em `lib/rbac/permissions.ts`
2. **Use o componente** `<CanAccess permission="...">` para UI
3. **Use o hook** `useAuth().can()` para lógica
4. **Proteja rotas** com `<RoleGuard allowedRoles={['gestor', 'adm']}>`

Nunca remova ou altere permissões existentes — apenas adicione novas.

---

### REGRA #6: NUNCA REMOVA PROTEÇÕES DE DADOS

São **IMUTÁVEIS** estas proteções:

- Flag `foi_editado` em pedidos — protege edições manuais
- Campos `codigo_rastreio`, `data_envio` — bloqueiam consolidação
- Status `Unificado` — remove da visão do CRM
- Janela de 5 dias — consolidação de endereço compartilhado

---

### REGRA #7: SEMPRE DOCUMENTE NOVAS FUNCIONALIDADES

Ao criar uma nova funcionalidade:

1. Crie arquivo `.md` documentando (veja `FUNCIONALIDADES_PROTEGIDAS.md`)
2. Adicione ao índice de `CODIGO_PROTECAO_POLICY.md`
3. Crie migration SQL numerada
4. Siga o checklist de 5 fases (Planejamento → Implantação)

---

### REGRA #8: USE COMPONENTES DE PROTEÇÃO DE ACESSO

Sempre proteja UI baseada em permissões:

```tsx
// ✅ CERTO - Usar CanAccess
import { CanAccess } from '@/components/RBAC/CanAccess';

<CanAccess permission="logistics:generate_labels">
  <button>Gerar Etiqueta</button>
</CanAccess>

// ✅ CERTO - Usar useAuth
import { useAuth } from '@/lib/hooks/useAuth';

const { can, profile } = useAuth();
if (!can('solicitacoes:approve')) return null;

// ❌ ERRADO - Verificação manual de role
if (profile?.role === 'gestor') { ... }
```

---

### REGRA #9: SIGA O FLUXO STAGING FIRST

1. **Desenvolva** em ambiente local
2. **Teste** em Staging (`npm run dev:staging`)
3. **Aplique** migration em Staging
4. **Valide** funcionamento em Staging
5. **Só então** faça deploy em Produção

---

### REGRA #10: EM CASO DE DÚVIDA, PERGUNTE

**NÃO ASSUMA** que uma modificação é segura.

Se tiver dúvida sobre:
- Se um módulo é protegido
- Se uma migration pode ser modificada
- Se uma permissão pode ser alterada
- Se uma função RPC pode ser editada

**PERGUNTE AO USUÁRIO ANTES DE PROSSEGUIR.**

---

## 📋 CHECKLIST RÁPIDO PARA MODIFICAÇÕES

Antes de modificar qualquer código, verifique:

- [ ] Este módulo está listado como protegido?
- [ ] Esta migration já foi aplicada em produção?
- [ ] Esta função RPC é crítica?
- [ ] Esta permissão RBAC já existe?
- [ ] Estou seguindo isolamento de módulos?
- [ ] Documentei a mudança?
- [ ] Testei em staging?

**Se qualquer resposta for "SIM" para as primeiras 4 questões → PARE E CONSULTE O USUÁRIO.**

---

## 🔗 ARQUIVOS DE REFERÊNCIA

- `CODIGO_PROTECAO_POLICY.md` — Política completa de proteção
- `FUNCIONALIDADES_PROTEGIDAS.md` — Lista detalhada de funcionalidades
- `RBAC_SETUP.md` — Guia de configuração RBAC
- `lib/rbac/permissions.ts` — Matriz de permissões atual

---

**PRINCÍPIO FINAL:** Na dúvida, **NÃO MODIFIQUE**. Consulte o responsável.
