// ---------------------------------------------------------------------------
// Types for the install wizard TUI (CyberdeckBlueprint)
// ---------------------------------------------------------------------------

export type WizardStep = 'mode' | 'components' | 'config' | 'review' | 'executing' | 'complete';

export const WIZARD_STEPS: readonly WizardStep[] = [
  'mode',
  'components',
  'config',
  'review',
  'executing',
  'complete',
];

export interface InstallConfig {
  mode: 'global' | 'project';
  projectPath: string;
  selectedIds: string[];
  mcpEnabled: boolean;
  mcpTools: string[];
  mcpProjectRoot: string;
  hookLevel: 'none' | 'minimal' | 'standard' | 'full';
  doBackup: boolean;
}

export const DEFAULT_INSTALL_CONFIG: InstallConfig = {
  mode: 'global',
  projectPath: '',
  selectedIds: [],
  mcpEnabled: true,
  mcpTools: [],
  mcpProjectRoot: '',
  hookLevel: 'none',
  doBackup: false,
};

// ---------------------------------------------------------------------------
// Execution result (produced by ExecutionView, consumed by ResultDashboard)
// ---------------------------------------------------------------------------

export interface InstallResult {
  totalStats: { files: number; dirs: number; skipped: number };
  manifestPath: string;
  mcpRegistered: boolean;
  hookResult: { installedHooks: string[]; level: string } | null;
  disabledRestored: number;
  overlaysApplied: number;
}
