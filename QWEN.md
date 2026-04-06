# Regras do Projeto - Pedidos GNV

## 📋 Consulta Obrigatória

**ANTES DE QUALQUER RESPOSTA:**
1. Sempre consulte o arquivo `.agent/rules/MODIFY.md` na íntegra
2. Siga o workflow `/modify` descrito nesse arquivo
3. Leia `CODEBASE.md` para identificar dependências

## 📝 Solicitações - Seção Reenvio

Na seção de Solicitações do sistema, existe a funcionalidade de **Reenvio** que deve ser considerada:

- **Reenvio Vinculado à Solicitação**: Pedidos de reenvio são criados via `duplicar_pedido_como_reenvio()` e vinculados à solicitação original
- **Campos Relacionados**:
  - `solicitacoes.necessita_reenvio` → Boolean que indica se precisa reenvio
  - `solicitacoes.pedido_reenvio_id` → Link para o pedido de reenvio criado
  - `solicitacoes.responsavel_reenvio_id` → Quem é responsável pelo reenvio
  - `pedidos_consolidados_v3.is_reenvio` → Marca que é um pedido de reenvio
  - `pedidos_consolidados_v3.pedido_origem_id` → ID do pedido original
  - `pedidos_consolidados_v3.solicitacao_reenvio_id` → ID da solicitação de reenvio

- **Regras de Negócio**:
  - Reenvio nasce com `is_reenvio = TRUE` e `foi_editado = TRUE`
  - Atualiza `solicitacoes.pedido_reenvio_id` automaticamente
  - Protegido de re-consolidação pelo `foi_editado = TRUE`

- **Arquivos Relacionados**:
  - Migration: `supabase/migrations/110_reenvio_solicitacoes.sql`
  - Função: `duplicar_pedido_como_reenvio(UUID, UUID, TEXT)`
  - Página: `pages/Solicitacoes/Reembolsos.tsx`

- **⚠️ Alerta**: Função `duplicar_pedido_como_reenvio()` é classificada como **🔴 ALTO** risco - testar exaustivamente qualquer modificação.
