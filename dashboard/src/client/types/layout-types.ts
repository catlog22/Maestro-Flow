import type { ComponentType } from 'react';

// ---------------------------------------------------------------------------
// Layout Type Definitions — VS Code-style layout system
// ---------------------------------------------------------------------------

// ---- Editor Group Tree (binary split model) ----

export interface TabSession {
  id: string;
  type: 'chat' | 'agent' | 'file' | 'workflow' | 'kanban' | 'settings';
  title: string;
  /** Opaque key linking the tab to its data source (agent id, file path, etc.) */
  ref: string;
  /** Whether this tab is a preview (single-click opened, replaced on next single-click) */
  preview?: boolean;
  /** Icon component override for the tab */
  icon?: ComponentType<{ size?: number; className?: string }>;
}

export interface EditorGroupLeaf {
  type: 'leaf';
  id: string;
  tabs: TabSession[];
  activeTabId: string | null;
}

export interface EditorGroupBranch {
  type: 'branch';
  id: string;
  direction: 'horizontal' | 'vertical';
  /** Split ratio 0-1, where first child gets `ratio` and second gets `1 - ratio` */
  ratio: number;
  first: EditorGroupNode;
  second: EditorGroupNode;
}

export type EditorGroupNode = EditorGroupLeaf | EditorGroupBranch;

// ---- Panel Registration ----

export interface PanelRegistration {
  /** Unique panel identifier (e.g. 'explorer', 'sessions') */
  id: string;
  /** Lucide icon component */
  icon: ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  /** Display label (used for tooltips and sidebar headers) */
  label: string;
  /** Lazy component factory — the panel component */
  component: () => Promise<{ default: ComponentType<Record<string, unknown>> }>;
  /** Optional badge counter function, returns null when no badge should show */
  badge?: () => number | null;
  /** Sort order within the side bar */
  order: number;
  /** Which side bar this panel belongs to */
  side: 'primary' | 'secondary';
  /** Whether the panel is visible by default */
  defaultVisible?: boolean;
}

// ---- Status Bar ----

export interface StatusBarItem {
  id: string;
  alignment: 'left' | 'right';
  priority: number;
  component: ComponentType;
  visible?: boolean;
}

// ---- Workspace Mode ----

export type WorkspaceMode = 'conversation' | 'files' | 'fusion';

// ---- Layout State ----

export interface SidebarState {
  visible: boolean;
  width: number;
  activePanelId: string | null;
}

export interface ActivityBarState {
  activePanelId: string | null;
}

export interface PanelState {
  visible: boolean;
  height: number;
  activeTabId: string | null;
  isMaximized: boolean;
}

/**
 * LayoutState — versioned schema for localStorage persistence.
 *
 * Migration pipeline:
 *   v1 — base: primarySidebar, editorArea, activityBar, panel
 *   v2 — adds: secondarySidebar
 *   v3 — adds: focusedGroupId
 *   v4 — adds: topBarSlotConfig (reserved for future)
 */
export interface LayoutState {
  version: number;
  primarySidebar: SidebarState;
  secondarySidebar: SidebarState;
  activityBar: ActivityBarState;
  editorArea: EditorGroupNode;
  panel: PanelState;
  focusedGroupId: string;
  workspaceMode: WorkspaceMode;
}

// ---- Layout Actions ----

export type LayoutAction =
  | { type: 'SET_SIDEBAR_VISIBLE'; side: 'primary' | 'secondary'; visible: boolean }
  | { type: 'SET_SIDEBAR_WIDTH'; side: 'primary' | 'secondary'; width: number }
  | { type: 'SET_ACTIVE_PANEL'; side: 'primary' | 'secondary'; panelId: string | null }
  | { type: 'MOVE_PANEL'; panelId: string; toSide: 'primary' | 'secondary' }
  | { type: 'SPLIT_GROUP'; groupId: string; direction: 'horizontal' | 'vertical' }
  | { type: 'CLOSE_GROUP'; groupId: string }
  | { type: 'RESIZE_GROUP'; branchId: string; ratio: number }
  | { type: 'SET_FOCUSED_GROUP'; groupId: string }
  | { type: 'SET_PANEL_VISIBLE'; visible: boolean }
  | { type: 'SET_PANEL_HEIGHT'; height: number }
  | { type: 'SET_PANEL_ACTIVE_TAB'; tabId: string | null }
  | { type: 'SET_PANEL_MAXIMIZED'; maximized: boolean }
  | { type: 'OPEN_TAB'; groupId: string; tab: TabSession }
  | { type: 'CLOSE_TAB'; groupId: string; tabId: string }
  | { type: 'SET_ACTIVE_TAB'; groupId: string; tabId: string | null }
  | { type: 'SET_WORKSPACE_MODE'; mode: WorkspaceMode }
  | { type: 'RESTORE_STATE'; state: LayoutState };

// ---- Event Bus ----

export interface LayoutEventMap {
  OPEN_FILE_IN_EDITOR: { filePath: string; groupId?: string; preview?: boolean };
  OPEN_SESSION_IN_SIDEBAR: { sessionId: string; agentType?: string };
  FILE_PREVIEW_REQUEST: { filePath: string };
  LAYOUT_CHANGED: { state: LayoutState };
}
