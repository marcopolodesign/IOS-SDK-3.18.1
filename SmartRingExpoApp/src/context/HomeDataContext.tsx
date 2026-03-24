import React, { createContext, useContext, ReactNode } from 'react';
import { useHomeData, HomeData } from '../hooks/useHomeData';
import { useOnboarding } from './OnboardingContext';

interface HomeDataContextValue extends HomeData {
  refresh: () => Promise<void>;
}

const HomeDataContext = createContext<HomeDataContextValue | null>(null);

interface HomeDataProviderProps {
  children: ReactNode;
}

export function HomeDataProvider({ children }: HomeDataProviderProps) {
  const { isAuthenticated, hasConnectedDevice } = useOnboarding();
  const homeData = useHomeData(isAuthenticated && hasConnectedDevice);

  return (
    <HomeDataContext.Provider value={homeData}>
      {children}
    </HomeDataContext.Provider>
  );
}

export function useHomeDataContext(): HomeDataContextValue {
  const context = useContext(HomeDataContext);
  if (!context) {
    throw new Error('useHomeDataContext must be used within a HomeDataProvider');
  }
  return context;
}

export default HomeDataContext;
