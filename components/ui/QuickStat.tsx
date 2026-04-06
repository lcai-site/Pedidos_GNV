import React from 'react';
import { LucideIcon } from 'lucide-react';

interface QuickStatProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  color?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'amber';
  loading?: boolean;
}

const colorVariants = {
  default: 'bg-slate-800/50 text-slate-400 border-slate-700',
  success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  warning: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  danger: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  info: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
};

export const QuickStat: React.FC<QuickStatProps> = ({
  label,
  value,
  icon: Icon,
  color = 'default',
  loading = false,
}) => {
  if (loading) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/50 p-3 backdrop-blur-sm">
        <div className="h-10 w-10 animate-pulse rounded-lg bg-slate-800" />
        <div className="space-y-2">
          <div className="h-3 w-20 animate-pulse rounded bg-slate-800" />
          <div className="h-5 w-12 animate-pulse rounded bg-slate-800" />
        </div>
      </div>
    );
  }
  
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/50 p-3 backdrop-blur-sm transition-all duration-200 hover:border-slate-700 hover:bg-slate-800/50">
      <div className={`flex h-10 w-10 items-center justify-center rounded-lg border ${colorVariants[color]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500">{label}</p>
        <p className="text-lg font-bold text-white">{value}</p>
      </div>
    </div>
  );
};

interface QuickStatsGridProps {
  children: React.ReactNode;
  className?: string;
}

export const QuickStatsGrid: React.FC<QuickStatsGridProps> = ({ children, className = '' }) => {
  return (
    <div className={`flex flex-wrap gap-3 ${className}`}>
      {children}
    </div>
  );
};

export default QuickStat;
