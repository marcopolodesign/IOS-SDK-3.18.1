import React, { createContext, useContext, useState, useCallback } from 'react';
import type { MetricKey } from '../data/metricExplanations';

interface MetricExplainerContextType {
  openExplainer: (key: MetricKey) => void;
  closeExplainer: () => void;
  activeKey: MetricKey | null;
  isOpen: boolean;
}

const MetricExplainerContext = createContext<MetricExplainerContextType>({
  openExplainer: () => {},
  closeExplainer: () => {},
  activeKey: null,
  isOpen: false,
});

export const useMetricExplainer = () => useContext(MetricExplainerContext);

export function MetricExplainerProvider({ children }: { children: React.ReactNode }) {
  const [activeKey, setActiveKey] = useState<MetricKey | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const openExplainer = useCallback((key: MetricKey) => {
    setActiveKey(key);
    setIsOpen(true);
  }, []);

  const closeExplainer = useCallback(() => {
    setIsOpen(false);
    // Delay clearing key so sheet can animate out before content disappears
    setTimeout(() => setActiveKey(null), 350);
  }, []);

  // Rendered inline like AddOverlayContext pattern — ExplainerSheet reads context via hook
  return (
    <MetricExplainerContext.Provider value={{ openExplainer, closeExplainer, activeKey, isOpen }}>
      {children}
      <SheetRenderer />
    </MetricExplainerContext.Provider>
  );
}

// Separate component so ExplainerSheet module import is deferred until first render,
// avoiding any circular module reference issue at bundle initialization time.
const SheetRenderer = React.memo(function SheetRenderer() {
  // We keep it mounted always (once first open happens) so spring-out animation plays
  const [everOpened, setEverOpened] = React.useState(false);
  const { isOpen } = useMetricExplainer();

  React.useEffect(() => {
    if (isOpen) setEverOpened(true);
  }, [isOpen]);

  if (!everOpened) return null;

  // Inline require avoids circular import at module init time
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const ExplainerSheet = require('../components/explainer/ExplainerSheet').default;
  return <ExplainerSheet />;
});
