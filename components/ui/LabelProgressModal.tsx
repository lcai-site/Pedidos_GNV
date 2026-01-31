// Componente: Modal de Progresso de Geração de Etiquetas

import React, { useEffect, useState } from 'react';
import { Modal } from './Modal';
import { Loader2, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import type { JobStatus } from '../../types/labels';

interface LabelProgressModalProps {
    isOpen: boolean;
    onClose: () => void;
    jobId: string | null;
    produto: 'DP' | 'BF' | 'BL';
}

export const LabelProgressModal: React.FC<LabelProgressModalProps> = ({
    isOpen,
    onClose,
    jobId,
    produto
}) => {
    const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
    const [polling, setPolling] = useState(true);

    // Poll status a cada 2 segundos
    useEffect(() => {
        if (!jobId || !isOpen) {
            setPolling(false);
            return;
        }

        const fetchStatus = async () => {
            try {
                const response = await fetch(`/api/labels/status?jobId=${jobId}`);
                if (response.ok) {
                    const data: JobStatus = await response.json();
                    setJobStatus(data);

                    // Para de fazer polling quando concluído ou erro
                    if (data.status === 'concluido' || data.status === 'erro') {
                        setPolling(false);
                    }
                }
            } catch (error) {
                console.error('Erro ao buscar status:', error);
            }
        };

        fetchStatus(); // Primeira chamada imediata

        if (polling) {
            const interval = setInterval(fetchStatus, 2000);
            return () => clearInterval(interval);
        }
    }, [jobId, isOpen, polling]);

    const handleClose = () => {
        setPolling(false);
        setJobStatus(null);
        onClose();
    };

    const produtoNome = {
        'DP': 'Desejo Proibido',
        'BF': 'Bela Forma',
        'BL': 'Bela Lumi'
    }[produto];

    const progresso = jobStatus ? Math.round((jobStatus.processados / jobStatus.total) * 100) : 0;

    return (
        <Modal isOpen={isOpen} onClose={handleClose} title={`Gerando Etiquetas - ${produtoNome}`}>
            <div className="space-y-6">
                {/* Barra de Progresso */}
                <div className="space-y-2">
                    <div className="flex justify-between text-sm text-gray-600">
                        <span>Progresso</span>
                        <span>{jobStatus?.processados || 0} / {jobStatus?.total || 0}</span>
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
                        <div className="text-2xl font-bold text-green-700">{jobStatus?.sucesso || 0}</div>
                        <div className="text-sm text-green-600">Sucesso</div>
                    </div>

                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                        <XCircle className="w-6 h-6 text-red-600 mx-auto mb-2" />
                        <div className="text-2xl font-bold text-red-700">{jobStatus?.erros || 0}</div>
                        <div className="text-sm text-red-600">Erros</div>
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                        <Loader2 className={`w-6 h-6 text-blue-600 mx-auto mb-2 ${polling ? 'animate-spin' : ''}`} />
                        <div className="text-2xl font-bold text-blue-700">{jobStatus?.total || 0}</div>
                        <div className="text-sm text-blue-600">Total</div>
                    </div>
                </div>

                {/* Status */}
                {jobStatus?.status === 'processando' && (
                    <div className="flex items-center justify-center gap-2 text-blue-600">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Processando etiquetas...</span>
                    </div>
                )}

                {jobStatus?.status === 'concluido' && (
                    <div className="flex items-center justify-center gap-2 text-green-600">
                        <CheckCircle2 className="w-5 h-5" />
                        <span>Processamento concluído!</span>
                    </div>
                )}

                {jobStatus?.status === 'erro' && (
                    <div className="flex items-center justify-center gap-2 text-red-600">
                        <XCircle className="w-5 h-5" />
                        <span>Erro no processamento</span>
                    </div>
                )}

                {/* Detalhes de Erros */}
                {jobStatus && jobStatus.erros > 0 && (
                    <div className="mt-4">
                        <div className="flex items-center gap-2 mb-2">
                            <AlertCircle className="w-5 h-5 text-orange-600" />
                            <h4 className="font-semibold text-gray-800">Pedidos com Erro:</h4>
                        </div>
                        <div className="max-h-48 overflow-y-auto space-y-2">
                            {jobStatus.detalhes
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
                {jobStatus?.status !== 'processando' && (
                    <button
                        onClick={handleClose}
                        className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        Fechar
                    </button>
                )}
            </div>
        </Modal>
    );
};
