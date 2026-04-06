import { supabase } from '../supabase';
import type {
    Solicitacao,
    CriarSolicitacaoInput,
    AtualizarSolicitacaoInput,
    SolicitacaoHistorico,
    StatusSolicitacao,
} from '../types/solicitacoes';
import { logger } from '../utils/logger';

export class SolicitacoesService {
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
            logger.error('Erro ao buscar solicitações', error, { service: 'SolicitacoesService', action: 'buscarSolicitacoes' });
            return { data: null, error };
        }
    }

    async buscarPorId(id: string): Promise<{ data: Solicitacao | null; error: any }> {
        try {
            const { data, error } = await supabase
                .from('solicitacoes')
                .select('*')
                .eq('id', id)
                .single();

            return { data, error };
        } catch (error) {
            logger.error('Erro ao buscar solicitação', error, { service: 'SolicitacoesService', action: 'buscarPorId', id });
            return { data: null, error };
        }
    }

    async criar(input: CriarSolicitacaoInput): Promise<{ data: Solicitacao | null; error: any }> {
        try {
            const { data: { user } } = await supabase.auth.getUser();

            const { data, error } = await supabase
                .from('solicitacoes')
                .insert({
                    ...input,
                    criado_por: user?.id,
                    status: 'pendente',
                    // Campos de reenvio (opcionais)
                    necessita_reenvio: input.necessita_reenvio ?? false,
                    pedido_reenvio_id: input.pedido_reenvio_id ?? null,
                    responsavel_reenvio_id: input.responsavel_reenvio_id ?? null,
                    observacoes_reenvio: input.observacoes_reenvio ?? null,
                })
                .select()
                .single();

            return { data, error };
        } catch (error) {
            logger.error('Erro ao criar solicitação', error, { service: 'SolicitacoesService', action: 'criar', input });
            return { data: null, error };
        }
    }

    async atualizar(
        id: string,
        input: AtualizarSolicitacaoInput
    ): Promise<{ data: Solicitacao | null; error: any }> {
        try {
            const { data, error } = await supabase
                .from('solicitacoes')
                .update({
                    ...input,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', id)
                .select()
                .single();

            return { data, error };
        } catch (error) {
            logger.error('Erro ao atualizar solicitação', error, { service: 'SolicitacoesService', action: 'atualizar', id, input });
            return { data: null, error };
        }
    }

    async buscarHistorico(id: string): Promise<{ data: SolicitacaoHistorico[] | null; error: any }> {
        try {
            const { data, error } = await supabase
                .from('solicitacoes_historico')
                .select('*')
                .eq('solicitacao_id', id)
                .order('created_at', { ascending: false });

            return { data, error };
        } catch (error) {
            logger.error('Erro ao buscar histórico', error, { service: 'SolicitacoesService', action: 'buscarHistorico', id });
            return { data: null, error };
        }
    }

    async buscarEstatisticas(): Promise<{ data: any | null; error: any }> {
        try {
            const { data, error } = await supabase
                .from('solicitacoes')
                .select('status, tipo');

            if (error) throw error;

            const estatisticas = {
                total: data?.length || 0,
                porStatus: {} as Record<string, number>,
                porTipo: {} as Record<string, number>,
            };

            data?.forEach((item) => {
                estatisticas.porStatus[item.status] = (estatisticas.porStatus[item.status] || 0) + 1;
                estatisticas.porTipo[item.tipo] = (estatisticas.porTipo[item.tipo] || 0) + 1;
            });

            return { data: estatisticas, error: null };
        } catch (error) {
            logger.error('Erro ao buscar estatísticas', error, { service: 'SolicitacoesService', action: 'buscarEstatisticas' });
            return { data: null, error };
        }
    }

    async deletar(id: string): Promise<{ error: any }> {
        try {
            const { error } = await supabase.from('solicitacoes').delete().eq('id', id);
            return { error };
        } catch (error) {
            logger.error('Erro ao deletar solicitação', error, { service: 'SolicitacoesService', action: 'deletar', id });
            return { error };
        }
    }

    // ─── Emite reenvio: chama SQL que duplica o pedido original ──────────────
    async emitirReenvio(
        pedidoOrigemId: string,
        solicitacaoId: string,
        observacaoExtra?: string
    ): Promise<{ data: string | null; error: any }> {
        try {
            const { data, error } = await supabase.rpc('duplicar_pedido_como_reenvio', {
                p_pedido_id: pedidoOrigemId,
                p_solicitacao_id: solicitacaoId,
                p_observacao_extra: observacaoExtra || null,
            });
            if (error) throw error;
            return { data: data as string, error: null };
        } catch (error) {
            logger.error('Erro ao emitir reenvio', error, {
                service: 'SolicitacoesService',
                action: 'emitirReenvio',
                pedidoOrigemId,
                solicitacaoId,
            });
            return { data: null, error };
        }
    }

    async aprovar(id: string, observacoes?: string): Promise<{ data: Solicitacao | null; error: any }> {
        try {
            // 👤 Capturar usuário atual para registrar quem aprovou
            const { data: { user } } = await supabase.auth.getUser();

            const { data, error } = await supabase
                .from('solicitacoes')
                .update({
                    status: 'aprovada',
                    observacoes_internas: observacoes || null,
                    aprovado_por: user?.id || null,
                    aprovado_em: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                })
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return { data, error: null };
        } catch (error) {
            logger.error('Erro ao aprovar solicitação', error, { service: 'SolicitacoesService', action: 'aprovar', id });
            return { data: null, error };
        }
    }

    async recusar(id: string, justificativa: string): Promise<{ data: Solicitacao | null; error: any }> {
        try {
            // 👤 Capturar usuário atual para registrar quem recusou
            const { data: { user } } = await supabase.auth.getUser();

            const { data, error } = await supabase
                .from('solicitacoes')
                .update({
                    status: 'recusada',
                    justificativa_recusa: justificativa,
                    observacoes_internas: justificativa,
                    aprovado_por: user?.id || null,
                    aprovado_em: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                })
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return { data, error: null };
        } catch (error) {
            logger.error('Erro ao recusar solicitação', error, { service: 'SolicitacoesService', action: 'recusar', id });
            return { data: null, error };
        }
    }
}

export const solicitacoesService = new SolicitacoesService();
