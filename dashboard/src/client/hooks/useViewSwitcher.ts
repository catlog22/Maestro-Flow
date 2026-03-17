import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

// ---------------------------------------------------------------------------
// ViewSwitcher context — pages register their view configs, TopBar renders them
// ---------------------------------------------------------------------------

export interface ViewSwitcherItem {
  label: string;
  icon: ReactNode;
  shortcut: string;
}

export interface ViewSwitcherConfig {
  items: ViewSwitcherItem[];
  activeIndex: number;
  onSwitch: (index: number) => void;
}

interface ViewSwitcherContextValue {
  config: ViewSwitcherConfig | null;
  register: (config: ViewSwitcherConfig) => void;
  unregister: () => void;
}

const ViewSwitcherContext = createContext<ViewSwitcherContextValue>({
  config: null,
  register: () => {},
  unregister: () => {},
});

export function useViewSwitcherProvider(): ViewSwitcherContextValue {
  const [config, setConfig] = useState<ViewSwitcherConfig | null>(null);
  const register = useCallback((c: ViewSwitcherConfig) => setConfig(c), []);
  const unregister = useCallback(() => setConfig(null), []);
  return { config, register, unregister };
}

export { ViewSwitcherContext };

export function useRegisterViewSwitcher(config: ViewSwitcherConfig) {
  const ctx = useContext(ViewSwitcherContext);
  // Registration is done via useEffect in the calling component
  return ctx;
}

export function useViewSwitcherConfig(): ViewSwitcherConfig | null {
  return useContext(ViewSwitcherContext).config;
}
