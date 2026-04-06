import React from 'react';
import { Truck, Package, Zap, DollarSign } from 'lucide-react';
import { formatarMoeda } from '../../lib/hooks/useFrete';

interface TotalizacaoFreteProps {
  miniEnvios?: { count: number; valor: number };
  pac?: { count: number; valor: number };
  sedex?: { count: number; valor: number };
  total?: { count: number; valor: number };
  isLoading?: boolean;
}

export const TotalizacaoFrete: React.FC<TotalizacaoFreteProps> = ({
  miniEnvios = { count: 0, valor: 0 },
  pac = { count: 0, valor: 0 },
  sedex = { count: 0, valor: 0 },
  total = { count: 0, valor: 0 },
  isLoading = false,
}) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-pulse">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-24 bg-slate-800/50 rounded-xl" />
        ))}
      </div>
    );
  }

  const cards = [
    {
      tipo: 'Mini Envios',
      icon: Package,
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/10 border-purple-500/30',
      count: miniEnvios.count,
      valor: miniEnvios.valor,
    },
    {
      tipo: 'PAC',
      icon: Truck,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10 border-blue-500/30',
      count: pac.count,
      valor: pac.valor,
    },
    {
      tipo: 'SEDEX',
      icon: Zap,
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/10 border-amber-500/30',
      count: sedex.count,
      valor: sedex.valor,
    },
    {
      tipo: 'Total',
      icon: DollarSign,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10 border-emerald-500/30',
      count: total.count,
      valor: total.valor,
      isTotal: true,
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map((card, index) => (
        <div
          key={index}
          className={`p-4 rounded-xl border ${card.bgColor} ${
            card.isTotal ? 'md:col-span-1' : ''
          }`}
        >
          <div className="flex items-center gap-2 mb-2">
            <card.icon className={`w-4 h-4 ${card.color}`} />
            <span className={`text-xs font-medium ${card.color}`}>
              {card.tipo}
            </span>
          </div>
          <div className="space-y-1">
            <p className="text-2xl font-bold text-slate-200">
              {formatarMoeda(card.valor)}
            </p>
            <p className="text-xs text-slate-500">
              {card.count} pedido{card.count !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default TotalizacaoFrete;
