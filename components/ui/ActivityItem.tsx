import React from 'react';
import { LucideIcon } from 'lucide-react';

interface ActivityItemProps {
  icon: LucideIcon;
  iconColor?: 'emerald' | 'blue' | 'amber' | 'rose' | 'violet' | 'cyan' | 'slate';
  title: string;
  description?: string;
  timestamp: string;
  status?: 'success' | 'warning' | 'error' | 'pending';
}

const colorVariants = {
  emerald: 'bg-emerald-500/10 text-emerald-400',
  blue: 'bg-blue-500/10 text-blue-400',
  amber: 'bg-amber-500/10 text-amber-400',
  rose: 'bg-rose-500/10 text-rose-400',
  violet: 'bg-violet-500/10 text-violet-400',
  cyan: 'bg-cyan-500/10 text-cyan-400',
  slate: 'bg-slate-500/10 text-slate-400',
};

const statusVariants = {
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  error: 'bg-rose-500',
  pending: 'bg-blue-500 animate-pulse',
};

export const ActivityItem: React.FC<ActivityItemProps> = ({
  icon: Icon,
  iconColor = 'slate',
  title,
  description,
  timestamp,
  status,
}) => {
  return (
    <div className="flex items-start gap-4 py-4 group">
      <div className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${colorVariants[iconColor]} transition-transform group-hover:scale-110`}>
        <Icon className="h-5 w-5" />
        {status && (
          <span className={`absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-slate-900 ${statusVariants[status]}`} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-200">{title}</p>
        {description && (
          <p className="text-xs text-slate-500 truncate">{description}</p>
        )}
      </div>
      <span className="text-xs text-slate-600 whitespace-nowrap">{timestamp}</span>
    </div>
  );
};

interface ActivityListProps {
  children: React.ReactNode;
  title?: string;
  className?: string;
}

export const ActivityList: React.FC<ActivityListProps> = ({ children, title, className = '' }) => {
  return (
    <div className={`rounded-2xl border border-slate-800 bg-slate-900/50 overflow-hidden backdrop-blur-sm ${className}`}>
      {title && (
        <div className="border-b border-slate-800 px-6 py-4">
          <h3 className="font-semibold text-slate-200">{title}</h3>
        </div>
      )}
      <div className="divide-y divide-slate-800 px-6">
        {children}
      </div>
    </div>
  );
};

export default ActivityItem;
