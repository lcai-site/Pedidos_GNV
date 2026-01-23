import React from 'react';

interface StatusBadgeProps {
  status: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const normalizedStatus = status?.toLowerCase() || '';

  let colorClass = 'bg-slate-800 text-slate-400'; // Default

  if (
    ['aprovado', 'enviado', 'ativa', 'pago', 'entregue'].includes(normalizedStatus)
  ) {
    colorClass = 'bg-green-500/10 text-green-400 border border-green-500/20';
  } else if (
    ['pendente', 'waiting payment', 'atrasada', 'aguardando', 'processando'].includes(normalizedStatus)
  ) {
    colorClass = 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20';
  } else if (
    ['cancelado', 'reembolsado', 'chargeback', 'erro', 'cancelada'].includes(normalizedStatus)
  ) {
    colorClass = 'bg-red-500/10 text-red-400 border border-red-500/20';
  }

  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium uppercase tracking-wide ${colorClass}`}>
      {status}
    </span>
  );
};
