import React from 'react';
import { TrendingUp, TrendingDown, Minus, LucideIcon } from 'lucide-react';

type StatColor = 'emerald' | 'blue' | 'amber' | 'rose' | 'cyan' | 'slate';

interface EcommerceStatCardProps {
  /** Label above the value */
  label: string;
  /** Main metric value (formatted) */
  value: string;
  /** Trend percentage (positive = up, negative = down) */
  trend?: number;
  /** Label for the trend (e.g., "vs mês anterior") */
  trendLabel?: string;
  /** Lucide icon component */
  icon: LucideIcon;
  /** Color variant */
  color: StatColor;
}

const colorMap: Record<StatColor, {
  bg: string;
  text: string;
  border: string;
  glow: string;
  gradient: string;
}> = {
  emerald: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    border: 'border-emerald-500/20',
    glow: 'hover:shadow-emerald-500/10',
    gradient: 'from-emerald-500/10 to-transparent',
  },
  blue: {
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
    border: 'border-blue-500/20',
    glow: 'hover:shadow-blue-500/10',
    gradient: 'from-blue-500/10 to-transparent',
  },
  amber: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    border: 'border-amber-500/20',
    glow: 'hover:shadow-amber-500/10',
    gradient: 'from-amber-500/10 to-transparent',
  },
  rose: {
    bg: 'bg-rose-500/10',
    text: 'text-rose-400',
    border: 'border-rose-500/20',
    glow: 'hover:shadow-rose-500/10',
    gradient: 'from-rose-500/10 to-transparent',
  },
  cyan: {
    bg: 'bg-cyan-500/10',
    text: 'text-cyan-400',
    border: 'border-cyan-500/20',
    glow: 'hover:shadow-cyan-500/10',
    gradient: 'from-cyan-500/10 to-transparent',
  },
  slate: {
    bg: 'bg-slate-500/10',
    text: 'text-slate-400',
    border: 'border-slate-700',
    glow: 'hover:shadow-slate-500/10',
    gradient: 'from-slate-500/10 to-transparent',
  },
};

export const EcommerceStatCard: React.FC<EcommerceStatCardProps> = ({
  label,
  value,
  trend,
  trendLabel,
  icon: Icon,
  color,
}) => {
  const c = colorMap[color];
  const isPositive = trend !== undefined && trend > 0;
  const isNegative = trend !== undefined && trend < 0;
  const TrendIcon = isPositive ? TrendingUp : isNegative ? TrendingDown : Minus;

  return (
    <div
      className={`
        group relative overflow-hidden rounded-2xl border ${c.border}
        bg-gradient-to-br from-slate-900 to-slate-800/50
        backdrop-blur-sm transition-all duration-300
        hover:border-opacity-50 hover:shadow-lg ${c.glow}
      `}
    >
      {/* Hover gradient overlay */}
      <div className={`absolute inset-0 bg-gradient-to-br ${c.gradient} opacity-0 transition-opacity duration-300 group-hover:opacity-100`} />

      <div className="relative p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 font-mono">
              {label}
            </p>
            <h3 className="text-2xl font-black tracking-tight text-white">
              {value}
            </h3>
          </div>

          <div className={`
            flex h-11 w-11 items-center justify-center rounded-xl
            ${c.bg} ${c.text} transition-all duration-300
            group-hover:scale-110 group-hover:shadow-lg
          `}>
            <Icon className="h-5 w-5" />
          </div>
        </div>

        {trend !== undefined && (
          <div className="mt-3 flex items-center gap-2">
            <div className={`
              flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-semibold
              ${isPositive ? 'bg-emerald-500/10 text-emerald-400' :
                isNegative ? 'bg-rose-500/10 text-rose-400' :
                'bg-slate-500/10 text-slate-400'}
            `}>
              <TrendIcon className="h-3 w-3" />
              <span>{Math.abs(trend)}%</span>
            </div>
            {trendLabel && (
              <span className="text-[11px] text-slate-500">{trendLabel}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
