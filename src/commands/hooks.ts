import type { Command } from 'commander';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { paths } from '../config/paths.js';

interface ClaudeSettings {
  hooks?: {
    PostToolUse?: Array<{ hooks: Array<{ type: string; command: string }> }>;
    [key: string]: unknown;
  };
  statusLine?: { type: string; command: string };
  [key: string]: unknown;
}

function getClaudeSettingsPath(): string {
  const claudeDir = process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude');
  return join(claudeDir, 'settings.json');
}

function loadClaudeSettings(settingsPath: string): ClaudeSettings {
  if (!existsSync(settingsPath)) return {};
  return JSON.parse(readFileSync(settingsPath, 'utf8'));
}

function getMaestroBinDir(): string {
  // Resolve from this module up to the bin directory
  return resolve(new URL('../../bin', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'));
}

const HOOK_MARKER = 'maestro-';

export function registerHooksCommand(program: Command): void {
  const hooks = program
    .command('hooks')
    .description('Manage Claude Code hooks for context monitoring');

  hooks
    .command('install')
    .description('Install maestro statusline and context-monitor hooks into Claude Code settings')
    .option('--global', 'Install to global ~/.claude/settings.json (default)')
    .option('--project', 'Install to project .claude/settings.json')
    .action((opts) => {
      const settingsPath = opts.project
        ? join(process.cwd(), '.claude', 'settings.json')
        : getClaudeSettingsPath();

      const settings = loadClaudeSettings(settingsPath);
      const binDir = getMaestroBinDir();

      const statuslineCmd = `node "${join(binDir, 'maestro-statusline.js')}"`;
      const monitorCmd = `node "${join(binDir, 'maestro-context-monitor.js')}"`;

      // --- Statusline ---
      settings.statusLine = {
        type: 'command',
        command: statuslineCmd,
      };

      // --- PostToolUse hook ---
      if (!settings.hooks) settings.hooks = {};
      if (!settings.hooks.PostToolUse) settings.hooks.PostToolUse = [];

      // Remove existing maestro hooks to avoid duplicates
      for (const group of settings.hooks.PostToolUse) {
        group.hooks = group.hooks.filter((h) => !h.command.includes(HOOK_MARKER));
      }
      // Remove empty groups
      settings.hooks.PostToolUse = settings.hooks.PostToolUse.filter(
        (g) => g.hooks.length > 0
      );

      // Add new
      settings.hooks.PostToolUse.push({
        hooks: [{ type: 'command', command: monitorCmd }],
      });

      // Ensure parent directory exists
      const settingsDir = join(settingsPath, '..');
      paths.ensure(settingsDir);
      writeFileSync(settingsPath, JSON.stringify(settings, null, 2));

      console.log('Maestro hooks installed:');
      console.log(`  Statusline:       ${statuslineCmd}`);
      console.log(`  Context monitor:  ${monitorCmd}`);
      console.log(`  Settings file:    ${settingsPath}`);
    });

  hooks
    .command('uninstall')
    .description('Remove maestro hooks from Claude Code settings')
    .option('--global', 'Uninstall from global ~/.claude/settings.json (default)')
    .option('--project', 'Uninstall from project .claude/settings.json')
    .action((opts) => {
      const settingsPath = opts.project
        ? join(process.cwd(), '.claude', 'settings.json')
        : getClaudeSettingsPath();

      if (!existsSync(settingsPath)) {
        console.log('No settings file found — nothing to uninstall.');
        return;
      }

      const settings = loadClaudeSettings(settingsPath);

      // Remove statusline if it's ours
      if (settings.statusLine?.command?.includes(HOOK_MARKER)) {
        delete settings.statusLine;
      }

      // Remove PostToolUse hooks
      if (settings.hooks?.PostToolUse) {
        for (const group of settings.hooks.PostToolUse) {
          group.hooks = group.hooks.filter((h) => !h.command.includes(HOOK_MARKER));
        }
        settings.hooks.PostToolUse = settings.hooks.PostToolUse.filter(
          (g) => g.hooks.length > 0
        );
        if (settings.hooks.PostToolUse.length === 0) {
          delete settings.hooks.PostToolUse;
        }
        if (Object.keys(settings.hooks).length === 0) {
          delete settings.hooks;
        }
      }

      writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
      console.log(`Maestro hooks removed from ${settingsPath}`);
    });

  hooks
    .command('status')
    .description('Show current hook installation status')
    .action(() => {
      const globalPath = getClaudeSettingsPath();
      const projectPath = join(process.cwd(), '.claude', 'settings.json');

      for (const [label, p] of [['Global', globalPath], ['Project', projectPath]] as const) {
        if (!existsSync(p)) {
          console.log(`${label}: no settings file`);
          continue;
        }
        const s = loadClaudeSettings(p);
        const hasStatusline = s.statusLine?.command?.includes(HOOK_MARKER) || false;
        const hasMonitor = s.hooks?.PostToolUse?.some(
          (g) => g.hooks.some((h) => h.command.includes(HOOK_MARKER))
        ) || false;

        console.log(`${label} (${p}):`);
        console.log(`  Statusline:      ${hasStatusline ? 'installed' : 'not installed'}`);
        console.log(`  Context monitor: ${hasMonitor ? 'installed' : 'not installed'}`);
      }
    });
}
