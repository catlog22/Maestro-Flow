import { createContext, useContext } from 'react';
import type { I18nState } from './types.js';

// ---------------------------------------------------------------------------
// I18n Context - provides locale state and translation function
// ---------------------------------------------------------------------------

export const I18nContext = createContext<I18nState | null>(null);

/**
 * Hook to access i18n context
 * @throws {Error} if used outside I18nProvider
 */
export function useI18nContext(): I18nState {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18nContext must be used within I18nProvider');
  }
  return context;
}
