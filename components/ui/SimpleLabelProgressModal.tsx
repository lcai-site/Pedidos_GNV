// Componente: Modal de Progresso de Geração de Etiquetas (Versão Simplificada)

import React, { useState } from 'react';
import { Modal } from './Modal';
import { Loader2, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import type { ResultadoEtiqueta } from '../../types/labels';

interface SimpleLabelProgressModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCancel?: () => void; // Nova prop
    produto: 'DP' | 'BF' | 'BL';
    total: number;
    processados: number;
    sucesso: number;
    erros: number;
    detalhes: ResultadoEtiqueta[];
    concluido: boolean;
}

export const SimpleLabelProgressModal: React.FC<SimpleLabelProgressModalProps> = ({
    isOpen,
    onClose,
    onCancel,
    produto,
    total,
    processados,
    sucesso,
    erros,
    detalhes,
    concluido
}) => {
    const produtoNome = {
        'DP': 'Desejo Proibido',
        'BF': 'Bela Forma',
        'BL': 'Bela Lumi'
    }[produto];

    const progresso = total > 0 ? Math.round((processados / total) * 100) : 0;
    const hasErrors = erros > 0;

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#020617]/80 backdrop-blur-sm p-4">
            <div className="bg-[#0f172a] border border-[#22d3ee]/50 shadow-[0_0_20px_rgba(34,211,238,0.1)] w-full max-w-lg">
                <div className="px-6 py-4 border-b border-[#22d3ee]/30 flex items-center justify-between bg-[#22d3ee]/5">
                    <h3 className="text-sm font-mono font-bold tracking-widest text-[#22d3ee] uppercase">
                        :: GERANDO ETIQUETAS_ :: [{produtoNome}]
                    </h3>
                    {concluido && (
                        <button onClick={onClose} className="text-slate-500 hover:text-red-500 transition-colors">
                            <XCircle className="w-5 h-5" />
                        </button>
                    )}
                </div>

                <div className="p-6 space-y-6">
                    {/* Barra de Progresso Terminal */}
                    <div className="space-y-2">
                        <div className="flex justify-between text-[10px] font-mono font-bold tracking-widest text-[#22d3ee] uppercase">
                            <span>&gt; PROGRESSO_</span>
                            <span>{processados}/{total} [{progresso}%]</span>
                        </div>
                        <div className="w-full bg-[#020617] border border-slate-700 h-2">
                            <div
                                className="bg-[#22d3ee] h-full shadow-[0_0_8px_#22d3ee] transition-all duration-300 ease-out"
                                style={{ width: `${progresso}%` }}
                            />
                        </div>
                    </div>

                    {/* Estatísticas Neon */}
                    <div className="grid grid-cols-3 gap-4">
                        <div className="bg-[#a3e635]/5 border border-[#a3e635]/30 p-4 text-center">
                            <CheckCircle2 className="w-5 h-5 text-[#a3e635] mx-auto mb-2" />
                            <div className="text-xl font-mono font-black text-[#a3e635] shadow-[0_0_8px_rgba(163,230,53,0.3)]">{sucesso}</div>
                            <div className="text-[9px] font-mono tracking-widest uppercase text-[#a3e635]/70 mt-1">SUCESSO</div>
                        </div>

                        <div className="bg-[#ef4444]/5 border border-[#ef4444]/30 p-4 text-center">
                            <XCircle className="w-5 h-5 text-[#ef4444] mx-auto mb-2" />
                            <div className="text-xl font-mono font-black text-[#ef4444] shadow-[0_0_8px_rgba(239,68,68,0.3)]">{erros}</div>
                            <div className="text-[9px] font-mono tracking-widest uppercase text-[#ef4444]/70 mt-1">ERROS</div>
                        </div>

                        <div className="bg-[#22d3ee]/5 border border-[#22d3ee]/30 p-4 text-center">
                            <Loader2 className={`w-5 h-5 text-[#22d3ee] mx-auto mb-2 ${!concluido ? 'animate-spin' : ''}`} />
                            <div className="text-xl font-mono font-black text-[#22d3ee] shadow-[0_0_8px_rgba(34,211,238,0.3)]">{total}</div>
                            <div className="text-[9px] font-mono tracking-widest uppercase text-[#22d3ee]/70 mt-1">TOTAL</div>
                        </div>
                    </div>

                    {/* Status Console */}
                    {!concluido && (
                        <div className="space-y-3 pt-2">
                            <div className="flex items-center justify-center gap-2 text-[#22d3ee] font-mono text-[10px] uppercase tracking-widest py-2 bg-[#22d3ee]/10 border border-[#22d3ee]/20">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>SINCRONIZANDO NODES... AGUARDE</span>
                            </div>
                            {onCancel && (
                                <button
                                    onClick={onCancel}
                                    className="w-full bg-transparent border border-[#ef4444] text-[#ef4444] hover:bg-[#ef4444] hover:text-[#020617] font-mono font-bold text-[10px] tracking-widest uppercase py-3 transition-colors flex items-center justify-center gap-2"
                                >
                                    <AlertCircle className="w-4 h-4" /> ABORTAR SEQUÊNCIA
                                </button>
                            )}
                        </div>
                    )}

                    {concluido && (
                        <div className={`flex items-center justify-center gap-2 font-mono text-[10px] uppercase tracking-widest py-2 ${hasErrors ? 'text-[#ef4444] bg-[#ef4444]/10 border border-[#ef4444]/20' : 'text-[#a3e635] bg-[#a3e635]/10 border border-[#a3e635]/20'}`}>
                            {hasErrors ? <XCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                            <span>{hasErrors ? 'OPERACAO FINALIZADA_ COM FALHAS' : 'OPERACAO FINALIZADA_ COM SUCESSO'}</span>
                        </div>
                    )}

                    {/* Error Logs */}
                    {erros > 0 && (
                        <div className="mt-4 border-t border-slate-800 pt-4">
                            <div className="flex items-center gap-2 mb-3">
                                <AlertCircle className="w-4 h-4 text-[#ef4444]" />
                                <h4 className="font-mono text-[10px] uppercase tracking-widest text-[#ef4444] font-bold">:: LOGS_DE_FALHA</h4>
                            </div>
                            <div className="max-h-48 overflow-y-auto space-y-2 pr-2 custom-scrollbar-dark">
                                {detalhes
                                    .filter(d => d.status === 'erro')
                                    .map((detalhe, idx) => (
                                        <div key={idx} className="bg-[#ef4444]/5 border-l-2 border-[#ef4444] p-3 text-sm flex flex-col gap-1">
                                            <div className="font-mono font-bold text-[#ef4444] text-xs uppercase tracking-tight">{detalhe.nome}</div>
                                            <div className="font-mono text-[#ef4444]/80 text-[10px] tracking-widest">ID: {detalhe.cpf}</div>
                                            <div className="text-slate-400 text-[10px] mt-1 font-mono break-words leading-relaxed">{detalhe.mensagem}</div>
                                            {detalhe.sugestao_ia && (
                                                <div className="mt-2 text-[10px] font-mono text-[#fb923c] bg-[#fb923c]/5 p-2 border border-[#fb923c]/20">
                                                    <strong className="tracking-widest uppercase mb-1 block">:: IA_SUGERE:</strong> {detalhe.sugestao_ia}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                            </div>
                        </div>
                    )}

                    {/* Botão Fechar Terminal */}
                    {concluido && (
                        <button
                            onClick={onClose}
                            className="w-full bg-[#22d3ee] text-[#020617] font-mono font-bold text-[10px] uppercase tracking-widest py-3 hover:bg-cyan-300 transition-colors mt-4"
                        >
                            FECHAR TERMINAL
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
