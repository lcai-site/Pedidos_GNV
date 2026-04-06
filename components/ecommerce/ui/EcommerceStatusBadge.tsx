import React from 'react';

interface EcommerceStatusBadgeProps {
  /** Status text to display */
  status: string;
}

const STATUS_COLORS: Record<string, string> = {
  // Success states
  ativo: 'bg-[#a3e635]/10 text-[#a3e635] border-[#a3e635]/40 shadow-[0_0_8px_rgba(163,230,53,0.15)]',
  ativa: 'bg-[#a3e635]/10 text-[#a3e635] border-[#a3e635]/40 shadow-[0_0_8px_rgba(163,230,53,0.15)]',
  confirmado: 'bg-[#a3e635]/10 text-[#a3e635] border-[#a3e635]/40 shadow-[0_0_8px_rgba(163,230,53,0.15)]',
  entregue: 'bg-[#a3e635]/10 text-[#a3e635] border-[#a3e635]/40 shadow-[0_0_8px_rgba(163,230,53,0.15)]',
  convertido: 'bg-[#a3e635]/10 text-[#a3e635] border-[#a3e635]/40 shadow-[0_0_8px_rgba(163,230,53,0.15)]',
  recuperado: 'bg-[#a3e635]/10 text-[#a3e635] border-[#a3e635]/40 shadow-[0_0_8px_rgba(163,230,53,0.15)]',
  // Warning/Pending states
  pendente: 'bg-[#fb923c]/10 text-[#fb923c] border-[#fb923c]/40 shadow-[0_0_8px_rgba(251,146,60,0.15)]',
  processando: 'bg-[#fb923c]/10 text-[#fb923c] border-[#fb923c]/40 shadow-[0_0_8px_rgba(251,146,60,0.15)]',
  agendada: 'bg-[#fb923c]/10 text-[#fb923c] border-[#fb923c]/40 shadow-[0_0_8px_rgba(251,146,60,0.15)]',
  agendado: 'bg-[#fb923c]/10 text-[#fb923c] border-[#fb923c]/40 shadow-[0_0_8px_rgba(251,146,60,0.15)]',
  // Info states
  rascunho: 'bg-slate-500/10 text-slate-400 border-slate-500/40',
  enviado: 'bg-blue-500/10 text-blue-400 border-blue-500/40 shadow-[0_0_8px_rgba(59,130,246,0.15)]',
  arquivado: 'bg-slate-500/10 text-slate-400 border-slate-500/40',
  // Danger states
  cancelado: 'bg-red-500/10 text-red-500 border-red-500/40 shadow-[0_0_8px_rgba(239,68,68,0.15)]',
  reembolsado: 'bg-red-500/10 text-red-500 border-red-500/40 shadow-[0_0_8px_rgba(239,68,68,0.15)]',
  expirada: 'bg-red-500/10 text-red-500 border-red-500/40 shadow-[0_0_8px_rgba(239,68,68,0.15)]',
  expirado: 'bg-red-500/10 text-red-500 border-red-500/40 shadow-[0_0_8px_rgba(239,68,68,0.15)]',
  abandonado: 'bg-red-500/10 text-red-500 border-red-500/40 shadow-[0_0_8px_rgba(239,68,68,0.15)]',
};

const DEFAULT_COLOR = 'bg-slate-900 text-slate-400 border-slate-700';

export const EcommerceStatusBadge: React.FC<EcommerceStatusBadgeProps> = ({ status }) => {
  const normalized = status?.toLowerCase() || '';
  const colorClass = STATUS_COLORS[normalized] || DEFAULT_COLOR;

  return (
    <span
      className={`
        inline-flex items-center px-2 py-0.5 border
        text-[10px] font-mono font-bold uppercase tracking-widest
        ${colorClass}
      `}
    >
      {status}
    </span>
  );
};
