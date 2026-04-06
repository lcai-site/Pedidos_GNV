import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { ENV } from '../lib/config/environment';
import { Send, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { PedidoUnificado } from '../types';
import { logger } from '../lib/utils/logger';

const BotaoRelatorioEnvios = ({ pedidosEnvios }: { pedidosEnvios: PedidoUnificado[] }) => {
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');

    const handleDispatch = async () => {
        if (loading) return;

        if (pedidosEnvios.length === 0) {
            toast.error("Nenhum pedido na aba Envios para gerar relatório.");
            return;
        }

        if (!window.confirm("Disparar relatório de envios com base na ABA ENVIOS atual? Isso enviará uma mensagem no WhatsApp.")) {
            return;
        }

        setLoading(true);
        setStatus('idle');
        const loadingToast = toast.loading('Gerando e enviando relatório...');

        try {
            const projectUrl = ENV.supabase.url;
            const anonKey = ENV.supabase.anonKey;

            const response = await fetch(`${projectUrl}/functions/v1/relatorio-envios`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${anonKey}`
                },
                body: JSON.stringify({ pedidoIds: pedidosEnvios.map(p => p.id) })
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => null);
                throw new Error(errData?.error || `Erro HTTP: ${response.status}`);
            }

            const data = await response.json();

            if (data?.error) {
                throw new Error(data.error);
            }

            setStatus('success');
            toast.success(data?.message || 'Relatório disparado com sucesso!', { id: loadingToast, duration: 5000 });

            setTimeout(() => setStatus('idle'), 4000);

        } catch (err: any) {
            logger.error('Erro ao disparar relatório', err, { module: 'BotaoRelatorioEnvios', pedidoCount: pedidosEnvios.length });
            setStatus('error');
            toast.error(err.message || 'Erro ao disparar relatório', { id: loadingToast, duration: 5000 });
            setTimeout(() => setStatus('idle'), 4000);
        } finally {
            setLoading(false);
        }
    };

    const getButtonText = () => {
        if (loading) return 'Enviando...';
        if (status === 'success') return 'Sucesso!';
        if (status === 'error') return 'Erro!';
        return 'Relatório Diário';
    };

    return (
        <div className="flex flex-col items-end gap-1">
            <button
                onClick={handleDispatch}
                disabled={loading}
                className={`
          flex items-center gap-2 px-4 py-2 rounded-none transition-all font-mono text-[10px] font-bold uppercase tracking-widest border
          ${status === 'success' ? 'bg-[#a3e635] text-[#020617] border-[#a3e635]' : ''}
          ${status === 'error' ? 'bg-red-500/10 text-red-500 border-red-500/50' : ''}
          ${status === 'idle' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30 hover:bg-indigo-500 hover:text-white hover:border-indigo-500' : ''}
          ${loading ? 'opacity-75 cursor-not-allowed border-indigo-500/30 text-indigo-400' : ''}
        `}
                title="Disparar relatório de envios e despachos do dia de hoje para o Webhook"
            >
                {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {!loading && status === 'success' && <CheckCircle className="w-3.5 h-3.5" />}
                {!loading && status === 'error' && <XCircle className="w-3.5 h-3.5" />}
                {!loading && status === 'idle' && <Send className="w-3.5 h-3.5" />}
                <span>{getButtonText()}</span>
            </button>
            <span className="text-[9px] text-slate-500 font-medium font-mono uppercase tracking-widest">
                Automático: 08:35 (Seg-Sex)
            </span>
        </div>
    );
};

export default BotaoRelatorioEnvios;
