import React, { createContext, useContext, ReactNode } from 'react';
import { useFocusData } from '../hooks/useFocusData';
import type { FocusState } from '../types/focus.types';

const FocusDataContext = createContext<FocusState | null>(null);

export function FocusDataProvider({ children }: { children: ReactNode }) {
  const focusData = useFocusData();
  return (
    <FocusDataContext.Provider value={focusData}>
      {children}
    </FocusDataContext.Provider>
  );
}

export function useFocusDataContext(): FocusState {
  const context = useContext(FocusDataContext);
  if (!context) throw new Error('useFocusDataContext must be used within a FocusDataProvider');
  return context;
}
