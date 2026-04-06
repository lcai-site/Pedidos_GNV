import React, { useMemo } from 'react';
import { useLeads, usePipelines, useEtapas, useTags } from '../../lib/hooks/useCRMKanban';
import { SectionHeader } from '../../components/ui/SectionHeader';
import {
  BarChart3, Users, TrendingUp, Clock, DollarSign, Target,
  Tag, ArrowDownRight, ArrowUpRight, Activity
} from 'lucide-react';

// ============================================
// COMPONENTES DE MÉTRICAS
// ============================================

const MetricCard: React.FC<{
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  trend?: { value: number; label: string };
}> = ({ label, value, icon: Icon, color, trend }) => (
  <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-colors">
    <div className="flex items-start justify-between mb-3">
      <div className={`p-2.5 rounded-lg ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      {trend && (
        <div className={`flex items-center gap-1 text-xs font-medium ${trend.value >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
          {trend.value >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
          {Math.abs(trend.value)}%
        </div>
      )}
    </div>
    <div className="text-2xl font-bold text-slate-200 mb-1">{value}</div>
    <div className="text-sm text-slate-500">{label}</div>
  </div>
);

// Funil visual
const FunnelBar: React.FC<{
  etapa: { nome: string; cor: string };
  count: number;
  maxCount: number;
  valor: number;
  probabilidade: number;
}> = ({ etapa, count, maxCount, valor, probabilidade }) => {
  const width = maxCount > 0 ? Math.max((count / maxCount) * 100, 8) : 8;

  return (
    <div className="group">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: etapa.cor }} />
          <span className="text-sm font-medium text-slate-300">{etapa.nome}</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span>{count} leads</span>
          {probabilidade > 0 && <span className="text-slate-600">({probabilidade}%)</span>}
          {valor > 0 && (
            <span className="text-emerald-400/70">
              {valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </span>
          )}
        </div>
      </div>
      <div className="h-8 bg-slate-800/50 rounded-lg overflow-hidden">
        <div
          className="h-full rounded-lg transition-all duration-500 ease-out flex items-center px-3 group-hover:brightness-110"
          style={{
            width: `${width}%`,
            backgroundColor: `${etapa.cor}40`,
            borderLeft: `3px solid ${etapa.cor}`,
          }}
        >
          <span className="text-xs font-bold text-slate-200">{count}</span>
        </div>
      </div>
    </div>
  );
};

// Tag ranking
const TagRank: React.FC<{ nome: string; cor: string; count: number; maxCount: number }> = ({
  nome, cor, count, maxCount,
}) => {
  const width = maxCount > 0 ? Math.max((count / maxCount) * 100, 5) : 5;

  return (
    <div className="flex items-center gap-3">
      <span
        className="px-2 py-0.5 rounded text-xs font-medium shrink-0"
        style={{ backgroundColor: `${cor}20`, color: cor }}
      >
        {nome}
      </span>
      <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${width}%`, backgroundColor: cor }}
        />
      </div>
      <span className="text-xs text-slate-500 w-8 text-right">{count}</span>
    </div>
  );
};

// ============================================
// PÁGINA PRINCIPAL
// ============================================
export const CRMDashboard: React.FC = () => {
  const { data: pipelines } = usePipelines();
  const firstPipelineId = pipelines?.[0]?.id;
  const { data: etapas } = useEtapas(firstPipelineId);
  const { data: leads } = useLeads({ pipeline_id: firstPipelineId });
  const { data: allLeads } = useLeads({});
  const { data: tags } = useTags();

  // Métricas calculadas
  const metricas = useMemo(() => {
    const all = allLeads || [];
    const pipelineLeads = leads || [];

    const totalLeads = all.length;
    const leadsAbertos = all.filter(l => !l.arquivado).length;
    const valorTotal = all.reduce((sum, l) => sum + (l.valor || 0), 0);
    const ticketMedio = totalLeads > 0 ? valorTotal / totalLeads : 0;

    // Leads por etapa
    const porEtapa: Record<string, { count: number; valor: number }> = {};
    (etapas || []).forEach(e => {
      const etapaLeads = pipelineLeads.filter(l => (l.etapa_atual_id || l.etapa_id) === e.id);
      porEtapa[e.id] = {
        count: etapaLeads.length,
        valor: etapaLeads.reduce((sum, l) => sum + (l.valor || 0), 0),
      };
    });

    // Tags contagem
    const tagContagem: Record<string, number> = {};
    all.forEach(lead => {
      (lead.tags || []).forEach((tag: any) => {
        tagContagem[tag.id] = (tagContagem[tag.id] || 0) + 1;
      });
    });

    // Leads por responsável
    const porResponsavel: Record<string, { nome: string; count: number }> = {};
    all.forEach(lead => {
      if (lead.responsavel) {
        const key = lead.responsavel.id;
        if (!porResponsavel[key]) {
          porResponsavel[key] = {
            nome: lead.responsavel.nome_completo || lead.responsavel.email,
            count: 0,
          };
        }
        porResponsavel[key].count++;
      }
    });

    // Revenue forecast baseado em probabilidade
    let forecast = 0;
    (etapas || []).forEach(e => {
      const etapaLeads = pipelineLeads.filter(l => (l.etapa_atual_id || l.etapa_id) === e.id);
      const etapaValor = etapaLeads.reduce((sum, l) => sum + (l.valor || 0), 0);
      forecast += etapaValor * (e.probabilidade / 100);
    });

    // Leads por origem
    const porOrigem: Record<string, number> = {};
    all.forEach(lead => {
      const origem = lead.origem || 'desconhecido';
      porOrigem[origem] = (porOrigem[origem] || 0) + 1;
    });

    // Leads criados hoje
    const hoje = new Date().toISOString().split('T')[0];
    const criadosHoje = all.filter(l => l.created_at.startsWith(hoje)).length;

    return {
      totalLeads,
      leadsAbertos,
      valorTotal,
      ticketMedio,
      porEtapa,
      tagContagem,
      porResponsavel,
      forecast,
      porOrigem,
      criadosHoje,
    };
  }, [allLeads, leads, etapas]);

  const maxEtapaCount = Math.max(...Object.values(metricas.porEtapa).map(e => e.count), 1);
  const maxTagCount = Math.max(...Object.values(metricas.tagContagem), 1);

  const topTags = useMemo(() => {
    return Object.entries(metricas.tagContagem)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([tagId, count]) => {
        const tag = tags?.find(t => t.id === tagId);
        return tag ? { ...tag, count } : null;
      })
      .filter(Boolean) as (typeof tags extends (infer T)[] | undefined ? T & { count: number } : never)[];
  }, [metricas.tagContagem, tags]);

  const topResponsaveis = useMemo(() => {
    return Object.values(metricas.porResponsavel)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [metricas.porResponsavel]);

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Dashboard CRM"
        subtitle="Métricas e visão geral do pipeline de vendas"
        icon={BarChart3}
      />

      {/* Cards de métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Total de Leads"
          value={metricas.totalLeads}
          icon={Users}
          color="bg-blue-500/10 text-blue-400"
        />
        <MetricCard
          label="Valor em Aberto"
          value={metricas.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          icon={DollarSign}
          color="bg-emerald-500/10 text-emerald-400"
        />
        <MetricCard
          label="Ticket Médio"
          value={metricas.ticketMedio.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          icon={TrendingUp}
          color="bg-amber-500/10 text-amber-400"
        />
        <MetricCard
          label="Revenue Forecast"
          value={metricas.forecast.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          icon={Target}
          color="bg-cyan-500/10 text-cyan-400"
        />
      </div>

      {/* Segunda linha de stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 flex items-center gap-4">
          <div className="p-2 rounded-lg bg-emerald-500/10">
            <ArrowUpRight className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <div className="text-lg font-bold text-slate-200">{metricas.criadosHoje}</div>
            <div className="text-xs text-slate-500">Leads hoje</div>
          </div>
        </div>
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 flex items-center gap-4">
          <div className="p-2 rounded-lg bg-blue-500/10">
            <Activity className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <div className="text-lg font-bold text-slate-200">{pipelines?.length || 0}</div>
            <div className="text-xs text-slate-500">Pipelines ativos</div>
          </div>
        </div>
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 flex items-center gap-4">
          <div className="p-2 rounded-lg bg-amber-500/10">
            <Tag className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <div className="text-lg font-bold text-slate-200">{tags?.length || 0}</div>
            <div className="text-xs text-slate-500">Tags ativas</div>
          </div>
        </div>
      </div>

      {/* Grid de painéis */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Funil de Conversão */}
        <div className="lg:col-span-2 bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-slate-200">Funil de Conversão</h3>
              <p className="text-xs text-slate-500">
                {pipelines?.[0]?.nome || 'Pipeline principal'}
              </p>
            </div>
            <span className="text-xs text-slate-500">
              {leads?.length || 0} leads no pipeline
            </span>
          </div>
          <div className="p-4 space-y-3">
            {etapas?.length ? (
              etapas.map(etapa => (
                <FunnelBar
                  key={etapa.id}
                  etapa={etapa}
                  count={metricas.porEtapa[etapa.id]?.count || 0}
                  maxCount={maxEtapaCount}
                  valor={metricas.porEtapa[etapa.id]?.valor || 0}
                  probabilidade={etapa.probabilidade}
                />
              ))
            ) : (
              <div className="text-center py-8 text-slate-500 text-sm">
                Nenhum pipeline configurado. Vá em CRM → Config para criar.
              </div>
            )}
          </div>
        </div>

        {/* Tags mais usadas */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-800">
            <h3 className="font-semibold text-slate-200">Tags Mais Usadas</h3>
            <p className="text-xs text-slate-500">Top 8 etiquetas aplicadas</p>
          </div>
          <div className="p-4 space-y-3">
            {topTags.length > 0 ? (
              topTags.map((tag: any) => (
                <TagRank
                  key={tag.id}
                  nome={tag.nome}
                  cor={tag.cor}
                  count={tag.count}
                  maxCount={maxTagCount}
                />
              ))
            ) : (
              <div className="text-center py-8 text-slate-500 text-sm">
                Nenhuma tag aplicada ainda
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Origem dos leads + Ranking de responsáveis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Origem */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-800">
            <h3 className="font-semibold text-slate-200">Origem dos Leads</h3>
          </div>
          <div className="p-4">
            {Object.keys(metricas.porOrigem).length > 0 ? (
              <div className="space-y-2">
                {Object.entries(metricas.porOrigem)
                  .sort(([, a], [, b]) => b - a)
                  .map(([origem, count]) => (
                    <div key={origem} className="flex items-center justify-between py-1.5">
                      <span className="text-sm text-slate-300 capitalize">{origem}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full"
                            style={{
                              width: `${(count / metricas.totalLeads) * 100}%`,
                            }}
                          />
                        </div>
                        <span className="text-xs text-slate-500 w-8 text-right">{count}</span>
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500 text-sm">
                Nenhum lead registrado
              </div>
            )}
          </div>
        </div>

        {/* Responsáveis */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-800">
            <h3 className="font-semibold text-slate-200">Ranking de Atendentes</h3>
          </div>
          <div className="p-4">
            {topResponsaveis.length > 0 ? (
              <div className="space-y-3">
                {topResponsaveis.map((r, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                      i === 0 ? 'bg-amber-500/20 text-amber-400' :
                      i === 1 ? 'bg-slate-400/20 text-slate-300' :
                      i === 2 ? 'bg-orange-500/20 text-orange-400' :
                      'bg-slate-700 text-slate-400'
                    }`}>
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-200 truncate">{r.nome}</p>
                    </div>
                    <span className="text-sm font-bold text-slate-300">{r.count} leads</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500 text-sm">
                Nenhum lead com responsável atribuído
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CRMDashboard;
