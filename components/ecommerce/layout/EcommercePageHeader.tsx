import React from 'react';
import { LucideIcon } from 'lucide-react';

interface EcommercePageHeaderProps {
  /** Page title */
  title: string;
  /** Page description */
  description: string;
  /** Primary action button label */
  actionLabel?: string;
  /** Action button icon */
  actionIcon?: LucideIcon;
  /** Action button click handler */
  onAction?: () => void;
  /** Optional right-side content instead of action button */
  rightContent?: React.ReactNode;
}

export const EcommercePageHeader: React.FC<EcommercePageHeaderProps> = ({
  title,
  description,
  actionLabel,
  actionIcon: ActionIcon,
  onAction,
  rightContent,
}) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
      <div>
        <h2 className="text-xl font-black text-text-primary tracking-tight uppercase">
          {title}
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          {description}
        </p>
      </div>

      {rightContent ? (
        rightContent
      ) : actionLabel && onAction ? (
        <button
          onClick={onAction}
          className="
            flex items-center gap-2 px-5 py-2.5 shrink-0
            bg-[#a3e635] text-black text-sm font-bold
            rounded-lg transition-all duration-200
            hover:bg-[#bef264] hover:shadow-[0_0_20px_rgba(163,230,53,0.3)]
            active:scale-95
          "
        >
          {ActionIcon && <ActionIcon className="h-4 w-4" />}
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
};
