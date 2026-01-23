import React from 'react';
import { useDateFilter } from '../../context/DateFilterContext';
import { Calendar as CalendarIcon, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';

export const DateRangeFilter: React.FC = () => {
  const { period, setPeriod, startDate, endDate, setCustomRange } = useDateFilter();

  const handleCustomDateChange = (type: 'start' | 'end', value: string) => {
    if (!value) return;
    const date = new Date(value);
    // Ajusta o fuso horário local simples adicionando horas para compensar conversão UTC se necessário, 
    // mas para input type="date", o new Date(string) geralmente pega UTC 0h.
    // Vamos garantir que pegamos o dia correto.
    const [year, month, day] = value.split('-').map(Number);
    const localDate = new Date(year, month - 1, day);

    if (type === 'start') {
      setCustomRange(localDate, endDate);
    } else {
      setCustomRange(startDate, localDate);
    }
  };

  return (
    <div className="flex flex-col sm:flex-row items-center gap-2 bg-slate-900/50 p-1.5 rounded-lg border border-slate-800">
      <div className="flex bg-slate-800 rounded-md p-1">
        {(['7d', '15d', '30d'] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              period === p
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'
            }`}
          >
            {p === '7d' ? '7 Dias' : p === '15d' ? '15 Dias' : '30 Dias'}
          </button>
        ))}
        <button
            onClick={() => setPeriod('custom')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              period === 'custom'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'
            }`}
          >
            Personalizar
          </button>
      </div>

      {period === 'custom' ? (
        <div className="flex items-center gap-2 px-2 animate-in fade-in slide-in-from-left-2 duration-300">
          <input
            type="date"
            value={format(startDate, 'yyyy-MM-dd')}
            onChange={(e) => handleCustomDateChange('start', e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 focus:border-blue-500 outline-none"
          />
          <span className="text-slate-500 text-xs">até</span>
          <input
            type="date"
            value={format(endDate, 'yyyy-MM-dd')}
            onChange={(e) => handleCustomDateChange('end', e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 focus:border-blue-500 outline-none"
          />
        </div>
      ) : (
        <div className="flex items-center gap-2 px-3 py-1 text-xs text-slate-400 border-l border-slate-700/50 ml-1">
           <CalendarIcon className="w-3.5 h-3.5" />
           <span>{format(startDate, 'dd/MM')} - {format(endDate, 'dd/MM')}</span>
        </div>
      )}
    </div>
  );
};