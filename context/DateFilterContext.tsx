import React, { createContext, useContext, useState, ReactNode } from 'react';
import { subDays, startOfDay, endOfDay } from 'date-fns';

type PeriodType = '7d' | '15d' | '30d' | 'custom';

interface DateFilterContextType {
  startDate: Date;
  endDate: Date;
  period: PeriodType;
  setPeriod: (period: PeriodType) => void;
  setCustomRange: (start: Date, end: Date) => void;
}

const DateFilterContext = createContext<DateFilterContextType | undefined>(undefined);

export const DateFilterProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Padrão: Últimos 7 dias
  const [period, setPeriodState] = useState<PeriodType>('7d');
  const [startDate, setStartDate] = useState<Date>(startOfDay(subDays(new Date(), 7)));
  const [endDate, setEndDate] = useState<Date>(endOfDay(new Date()));

  const setPeriod = (newPeriod: PeriodType) => {
    setPeriodState(newPeriod);
    const end = endOfDay(new Date());
    let start = startOfDay(new Date());

    switch (newPeriod) {
      case '7d':
        start = startOfDay(subDays(new Date(), 7));
        break;
      case '15d':
        start = startOfDay(subDays(new Date(), 15));
        break;
      case '30d':
        start = startOfDay(subDays(new Date(), 30));
        break;
      case 'custom':
        // Mantém as datas atuais se mudar para custom, o usuário ajusta depois
        return; 
    }
    setStartDate(start);
    setEndDate(end);
  };

  const setCustomRange = (start: Date, end: Date) => {
    setPeriodState('custom');
    setStartDate(startOfDay(start));
    setEndDate(endOfDay(end));
  };

  return (
    <DateFilterContext.Provider value={{ startDate, endDate, period, setPeriod, setCustomRange }}>
      {children}
    </DateFilterContext.Provider>
  );
};

export const useDateFilter = () => {
  const context = useContext(DateFilterContext);
  if (!context) {
    throw new Error('useDateFilter must be used within a DateFilterProvider');
  }
  return context;
};