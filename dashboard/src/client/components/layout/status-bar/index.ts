// Status Bar components
export { StatusBar } from './StatusBar.js';
export { StatusBarItem } from './StatusBarItem.js';
export { PanelArea } from './PanelArea.js';

// Registry
export { registerStatusBarItem, getStatusBarItems, getSortedItems } from './status-bar-registry.js';
export type { StatusBarItemRegistration } from './status-bar-registry.js';

// Default items (import for side effects to register items)
import './default-status-items.js';
