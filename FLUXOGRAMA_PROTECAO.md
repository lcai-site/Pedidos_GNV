# 🚦 FLUXOGRAMA DE DECISÃO - Modificação de Código

> **Data:** 26 de março de 2026  
> **Use este guia antes de qualquer modificação**

---

## 📊 FLUXOGRAMA PRINCIPAL

```
┌─────────────────────────────────────────────────────────────────┐
│  VOCÊ PRECISA MODIFICAR CÓDIGO?                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │ Qual o tipo de  │
                    │ modificação?    │
                    └─────────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ ADICIONAR       │ │ CORRIGIR BUG    │ │ ALTERAR         │
│ FUNCIONALIDADE  │ │ EXISTENTE       │ │ CÓDIGO EXISTENTE│
│ NOVA            │ │                 │ │                 │
└─────────────────┘ └─────────────────┘ └─────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ ✅ PROSSIGA     │ │ Verifique se    │ │ 🛑 PARE!        │
│                 │ │ afeta módulo    │ │                 │
│ Siga checklist  │ │ protegido       │ │ Consulte        │
│ de 5 fases      │ │                 │ │ documentação    │
│                 │ │                 │ │                 │
│ 1. Documente    │ │ Se afeta        │ │ Verifique       │
│ 2. Crie module  │ │ módulo          │ │ arquivo:        │
│ 3. Crie mig.    │ │ protegido →     │ │                 │
│ 4. Teste        │ │ 🛑 PARE!        │ │ CODIGO_PROTECAO │
│ 5. Deploy       │ │                 │ │ _POLICY.md      │
│                 │ │ Se não afeta →  │ │                 │
│                 │ │ ✅ PROSSIGA     │ │ Se módulo está  │
│                 │ │ com cautela     │ │ na lista de     │
│                 │ │                 │ │ protegidos →    │
│                 │ │                 │ │ 🛑 CONSULTE     │
│                 │ │                 │ │ USUÁRIO         │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

---

## 🔍 VERIFICAÇÃO RÁPIDA DE MÓDULOS PROTEGIDOS

### Pergunte-se:

```
┌────────────────────────────────────────────────────────────┐
│ O arquivo que você vai modificar está em uma destas        │
│ pastas/listas?                                             │
└────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┴───────────────────┐
        │                                       │
        ▼                                       ▼
┌──────────────────┐                  ┌──────────────────┐
│ SIM → 🛑 PARE!   │                  │ NÃO → ✅ OK      │
│                  │                  │                  │
│ Consulte         │                  │ Prossiga com     │
│ documentação     │                  │ as melhores      │
│ antes de         │                  │ práticas         │
│ prosseguir       │                  │                  │
└──────────────────┘                  └──────────────────┘
```

### Lista de Arquivos/Categorias Protegidas:

#### 🔴 NÍVEL CRÍTICO (NÃO MODIFICAR SEM APROVAÇÃO)
```
App.tsx
lib/contexts/AuthContext.tsx
lib/contexts/NotificationContext.tsx
lib/rbac/permissions.ts
lib/supabase.ts
supabase/migrations/*.sql (qualquer migration existente)
```

#### 🟡 NÍVEL ALTO (MODIFICAR COM EXTREMA CAUTELA)
```
pages/Logistics.tsx
pages/Dashboard.tsx
pages/CRM/Leads.tsx
components/crm/KanbanBoard.tsx
components/crm/LeadModal.tsx
components/SimilarOrdersModal.tsx
components/NotificationMenu.tsx
components/ModalUnificarEndereco.tsx
```

---

## 📝 CHECKLIST DE 10 SEGUNDOS

Antes de modificar, pergunte:

```
1. Este módulo está na lista de protegidos?
   │
   ├─ SIM → 🛑 PARE! Consulte CODIGO_PROTECAO_POLICY.md
   │
   └─ NÃO → Continue para próxima pergunta

2. Esta migration SQL já existe?
   │
   ├─ SIM → 🛑 PARE! Crie nova migration numerada
   │
   └─ NÃO → Continue para próxima pergunta

3. Esta função RPC é crítica?
   │
   ├─ SIM → 🛑 PARE! Crie nova versão (ex: v4)
   │
   └─ NÃO → Continue para próxima pergunta

4. Estou quebrando isolamento de módulos?
   │
   ├─ SIM → 🛑 PARE! Use imports corretos
   │
   └─ NÃO → ✅ PROSSIGA com cautela
```

---

## 🎯 GUIA DE DECISÃO RÁPIDA

| Situação | Ação |
|----------|------|
| Adicionar nova feature | ✅ Crie módulo novo + migration numerada |
| Corrigir bug em módulo protegido | 🛑 Consulte usuário |
| Adicionar permissão RBAC | ✅ Adicione em `permissions.ts` |
| Remover permissão RBAC | 🛑 NUNCA faça isso |
| Modificar migration existente | 🛑 Crie nova migration de correção |
| Alterar função RPC crítica | 🛑 Crie nova versão (v4, v5...) |
| Adicionar nova rota | ✅ Siga padrão do `App.tsx` |
| Remover rota existente | 🛑 NUNCA faça isso |
| Modificar `App.tsx` | 🛑 Consulte usuário |
| Adicionar componente UI | ✅ Crie em `components/` |
| Importar de outro módulo | 🛑 Use imports via barrel export |

---

## 🚨 SITUAÇÕES DE EMERGÊNCIA

### Bug Crítico em Produção

```
1. Identifique o módulo afetado
   │
   ├─ É módulo protegido? → 🛑 PARE!
   │                        Consulte usuário antes
   │
   └─ É módulo novo? → ✅ Corrija com cautela
                       Teste em staging primeiro
```

### Dados Corrompidos

```
1. NÃO modifique migrations existentes
2. CRIE nova migration de correção
3. Documente o problema e solução
4. Teste em staging
5. Aplique em produção com backup prévio
```

---

## 📞 QUANDO CONSULTAR O USUÁRIO

Consulte **SEMPRE** que:

- ✅ Precisar modificar arquivo 🔴 crítico
- ✅ Precisar modificar função RPC existente
- ✅ Precisar alterar permissão RBAC existente
- ✅ Precisar remover código existente
- ✅ Precisar modificar estrutura de tabela
- ✅ Tiver dúvida sobre proteção do módulo

**NÃO ASSUMA** — **PERGUNTE!**

---

## 📋 RESUMO VISUAL

```
┌─────────────────────────────────────────────────────────────┐
│                    NUNCA MODIFIQUE:                         │
│                                                             │
│  🔴 App.tsx                  🔴 Migrations existentes       │
│  🔴 AuthContext.tsx          🔴 Funções RPC críticas       │
│  🔴 NotificationContext.tsx  🔴 Permissões RBAC existentes │
│  🔴 permissions.ts           🔴 Proteções de dados         │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    SEMPRE FAÇA:                             │
│                                                             │
│  ✅ Documente novas features   ✅ Teste em staging          │
│  ✅ Crie migrations numeradas  ✅ Use isolamento de módulos │
│  ✅ Siga padrão do projeto     ✅ Consulte na dúvida        │
└─────────────────────────────────────────────────────────────┘
```

---

**PRINCÍPIO FINAL:** Na dúvida, **NÃO MODIFIQUE**. Consulte o responsável.
