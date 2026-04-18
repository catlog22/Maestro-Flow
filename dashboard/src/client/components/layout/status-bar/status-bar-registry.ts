import type { ComponentType } from 'react';

// ---------------------------------------------------------------------------
// Status Bar Registry -- extensible status items with alignment & priority
// ---------------------------------------------------------------------------

export interface StatusBarItemRegistration {
  /** Unique item identifier */
  id: string;
  /** Which side of the status bar: left or right */
  alignment: 'left' | 'right';
  /** Higher priority = closer to edge */
  priority: number;
  /** The component to render */
  component: ComponentType;
  /** Optional visibility predicate */
  visible?: () => boolean;
  /** Tab to activate when this item is clicked (expands panel) */
  panelTabId?: string;
}

// Mutable registry -- items self-register on module import
const registry: StatusBarItemRegistration[] = [];

export function registerStatusBarItem(item: StatusBarItemRegistration): void {
  const existing = registry.findIndex((r) => r.id === item.id);
  if (existing >= 0) {
    registry[existing] = item;
  } else {
    registry.push(item);
  }
}

export function getStatusBarItems(): StatusBarItemRegistration[] {
  return [...registry];
}

export function getSortedItems(alignment: 'left' | 'right'): StatusBarItemRegistration[] {
  return registry
    .filter((item) => item.alignment === alignment)
    .filter((item) => (item.visible ? item.visible() : true))
    .sort((a, b) => b.priority - a.priority);
}
