# 📚 ÍNDICE DE DOCUMENTAÇÃO DE PROTEÇÃO

> **Data:** 26 de março de 2026  
> **Versão:** 1.0

---

## 🎯 PROPÓSITO

Este diretório contém toda a documentação necessária para proteger as funcionalidades existentes do sistema **Pedidos GNV** contra modificações acidentais.

---

## 📁 ARQUIVOS PRINCIPAIS

### 1. `CODIGO_PROTECAO_POLICY.md` 📖
**O que é:** Política completa e detalhada de proteção de código

**Conteúdo:**
- 20 módulos protegidos documentados
- Matriz completa de permissões RBAC (40+ permissões)
- Regras de modificação (permitido vs. proibido)
- Checklist de 5 fases para novas funcionalidades
- Lista de arquivos críticos com níveis de risco
- Fluxo de implantação (dev → staging → produção)

**Quando usar:**
- Antes de iniciar qualquer desenvolvimento
- Para consultar permissões de um role específico
- Para entender o impacto de uma modificação

**Link:** [`CODIGO_PROTECAO_POLICY.md`](./CODIGO_PROTECAO_POLICY.md)

---

### 2. `FUNCIONALIDADES_PROTEGIDAS.md` 🔒
**O que é:** Lista mestra de todas as funcionalidades protegidas

**Conteúdo:**
- 20 funcionalidades protegidas detalhadas
- Descrição de cada módulo
- Arquivos relacionados
- Migrations associadas
- Status de proteção

**Quando usar:**
- Para verificar se uma funcionalidade é protegida
- Para entender o escopo de um módulo
- Para encontrar arquivos relacionados a uma feature

**Link:** [`FUNCIONALIDADES_PROTEGIDAS.md`](./FUNCIONALIDADES_PROTEGIDAS.md)

---

### 3. `FLUXOGRAMA_PROTECAO.md` 🚦
**O que é:** Guia visual de decisão rápida

**Conteúdo:**
- Fluxogramas de decisão
- Checklist de 10 segundos
- Guia de decisão rápida (tabela)
- Situações de emergência
- Resumo visual

**Quando usar:**
- Antes de modificar qualquer código (checklist rápido)
- Para decidir se precisa consultar o usuário
- Em situações de bug crítico

**Link:** [`FLUXOGRAMA_PROTECAO.md`](./FLUXOGRAMA_PROTECAO.md)

---

### 4. `.qwen/rules.md` 🤖
**O que é:** Regras para assistentes de IA (Qwen Code)

**Conteúdo:**
- 10 regras obrigatórias para IAs
- Padrões de importação de módulos
- Proteção de migrations e funções RPC
- Uso correto de RBAC
- Checklist rápido para modificações

**Quando usar:**
- Configuração de contexto para IAs
- Para garantir que assistentes sigam as regras
- Como referência para desenvolvedores

**Link:** [`.qwen/rules.md`](./.qwen/rules.md)

---

### 5. `.agent/rules/PROTECAO.md` 🤖
**O que é:** Regras rápidas para agentes (Geminis/Agents)

**Conteúdo:**
- Lista de módulos protegidos
- Proibições principais
- Práticas recomendadas
- Checklist rápido

**Quando usar:**
- Configuração de agentes autônomos
- Como referência rápida durante desenvolvimento

**Link:** [`.agent/rules/PROTECAO.md`](./.agent/rules/PROTECAO.md)

---

## 🗺️ MAPA DE NAVEGAÇÃO

### Precisa entender o sistema?
→ **`CODIGO_PROTECAO_POLICY.md`** (visão completa)

### Precisa verificar se algo é protegido?
→ **`FUNCIONALIDADES_PROTEGIDAS.md`** (lista mestra)

### Vai modificar código agora?
→ **`FLUXOGRAMA_PROTECAO.md`** (checklist rápido)

### Está configurando uma IA?
→ **`.qwen/rules.md`** (regras para IAs)

### Está configurando um agente?
→ **`.agent/rules/PROTECAO.md`** (regras para agentes)

---

## 📊 RESUMO DO SISTEMA

| Componente | Quantidade | Status |
|------------|------------|--------|
| Módulos Protegidos | 20 | ✅ |
| Permissões RBAC | 40+ | ✅ |
| Migrations Críticas | 10+ | ✅ |
| Arquivos Core | 5 | ✅ |
| Componentes UI | 8 | ✅ |
| Documentos de Proteção | 5 | ✅ |

---

## 🎯 PRINCÍPIOS FUNDAMENTAIS

1. **Não Quebre o Que Funciona** — Módulos existentes são intocáveis
2. **Isolamento de Módulos** — Não importe diretamente entre módulos
3. **Staging First** — Sempre teste em staging antes de produção
4. **Documentação Obrigatória** — Nova feature = nova documentação
5. **Na Dúvida, Pergunte** — Nunca assuma, sempre consulte

---

## 🔗 ARQUIVOS RELACIONADOS

Além dos documentos de proteção, consulte também:

- **`RBAC_SETUP.md`** — Guia de configuração do sistema RBAC
- **`README.md`** — Documentação geral do projeto
- **`ARCHITECTURE.md`** — Arquitetura do sistema
- **`WORKFLOW.md`** — Fluxo de trabalho

---

## 📞 SUPORTE

### Nível 1: Dúvidas de Implementação
1. Consulte este índice
2. Leia o fluxograma de decisão
3. Verifique a lista de funcionalidades protegidas

### Nível 2: Problemas Técnicos
1. Consulte a política completa
2. Verifique permissões RBAC
3. Analise arquivos críticos

### Nível 3: Modificações Críticas
**Contate o responsável antes de:**
- Modificar arquivos 🔴 críticos
- Alterar estrutura de tabelas
- Remover/modificar funções RPC
- Mudar permissões RBAC

---

## ✅ CHECKLIST DE ACESSO RÁPIDO

Antes de modificar código, siga este fluxo:

```
1. Consulte FLUXOGRAMA_PROTECAO.md
   ↓
2. Verifique se módulo está em FUNCIONALIDADES_PROTEGIDAS.md
   ↓
3. Se estiver protegido → 🛑 PARE! Consulte usuário
   ↓
4. Se não estiver → Consulte CODIGO_PROTECAO_POLICY.md
   ↓
5. Siga checklist de 5 fases
   ↓
6. Teste em staging
   ↓
7. Deploy em produção
```

---

## 📝 HISTÓRICO DE REVISÕES

| Versão | Data | Descrição | Status |
|--------|------|-----------|--------|
| 1.0 | 26/03/2026 | Criação do índice | ✅ Ativo |

---

**LEMBRETE:** Esta documentação é **viva**. Atualize sempre que uma nova funcionalidade for adicionada.

**PRINCÍPIO FINAL:** Na dúvida, **NÃO MODIFIQUE**. Consulte o responsável.
