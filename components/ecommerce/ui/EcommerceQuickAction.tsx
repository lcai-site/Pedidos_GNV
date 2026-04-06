import React from 'react';
import { ArrowRight, LucideIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface EcommerceQuickActionProps {
  /** Navigation destination path */
  to: string;
  /** Lucide icon component */
  icon: LucideIcon;
  /** Action title */
  title: string;
  /** Short description */
  description: string;
  /** Item count badge (optional) */
  count?: number;
}

export const EcommerceQuickAction: React.FC<EcommerceQuickActionProps> = ({
  to,
  icon: Icon,
  title,
  description,
  count,
}) => {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate(to)}
      className="
        group relative flex items-center gap-4 p-4 w-full text-left
        rounded-xl border border-slate-800 bg-slate-900/50
        transition-all duration-300
        hover:border-[#a3e635]/30 hover:bg-slate-800/60
        hover:shadow-[0_0_20px_rgba(163,230,53,0.05)]
      "
      aria-label={`Ir para ${title}`}
    >
      <div className="
        flex h-10 w-10 shrink-0 items-center justify-center rounded-lg
        bg-slate-800 text-slate-400
        transition-all duration-300
        group-hover:bg-[#a3e635]/10 group-hover:text-[#a3e635]
      ">
        <Icon className="h-5 w-5" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-bold text-slate-200 group-hover:text-white truncate">
            {title}
          </h4>
          {count !== undefined && (
            <span className="px-1.5 py-0.5 text-[10px] font-bold font-mono bg-slate-800 text-slate-400 rounded">
              {count}
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500 mt-0.5 truncate">
          {description}
        </p>
      </div>

      <ArrowRight className="
        h-4 w-4 text-slate-600
        transition-all duration-300
        group-hover:text-[#a3e635] group-hover:translate-x-1
      " />
    </button>
  );
};
