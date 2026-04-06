import React from 'react';
import { LucideIcon, Plus } from 'lucide-react';

interface EcommerceEmptyStateProps {
  /** Lucide icon to display */
  icon: LucideIcon;
  /** Title text */
  title: string;
  /** Description/subtitle */
  description: string;
  /** Action button label */
  actionLabel?: string;
  /** Action button click handler */
  onAction?: () => void;
}

export const EcommerceEmptyState: React.FC<EcommerceEmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}) => {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6">
      <div className="
        flex h-16 w-16 items-center justify-center rounded-2xl
        bg-slate-800/80 text-slate-500 mb-5
      ">
        <Icon className="h-8 w-8" />
      </div>

      <h3 className="text-lg font-bold text-slate-200 mb-2 text-center">
        {title}
      </h3>
      <p className="text-sm text-slate-500 max-w-sm text-center mb-6">
        {description}
      </p>

      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="
            flex items-center gap-2 px-5 py-2.5
            bg-[#a3e635] text-black text-sm font-bold
            rounded-lg transition-all duration-200
            hover:bg-[#bef264] hover:shadow-[0_0_20px_rgba(163,230,53,0.3)]
            active:scale-95
          "
        >
          <Plus className="h-4 w-4" />
          {actionLabel}
        </button>
      )}
    </div>
  );
};
