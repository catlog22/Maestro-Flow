// ---------------------------------------------------------------------------
// Panel Component Declarations — stub type declarations for lazy-loaded panels
// ---------------------------------------------------------------------------
// These panels will be implemented in subsequent tasks (IMPL-003, IMPL-006, etc.)
// The declarations allow the panel-registry to compile while panels are developed.
// ---------------------------------------------------------------------------

declare module '@/client/components/panels/ExplorerPanel.js' {
  export const ExplorerPanel: React.ComponentType<Record<string, unknown>>;
}
// SessionsPanel is implemented in components/panels/SessionsPanel.tsx
declare module '@/client/components/panels/KanbanPanel.js' {
  export const KanbanPanel: React.ComponentType<Record<string, unknown>>;
}
declare module '@/client/components/panels/WorkflowPanel.js' {
  export const WorkflowPanel: React.ComponentType<Record<string, unknown>>;
}
declare module '@/client/components/panels/SearchPanel.js' {
  export const SearchPanel: React.ComponentType<Record<string, unknown>>;
}
declare module '@/client/components/panels/MorePanel.js' {
  export const MorePanel: React.ComponentType<Record<string, unknown>>;
}
declare module '@/client/components/settings/SettingsPanel.js' {
  export const SettingsPanel: React.ComponentType<Record<string, unknown>>;
}
declare module '@/client/components/panels/SpecsPanel.js' {
  export const SpecsPanel: React.ComponentType<Record<string, unknown>>;
}
declare module '@/client/components/panels/McpPanel.js' {
  export const McpPanel: React.ComponentType<Record<string, unknown>>;
}
declare module '@/client/components/panels/TeamsPanel.js' {
  export const TeamsPanel: React.ComponentType<Record<string, unknown>>;
}

declare module '@/client/components/layout/sidebar/panels/FilePreviewPanel.js' {
  export const FilePreviewPanel: React.ComponentType<Record<string, unknown>>;
}

declare module '@/client/components/layout/sidebar/panels/PropertiesPanel.js' {
  export const PropertiesPanel: React.ComponentType<Record<string, unknown>>;
}

declare module '@/client/components/layout/sidebar/panels/OutlinePanel.js' {
  export const OutlinePanel: React.ComponentType<Record<string, unknown>>;
}

declare module '@/client/components/layout/sidebar/panels/TimelinePanel.js' {
  export const TimelinePanel: React.ComponentType<Record<string, unknown>>;
}
