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

    return (
        <Modal isOpen={isOpen} onClose={concluido ? onClose : () => { }} title={`Gerando Etiquetas - ${produtoNome}`}>
            <div className="space-y-6">
                {/* Barra de Progresso */}
                <div className="space-y-2">
                    <div className="flex justify-between text-sm text-gray-600">
                        <span>Progresso</span>
                        <span>{processados} / {total}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                        <div
                            className="bg-blue-600 h-full transition-all duration-300 ease-out"
                            style={{ width: `${progresso}%` }}
                        />
                    </div>
                    <div className="text-center text-2xl font-bold text-gray-800">
                        {progresso}%
                    </div>
                </div>

                {/* Estatísticas */}
                <div className="grid grid-cols-3 gap-4">
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                        <CheckCircle2 className="w-6 h-6 text-green-600 mx-auto mb-2" />
                        <div className="text-2xl font-bold text-green-700">{sucesso}</div>
                        <div className="text-sm text-green-600">Sucesso</div>
                    </div>

                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                        <XCircle className="w-6 h-6 text-red-600 mx-auto mb-2" />
                        <div className="text-2xl font-bold text-red-700">{erros}</div>
                        <div className="text-sm text-red-600">Erros</div>
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                        <Loader2 className={`w-6 h-6 text-blue-600 mx-auto mb-2 ${!concluido ? 'animate-spin' : ''}`} />
                        <div className="text-2xl font-bold text-blue-700">{total}</div>
                        <div className="text-sm text-blue-600">Total</div>
                    </div>
                </div>

                {/* Status */}
                {!concluido && (
                    <div className="space-y-3">
                        <div className="flex items-center justify-center gap-2 text-blue-600">
                            <Loader2 className="w-5 h-5 animate-spin" />
                            <span>Processando etiquetas...</span>
                        </div>
                        {onCancel && (
                            <button
                                onClick={onCancel}
                                className="w-full bg-red-500 hover:bg-red-600 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl animate-pulse"
                                style={{
                                    animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
                                }}
                            >
                                ⏸️ Cancelar Geração
                            </button>
                        )}
                    </div>
                )}

                {concluido && (
                    <div className="flex items-center justify-center gap-2 text-green-600">
                        <CheckCircle2 className="w-5 h-5" />
                        <span>Processamento concluído!</span>
                    </div>
                )}

                {/* Detalhes de Erros */}
                {erros > 0 && (
                    <div className="mt-4">
                        <div className="flex items-center gap-2 mb-2">
                            <AlertCircle className="w-5 h-5 text-orange-600" />
                            <h4 className="font-semibold text-gray-800">Pedidos com Erro:</h4>
                        </div>
                        <div className="max-h-48 overflow-y-auto space-y-2">
                            {detalhes
                                .filter(d => d.status === 'erro')
                                .map((detalhe, idx) => (
                                    <div key={idx} className="bg-red-50 border border-red-200 rounded p-3 text-sm">
                                        <div className="font-medium text-red-900">{detalhe.nome}</div>
                                        <div className="text-red-700">CPF: {detalhe.cpf}</div>
                                        <div className="text-red-600 text-xs mt-1">{detalhe.mensagem}</div>
                                        {detalhe.sugestao_ia && (
                                            <div className="mt-2 text-xs text-orange-700 bg-orange-50 p-2 rounded border border-orange-200">
                                                <strong>IA:</strong> {detalhe.sugestao_ia}
                                            </div>
                                        )}
                                    </div>
                                ))}
                        </div>
                    </div>
                )}

                {/* Botão Fechar */}
                {concluido && (
                    <button
                        onClick={onClose}
                        className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        Fechar
                    </button>
                )}
            </div>
        </Modal>
    );
};
