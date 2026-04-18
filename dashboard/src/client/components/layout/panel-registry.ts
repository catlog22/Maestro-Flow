import type { PanelRegistration } from '@/client/types/layout-types.js';
import {
  FolderSearch,
  MessageSquare,
  LayoutGrid,
  GitBranch,
  Search,
  MoreHorizontal,
  Settings,
  FileText,
  Plug,
  Users,
  Eye,
  List,
  AlignLeft,
  Clock,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Panel Registry — declarative side bar panel definitions
// ---------------------------------------------------------------------------
// Panels are lazy-loaded via dynamic import. The registry is a static array
// consumed by ActivityBar and PrimarySideBar components.
// ---------------------------------------------------------------------------

/**
 * All registered side bar panels.
 *
 * Primary side bar (7 top-level):
 *   Explorer, Sessions, Kanban, Workflow, Search, More, Settings
 *
 * Secondary side bar (3, accessible via "More" panel):
 *   Specs, MCP, Teams
 */
export const panelRegistry: PanelRegistration[] = [
  // ---- Primary side bar panels (order: 10-60) ----
  {
    id: 'explorer',
    icon: FolderSearch,
    label: 'Explorer',
    component: () => import('@/client/components/panels/ExplorerPanel.js').then((m) => ({ default: m.ExplorerPanel })),
    order: 10,
    side: 'primary',
    defaultVisible: true,
  },
  {
    id: 'sessions',
    icon: MessageSquare,
    label: 'Sessions',
    component: () => import('@/client/components/panels/SessionsPanel.js').then((m) => ({ default: m.SessionsPanel })),
    order: 20,
    side: 'primary',
  },
  {
    id: 'kanban',
    icon: LayoutGrid,
    label: 'Kanban',
    component: () => import('@/client/components/panels/KanbanPanel.js').then((m) => ({ default: m.KanbanPanel })),
    order: 30,
    side: 'primary',
  },
  {
    id: 'workflow',
    icon: GitBranch,
    label: 'Workflow',
    component: () => import('@/client/components/panels/WorkflowPanel.js').then((m) => ({ default: m.WorkflowPanel })),
    order: 40,
    side: 'primary',
  },
  {
    id: 'search',
    icon: Search,
    label: 'Search',
    component: () => import('@/client/components/panels/SearchPanel.js').then((m) => ({ default: m.SearchPanel })),
    order: 50,
    side: 'primary',
  },
  {
    id: 'more',
    icon: MoreHorizontal,
    label: 'More',
    component: () => import('@/client/components/panels/MorePanel.js').then((m) => ({ default: m.MorePanel })),
    order: 60,
    side: 'primary',
  },
  {
    id: 'settings',
    icon: Settings,
    label: 'Settings',
    component: () => import('@/client/components/settings/SettingsPanel.js').then((m) => ({ default: m.SettingsPanel })),
    order: 70,
    side: 'primary',
  },

  // ---- Secondary side bar panels (order: 110-130) ----
  {
    id: 'specs',
    icon: FileText,
    label: 'Specs',
    component: () => import('@/client/components/panels/SpecsPanel.js').then((m) => ({ default: m.SpecsPanel })),
    order: 110,
    side: 'secondary',
  },
  {
    id: 'mcp',
    icon: Plug,
    label: 'MCP',
    component: () => import('@/client/components/panels/McpPanel.js').then((m) => ({ default: m.McpPanel })),
    order: 120,
    side: 'secondary',
  },
  {
    id: 'teams',
    icon: Users,
    label: 'Teams',
    component: () => import('@/client/components/panels/TeamsPanel.js').then((m) => ({ default: m.TeamsPanel })),
    order: 130,
    side: 'secondary',
  },

  // ---- Secondary side bar panels: dual-sidebar (order: 140-170) ----
  {
    id: 'file-preview',
    icon: Eye,
    label: 'Preview',
    component: () => import('@/client/components/layout/sidebar/panels/FilePreviewPanel.js').then((m) => ({ default: m.FilePreviewPanel })),
    order: 140,
    side: 'secondary',
    defaultVisible: true,
  },
  {
    id: 'properties',
    icon: List,
    label: 'Properties',
    component: () => import('@/client/components/layout/sidebar/panels/PropertiesPanel.js').then((m) => ({ default: m.PropertiesPanel })),
    order: 150,
    side: 'secondary',
  },
  {
    id: 'outline',
    icon: AlignLeft,
    label: 'Outline',
    component: () => import('@/client/components/layout/sidebar/panels/OutlinePanel.js').then((m) => ({ default: m.OutlinePanel })),
    order: 160,
    side: 'secondary',
  },
  {
    id: 'timeline',
    icon: Clock,
    label: 'Timeline',
    component: () => import('@/client/components/layout/sidebar/panels/TimelinePanel.js').then((m) => ({ default: m.TimelinePanel })),
    order: 170,
    side: 'secondary',
  },
];

/** Get panels for a specific side, sorted by order */
export function getPanelsBySide(side: 'primary' | 'secondary'): PanelRegistration[] {
  return panelRegistry
    .filter((p) => p.side === side)
    .sort((a, b) => a.order - b.order);
}

/** Get a panel by its id */
export function getPanelById(id: string): PanelRegistration | undefined {
  return panelRegistry.find((p) => p.id === id);
}

/** Move a panel to the other side bar (panel mobility) */
export function movePanelSide(panelId: string, toSide: 'primary' | 'secondary'): boolean {
  const panel = panelRegistry.find((p) => p.id === panelId);
  if (!panel || panel.side === toSide) return false;
  panel.side = toSide;
  return true;
}
