import React from 'react';
import { useDateFilter } from '../../context/DateFilterContext';
import { Calendar as CalendarIcon, ChevronDown, CalendarDays } from 'lucide-react';
import { format } from 'date-fns';

export const DateRangeFilter: React.FC = () => {
  const { period, setPeriod, startDate, endDate, setCustomRange } = useDateFilter();

  const handleCustomDateChange = (type: 'start' | 'end', value: string) => {
    if (!value) return;
    const [year, month, day] = value.split('-').map(Number);
    const localDate = new Date(year, month - 1, day);

    if (type === 'start') {
      setCustomRange(localDate, endDate);
    } else {
      setCustomRange(startDate, localDate);
    }
  };

  const periodLabels: Record<string, string> = {
    '7d': '7D',
    '15d': '15D', 
    '30d': '30D',
    'custom': 'Personalizado'
  };

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
      {/* Period Selector Pills */}
      <div className="inline-flex items-center gap-1 p-1 bg-surface/80 backdrop-blur-sm border border-border rounded-xl">
        {(['7d', '15d', '30d'] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`relative px-4 py-2 text-xs font-semibold rounded-lg transition-all duration-300 ${
              period === p
                ? 'bg-gradient-to-r from-emerald-500 to-emerald-400 text-white shadow-lg shadow-emerald-500/25'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            {periodLabels[p]}
          </button>
        ))}
        
        {/* Custom Period Button */}
        <button
          onClick={() => setPeriod('custom')}
          className={`relative flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all duration-300 ${
            period === 'custom'
              ? 'bg-gradient-to-r from-violet-500 to-violet-400 text-white shadow-lg shadow-violet-500/25'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <CalendarDays className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{periodLabels['custom']}</span>
        </button>
      </div>

      {/* Date Display / Custom Inputs */}
      <div className="flex items-center">
        {period === 'custom' ? (
          <div className="flex items-center gap-2 px-3 py-2 bg-surface/80 backdrop-blur-sm border border-border rounded-xl animate-in fade-in slide-in-from-left-2 duration-300">
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-violet-400" />
              <input
                type="date"
                value={format(startDate, 'yyyy-MM-dd')}
                onChange={(e) => handleCustomDateChange('start', e.target.value)}
                className="bg-transparent border-none px-2 py-1 text-xs font-medium text-text-primary focus:outline-none focus:ring-2 focus:ring-violet-500/30 rounded"
              />
            </div>
            <span className="text-slate-500 text-xs">até</span>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={format(endDate, 'yyyy-MM-dd')}
                onChange={(e) => handleCustomDateChange('end', e.target.value)}
                className="bg-transparent border-none px-2 py-1 text-xs font-medium text-text-primary focus:outline-none focus:ring-2 focus:ring-violet-500/30 rounded"
              />
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-4 py-2.5 bg-surface/80 backdrop-blur-sm border border-border rounded-xl">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-500/10">
              <CalendarIcon className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">Período selecionado</span>
              <span className="text-sm font-semibold text-text-primary">
                {format(startDate, 'dd/MM/yyyy')} <span className="text-slate-500 mx-1">→</span> {format(endDate, 'dd/MM/yyyy')}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DateRangeFilter;
