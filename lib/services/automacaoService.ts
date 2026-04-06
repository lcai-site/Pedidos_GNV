import { supabase } from '../supabase';
import { GatilhoTipo } from '../hooks/useCRMAutomacao';
import { logger } from '../utils/logger';

/**
 * Serviço para execução de regras de automação do CRM
 */

export interface AutomacaoContexto {
  status_anterior?: string;
  status_novo?: string;
  secao_anterior?: string;
  secao_nova?: string;
  etapa_anterior_id?: string;
  etapa_nova_id?: string;
  pipeline_anterior_id?: string;
  pipeline_novo_id?: string;
  [key: string]: any;
}

/**
 * Executa regras de automação para um lead específico
 */
export async function executarRegrasAutomacao(
  leadId: string,
  gatilhoTipo: GatilhoTipo,
  contexto: AutomacaoContexto = {}
): Promise<{ sucesso: boolean; regrasExecutadas: number; erros: string[] }> {
  const erros: string[] = [];
  let regrasExecutadas = 0;

  try {
    const { data, error } = await supabase.rpc('executar_regras_automacao', {
      p_lead_id: leadId,
      p_gatilho_tipo: gatilhoTipo,
      p_contexto: contexto
    });

    if (error) {
      logger.error('Erro ao executar regras', error, { service: 'AutomacaoService', leadId, gatilhoTipo });
      erros.push(error.message);
      return { sucesso: false, regrasExecutadas: 0, erros };
    }

    if (data && Array.isArray(data)) {
      for (const resultado of data) {
        if (resultado.status === 'sucesso') {
          regrasExecutadas++;
          logger.debug(`Regra "${resultado.regra_nome}" executada com sucesso`, {
            service: 'AutomacaoService',
            leadId,
            regraNome: resultado.regra_nome
          });
        } else if (resultado.status === 'erro') {
          erros.push(`Regra "${resultado.regra_nome}": ${resultado.mensagem}`);
        }
      }
    }

    return {
      sucesso: erros.length === 0,
      regrasExecutadas,
      erros
    };

  } catch (error: any) {
    logger.error('Erro inesperado', error, { service: 'AutomacaoService', leadId, gatilhoTipo });
    erros.push(error.message);
    return { sucesso: false, regrasExecutadas: 0, erros };
  }
}

/**
 * Executa regras quando um lead é criado
 */
export async function executarRegrasLeadCriado(
  leadId: string,
  dadosLead?: { status?: string; fonte?: string }
): Promise<void> {
  const contexto: AutomacaoContexto = {
    status_novo: dadosLead?.status || 'novo',
    fonte: dadosLead?.fonte
  };

  await executarRegrasAutomacao(leadId, 'lead_criado', contexto);
}

/**
 * Executa regras quando o status de um lead muda
 */
export async function executarRegrasStatusAlterado(
  leadId: string,
  statusAnterior: string | null,
  statusNovo: string
): Promise<void> {
  const contexto: AutomacaoContexto = {
    status_anterior: statusAnterior || undefined,
    status_novo: statusNovo
  };

  await executarRegrasAutomacao(leadId, 'status_alterado', contexto);
}

/**
 * Executa regras quando um lead muda de etapa no pipeline
 */
export async function executarRegrasEtapaAlterada(
  leadId: string,
  etapaAnteriorId: string | null,
  etapaNovaId: string
): Promise<void> {
  const contexto: AutomacaoContexto = {
    etapa_anterior_id: etapaAnteriorId || undefined,
    etapa_nova_id: etapaNovaId
  };

  await executarRegrasAutomacao(leadId, 'etapa_alterada', contexto);
}

/**
 * Executa regras quando um lead transita entre seções
 */
export async function executarRegrasSecaoAlterada(
  leadId: string,
  secaoAnterior: string | null,
  secaoNova: string
): Promise<void> {
  const contexto: AutomacaoContexto = {
    secao_anterior: secaoAnterior || undefined,
    secao_nova: secaoNova
  };

  await executarRegrasAutomacao(leadId, 'secao_alterada', contexto);
}

/**
 * Executa regras quando uma compra é realizada
 */
export async function executarRegrasCompraRealizada(
  leadId: string,
  dadosCompra?: { valor?: number; produto?: string }
): Promise<void> {
  const contexto: AutomacaoContexto = {
    valor_compra: dadosCompra?.valor,
    produto: dadosCompra?.produto
  };

  await executarRegrasAutomacao(leadId, 'compra_realizada', contexto);
}

/**
 * Executa regras quando uma compra é cancelada
 */
export async function executarRegrasCompraCancelada(
  leadId: string,
  motivo?: string
): Promise<void> {
  const contexto: AutomacaoContexto = {
    motivo_cancelamento: motivo
  };

  await executarRegrasAutomacao(leadId, 'compra_cancelada', contexto);
}
