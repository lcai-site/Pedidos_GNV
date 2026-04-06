import React from 'react';
import { LucideIcon } from 'lucide-react';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
  className?: string;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  subtitle,
  icon: Icon,
  action,
  className = '',
}) => {
  return (
    <div className={`flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between ${className}`}>
      <div className="flex items-start gap-3">
        {Icon && (
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 text-slate-400 shadow-inner">
            <Icon className="h-5 w-5" />
          </div>
        )}
        <div>
          <h2 className="text-xl font-bold tracking-tight text-text-primary">
            {title}
          </h2>
          {subtitle && (
            <p className="text-sm text-slate-500">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {action && (
        <div className="mt-3 sm:mt-0">
          {action}
        </div>
      )}
    </div>
  );
};

export default SectionHeader;
