import React from 'react';
import { TrendingUp, TrendingDown, Minus, LucideIcon } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string;
  count?: number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: number;
  trendLabel?: string;
  color: 'emerald' | 'blue' | 'amber' | 'rose' | 'violet' | 'cyan' | 'slate';
  loading?: boolean;
  sparklineData?: number[];
  footer?: React.ReactNode;
}

const colorVariants = {
  slate: {
    bg: 'bg-slate-500/10',
    border: 'border-slate-700',
    text: 'text-slate-400',
    glow: 'shadow-slate-500/10',
    gradient: 'from-slate-500/10 to-transparent',
    sparkline: '#64748b',
  },
  emerald: {
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    text: 'text-emerald-400',
    glow: 'shadow-emerald-500/10',
    gradient: 'from-emerald-500/10 to-transparent',
    sparkline: '#10b981',
  },
  blue: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    text: 'text-blue-400',
    glow: 'shadow-blue-500/10',
    gradient: 'from-blue-500/10 to-transparent',
    sparkline: '#3b82f6',
  },
  amber: {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    text: 'text-amber-400',
    glow: 'shadow-amber-500/10',
    gradient: 'from-amber-500/10 to-transparent',
    sparkline: '#f59e0b',
  },
  rose: {
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/20',
    text: 'text-rose-400',
    glow: 'shadow-rose-500/10',
    gradient: 'from-rose-500/10 to-transparent',
    sparkline: '#f43f5e',
  },
  violet: {
    bg: 'bg-violet-500/10',
    border: 'border-violet-500/20',
    text: 'text-violet-400',
    glow: 'shadow-violet-500/10',
    gradient: 'from-violet-500/10 to-transparent',
    sparkline: '#8b5cf6',
  },
  cyan: {
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/20',
    text: 'text-cyan-400',
    glow: 'shadow-cyan-500/10',
    gradient: 'from-cyan-500/10 to-transparent',
    sparkline: '#06b6d4',
  },
};

const Sparkline: React.FC<{ data: number[]; color: string }> = ({ data, color }) => {
  if (!data || data.length < 2) return null;
  
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const width = 100;
  const height = 35;
  const padding = 3;
  
  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * width;
    const y = height - padding - ((value - min) / range) * (height - 2 * padding);
    return `${x},${y}`;
  }).join(' ');
  
  const areaPoints = `${points} ${width},${height} 0,${height}`;
  
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-9 opacity-70" preserveAspectRatio="none">
      <defs>
        <linearGradient id={`grad-${color.replace('#', '')}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.4" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#grad-${color.replace('#', '')})`} />
      <polyline 
        points={points} 
        fill="none" 
        stroke={color} 
        strokeWidth="2" 
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle 
        cx={width} 
        cy={height - padding - ((data[data.length - 1] - min) / range) * (height - 2 * padding)}
        r="3" 
        fill={color}
      />
    </svg>
  );
};

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  count,
  subtitle,
  icon: Icon,
  trend,
  trendLabel,
  color,
  loading = false,
  sparklineData,
  footer,
}) => {
  if (loading) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50 p-6 backdrop-blur-sm">
        <div className="animate-pulse space-y-4">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="h-3 w-24 rounded bg-slate-800" />
              <div className="h-8 w-32 rounded bg-slate-800" />
            </div>
            <div className="h-12 w-12 rounded-xl bg-slate-800" />
          </div>
          <div className="h-8 rounded bg-slate-800/50" />
        </div>
      </div>
    );
  }
  
  const colors = colorVariants[color];
  const isPositive = trend && trend > 0;
  const isNegative = trend && trend < 0;
  const TrendIcon = isPositive ? TrendingUp : isNegative ? TrendingDown : Minus;
  
  return (
    <div 
      className={`
        group relative overflow-hidden rounded-2xl border ${colors.border} 
        bg-gradient-to-br from-slate-900 to-slate-800/50 
        backdrop-blur-sm transition-all duration-300 
        hover:border-opacity-50 hover:shadow-lg ${colors.glow}
      `}
    >
      {/* Hover gradient */}
      <div className={`absolute inset-0 bg-gradient-to-br ${colors.gradient} opacity-0 transition-opacity duration-300 group-hover:opacity-100`} />
      
      <div className="relative p-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {title}
            </p>
            <div className="flex items-baseline gap-2">
              <h3 className="text-2xl font-bold tracking-tight text-white">
                {value}
              </h3>
              {count !== undefined && (
                <span className={`
                  rounded-full px-2 py-0.5 text-[10px] font-bold
                  ${colors.bg} ${colors.text}
                `}>
                  {count} {count === 1 ? 'ped' : 'peds'}
                </span>
              )}
            </div>
          </div>
          
          <div className={`
            flex h-12 w-12 items-center justify-center rounded-xl
            ${colors.bg} ${colors.text} transition-all duration-300 
            group-hover:scale-110 group-hover:shadow-lg
          `}>
            <Icon className="h-6 w-6" />
          </div>
        </div>
        
        {/* Sparkline */}
        {sparklineData && sparklineData.length > 1 && (
          <div className="mt-4 -mx-2">
            <Sparkline data={sparklineData} color={colors.sparkline} />
          </div>
        )}
        
        {/* Subtitle and Trend */}
        <div className="mt-4 flex items-center justify-between">
          {subtitle && (
            <p className="text-sm text-slate-400">
              {subtitle}
            </p>
          )}
          
          {trend !== undefined && (
            <div className={`
              flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold
              ${isPositive ? 'bg-emerald-500/10 text-emerald-400' : 
                isNegative ? 'bg-rose-500/10 text-rose-400' : 'bg-slate-500/10 text-slate-400'}
            `}>
              <TrendIcon className="h-3 w-3" />
              <span>{Math.abs(trend)}%</span>
              {trendLabel && (
                <span className="ml-1 text-slate-500">{trendLabel}</span>
              )}
            </div>
          )}
        </div>
        
        {/* Footer */}
        {footer && (
          <div className="mt-4 border-t border-slate-800 pt-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export default MetricCard;
