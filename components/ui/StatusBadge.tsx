import React from 'react';

interface StatusBadgeProps {
  status: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const normalizedStatus = status?.toLowerCase() || '';

  let colorClass = 'bg-slate-900 text-slate-400 border-slate-700'; // Default

  if (
    ['aprovado', 'enviado', 'ativa', 'pago', 'entregue'].includes(normalizedStatus)
  ) {
    colorClass = 'bg-[#a3e635]/10 text-[#a3e635] border-[#a3e635]/40 shadow-[0_0_8px_rgba(163,230,53,0.15)]';
  } else if (
    ['pendente', 'waiting payment', 'atrasada', 'aguardando', 'processando'].includes(normalizedStatus)
  ) {
    colorClass = 'bg-[#fb923c]/10 text-[#fb923c] border-[#fb923c]/40 shadow-[0_0_8px_rgba(251,146,60,0.15)]';
  } else if (
    ['cancelado', 'reembolsado', 'chargeback', 'erro', 'cancelada'].includes(normalizedStatus)
  ) {
    colorClass = 'bg-red-500/10 text-red-500 border-red-500/40 shadow-[0_0_8px_rgba(239,68,68,0.15)]';
  }

  return (
    <span className={`px-2 py-0.5 border text-[10px] font-mono font-bold uppercase tracking-widest ${colorClass}`}>
      {status}
    </span>
  );
};
