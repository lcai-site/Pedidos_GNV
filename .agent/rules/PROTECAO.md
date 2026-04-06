# 🛡️ REGRAS DE PROTEÇÃO - Pedidos GNV

> **Data:** 26 de março de 2026  
> **Status:** ✅ ATIVO

---

## ⚠️ MÓDULOS PROTEGIDOS - NÃO MODIFICAR

### Core do Sistema (Risco 🔴 ALTO)
- `App.tsx` - Rotas e ProtectedRoute
- `lib/contexts/AuthContext.tsx` - Autenticação e RBAC
- `lib/contexts/NotificationContext.tsx` - Notificações (detectSimilarPairs)
- `lib/rbac/permissions.ts` - Matriz de permissões
- `lib/supabase.ts` - Cliente Supabase

### Módulos de Negócio (Risco 🟡 MÉDIO)
- `pages/Logistics.tsx`
- `pages/Dashboard.tsx`
- `pages/CRM/Leads.tsx`
- `components/crm/KanbanBoard.tsx`
- `components/crm/LeadModal.tsx`
- `components/SimilarOrdersModal.tsx`
- `components/NotificationMenu.tsx`
- `components/ModalUnificarEndereco.tsx`

---

## 🚫 PROIBIÇÕES

1. **NUNCA** modifique migrations SQL existentes em `supabase/migrations/`
2. **NUNCA** altere funções RPC críticas sem criar nova versão
3. **NUNCA** remova proteções de dados (foi_editado, codigo_rastreio, etc.)
4. **NUNCA** quebre isolamento de módulos
5. **NUNCA** modifique permissões RBAC existentes

---

## ✅ PRÁTICAS RECOMENDADAS

1. **Sempre** use `CanAccess` para UI condicional
2. **Sempre** use `RoleGuard` para rotas protegidas
3. **Sempre** crie nova migration numerada para mudanças no DB
4. **Sempre** documente novas funcionalidades
5. **Sempre** teste em staging antes de produção

---

## 📋 CHECKLIST ANTES DE MODIFICAR

- [ ] Este módulo está protegido?
- [ ] Esta migration já existe?
- [ ] Esta função RPC é crítica?
- [ ] Estou seguindo isolamento de módulos?

**Se sim para as primeiras 2 → PARE E CONSULTE.**

---

## 🔗 REFERÊNCIAS

- `CODIGO_PROTECAO_POLICY.md`
- `FUNCIONALIDADES_PROTEGIDAS.md`
- `.qwen/rules.md`
