// ---------------------------------------------------------------------------
// Component Definitions — single source of truth for CLI and Dashboard.
//
// Both `maestro install` (CLI) and the Dashboard wizard import from here.
// ---------------------------------------------------------------------------

import { join } from 'node:path';
import { homedir } from 'node:os';
import { paths } from '../config/paths.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ComponentDef {
  id: string;
  label: string;
  description: string;
  sourcePath: string;
  /** Resolve target path based on mode and project path */
  target: (mode: 'global' | 'project', projectPath: string) => string;
  /** Always installs to global location regardless of mode */
  alwaysGlobal: boolean;
  /** Use tag injection instead of file copy (for doc files like CLAUDE.md) */
  inject?: boolean;
  /** Section name for tag injection (default: "core") */
  section?: string;
}

// ---------------------------------------------------------------------------
// Definitions
// ---------------------------------------------------------------------------

export const COMPONENT_DEFS: ComponentDef[] = [
  {
    id: 'workflows',
    label: 'Workflows',
    description: 'Workflow definitions (~/.maestro/workflows/)',
    sourcePath: 'workflows',
    target: () => join(paths.home, 'workflows'),
    alwaysGlobal: true,
  },
  {
    id: 'templates',
    label: 'Templates',
    description: 'Prompt & task templates (~/.maestro/templates/)',
    sourcePath: 'templates',
    target: () => join(paths.home, 'templates'),
    alwaysGlobal: true,
  },
  {
    id: 'chains',
    label: 'Chains',
    description: 'Coordinate chain graphs (~/.maestro/chains/)',
    sourcePath: 'chains',
    target: () => join(paths.home, 'chains'),
    alwaysGlobal: true,
  },
  {
    id: 'overlays',
    label: 'Overlays',
    description: 'Command overlay packs (~/.maestro/overlays/_shipped/)',
    sourcePath: join('overlays', '_shipped'),
    target: () => join(paths.home, 'overlays', '_shipped'),
    alwaysGlobal: true,
  },
  {
    id: 'commands',
    label: 'Commands',
    description: 'Claude Code slash commands',
    sourcePath: join('.claude', 'commands'),
    target: (mode, projectPath) =>
      mode === 'global'
        ? join(homedir(), '.claude', 'commands')
        : join(projectPath, '.claude', 'commands'),
    alwaysGlobal: false,
  },
  {
    id: 'agents',
    label: 'Agents',
    description: 'Agent definitions',
    sourcePath: join('.claude', 'agents'),
    target: (mode, projectPath) =>
      mode === 'global'
        ? join(homedir(), '.claude', 'agents')
        : join(projectPath, '.claude', 'agents'),
    alwaysGlobal: false,
  },
  {
    id: 'skills',
    label: 'Skills',
    description: 'Claude Code skills',
    sourcePath: join('.claude', 'skills'),
    target: (mode, projectPath) =>
      mode === 'global'
        ? join(homedir(), '.claude', 'skills')
        : join(projectPath, '.claude', 'skills'),
    alwaysGlobal: false,
  },
  {
    id: 'claude-md',
    label: 'CLAUDE.md',
    description: 'Project instructions file',
    sourcePath: join('workflows', 'claude-instructions.md'),
    target: (mode, projectPath) =>
      mode === 'global'
        ? join(homedir(), '.claude', 'CLAUDE.md')
        : join(projectPath, '.claude', 'CLAUDE.md'),
    alwaysGlobal: false,
    inject: true,
  },
  {
    id: 'codex-agents-md',
    label: 'Codex AGENTS.md',
    description: 'Codex project instructions file',
    sourcePath: join('workflows', 'codex-instructions.md'),
    target: (mode, projectPath) =>
      mode === 'global'
        ? join(homedir(), '.codex', 'AGENTS.md')
        : join(projectPath, '.codex', 'AGENTS.md'),
    alwaysGlobal: false,
    inject: true,
  },
  {
    id: 'claude-md-chinese',
    label: 'Chinese Response (Claude)',
    description: 'Chinese response guidelines → CLAUDE.md',
    sourcePath: join('workflows', 'chinese-response.md'),
    target: (mode, projectPath) =>
      mode === 'global'
        ? join(homedir(), '.claude', 'CLAUDE.md')
        : join(projectPath, '.claude', 'CLAUDE.md'),
    alwaysGlobal: false,
    inject: true,
    section: 'chinese',
  },
  {
    id: 'codex-md-chinese',
    label: 'Chinese Response (Codex)',
    description: 'Chinese response guidelines → AGENTS.md',
    sourcePath: join('workflows', 'chinese-response.md'),
    target: (mode, projectPath) =>
      mode === 'global'
        ? join(homedir(), '.codex', 'AGENTS.md')
        : join(projectPath, '.codex', 'AGENTS.md'),
    alwaysGlobal: false,
    inject: true,
    section: 'chinese',
  },
  {
    id: 'codex-agents',
    label: 'Codex Agents',
    description: 'Codex agent definitions',
    sourcePath: join('.codex', 'agents'),
    target: (mode, projectPath) =>
      mode === 'global'
        ? join(homedir(), '.codex', 'agents')
        : join(projectPath, '.codex', 'agents'),
    alwaysGlobal: false,
  },
  {
    id: 'codex-skills',
    label: 'Codex Skills',
    description: 'Codex skill definitions',
    sourcePath: join('.codex', 'skills'),
    target: (mode, projectPath) =>
      mode === 'global'
        ? join(homedir(), '.codex', 'skills')
        : join(projectPath, '.codex', 'skills'),
    alwaysGlobal: false,
  },
];
