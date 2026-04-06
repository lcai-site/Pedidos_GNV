import React, { createContext, useContext, useState, useMemo, useCallback, ReactNode } from 'react';
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
  const [period, setPeriodState] = useState<PeriodType>('7d');
  const [startDate, setStartDate] = useState<Date>(startOfDay(subDays(new Date(), 7)));
  const [endDate, setEndDate] = useState<Date>(endOfDay(new Date()));

  const setPeriod = useCallback((newPeriod: PeriodType) => {
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
        return;
    }
    setStartDate(start);
    setEndDate(end);
  }, []);

  const setCustomRange = useCallback((start: Date, end: Date) => {
    setPeriodState('custom');
    setStartDate(startOfDay(start));
    setEndDate(endOfDay(end));
  }, []);

  const value = useMemo(() => ({
    startDate,
    endDate,
    period,
    setPeriod,
    setCustomRange,
  }), [startDate, endDate, period, setPeriod, setCustomRange]);

  return (
    <DateFilterContext.Provider value={value}>
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