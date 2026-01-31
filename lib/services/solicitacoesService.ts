import { supabase } from '../supabase';
import type {
    Solicitacao,
    CriarSolicitacaoInput,
    AtualizarSolicitacaoInput,
    SolicitacaoHistorico,
    StatusSolicitacao,
} from '../types/solicitacoes';

export class SolicitacoesService {
    /**
     * Buscar todas as solicitações (com filtros opcionais)
     */
    async buscarSolicitacoes(filtros?: {
        status?: StatusSolicitacao;
        tipo?: string;
        pedido_id?: string;
        criado_por?: string;
    }): Promise<{ data: Solicitacao[] | null; error: any }> {
        try {
            let query = supabase
                .from('solicitacoes')
                .select('*')
                .order('created_at', { ascending: false });

            if (filtros?.status) {
                query = query.eq('status', filtros.status);
            }
            if (filtros?.tipo) {
                query = query.eq('tipo', filtros.tipo);
            }
            if (filtros?.pedido_id) {
                query = query.eq('pedido_id', filtros.pedido_id);
            }
            if (filtros?.criado_por) {
                query = query.eq('criado_por', filtros.criado_por);
            }

            const { data, error } = await query;

            return { data, error };
        } catch (error) {
            console.error('Erro ao buscar solicitações:', error);
            return { data: null, error };
        }
    }

    /**
     * Buscar solicitação por ID
     */
    async buscarPorId(id: string): Promise<{ data: Solicitacao | null; error: any }> {
        try {
            const { data, error } = await supabase
                .from('solicitacoes')
                .select('*')
                .eq('id', id)
                .single();

            return { data, error };
        } catch (error) {
            console.error('Erro ao buscar solicitação:', error);
            return { data: null, error };
        }
    }

    /**
     * Criar nova solicitação
     */
    async criar(input: CriarSolicitacaoInput): Promise<{ data: Solicitacao | null; error: any }> {
        try {
            const { data: { user } } = await supabase.auth.getUser();

            const { data, error } = await supabase
                .from('solicitacoes')
                .insert({
                    ...input,
                    criado_por: user?.id,
                    status: 'pendente',
                })
                .select()
                .single();

            return { data, error };
        } catch (error) {
            console.error('Erro ao criar solicitação:', error);
            return { data: null, error };
        }
    }

    /**
     * Atualizar solicitação
     */
    async atualizar(
        id: string,
        input: AtualizarSolicitacaoInput
    ): Promise<{ data: Solicitacao | null; error: any }> {
        try {
            const updateData: any = { ...input };

            // Se está aprovando, adicionar aprovado_por e aprovado_em
            if (input.status === 'aprovada') {
                const { data: { user } } = await supabase.auth.getUser();
                updateData.aprovado_por = user?.id;
                updateData.aprovado_em = new Date().toISOString();
            }

            // Se está concluindo, adicionar concluido_em
            if (input.status === 'concluida') {
                updateData.concluido_em = new Date().toISOString();
            }

            const { data, error } = await supabase
                .from('solicitacoes')
                .update(updateData)
                .eq('id', id)
                .select()
                .single();

            return { data, error };
        } catch (error) {
            console.error('Erro ao atualizar solicitação:', error);
            return { data: null, error };
        }
    }

    /**
     * Aprovar solicitação
     */
    async aprovar(id: string, observacoes_internas?: string): Promise<{ data: Solicitacao | null; error: any }> {
        return this.atualizar(id, {
            status: 'aprovada',
            observacoes_internas,
        });
    }

    /**
     * Recusar solicitação
     */
    async recusar(id: string, observacoes_internas: string): Promise<{ data: Solicitacao | null; error: any }> {
        return this.atualizar(id, {
            status: 'recusada',
            observacoes_internas,
        });
    }

    /**
     * Concluir solicitação
     */
    async concluir(id: string): Promise<{ data: Solicitacao | null; error: any }> {
        return this.atualizar(id, {
            status: 'concluida',
        });
    }

    /**
     * Cancelar solicitação
     */
    async cancelar(id: string, motivo?: string): Promise<{ data: Solicitacao | null; error: any }> {
        return this.atualizar(id, {
            status: 'cancelada',
            observacoes_internas: motivo,
        });
    }

    /**
     * Buscar histórico de uma solicitação
     */
    async buscarHistorico(solicitacaoId: string): Promise<{ data: SolicitacaoHistorico[] | null; error: any }> {
        try {
            const { data, error } = await supabase
                .from('solicitacoes_historico')
                .select('*')
                .eq('solicitacao_id', solicitacaoId)
                .order('alterado_em', { ascending: false });

            return { data, error };
        } catch (error) {
            console.error('Erro ao buscar histórico:', error);
            return { data: null, error };
        }
    }

    /**
     * Buscar estatísticas de solicitações
     */
    async buscarEstatisticas(): Promise<{
        total: number;
        pendentes: number;
        em_analise: number;
        aprovadas: number;
        recusadas: number;
        concluidas: number;
    }> {
        try {
            const { data } = await supabase
                .from('solicitacoes')
                .select('status');

            if (!data) return {
                total: 0,
                pendentes: 0,
                em_analise: 0,
                aprovadas: 0,
                recusadas: 0,
                concluidas: 0,
            };

            return {
                total: data.length,
                pendentes: data.filter(s => s.status === 'pendente').length,
                em_analise: data.filter(s => s.status === 'em_analise').length,
                aprovadas: data.filter(s => s.status === 'aprovada').length,
                recusadas: data.filter(s => s.status === 'recusada').length,
                concluidas: data.filter(s => s.status === 'concluida').length,
            };
        } catch (error) {
            console.error('Erro ao buscar estatísticas:', error);
            return {
                total: 0,
                pendentes: 0,
                em_analise: 0,
                aprovadas: 0,
                recusadas: 0,
                concluidas: 0,
            };
        }
    }

    /**
     * Deletar solicitação (apenas gestores/ADM)
     */
    async deletar(id: string): Promise<{ error: any }> {
        try {
            const { error } = await supabase
                .from('solicitacoes')
                .delete()
                .eq('id', id);

            return { error };
        } catch (error) {
            console.error('Erro ao deletar solicitação:', error);
            return { error };
        }
    }
}

export const solicitacoesService = new SolicitacoesService();
