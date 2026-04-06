import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { RefreshCw, CheckCircle, XCircle, Calendar } from 'lucide-react';
import { logger } from '../lib/utils/logger';

const BotaoConsolidar = ({ onComplete }: { onComplete?: () => void }) => {
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<'idle' | 'success' | 'error' | 'skipped'>('idle');
    const [message, setMessage] = useState('');

    const handleConsolidation = async () => {
        if (loading) return;
        setLoading(true);
        setStatus('idle');
        setMessage('');

        try {
            // Chama a procedure. Agora ela retorna um JSONB { status: 'success' | 'skipped', message: '...' }
            // ou void se o usuário rodar uma versão antiga da migration (fallback)
            const { data, error } = await supabase.rpc('consolidar_pedidos_ticto');

            if (error) throw error;

            // Parsing robusto
            let result = data;
            if (typeof data === 'string') {
                try {
                    result = JSON.parse(data);
                } catch (e) {
                    result = { status: 'success' }; // Fallback se retornar void/texto simples
                }
            }

            // Se data for null (versão antiga VOID), assume sucesso
            if (!result) result = { status: 'success' };

            if (result.status === 'skipped') {
                setStatus('skipped');
                setMessage(result.message || 'Feriado detectado');
            } else {
                setStatus('success');
                setMessage('Consolidação concluída!');
                if (onComplete) onComplete();
            }

            // Resetar estado visual após 4 segundos
            setTimeout(() => {
                setStatus('idle');
                setMessage('');
            }, 4000);

        } catch (err: any) {
            logger.error('Erro ao consolidar pedidos', err, { module: 'BotaoConsolidar' });
            setStatus('error');
            setMessage('Erro na execução');
            setTimeout(() => setStatus('idle'), 4000);
        } finally {
            setLoading(false);
        }
    };

    const getButtonText = () => {
        if (loading) return 'Processando...';
        if (status === 'success') return 'Sucesso!';
        if (status === 'error') return 'Erro!';
        if (status === 'skipped') return message || 'Feriado!';
        return 'Consolidar Agora';
    };

    const getLimitDate = () => {
        // Retorna string com horário limite (apenas visual)
        const now = new Date();
        const isWeekend = now.getDay() === 0 || now.getDay() === 6;
        if (isWeekend) return 'Fim de Semana';
        return 'Corte: 08:30';
    };

    return (
        <div className="flex flex-col items-end gap-1">
            <button
                onClick={handleConsolidation}
                disabled={loading}
                className={`
          flex items-center gap-2 px-4 py-2 rounded-md transition-all text-white font-medium text-sm shadow-sm
          ${status === 'success' ? 'bg-green-600 hover:bg-green-700' : ''}
          ${status === 'error' ? 'bg-red-600 hover:bg-red-700' : ''}
          ${status === 'skipped' ? 'bg-orange-500 hover:bg-orange-600' : ''}
          ${status === 'idle' ? 'bg-indigo-600 hover:bg-indigo-700' : ''}
          ${loading ? 'opacity-75 cursor-not-allowed' : ''}
        `}
                title={message || "Rodar processamento manual de pedidos Ticto"}
            >
                {loading && <RefreshCw className="w-4 h-4 animate-spin" />}
                {!loading && status === 'success' && <CheckCircle className="w-4 h-4" />}
                {!loading && status === 'error' && <XCircle className="w-4 h-4" />}
                {!loading && status === 'skipped' && <Calendar className="w-4 h-4" />}
                {!loading && status === 'idle' && <RefreshCw className="w-4 h-4" />}
                <span>{getButtonText()}</span>
            </button>

            {/* Mini Helper Text */}
            <span className="text-[10px] text-slate-400 font-medium">
                {getLimitDate()}
            </span>
        </div>
    );
};

export default BotaoConsolidar;
