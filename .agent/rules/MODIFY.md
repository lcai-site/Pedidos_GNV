# 📝 REGRA: Consultar modify.md

> **Sempre consulte o workflow `/modify` antes de modificar código.**

---

## 🎯 Quando Aplicar

Esta regra deve ser aplicada **SEMPRE** que o usuário solicitar:

- Modificar qualquer função SQL/RPC
- Alterar migrations existentes
- Criar novas funcionalidades que tocam em código existente
- Modificar componentes, hooks ou services listados no CODEBASE.md
- Qualquer mudança que possa ter impacto em outras partes do sistema

---

## ✅ Processo Obrigatório

Antes de **qualquer modificação**, o agente DEVE:

1. **Ler o arquivo `.agent/workflows/modify.md`** na íntegra
2. **Seguir o Passo 1** — Ler `CODEBASE.md` para identificar dependências
3. **Seguir o Passo 2** — Identificar escopo da mudança
4. **Seguir o Passo 3** — Ler arquivo de origem antes de modificar
5. **Seguir o Passo 4** — Apresentar plano ao usuário e aguardar confirmação
6. **Seguir o Passo 5** — Implementar apenas mudança cirúrgica
7. **Seguir o Passo 6** — Atualizar CODEBASE.md se necessário

---

## 🚨 Sinais de Alerta

Se encontrar qualquer um destes sinais, **PARE** e consulte o usuário:

| Sinal | Ação |
|-------|------|
| Função listada como 🔴 ALTO no CODEBASE.md | Extrema cautela |
| Função é `aprovar_usuario()`, `get_current_user_role()` | NÃO MODIFICAR SEM APROVAÇÃO |
| Função é `duplicar_pedido_como_reenvio()` | Testar exaustivamente |
| Função é `atribuir_atendimento()` | Verificar RLS de crm_atendimentos |
| Função é `cancelar_pedido_logistica()` ou `restaurar_pedido_logistica()` | Verificar status antes/depois |
| Tabela é `zapi_config` | Apenas ADM pode modificar |
| Migration tem comentário explicando "por que existe" | Não remover — há razão histórica |

---

## 📋 Checklist Rápido

Antes de codificar, marcar mentalmente:

- [ ] Li o `modify.md`
- [ ] Li o `CODEBASE.md`
- [ ] Li o arquivo de origem na íntegra
- [ ] Identifiquei dependentes
- [ ] Entendi regras de negócio
- [ ] Verifiquei permissões RBAC
- [ ] Apresentei plano e aguardei OK
- [ ] Sei qual migration atualizar se criar nova funcionalidade

---

## 🔗 Arquivos de Referência

- `.agent/workflows/modify.md` — Workflow completo
- `CODEBASE.md` — Índice do projeto
- `FUNCIONALIDADES_PROTEGIDAS.md` — O que NÃO modificar
- `CODIGO_PROTECAO_POLICY.md` — Política de proteção
